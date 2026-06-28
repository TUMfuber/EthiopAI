import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { enrichCell } from './enricher.js';
import { predict } from './predictor.js';

const s3 = new S3Client({ region: 'us-west-2' });
const BUCKET = process.env.CACHE_BUCKET || 'ethopai-grid-cache';

function subdivide(lat, lng, zoom) {
  const gridSize = zoom >= 10 ? 9 : 3;
  const cellSize = zoom >= 10 ? 0.005 : 0.02;
  const cells = [];
  const halfSpan = (gridSize * cellSize) / 2;
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      cells.push({
        lat: lat - halfSpan + (r + 0.5) * cellSize,
        lng: lng - halfSpan + (c + 0.5) * cellSize,
      });
    }
  }
  return { cells, cellSize };
}

function cellToPolygon(lat, lng, size) {
  const h = size / 2;
  return [[
    [lng - h, lat - h], [lng + h, lat - h],
    [lng + h, lat + h], [lng - h, lat + h],
    [lng - h, lat - h],
  ]];
}

async function getBaseScore(lat, lng) {
  const key = `scores/${lat.toFixed(2)}_${lng.toFixed(2)}.json`;
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return JSON.parse(await res.Body.transformToString());
  } catch { return { priority: 0.5, carbon_score: 0.5, water_score: 0.5, biodiversity_score: 0.5, soil_score: 0.5, elevation: null, ndvi: null, precipitation: null }; }
}

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const lat = parseFloat(params.lat);
  const lng = parseFloat(params.lng);
  const zoom = parseInt(params.zoom, 10);

  if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'lat, lng, zoom required' }) };
  }

  // Zoom 6-7: base grid cell
  if (zoom <= 7) {
    const score = await getBaseScore(lat, lng);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: cellToPolygon(lat, lng, 0.1) },
          properties: { ...score },
        }],
      }),
    };
  }

  // Zoom 8-9: 3x3 with enrichment; Zoom 10+: 9x9 with ML prediction
  const { cells, cellSize } = subdivide(lat, lng, zoom);
  const enriched = await Promise.all(cells.map(c => enrichCell(c.lat, c.lng)));
  const predictions = await predict(enriched);

  const features = cells.map((c, i) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: cellToPolygon(c.lat, c.lng, cellSize) },
    properties: {
      ...predictions[i],
      elevation: enriched[i].elevation,
      ndvi: enriched[i].ndvi,
      precipitation: enriched[i].precipitation,
    },
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'FeatureCollection', features }),
  };
}
