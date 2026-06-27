import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { fetchVerraProjects } from "./scrapers/verra.js";
import { fetchGoldStandardProjects } from "./scrapers/goldstandard.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");

async function main() {
  console.log("Scraping Ethiopian carbon credit projects...\n");

  let verra = [];
  let gs = [];

  try {
    verra = await fetchVerraProjects();
    console.log(`✓ Verra: ${verra.length} projects`);
  } catch (e) {
    console.error(`✗ Verra failed: ${e.message}`);
  }

  try {
    gs = await fetchGoldStandardProjects();
    console.log(`✓ Gold Standard: ${gs.length} projects`);
  } catch (e) {
    console.error(`✗ Gold Standard failed: ${e.message}`);
  }

  const all = [...verra, ...gs];
  if (all.length === 0) {
    console.error("\nNo projects found. Check network/API access.");
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, "raw-projects.json"), JSON.stringify(all, null, 2));
  console.log(`\nSaved ${all.length} projects to output/raw-projects.json`);
}

main().catch(console.error);
