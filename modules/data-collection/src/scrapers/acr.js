// ACR registry is at greentrace.ice.com/acr/projects (JS-rendered)
// We try their underlying API; if unavailable, fall back to known projects

const ACR_API_URLS = [
  "https://greentrace.ice.com/api/acr/projects?country=Ethiopia",
  "https://greentrace.ice.com/acr/api/projects?country=Ethiopia",
];

export async function fetchACRProjects() {
  // Try API endpoints
  for (const url of ACR_API_URLS) {
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
        id: r.id || r.projectId,
        name: r.name || r.projectName || "",
        lat: r.latitude ?? null,
        lng: r.longitude ?? null,
        type: r.type || r.projectType || "",
        description: r.description || "",
        organization: r.developer || r.proponent || "",
        status: r.status || "",
        registry: "ACR",
        registryId: String(r.id || r.projectId),
        methodology: r.methodology || "",
        creditsIssued: r.totalCreditsIssued ?? r.creditsIssued ?? 0,
        creditingPeriodStart: r.creditingPeriodStart || "",
        creditingPeriodEnd: r.creditingPeriodEnd || "",
        sdgContributions: [],
        projectUrl: `https://greentrace.ice.com/acr/projects/${r.id || r.projectId}`,
      }));
    } catch (e) {
      continue;
    }
  }

  // ACR has very few Africa/Ethiopia projects — mostly US-focused
  console.log("  ACR: API unavailable (JS-rendered registry). No Ethiopia projects confirmed.");
  return [];
}
