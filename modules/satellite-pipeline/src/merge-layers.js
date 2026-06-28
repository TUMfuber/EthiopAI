import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const PRECOMPUTED_DIR = path.resolve(__dirname, '..', '..', '..', 'resources', 'precomputed');

const WEIGHTS = { biodiversity: 0.3, carbon: 0.3, water: 0.2, land_degradation: 0.2 };

function loadGeoJSON(filePath) {
  return readFile(filePath, 'utf-8').then(JSON.parse);
}

function buildScoreMap(geojson) {
  const map = new Map();
  for (const f of geojson.features) {
    const { score } = f.properties;
    const [lng, lat] = f.geometry.type === 'Point'
      ? f.geometry.coordinates
      : f.geometry.coordinates[0][0]; // polygon centroid approx
    const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
    map.set(key, score);
  }
  return map;
}

export async function mergeLayers() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const [carbon, biodiversity, water, landDeg, demRaw] = await Promise.all([
    loadGeoJSON(path.join(PRECOMPUTED_DIR, 'carbon.geojson')),
    loadGeoJSON(path.join(PRECOMPUTED_DIR, 'biodiversity.geojson')),
    loadGeoJSON(path.join(PRECOMPUTED_DIR, 'water.geojson')),
    loadGeoJSON(path.join(PRECOMPUTED_DIR, 'land_degradation.geojson')),
    readFile(path.join(OUTPUT_DIR, 'ethiopia-dem.json'), 'utf-8').then(JSON.parse)
  ]);

  const carbonMap = buildScoreMap(carbon);
  const bioMap = buildScoreMap(biodiversity);
  const waterMap = buildScoreMap(water);
  const landMap = buildScoreMap(landDeg);

  const trainingData = demRaw.map(cell => {
    const key = `${cell.lat.toFixed(1)},${cell.lng.toFixed(1)}`;
    const cs = carbonMap.get(key) ?? 0;
    const bs = bioMap.get(key) ?? 0;
    const ws = waterMap.get(key) ?? 0;
    const ls = landMap.get(key) ?? 0;
    const composite = +(bs * WEIGHTS.biodiversity + cs * WEIGHTS.carbon + ws * WEIGHTS.water + ls * WEIGHTS.land_degradation).toFixed(4);

    return {
      lat: cell.lat,
      lng: cell.lng,
      elevation: cell.elevation_normalized,
      carbon_score: cs,
      biodiversity_score: bs,
      water_score: ws,
      land_degradation_score: ls,
      composite_priority: composite
    };
  });

  const outPath = path.join(OUTPUT_DIR, 'training-data.json');
  await writeFile(outPath, JSON.stringify(trainingData));
  console.log(`Training data written: ${trainingData.length} cells → ${outPath}`);
  return trainingData;
}
