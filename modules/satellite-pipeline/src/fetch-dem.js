import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { fromCogeoTiff } from 'geotiff';
import * as GeoTIFF from 'geotiff';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

const LAT_MIN = 3, LAT_MAX = 15, LNG_MIN = 33, LNG_MAX = 48;
const ZOOM = 10;
const RESOLUTION = 0.1;

function latLngToTile(lat, lng, zoom) {
  const n = 2 ** zoom;
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { x, y };
}

function tileBounds(x, y, zoom) {
  const n = 2 ** zoom;
  const lngMin = x / n * 360 - 180;
  const lngMax = (x + 1) / n * 360 - 180;
  const latMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  const latMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
  return { latMin, latMax, lngMin, lngMax };
}

export async function fetchDEM() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const s3 = new S3Client({ region: 'us-east-1' });
  const topLeft = latLngToTile(LAT_MAX, LNG_MIN, ZOOM);
  const bottomRight = latLngToTile(LAT_MIN, LNG_MAX, ZOOM);

  // Collect elevation samples per grid cell
  const grid = new Map();
  const rows = Math.round((LAT_MAX - LAT_MIN) / RESOLUTION);
  const cols = Math.round((LNG_MAX - LNG_MIN) / RESOLUTION);

  // Initialize grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lat = LAT_MAX - (r + 0.5) * RESOLUTION;
      const lng = LNG_MIN + (c + 0.5) * RESOLUTION;
      grid.set(`${r},${c}`, { lat: +lat.toFixed(2), lng: +lng.toFixed(2), elevation: null });
    }
  }

  let minElev = Infinity, maxElev = -Infinity;
  const elevations = new Map();

  console.log(`Fetching DEM tiles (x: ${topLeft.x}-${bottomRight.x}, y: ${topLeft.y}-${bottomRight.y})...`);

  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      try {
        const key = `geotiff/${ZOOM}/${x}/${y}.tif`;
        const resp = await s3.send(new GetObjectCommand({
          Bucket: 'elevation-tiles-prod',
          Key: key,
          RequestPayer: 'requester'
        }));
        const bytes = await resp.Body.transformToByteArray();
        const tiff = await GeoTIFF.fromArrayBuffer(bytes.buffer);
        const image = await tiff.getImage();
        const rasters = await image.readRasters();
        const data = rasters[0];
        const w = image.getWidth();
        const h = image.getHeight();
        const bounds = tileBounds(x, y, ZOOM);

        // Sample at grid resolution
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const lat = LAT_MAX - (r + 0.5) * RESOLUTION;
            const lng = LNG_MIN + (c + 0.5) * RESOLUTION;
            if (lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax) {
              const px = Math.floor((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin) * w);
              const py = Math.floor((bounds.latMax - lat) / (bounds.latMax - bounds.latMin) * h);
              const idx = py * w + px;
              if (idx >= 0 && idx < data.length) {
                const elev = data[idx];
                if (elev > -500) {
                  elevations.set(`${r},${c}`, elev);
                  if (elev < minElev) minElev = elev;
                  if (elev > maxElev) maxElev = elev;
                }
              }
            }
          }
        }
      } catch (e) {
        // Skip missing tiles
      }
    }
  }

  // Normalize and build output
  const range = maxElev - minElev || 1;
  const output = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const cell = grid.get(key);
      const elev = elevations.get(key);
      cell.elevation_normalized = elev != null ? +((elev - minElev) / range).toFixed(4) : 0;
      output.push(cell);
    }
  }

  const outPath = path.join(OUTPUT_DIR, 'ethiopia-dem.json');
  await writeFile(outPath, JSON.stringify(output));
  console.log(`DEM grid written: ${output.length} cells → ${outPath}`);
  return output;
}
