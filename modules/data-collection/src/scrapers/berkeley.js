import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const BERKELEY_URL = "https://gspp.berkeley.edu/assets/uploads/page/Voluntary-Registry-Offsets-Database--v2026-04.xlsx";

export async function fetchBerkeleyProjects() {
  console.log("  Berkeley DB: downloading Excel...");
  const res = await fetch(BERKELEY_URL);
  if (!res.ok) throw new Error(`Berkeley download failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });

  // Find the main data sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`  Berkeley DB: ${rows.length} total rows, filtering Ethiopia...`);

  // Filter for Ethiopia — check common column names
  const ethiopiaRows = rows.filter((r) => {
    const fields = Object.values(r).join(" ").toLowerCase();
    return fields.includes("ethiopia");
  });

  console.log(`  Berkeley DB: ${ethiopiaRows.length} Ethiopia projects found`);

  return ethiopiaRows.map((r, i) => {
    // Map common Berkeley DB column names
    const name = r["Project Name"] || r["project_name"] || r["Project"] || r["Name"] || "";
    const registry = r["Registry"] || r["registry"] || "";
    const type = r["Project Type"] || r["Type"] || r["Scope"] || "";
    const credits = r["Total Credits Issued"] || r["Credits Issued"] || r["Offsets Issued"] || 0;
    const status = r["Status"] || r["Project Status"] || "";
    const developer = r["Project Developer"] || r["Developer"] || r["Proponent"] || "";
    const country = r["Country"] || r["Region"] || "";
    const methodology = r["Methodology"] || r["Protocol"] || "";
    const id = r["Project ID"] || r["ID"] || r["Registry Project ID"] || `berkeley-${i}`;

    return {
      id: `berkeley-${id}`,
      name,
      lat: null,
      lng: null,
      type,
      description: "",
      organization: developer,
      status,
      registry: registry || "Berkeley_DB",
      registryId: String(id),
      methodology,
      creditsIssued: typeof credits === "number" ? credits : parseInt(credits) || 0,
      creditingPeriodStart: r["Crediting Period Start"] || r["Start Date"] || "",
      creditingPeriodEnd: r["Crediting Period End"] || r["End Date"] || "",
      sdgContributions: [],
      projectUrl: r["Project URL"] || r["URL"] || "",
      source: "berkeley-db",
    };
  });
}
