import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..', '..');
const PRECOMPUTED = path.join(ROOT, 'resources', 'precomputed');
const OUTPUT = path.join(__dirname, '..', 'output');
const SUBDIVIDE = 3;

// Read the main comprehensive layer
const mainGrid = JSON.parse(readFileSync(path.join(PRECOMPUTED, 'restoration_priority_score.geojson'), 'utf-8'));

// Find max values for normalization
let maxBio = 0, maxLand = 0, maxRain = 0, maxClimate = 0;
for (const f of mainGrid.features) {
  const p = f.properties;
  if ((p.biodiversity_livelihood_score ?? 0) > maxBio) maxBio = p.biodiversity_livelihood_score;
  if ((p.degraded_restorable_land_score ?? 0) > maxLand) maxLand = p.degraded_restorable_land_score;
  if ((p.seasonal_rainfall_mm ?? 0) > maxRain) maxRain = p.seasonal_rainfall_mm;
  if ((p.climate_suitability ?? 0) > maxClimate) maxClimate = p.climate_suitability;
}

const WEIGHTS = { biodiversity: 0.3, carbon: 0.3, water: 0.2, land_degradation: 0.2 };
const features = [];

for (const f of mainGrid.features) {
  const p = f.properties;
  const cellId = p.cell_id;
  const coords = f.geometry.coordinates[0];
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const dLng = (maxLng - minLng) / SUBDIVIDE;
  const dLat = (maxLat - minLat) / SUBDIVIDE;

  // Compute category scores (0-1)
  const scores = {
    biodiversity: maxBio > 0 ? (p.biodiversity_livelihood_score ?? 0) / maxBio : 0,
    // Carbon proxy: climate suitability + tree fraction potential (areas with low trees but high suitability = carbon opportunity)
    carbon: Math.min(1, ((p.climate_suitability ?? 0) / (maxClimate || 1)) * 0.5 + (1 - (p.tree_fraction ?? 0)) * (p.landcover_eligibility ?? 0) * 0.5),
    // Water proxy: rainfall + slope interaction (high rain + steep slope = erosion risk = water priority)
    water: Math.min(1, ((p.seasonal_rainfall_mm ?? 0) / (maxRain || 1)) * 0.6 + ((p.slope_p90 ?? 0) / 30) * 0.4),
    land_degradation: maxLand > 0 ? (p.degraded_restorable_land_score ?? 0) / maxLand : (p.bare_sparse_fraction ?? 0),
  };

  // Composite
  let priority = 0;
  for (const [name, w] of Object.entries(WEIGHTS)) priority += (scores[name] ?? 0) * w;

  // Dominant category
  let maxS = -1, category = 'biodiversity';
  for (const [name, s] of Object.entries(scores)) { if (s > maxS) { maxS = s; category = name; } }

  // Subdivide for resolution
  for (let row = 0; row < SUBDIVIDE; row++) {
    for (let col = 0; col < SUBDIVIDE; col++) {
      const subMinLng = minLng + col * dLng;
      const subMinLat = minLat + row * dLat;
      const subMaxLng = subMinLng + dLng;
      const subMaxLat = subMinLat + dLat;

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[subMinLng,subMinLat],[subMaxLng,subMinLat],[subMaxLng,subMaxLat],[subMinLng,subMaxLat],[subMinLng,subMinLat]]] },
        properties: {
          priority: +priority.toFixed(3),
          category,
          location: `${p.admin_region ?? 'Unknown'} (${cellId})`,
          lat: +((subMinLat + subMaxLat) / 2).toFixed(3),
          lng: +((subMinLng + subMaxLng) / 2).toFixed(3),
        }
      });
    }
  }
}

const geojson = { type: 'FeatureCollection', features };
mkdirSync(OUTPUT, { recursive: true });
writeFileSync(path.join(OUTPUT, 'priority-heatmap.geojson'), JSON.stringify(geojson));
const publicData = path.join(ROOT, 'public', 'data');
mkdirSync(publicData, { recursive: true });
writeFileSync(path.join(publicData, 'priority-heatmap.geojson'), JSON.stringify(geojson));

// Stats
const cats = {};
features.forEach(f => { cats[f.properties.category] = (cats[f.properties.category] || 0) + 1; });
console.log(`Generated: ${features.length} sub-cells (~${(0.45/SUBDIVIDE*111).toFixed(0)}km resolution)`);
console.log('Category distribution:', cats);
