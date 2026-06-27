import puppeteer from "puppeteer";

const VERRA_SEARCH = "https://registry.verra.org/uiapi/resource/resource/search?$top=500&count=true";

// All Verra programs to search
const PROGRAMS = ["VCS", "CCB", "SD_VISTA", "PLASTIC"];

export async function fetchVerraProjects() {
  let allRecords = [];

  for (const program of PROGRAMS) {
    const records = await searchProgram(program);
    if (records.length > 0) {
      console.log(`  Verra ${program}: ${records.length} Ethiopia projects`);
      allRecords.push(...records.map((r) => ({ ...r, _program: program })));
    }
  }

  if (allRecords.length === 0) {
    console.log("  Verra: no Ethiopia projects found in any program");
    return [];
  }

  console.log(`  Verra: ${allRecords.length} total Ethiopia projects, fetching coordinates...`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
  });

  const projects = [];
  for (const r of allRecords) {
    const id = r.resourceIdentifier || r.id;
    const program = r._program;
    const coords = await fetchProjectCoords(id, program, browser);
    projects.push({
      id,
      name: r.resourceName || r.name || "",
      lat: coords.lat,
      lng: coords.lng,
      type: r.projectType || r.category || "",
      description: "",
      organization: r.proponentName || r.developer || "",
      status: r.statusName || r.status || "",
      registry: `Verra_${program}`,
      registryId: String(id),
      methodology: r.methodology || "",
      creditsIssued: r.totalVCUsIssued ?? r.totalCreditsIssued ?? 0,
      creditingPeriodStart: r.creditingPeriodStartDate || "",
      creditingPeriodEnd: r.creditingPeriodEndDate || "",
      sdgContributions: [],
      projectUrl: `https://registry.verra.org/app/projectDetail/${program}/${id}`,
    });
  }

  await browser.close();
  return projects;
}

async function searchProgram(program) {
  const bodies = [
    { program, country_area: "Ethiopia" },
    { program, "country/area": "Ethiopia" },
    { program, countryName: "Ethiopia" },
  ];

  for (const body of bodies) {
    try {
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
      if (ethRecords.length > 0) return ethRecords;
    } catch (e) {
      continue;
    }
  }

  // Fallback: fetch all for this program and filter
  try {
    const res = await fetch(VERRA_SEARCH.replace("500", "5000"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const all = data.value || data.records || data || [];
    return all.filter((r) => {
      const fields = [r.country, r.countryName, r.country_area, r.region, r.resourceName, r.name].join(" ").toLowerCase();
      return fields.includes("ethiopia");
    });
  } catch (e) {
    return [];
  }
}

async function fetchProjectCoords(projectId, program, browser) {
  try {
    const page = await browser.newPage();
    await page.goto(`https://registry.verra.org/app/projectDetail/${program}/${projectId}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
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
