import puppeteer from "puppeteer";

const PLAN_VIVO_PAGES = [
  "https://www.planvivo.org/projects/carbon",
  "https://www.planvivo.org/projects/biodiversity",
  "https://www.planvivo.org/projects/carbon/pipeline",
];

export async function fetchPlanVivoProjects() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
  });

  const allProjects = [];

  for (const url of PLAN_VIVO_PAGES) {
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      const projects = await page.evaluate(() => {
        const cards = document.querySelectorAll('a[href*="/projects/"]');
        const results = [];
        const seen = new Set();

        cards.forEach((card) => {
          const href = card.getAttribute("href") || "";
          // Only project detail links (not category links)
          if (
            href.includes("/projects/carbon") ||
            href.includes("/projects/biodiversity") ||
            href.includes("/projects/certify") ||
            href === "/projects/" ||
            !href.includes("/projects/")
          ) return;

          if (seen.has(href)) return;
          seen.add(href);

          const name = card.querySelector("h3")?.textContent?.trim() || "";
          const desc = card.closest("li")?.querySelector("p")?.textContent?.trim() || "";
          if (!name) return;

          results.push({ href, name, desc });
        });
        return results;
      });

      for (const p of projects) {
        allProjects.push({
          id: `pv-${p.href.split("/").pop()}`,
          name: p.name,
          lat: null,
          lng: null,
          type: url.includes("biodiversity") ? "Biodiversity" : "Agroforestry",
          description: p.desc,
          organization: "",
          status: url.includes("pipeline") ? "Pipeline" : "Certified",
          registry: "PlanVivo",
          registryId: p.href.split("/").pop(),
          methodology: "PV Climate" + (url.includes("biodiversity") ? " / PV Nature" : ""),
          creditsIssued: 0,
          creditingPeriodStart: "",
          creditingPeriodEnd: "",
          sdgContributions: [],
          projectUrl: `https://www.planvivo.org${p.href}`,
        });
      }

      await page.close();
    } catch (e) {
      console.log(`  Plan Vivo: failed to scrape ${url}: ${e.message}`);
    }
  }

  await browser.close();

  // Filter to Ethiopia-related projects, but also keep all for reference
  const ethiopiaProjects = allProjects.filter((p) => {
    const text = [p.name, p.description, p.projectUrl].join(" ").toLowerCase();
    return text.includes("ethiopia") || text.includes("ethio");
  });

  const otherProjects = allProjects.filter((p) => {
    const text = [p.name, p.description, p.projectUrl].join(" ").toLowerCase();
    return !text.includes("ethiopia") && !text.includes("ethio");
  });

  console.log(`  Plan Vivo: ${ethiopiaProjects.length} Ethiopia + ${otherProjects.length} other projects scraped`);

  // Return all projects (Ethiopia first, then others for context)
  return [...ethiopiaProjects, ...otherProjects];
}
