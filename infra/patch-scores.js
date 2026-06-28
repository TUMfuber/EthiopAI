#!/usr/bin/env node
// Patches precomputed GeoJSON files with distinct carbon/water/soil scores
// Run: node infra/patch-scores.js

const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'resources', 'precomputed');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.geojson'));
let total = 0;

files.forEach(file => {
  const filepath = path.join(dir, file);
  const d = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  if (!d.features) return;

  d.features.forEach(feat => {
    const p = feat.properties;
    const rain = (p.seasonal_rainfall_mm || 100) / 400;
    const slope = (p.slope_p90 || 5) / 25;
    const climate = p.climate_suitability || 0;
    const tree = p.tree_fraction || 0;
    const elig = p.landcover_eligibility || 0.5;
    const bare = p.bare_sparse_fraction || 0;
    const crop = p.cropland_fraction || 0;
    const grass = p.grassland_fraction || 0;

    // Carbon: good climate + few trees + eligible land = reforestation potential
    p.carbon_recovery_score = Math.round(Math.min(100,
      climate * 100 * (1 - tree) * elig + rain * 20
    ));

    // Water: heavy rain + steep slopes = erosion risk needing intervention
    p.water_erosion_score = Math.round(Math.min(100,
      rain * 60 + slope * 40
    ));

    // Soil/Degradation: bare land + cropland without trees = degraded
    p.degraded_restorable_land_score = Math.round(Math.min(50,
      bare * 30 + (1 - tree) * crop * 20 + grass * (1 - tree) * 10
    ));
  });

  fs.writeFileSync(filepath, JSON.stringify(d));
  total += d.features.length;
  console.log(`✓ ${file}: ${d.features.length} cells patched`);
});

console.log(`\nDone. ${total} total cells across ${files.length} files.`);
console.log('Now run: cd modules/satellite-pipeline && node src/generate-heatmap.js');
