import XLSX from "xlsx";
import initSqlJs from "sql.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { writeFileSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "..", "output");
const DB_PATH = join(OUTPUT_DIR, "berkeley.db");
const BERKELEY_URL = "https://gspp.berkeley.edu/assets/uploads/page/Voluntary-Registry-Offsets-Database--v2026-04.xlsx";

// Header row is at index 3, data starts at index 4
const HEADER_ROW = 3;

// Column indices (0-based) from the PROJECTS tab
const COL = {
  PROJECT_ID: 0,
  PROJECT_NAME: 1,
  REGISTRY: 2,
  STATUS: 4,
  SCOPE: 5,
  TYPE: 6,
  REDUCTION_REMOVAL: 7,
  METHODOLOGY: 8,
  REGION: 10,
  COUNTRY: 11,
  STATE: 12,
  LOCATION: 13,
  DEVELOPER: 14,
  CREDITS_ISSUED: 15,
  CREDITS_RETIRED: 16,
  CREDITS_REMAINING: 17,
  ANNUAL_REDUCTIONS: 120, // "Estimated Annual Emission Reductions"
  PROJECT_URL: 132, // "Project Website"
  DESCRIPTION: 164, // "Project Description"
};

export async function fetchBerkeleyProjects() {
  console.log("  Berkeley DB: downloading Excel...");
  const res = await fetch(BERKELEY_URL);
  if (!res.ok) throw new Error(`Berkeley download failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });
  const sheet = workbook.Sheets["PROJECTS"];
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Data rows start after header (row 3)
  const dataRows = allRows.slice(HEADER_ROW + 1);
  console.log(`  Berkeley DB: ${dataRows.length} project rows`);

  // Load into SQLite
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`CREATE TABLE projects (
    project_id TEXT, project_name TEXT, registry TEXT, status TEXT,
    scope TEXT, type TEXT, methodology TEXT, region TEXT, country TEXT,
    location TEXT, developer TEXT,
    credits_issued REAL, credits_retired REAL, credits_remaining REAL,
    annual_reductions REAL, project_url TEXT, description TEXT
  )`);

  const stmt = db.prepare(`INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const row of dataRows) {
    if (!row || !row[COL.PROJECT_ID]) continue;
    stmt.run([
      String(row[COL.PROJECT_ID] || ""),
      String(row[COL.PROJECT_NAME] || ""),
      String(row[COL.REGISTRY] || ""),
      String(row[COL.STATUS] || ""),
      String(row[COL.SCOPE] || ""),
      String(row[COL.TYPE] || ""),
      String(row[COL.METHODOLOGY] || ""),
      String(row[COL.REGION] || ""),
      String(row[COL.COUNTRY] || ""),
      String(row[COL.LOCATION] || ""),
      String(row[COL.DEVELOPER] || ""),
      parseFloat(row[COL.CREDITS_ISSUED]) || 0,
      parseFloat(row[COL.CREDITS_RETIRED]) || 0,
      parseFloat(row[COL.CREDITS_REMAINING]) || 0,
      parseFloat(row[COL.ANNUAL_REDUCTIONS]) || 0,
      String(row[COL.PROJECT_URL] || ""),
      String(row[COL.DESCRIPTION] || ""),
    ]);
  }
  stmt.free();

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(DB_PATH, Buffer.from(db.export()));
  console.log(`  Berkeley DB: SQLite saved`);

  // Query Ethiopia + target types
  const results = db.exec(`
    SELECT * FROM projects
    WHERE country LIKE '%Ethiopia%'
    AND (
      type LIKE '%Afforestation%'
      OR type LIKE '%Reforestation%'
      OR type LIKE '%REDD%'
      OR type LIKE '%Jurisdictional%'
      OR type LIKE '%Sustainable Agriculture%'
      OR type LIKE '%Wetland%'
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
      type: r.type,
      description: r.description,
      organization: r.developer,
      status: r.status,
      registry: r.registry || "Berkeley_DB",
      registryId: r.project_id,
      methodology: r.methodology,
      creditsIssued: r.credits_issued,
      creditsRetired: r.credits_retired,
      creditsRemaining: r.credits_remaining,
      annualReductions: r.annual_reductions,
      creditingPeriodStart: "",
      creditingPeriodEnd: "",
      sdgContributions: [],
      projectUrl: r.project_url,
      location: r.location,
      source: "berkeley-db",
    };
  });

  console.log(`  Berkeley DB: ${mapped.length} Ethiopia projects found`);
  return mapped;
}
