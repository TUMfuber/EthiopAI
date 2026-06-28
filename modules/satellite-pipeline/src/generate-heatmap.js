import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..', '..');
const PRECOMPUTED = path.join(ROOT, 'resources', 'precomputed');
const OUTPUT = path.join(__dirname, '..', 'output');

// Use restoration_priority_score as the main precomputed layer
const FILE = path.join(PRECOMPUTED, 'restoration_priority_score.geojson');

const raw = JSON.parse(readFileSync(FILE, 'utf-8'));
const features = raw.features.map(f => {
  const p = f.properties;
  const coords = f.geometry.coordinates[0]; // polygon ring
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  
  // Normalize priority: max observed is ~100, scale to 0-1
  const priority = Math.min(1, (p.restoration_priority_score ?? 0) / 50);
  
  // Determine dominant category
  const scores = {
    biodiversity: (p.biodiversity_livelihood_score ?? 0) / 100,
    carbon: (p.carbon_recovery_score ?? p.unadjusted_partial_priority_score ?? 0) / 50,
    water: (p.water_erosion_score ?? 0) / 50,
    land_degradation: (p.degraded_restorable_land_score ?? 0) / 50,
  };
  let maxS = -1, category = 'biodiversity';
  for (const [k, v] of Object.entries(scores)) { if (v > maxS) { maxS = v; category = k; } }

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [+lng.toFixed(3), +lat.toFixed(3)] },
    properties: {
      priority: +priority.toFixed(3),
      category,
      location: `${p.admin_region ?? 'Unknown'} (${p.cell_id})`,
    }
  };
});

const geojson = { type: 'FeatureCollection', features };
mkdirSync(OUTPUT, { recursive: true });
writeFileSync(path.join(OUTPUT, 'priority-heatmap.geojson'), JSON.stringify(geojson));

const publicData = path.join(ROOT, 'public', 'data');
mkdirSync(publicData, { recursive: true });
writeFileSync(path.join(publicData, 'priority-heatmap.geojson'), JSON.stringify(geojson));
console.log(`Generated priority-heatmap.geojson: ${features.length} points from precomputed grid`);
