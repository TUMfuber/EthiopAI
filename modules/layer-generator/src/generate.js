import { writeFileSync, mkdirSync, cpSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildProjectLayer } from "./project-layer.js";
import { buildZoneLayers } from "./zone-layer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const DATA_INPUT = join(ROOT, "modules", "data-collection", "output", "projects.json");
const KBA_SHAPEFILE = join(ROOT, "resources", "KBAsGlobal_2026_March_01_POL.shp");
const OUTPUT_DIR = join(__dirname, "..", "output");
const PUBLIC_DATA = join(ROOT, "public", "data");

async function main() {
  console.log("=== Layer Generation ===\n");

  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(PUBLIC_DATA, { recursive: true });

  // 1. Project markers layer
  console.log("Building project markers layer...");
  const projectsGeoJSON = buildProjectLayer(DATA_INPUT);
  writeFileSync(join(OUTPUT_DIR, "projects.geojson"), JSON.stringify(projectsGeoJSON));
  console.log(`  ${projectsGeoJSON.features.length} project markers\n`);

  // 2. Priority zone layers (one per scoring mode)
  console.log("Building priority zone layers...");
  const zoneLayers = await buildZoneLayers(DATA_INPUT, KBA_SHAPEFILE);

  for (const [mode, geojson] of Object.entries(zoneLayers)) {
    writeFileSync(join(OUTPUT_DIR, `zones-${mode}.geojson`), JSON.stringify(geojson));
  }

  // 3. Copy to public/data/
  console.log("\nCopying to public/data/...");
  cpSync(join(OUTPUT_DIR, "projects.geojson"), join(PUBLIC_DATA, "projects.geojson"));
  for (const mode of Object.keys(zoneLayers)) {
    cpSync(join(OUTPUT_DIR, `zones-${mode}.geojson`), join(PUBLIC_DATA, `zones-${mode}.geojson`));
  }

  console.log("\n✓ Done. Layers available at public/data/");
  console.log("  - projects.geojson");
  Object.keys(zoneLayers).forEach((m) => console.log(`  - zones-${m}.geojson`));
}

main().catch(console.error);
