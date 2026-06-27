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
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Berkeley DB: ${rows.length} rows from "${sheetName}"`);

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
  for (const r of rows) {
    stmt.run([
      r["Project ID"] || "",
      r["Project Name"] || "",
      r["Voluntary Registry"] || "",
      r["Voluntary Status"] || "",
      r["Scope Type"] || "",
      r["Methodology / Protocol"] || "",
      r["Region"] || "",
      r["Country"] || "",
      r["Project Site Location"] || "",
      r["Project Developer"] || "",
      parseFloat(r["Total Credits \nIssued"] || r["Total Credits Issued"] || 0) || 0,
      parseFloat(r["Total Credits \nRetired"] || r["Total Credits Retired"] || 0) || 0,
      parseFloat(r["Total Credits Remaining"] || 0) || 0,
      parseFloat(r["Estimated Annual Emission Reductions"] || 0) || 0,
      r["Project Website"] || "",
      r["Project Description"] || "",
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
