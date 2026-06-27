import puppeteer from "puppeteer";

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

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
  });

  const projects = [];
  for (const r of records) {
    const id = r.resourceIdentifier || r.id;
    const coords = await fetchProjectCoords(id, browser);
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

  await browser.close();
  return projects;
}

async function fetchProjectCoords(projectId, browser) {
  try {
    const page = await browser.newPage();
    await page.goto(`https://registry.verra.org/app/projectDetail/VCS/${projectId}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    // Wait for the Azure Maps feedback link to render
    await page.waitForSelector('a[href*="azuremaps-feedback"]', { timeout: 15000 }).catch(() => {});
    const coords = await page.evaluate(() => {
      const link = document.querySelector('a[href*="azuremaps-feedback"]');
      if (!link) return null;
      const match = link.href.match(/cp=([-\d.]+)~([-\d.]+)/);
      return match ? { lat: parseFloat(match[1]), lng: parseFloat(match[2]) } : null;
    });
    await page.close();
    if (coords) {
      console.log(`    ✓ ${projectId}: ${coords.lat}, ${coords.lng}`);
      return coords;
    }
  } catch (e) {}
  console.log(`    ✗ ${projectId}: no coordinates found`);
  return { lat: null, lng: null };
}
