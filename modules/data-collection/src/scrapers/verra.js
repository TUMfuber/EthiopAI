const VERRA_SEARCH = "https://registry.verra.org/uiapi/resource/resource/search?$top=500&count=true";
const VERRA_DETAIL = "https://registry.verra.org/uiapi/resource/resourceSummary";

export async function fetchVerraProjects() {
  const bodies = [
    { program: "VCS", country_area: "Ethiopia" },
    { program: "VCS", "country/area": "Ethiopia" },
    { program: "VCS", countryName: "Ethiopia" },
  ];

  let records = [];

  for (const body of bodies) {
    const res = await fetch(VERRA_SEARCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) continue;
    const data = await res.json();
    const all = data.value || data.records || data || [];
    const ethRecords = all.filter((r) => {
      const fields = [r.country, r.countryName, r.country_area, r.region, r.resourceName, r.name].join(" ").toLowerCase();
      return fields.includes("ethiopia");
    });
    if (ethRecords.length > 0) {
      records = ethRecords;
      break;
    }
  }

  if (records.length === 0) {
    // Fallback: fetch all and filter
    const res = await fetch(VERRA_SEARCH.replace("500", "5000"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program: "VCS" }),
    });
    if (!res.ok) throw new Error(`Verra API error: ${res.status}`);
    const data = await res.json();
    const all = data.value || data.records || data || [];
    records = all.filter((r) => {
      const fields = [r.country, r.countryName, r.country_area, r.region, r.resourceName, r.name].join(" ").toLowerCase();
      return fields.includes("ethiopia");
    });
  }

  console.log(`  Verra: ${records.length} Ethiopia projects found, fetching coordinates...`);

  // Fetch detail for each project to get lat/lng
  const projects = [];
  for (const r of records) {
    const id = r.resourceIdentifier || r.id;
    const coords = await fetchProjectCoords(id);
    projects.push({
      id,
      name: r.resourceName || r.name || "",
      lat: coords.lat,
      lng: coords.lng,
      type: r.projectType || r.category || "",
      description: "",
      organization: r.proponentName || r.developer || "",
      status: r.statusName || r.status || "",
      registry: "Verra_VCS",
      registryId: String(id),
      methodology: r.methodology || "",
      creditsIssued: r.totalVCUsIssued ?? r.totalCreditsIssued ?? 0,
      creditingPeriodStart: r.creditingPeriodStartDate || "",
      creditingPeriodEnd: r.creditingPeriodEndDate || "",
      sdgContributions: [],
      projectUrl: `https://registry.verra.org/app/projectDetail/VCS/${id}`,
    });
  }

  return projects;
}

async function fetchProjectCoords(projectId) {
  try {
    const url = `https://registry.verra.org/app/projectDetail/VCS/${projectId}`;
    const res = await fetch(url);
    if (!res.ok) return { lat: null, lng: null };

    const html = await res.text();
    // Extract coords from Azure Maps feedback URL: cp={lat}~{lng}
    const match = html.match(/cp=([-\d.]+)~([-\d.]+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      console.log(`    ✓ ${projectId}: ${lat}, ${lng}`);
      return { lat, lng };
    }
  } catch (e) {}

  console.log(`    ✗ ${projectId}: no coordinates found`);
  return { lat: null, lng: null };
}
