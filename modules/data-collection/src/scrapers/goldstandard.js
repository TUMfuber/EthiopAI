const GS_API = "https://registry.goldstandard.org/api/v1/projects";

export async function fetchGoldStandardProjects() {
  // Try multiple possible API paths since GS has changed their API
  const urls = [
    `https://registry.goldstandard.org/api/v1/projects?country=Ethiopia&limit=100`,
    `https://registry.goldstandard.org/api/projects?country=Ethiopia&limit=100`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("json")) continue;

      const data = await res.json();
      const projects = data.data || data.projects || (Array.isArray(data) ? data : []);

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
    } catch (e) {
      continue;
    }
  }

  console.warn("Gold Standard API unavailable — skipping");
  return [];
}
