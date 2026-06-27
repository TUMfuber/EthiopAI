// Plan Vivo has no public API — we scrape their carbon projects page
// and specifically the known Ethiopia project (EthioTrees)

const PLAN_VIVO_PROJECTS_URL = "https://www.planvivo.org/projects/carbon";
const ETHIOTREES_URL = "https://www.planvivo.org/ethiotrees-documents";

// Known Ethiopia projects from Plan Vivo (manually curated since no API)
const ETHIOPIA_PROJECTS = [
  {
    id: "pv-ethiotrees",
    name: "EthioTrees – Ecosystem Restoration and Agroforestry",
    lat: 13.5,
    lng: 39.0,
    type: "Agroforestry",
    description:
      "Community-driven woodland restoration on degraded slopes in Tigray, North Ethiopian Highlands. Supports landless farmers through frankincense harvesting and ecosystem services.",
    organization: "Climate Lab",
    status: "Certified",
    registry: "PlanVivo",
    registryId: "ethiotrees",
    methodology: "PV Climate Version 4",
    creditsIssued: 760872,
    creditingPeriodStart: "2016",
    creditingPeriodEnd: "",
    sdgContributions: ["SDG 1", "SDG 13", "SDG 15"],
    projectUrl: "https://www.planvivo.org/ethiotrees-documents",
  },
];

export async function fetchPlanVivoProjects() {
  // Attempt to scrape the projects listing for any additional Ethiopia projects
  try {
    const res = await fetch(PLAN_VIVO_PROJECTS_URL);
    if (!res.ok) return ETHIOPIA_PROJECTS;

    const html = await res.text();
    // Check if there are other Ethiopia references we missed
    const ethiopiaMatches = html.match(/Ethiopia/gi);
    if (ethiopiaMatches && ethiopiaMatches.length > 1) {
      console.log(`  Plan Vivo: found ${ethiopiaMatches.length} Ethiopia references, may have additional projects`);
    }
  } catch (e) {
    // Fall back to known projects
  }

  console.log(`  Plan Vivo: returning ${ETHIOPIA_PROJECTS.length} known Ethiopia project(s)`);
  return ETHIOPIA_PROJECTS;
}
