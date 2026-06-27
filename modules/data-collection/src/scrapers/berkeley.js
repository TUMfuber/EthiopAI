import XLSX from "xlsx";
import initSqlJs from "sql.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const DB_PATH = join(OUTPUT_DIR, "berkeley.db");
const BERKELEY_URL = "https://gspp.berkeley.edu/assets/uploads/page/Voluntary-Registry-Offsets-Database--v2026-04.xlsx";

export async function fetchBerkeleyProjects() {
  console.log("  Berkeley DB: downloading Excel...");
  const res = await fetch(BERKELEY_URL);
  if (!res.ok) throw new Error(`Berkeley download failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });

  const sheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes("project")) || workbook.SheetNames[1];
  const sheet = workbook.Sheets[sheetName];

  // The sheet has metadata rows before actual headers - find the header row
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // raw arrays
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = (allRows[i] || []).map((c) => String(c).toLowerCase());
    if (row.some((c) => c.includes("project id") || c.includes("project name"))) {
      headerIdx = i;
      break;
    }
  }

  console.log(`  Berkeley DB: header row at index ${headerIdx}`);
  const headers = allRows[headerIdx].map((h) => String(h).trim());
  const dataRows = allRows.slice(headerIdx + 1);

  // Convert to objects using discovered headers
  const rows = dataRows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v !== ""));

  console.log(`  Berkeley DB: ${rows.length} data rows from "${sheetName}", headers: ${headers.slice(0, 5).join(", ")}...`);

  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`CREATE TABLE projects (
    project_id TEXT, project_name TEXT, registry TEXT, status TEXT,
    scope_type TEXT, methodology TEXT, region TEXT, country TEXT,
    project_site_location TEXT, project_developer TEXT,
    total_credits_issued REAL, total_credits_retired REAL,
    total_credits_remaining REAL, estimated_annual_reductions REAL,
    project_url TEXT, project_description TEXT
  )`);

  const stmt = db.prepare(`INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  // Log first row keys to debug column names
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    const countryCol = keys.find((k) => k.toLowerCase().includes("country"));
    const typeCol = keys.find((k) => k.toLowerCase().includes("scope") || k.toLowerCase().includes("type"));
    console.log(`  Berkeley DB: Country column = "${countryCol}", Type column = "${typeCol}"`);
  }
  for (const r of rows) {
    // Find the right column regardless of exact name
    const country = Object.entries(r).find(([k]) => k.toLowerCase().includes("country"))?.[1] || "";
    const scopeType = Object.entries(r).find(([k]) => k.toLowerCase().includes("scope") || (k.toLowerCase().includes("type") && !k.toLowerCase().includes("project type from")))?.[1] || "";
    const projectName = Object.entries(r).find(([k]) => k.toLowerCase().includes("project name"))?.[1] || "";
    const registry = Object.entries(r).find(([k]) => k.toLowerCase().includes("registry") && !k.toLowerCase().includes("from"))?.[1] || "";
    const status = Object.entries(r).find(([k]) => k.toLowerCase().includes("voluntary status") || k.toLowerCase() === "status")?.[1] || "";
    const methodology = Object.entries(r).find(([k]) => k.toLowerCase().includes("methodology") || k.toLowerCase().includes("protocol"))?.[1] || "";
    const region = Object.entries(r).find(([k]) => k.toLowerCase() === "region")?.[1] || "";
    const location = Object.entries(r).find(([k]) => k.toLowerCase().includes("project site"))?.[1] || "";
    const developer = Object.entries(r).find(([k]) => k.toLowerCase().includes("developer"))?.[1] || "";
    const creditsIssued = Object.entries(r).find(([k]) => k.toLowerCase().includes("credits") && k.toLowerCase().includes("issued"))?.[1] || 0;
    const creditsRetired = Object.entries(r).find(([k]) => k.toLowerCase().includes("credits") && k.toLowerCase().includes("retired"))?.[1] || 0;
    const creditsRemaining = Object.entries(r).find(([k]) => k.toLowerCase().includes("remaining"))?.[1] || 0;
    const annualReductions = Object.entries(r).find(([k]) => k.toLowerCase().includes("estimated annual"))?.[1] || 0;
    const projectUrl = Object.entries(r).find(([k]) => k.toLowerCase().includes("website"))?.[1] || "";
    const description = Object.entries(r).find(([k]) => k.toLowerCase().includes("description"))?.[1] || "";
    const projectId = Object.entries(r).find(([k]) => k.toLowerCase().includes("project id"))?.[1] || "";

    stmt.run([
      String(projectId),
      String(projectName),
      String(registry),
      String(status),
      String(scopeType),
      String(methodology),
      String(region),
      String(country),
      String(location),
      String(developer),
      parseFloat(creditsIssued) || 0,
      parseFloat(creditsRetired) || 0,
      parseFloat(creditsRemaining) || 0,
      parseFloat(annualReductions) || 0,
      String(projectUrl),
      String(description),
    ]);
  }
  stmt.free();

  // Save DB file
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(DB_PATH, Buffer.from(db.export()));
  console.log(`  Berkeley DB: SQLite saved to output/berkeley.db`);

  const results = db.exec(`
    SELECT * FROM projects
    WHERE country LIKE '%Ethiopia%'
    AND (
      scope_type LIKE '%Afforestation%'
      OR scope_type LIKE '%Reforestation%'
      OR scope_type LIKE '%REDD%'
      OR scope_type LIKE '%Jurisdictional%'
      OR scope_type LIKE '%Sustainable Agriculture%'
      OR scope_type LIKE '%Wetland%'
    )
  `);
  db.close();

  if (!results.length || !results[0].values.length) {
    console.log(`  Berkeley DB: 0 matching projects`);
    return [];
  }

  const cols = results[0].columns;
  const mapped = results[0].values.map((row) => {
    const r = {};
    cols.forEach((c, i) => (r[c] = row[i]));
    return {
      id: `berkeley-${r.project_id}`,
      name: r.project_name,
      lat: null,
      lng: null,
      type: r.scope_type,
      description: r.project_description,
      organization: r.project_developer,
      status: r.status,
      registry: r.registry || "Berkeley_DB",
      registryId: r.project_id,
      methodology: r.methodology,
      creditsIssued: r.total_credits_issued,
      creditsRetired: r.total_credits_retired,
      creditsRemaining: r.total_credits_remaining,
      annualReductions: r.estimated_annual_reductions,
      creditingPeriodStart: "",
      creditingPeriodEnd: "",
      sdgContributions: [],
      projectUrl: r.project_url,
      location: r.project_site_location,
      source: "berkeley-db",
    };
  });

  console.log(`  Berkeley DB: ${mapped.length} Ethiopia projects found`);
  return mapped;
}
