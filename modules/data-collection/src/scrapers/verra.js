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
  // Try the project detail/summary endpoint
  const urls = [
    `https://registry.verra.org/uiapi/resource/resourceSummary/${projectId}`,
    `https://registry.verra.org/uiapi/resource/resource/${projectId}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) continue;

      const data = await res.json();
      // Look for coordinates in various possible locations
      const lat = data.latitude ?? data.lat ?? data.geoLocation?.latitude ?? data.location?.lat ?? null;
      const lng = data.longitude ?? data.lng ?? data.lon ?? data.geoLocation?.longitude ?? data.location?.lng ?? null;

      if (lat && lng) {
        console.log(`    ✓ ${projectId}: ${lat}, ${lng}`);
        return { lat, lng };
      }

      // Check for nested location/map data
      if (data.mapData || data.coordinates || data.geographicLocation) {
        const geo = data.mapData || data.coordinates || data.geographicLocation;
        if (geo.latitude && geo.longitude) {
          console.log(`    ✓ ${projectId}: ${geo.latitude}, ${geo.longitude}`);
          return { lat: geo.latitude, lng: geo.longitude };
        }
      }
    } catch (e) {
      continue;
    }
  }

  console.log(`    ✗ ${projectId}: no coordinates found`);
  return { lat: null, lng: null };
}
