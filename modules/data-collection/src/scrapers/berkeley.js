import XLSX from "xlsx";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "output", "berkeley.db");
const BERKELEY_URL = "https://gspp.berkeley.edu/assets/uploads/page/Voluntary-Registry-Offsets-Database--v2026-04.xlsx";

export async function fetchBerkeleyProjects() {
  console.log("  Berkeley DB: downloading Excel...");
  const res = await fetch(BERKELEY_URL);
  if (!res.ok) throw new Error(`Berkeley download failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });

  // Find Projects tab
  const sheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes("project")) || workbook.SheetNames[1];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Berkeley DB: ${rows.length} rows loaded from "${sheetName}"`);

  // Load into SQLite
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`DROP TABLE IF EXISTS projects`);
  db.exec(`CREATE TABLE projects (
    project_id TEXT,
    project_name TEXT,
    registry TEXT,
    status TEXT,
    scope_type TEXT,
    methodology TEXT,
    region TEXT,
    country TEXT,
    project_site_location TEXT,
    project_developer TEXT,
    total_credits_issued REAL,
    total_credits_retired REAL,
    total_credits_remaining REAL,
    estimated_annual_reductions REAL,
    project_url TEXT,
    project_description TEXT
  )`);

  const insert = db.prepare(`INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run(
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
        r["Project Description"] || ""
      );
    }
  });
  tx(rows);
  console.log(`  Berkeley DB: loaded into SQLite`);

  // Query Ethiopia + our target types
  const results = db.prepare(`
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
  `).all();

  db.close();
  console.log(`  Berkeley DB: ${results.length} Ethiopia projects matching target types`);

  return results.map((r) => ({
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
  }));
}
