import { writeFileSync, mkdirSync } from "fs";
import { fetchVerraProjects } from "./scrapers/verra.js";
import { fetchGoldStandardProjects } from "./scrapers/goldstandard.js";

const OUTPUT_DIR = new URL("../output", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

async function main() {
  console.log("Scraping Ethiopian carbon credit projects...\n");

  const [verra, gs] = await Promise.all([
    fetchVerraProjects(),
    fetchGoldStandardProjects(),
  ]);

  console.log(`Verra: ${verra.length} projects`);
  console.log(`Gold Standard: ${gs.length} projects`);

  const all = [...verra, ...gs];
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(`${OUTPUT_DIR}/raw-projects.json`, JSON.stringify(all, null, 2));
  console.log(`\nSaved ${all.length} projects to output/raw-projects.json`);
}

main().catch(console.error);
