const GS_API = "https://registry.goldstandard.org/api/projects";

export async function fetchGoldStandardProjects() {
  const params = new URLSearchParams({
    q: "",
    country: "Ethiopia",
    page: "1",
    size: "100",
  });

  const res = await fetch(`${GS_API}?${params}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Gold Standard API error: ${res.status}`);
  const data = await res.json();
  const projects = data.data || data.projects || data || [];

  return projects.map((r) => ({
    id: r.id || r.gs_id,
    name: r.name || r.project_name || "",
    lat: r.coordinates?.lat ?? r.latitude ?? null,
    lng: r.coordinates?.lng ?? r.longitude ?? null,
    type: r.type || r.project_type || "",
    description: r.description || "",
    organization: r.developer || r.project_developer || "",
    status: r.status || "",
    registry: "GoldStandard",
    registryId: String(r.id || r.gs_id),
    methodology: r.methodology || "",
    creditsIssued: r.total_credits_issued ?? r.credits_issued ?? 0,
    creditingPeriodStart: r.crediting_period_start || "",
    creditingPeriodEnd: r.crediting_period_end || "",
    sdgContributions: r.sdg_contributions || r.sdgs || [],
    projectUrl: `https://registry.goldstandard.org/projects/details/${r.id || r.gs_id}`,
  }));
}
