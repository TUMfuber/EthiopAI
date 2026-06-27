import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { fetchVerraProjects } from "./scrapers/verra.js";
import { fetchGoldStandardProjects } from "./scrapers/goldstandard.js";
import { fetchACRProjects } from "./scrapers/acr.js";
import { fetchPlanVivoProjects } from "./scrapers/planvivo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

async function scrape(name, fn) {
  try {
    const results = await fn();
    console.log(`✓ ${name}: ${results.length} projects`);
    return results;
  } catch (e) {
    console.error(`✗ ${name} failed: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log("Scraping Ethiopian carbon credit projects...\n");

  const results = await Promise.all([
    scrape("Verra VCS", fetchVerraProjects),
    scrape("Gold Standard", fetchGoldStandardProjects),
    scrape("ACR", fetchACRProjects),
    scrape("Plan Vivo", fetchPlanVivoProjects),
  ]);

  const all = results.flat();
  if (all.length === 0) {
    console.error("\nNo projects found. Check network/API access.");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, "raw-projects.json"), JSON.stringify(all, null, 2));
  console.log(`\nTotal: ${all.length} projects saved to output/raw-projects.json`);
}

main().catch(console.error);
