// Gold Standard registry: registry.goldstandard.org
// Their frontend app uses an internal API - try known patterns

const GS_URLS = [
  "https://registry.goldstandard.org/api/v1/projects?country=Ethiopia&limit=100",
  "https://registry.goldstandard.org/api/projects?country=Ethiopia&limit=100",
  "https://registry.goldstandard.org/api/v1/projects?q=Ethiopia&limit=100",
  "https://registry.goldstandard.org/api/projects?q=Ethiopia&limit=100",
  "https://registry.goldstandard.org/projects?q=Ethiopia&page=1&format=json",
];

export async function fetchGoldStandardProjects() {
  for (const url of GS_URLS) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "EthopAI-DataCollector/0.1",
        },
      });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("json")) continue;

      const data = await res.json();
      const projects = data.data || data.projects || data.items || (Array.isArray(data) ? data : []);
      if (projects.length === 0) continue;

      return projects.map((r) => ({
        id: r.id || r.gs_id,
        name: r.name || r.project_name || r.title || "",
        lat: r.coordinates?.lat ?? r.latitude ?? r.lat ?? null,
        lng: r.coordinates?.lng ?? r.longitude ?? r.lng ?? null,
        type: r.type || r.project_type || r.activity_type || "",
        description: r.description || r.summary || "",
        organization: r.developer || r.project_developer || r.organisation || "",
        status: r.status || "",
        registry: "GoldStandard",
        registryId: String(r.id || r.gs_id),
        methodology: r.methodology || r.methodology_name || "",
        creditsIssued: r.total_credits_issued ?? r.credits_issued ?? r.vcus ?? 0,
        creditingPeriodStart: r.crediting_period_start || r.start_date || "",
        creditingPeriodEnd: r.crediting_period_end || r.end_date || "",
        sdgContributions: r.sdg_contributions || r.sdgs || [],
        projectUrl: `https://registry.goldstandard.org/projects/details/${r.id || r.gs_id}`,
      }));
    } catch (e) {
      continue;
    }
  }

  console.log("  Gold Standard: API not reachable (JS-rendered registry). Skipping.");
  return [];
}
