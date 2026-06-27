const VERRA_API = "https://registry.verra.org/uiapi/resource/resource/search?$top=500&count=true";

export async function fetchVerraProjects() {
  // Try multiple body formats — Verra's API isn't well documented
  const bodies = [
    { program: "VCS", country_area: "Ethiopia" },
    { program: "VCS", "country/area": "Ethiopia" },
    { program: "VCS", countryName: "Ethiopia" },
  ];

  for (const body of bodies) {
    const res = await fetch(VERRA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) continue;
    const data = await res.json();
    const records = data.value || data.records || data || [];

    // Check if results are actually Ethiopia — filter locally as fallback
    const ethiopiaRecords = records.filter((r) => {
      const country = (r.country || r.countryName || r.country_area || r.region || "").toLowerCase();
      const name = (r.resourceName || r.name || "").toLowerCase();
      return country.includes("ethiopia") || name.includes("ethiopia");
    });

    if (ethiopiaRecords.length > 0) {
      console.log(`  Verra: API filter worked — ${ethiopiaRecords.length} Ethiopia projects`);
      return mapRecords(ethiopiaRecords);
    }
  }

  // Fallback: fetch ALL and filter client-side
  console.log("  Verra: country filter not working, fetching all and filtering locally...");
  const res = await fetch("https://registry.verra.org/uiapi/resource/resource/search?$top=5000&count=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ program: "VCS" }),
  });

  if (!res.ok) throw new Error(`Verra API error: ${res.status}`);
  const data = await res.json();
  const records = data.value || data.records || data || [];

  const ethiopiaRecords = records.filter((r) => {
    const fields = [r.country, r.countryName, r.country_area, r.region, r.resourceName, r.name].join(" ").toLowerCase();
    return fields.includes("ethiopia");
  });

  console.log(`  Verra: found ${ethiopiaRecords.length} Ethiopia projects out of ${records.length} total`);
  return mapRecords(ethiopiaRecords);
}

function mapRecords(records) {
  return records.map((r) => ({
    id: r.resourceIdentifier || r.id,
    name: r.resourceName || r.name || "",
    lat: r.latitude ?? null,
    lng: r.longitude ?? null,
    type: r.projectType || r.category || "",
    description: "",
    organization: r.proponentName || r.developer || "",
    status: r.statusName || r.status || "",
    registry: "Verra_VCS",
    registryId: String(r.resourceIdentifier || r.id),
    methodology: r.methodology || "",
    creditsIssued: r.totalVCUsIssued ?? r.totalCreditsIssued ?? 0,
    creditingPeriodStart: r.creditingPeriodStartDate || "",
    creditingPeriodEnd: r.creditingPeriodEndDate || "",
    sdgContributions: [],
    projectUrl: `https://registry.verra.org/app/projectDetail/VCS/${r.resourceIdentifier || r.id}`,
  }));
}
