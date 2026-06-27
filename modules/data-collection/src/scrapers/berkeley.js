import XLSX from "xlsx";

const BERKELEY_URL = "https://gspp.berkeley.edu/assets/uploads/page/Voluntary-Registry-Offsets-Database--v2026-04.xlsx";

const TYPES_WE_WANT = [
  "afforestation",
  "reforestation",
  "jurisdictional redd",
  "redd+",
  "redd",
  "sustainable agriculture",
  "wetland restoration",
];

function matchesType(projectType) {
  const lower = (projectType || "").toLowerCase();
  return TYPES_WE_WANT.some((t) => lower.includes(t));
}

export async function fetchBerkeleyProjects() {
  console.log("  Berkeley DB: downloading Excel...");
  const res = await fetch(BERKELEY_URL);
  if (!res.ok) throw new Error(`Berkeley download failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(Buffer.from(buffer), { type: "buffer" });

  // Use the "Projects" tab
  const sheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes("project")) || workbook.SheetNames[1];
  if (!sheetName) throw new Error("Could not find Projects tab");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`  Berkeley DB: ${rows.length} total rows in "${sheetName}" tab`);

  // Filter: Ethiopia + matching project types
  const filtered = rows.filter((r) => {
    const country = Object.values(r).join(" ").toLowerCase();
    if (!country.includes("ethiopia")) return false;
    const type = (r["Project Type"] || r["Type"] || r["Scope"] || r["Category"] || "").toString();
    return matchesType(type);
  });

  console.log(`  Berkeley DB: ${filtered.length} Ethiopia projects matching our types`);

  return filtered.map((r, i) => {
    const name = r["Project Name"] || r["project_name"] || r["Project"] || r["Name"] || "";
    const registry = r["Registry"] || r["registry"] || "";
    const type = r["Project Type"] || r["Type"] || r["Scope"] || "";
    const credits = r["Total Credits Issued"] || r["Credits Issued"] || r["Offsets Issued"] || 0;
    const status = r["Status"] || r["Project Status"] || "";
    const developer = r["Project Developer"] || r["Developer"] || r["Proponent"] || "";
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
