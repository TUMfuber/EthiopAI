const VERRA_API = "https://registry.verra.org/uiapi/resource/resourceSummary";

export async function fetchVerraProjects() {
  const body = {
    program: "VCS",
    countryName: "Ethiopia",
    statusName: "",
    isFetchAllData: true,
  };

  const res = await fetch(VERRA_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Verra API error: ${res.status}`);
  const data = await res.json();

  return (data.records || data || []).map((r) => ({
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
    creditsIssued: r.totalCreditsIssued ?? r.creditsIssued ?? 0,
    creditingPeriodStart: r.creditingPeriodStartDate || "",
    creditingPeriodEnd: r.creditingPeriodEndDate || "",
    sdgContributions: [],
    projectUrl: `https://registry.verra.org/app/projectDetail/VCS/${r.resourceIdentifier || r.id}`,
  }));
}
