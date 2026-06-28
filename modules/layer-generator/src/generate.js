import { writeFileSync, copyFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { buildProjectLayer } from "./project-layer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..");
const DATA_INPUT = join(ROOT, "modules", "data-collection", "output", "projects.json");
const PUBLIC_DATA = join(ROOT, "public", "data");

async function main() {
  console.log("=== Layer Generation ===\n");
  mkdirSync(PUBLIC_DATA, { recursive: true });

  if (!existsSync(DATA_INPUT)) {
    console.log("No projects.json found. Run data-collection first.");
    process.exit(1);
  }

  // Copy projects.json to public/data/ for frontend
  copyFileSync(DATA_INPUT, join(PUBLIC_DATA, "projects.json"));
  console.log("✓ Copied projects.json to public/data/");

  // Also generate GeoJSON version
  const geojson = buildProjectLayer(DATA_INPUT);
  writeFileSync(join(PUBLIC_DATA, "projects.geojson"), JSON.stringify(geojson));
  console.log(`✓ Generated projects.geojson (${geojson.features.length} features)`);

  console.log("\n✓ Done. Frontend can serve project data from public/data/");
}

main().catch(console.error);
