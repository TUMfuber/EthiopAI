import { readFileSync } from "fs";
import * as shapefile from "shapefile";
import { scoreBiodiversity, scoreCarbon, scoreProjectDensity } from "./priority-scorer.js";

// Ethiopia bounding box
const BOUNDS = { minLat: 3.4, maxLat: 14.9, minLng: 33.0, maxLng: 48.0 };
const CELL_SIZE = 0.5; // degrees (~55km)

const SCORING_MODES = ["biodiversity", "carbon", "project_density"];

export async function buildZoneLayers(projectsPath, kbaShapefilePath) {
  const projects = JSON.parse(readFileSync(projectsPath, "utf-8"));

  // Load KBA shapefile
  let kbaFeatures = [];
  try {
    const source = await shapefile.open(kbaShapefilePath);
    let result = await source.read();
    while (!result.done) {
      kbaFeatures.push(result.value);
      result = await source.read();
    }
    console.log(`  Loaded ${kbaFeatures.length} KBA features`);
  } catch (e) {
    console.log(`  KBA shapefile not found, scoring without biodiversity`);
  }

  // Build grid
  const grid = [];
  for (let lat = BOUNDS.minLat; lat < BOUNDS.maxLat; lat += CELL_SIZE) {
    for (let lng = BOUNDS.minLng; lng < BOUNDS.maxLng; lng += CELL_SIZE) {
      grid.push({ lat: lat + CELL_SIZE / 2, lng: lng + CELL_SIZE / 2, size: CELL_SIZE });
    }
  }
  console.log(`  Grid: ${grid.length} cells (${CELL_SIZE}° resolution)`);

  // Score each cell for each mode
  const scores = {};
  for (const mode of SCORING_MODES) {
    scores[mode] = grid.map((cell) => {
      switch (mode) {
        case "biodiversity": return scoreBiodiversity(cell, kbaFeatures);
        case "carbon": return scoreCarbon(cell, projects);
        case "project_density": return scoreProjectDensity(cell, projects);
        default: return 0;
      }
    });
  }

  // Apply Gaussian blur to smooth the scores
  const layers = {};
  for (const mode of SCORING_MODES) {
    const blurred = gaussianBlur(scores[mode], grid);
    layers[mode] = gridToGeoJSON(grid, blurred);
    console.log(`  Layer "${mode}": ${layers[mode].features.length} cells with score > 0`);
  }

  return layers;
}

// 3x3 Gaussian blur on grid scores
function gaussianBlur(scores, grid) {
  const cols = Math.round((BOUNDS.maxLng - BOUNDS.minLng) / CELL_SIZE);
  const rows = Math.round((BOUNDS.maxLat - BOUNDS.minLat) / CELL_SIZE);
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ];
  const kernelSum = 16;
  const output = new Array(scores.length).fill(0);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let kr = -1; kr <= 1; kr++) {
        for (let kc = -1; kc <= 1; kc++) {
          const nr = r + kr, nc = c + kc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            sum += scores[nr * cols + nc] * kernel[kr + 1][kc + 1];
          }
        }
      }
      output[r * cols + c] = sum / kernelSum;
    }
  }
  return output;
}

// Convert scored grid to GeoJSON (only cells with score > 0.05)
function gridToGeoJSON(grid, scores) {
  const features = [];
  for (let i = 0; i < grid.length; i++) {
    if (scores[i] < 0.05) continue;
    const { lat, lng, size } = grid[i];
    const half = size / 2;
    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [lng - half, lat - half],
          [lng + half, lat - half],
          [lng + half, lat + half],
          [lng - half, lat + half],
          [lng - half, lat - half],
        ]],
      },
      properties: {
        score: Math.round(scores[i] * 100) / 100,
        priority: scores[i] > 0.6 ? "most" : scores[i] > 0.3 ? "middle" : "least",
      },
    });
  }
  return { type: "FeatureCollection", features };
}
