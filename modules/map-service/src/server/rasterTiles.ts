import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { metersPerPixel, responseBody, TILE_SIZE, tileBounds, transparentTile } from './tileUtils';

const NODATA = -9999;
const CHIRP_FILE_NAME = 'chirp-v3.0.2025.091011120102.tif';
const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

type ChirpData = {
  values: Float32Array;
  width: number;
  height: number;
  minLon: number;
  maxLat: number;
  pixelWidth: number;
  pixelHeight: number;
};

let chirpDataPromise: Promise<ChirpData | null> | null = null;
const tileCache = new Map<string, Buffer>();

function pngResponse(tile: Buffer, maxAge = 86400) {
  return new Response(responseBody(tile), {
    headers: { 'Cache-Control': `public, max-age=${maxAge}`, 'Content-Type': 'image/png' },
  });
}

function cacheGet(key: string) {
  return tileCache.get(key);
}

function cacheSet(key: string, value: Buffer) {
  if (tileCache.size > 512) {
    const oldestKey = tileCache.keys().next().value;
    if (oldestKey) tileCache.delete(oldestKey);
  }
  tileCache.set(key, value);
}

async function loadChirpData() {
  if (chirpDataPromise) return chirpDataPromise;

  chirpDataPromise = (async () => {
    const filePath = path.join(process.cwd(), 'resources', CHIRP_FILE_NAME);
    if (!existsSync(filePath)) return null;

    const { data, info } = await sharp(filePath, { limitInputPixels: false })
      .greyscale()
      .raw({ depth: 'float' })
      .toBuffer({ resolveWithObject: true });

    return {
      values: new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4),
      width: info.width,
      height: info.height,
      minLon: -180,
      maxLat: 60,
      pixelWidth: 360 / info.width,
      pixelHeight: 120 / info.height,
    };
  })().catch(() => null);

  return chirpDataPromise;
}

async function pngFromRgba(rgba: Uint8Array) {
  return sharp(rgba, {
    raw: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

export async function chirpRainfallTile(z: number, x: number, y: number) {
  const cacheKey = `chirp:${z}/${x}/${y}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return pngResponse(cached);
  }

  try {
    const rainfall = await loadChirpData();
    if (!rainfall) return transparentTile({ 'X-CHIRP-Status': 'missing-raster' });

    const [west, south, east, north] = tileBounds(z, x, y);
    const rgba = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);

    for (let py = 0; py < TILE_SIZE; py += 1) {
      const lat = north - ((north - south) * (py + 0.5)) / TILE_SIZE;
      const sourceY = Math.floor((rainfall.maxLat - lat) / rainfall.pixelHeight);
      const validY = sourceY >= 0 && sourceY < rainfall.height;

      for (let px = 0; px < TILE_SIZE; px += 1) {
        const lon = west + ((east - west) * (px + 0.5)) / TILE_SIZE;
        const sourceX = Math.floor((lon - rainfall.minLon) / rainfall.pixelWidth);
        const validX = sourceX >= 0 && sourceX < rainfall.width;
        if (!validX || !validY) continue;

        const value = rainfall.values[sourceY * rainfall.width + sourceX];
        if (!Number.isFinite(value) || value <= NODATA + 1) continue;

        const intensity = Math.max(0, Math.min(1, value / 1200));
        const offset = (py * TILE_SIZE + px) * 4;
        rgba[offset] = Math.round(230 * (1 - intensity) + 20 * intensity);
        rgba[offset + 1] = Math.round(243 * (1 - intensity) + 91 * intensity);
        rgba[offset + 2] = Math.round(255 * (1 - intensity) + 185 * intensity);
        rgba[offset + 3] = Math.round(45 + 175 * intensity);
      }
    }

    const tile = await pngFromRgba(rgba);
    cacheSet(cacheKey, tile);
    return pngResponse(tile);
  } catch {
    return transparentTile({ 'X-CHIRP-Status': 'empty-or-error' });
  }
}

async function terrariumTile(z: number, x: number, y: number) {
  const url = TERRARIUM_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  const response = await fetch(url);
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

function elevationAt(data: Buffer, channels: number, index: number) {
  const offset = index * channels;
  return data[offset] * 256 + data[offset + 1] + data[offset + 2] / 256 - 32768;
}

function gradient(values: Float32Array, x: number, y: number, axis: 'x' | 'y', resolution: number) {
  if (axis === 'x') {
    if (x === 0) return (values[y * TILE_SIZE + 1] - values[y * TILE_SIZE]) / resolution;
    if (x === TILE_SIZE - 1) {
      return (values[y * TILE_SIZE + x] - values[y * TILE_SIZE + x - 1]) / resolution;
    }
    return (values[y * TILE_SIZE + x + 1] - values[y * TILE_SIZE + x - 1]) / (2 * resolution);
  }

  if (y === 0) return (values[TILE_SIZE + x] - values[x]) / resolution;
  if (y === TILE_SIZE - 1) {
    return (values[y * TILE_SIZE + x] - values[(y - 1) * TILE_SIZE + x]) / resolution;
  }
  return (values[(y + 1) * TILE_SIZE + x] - values[(y - 1) * TILE_SIZE + x]) / (2 * resolution);
}

export async function srtmSlopeTile(z: number, x: number, y: number) {
  const cacheKey = `slope:${z}/${x}/${y}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return pngResponse(cached);
  }

  try {
    const source = await terrariumTile(z, x, y);
    if (!source) return transparentTile({ 'X-Terrain-Status': 'empty-or-error' });

    const { data, info } = await sharp(source).raw().toBuffer({ resolveWithObject: true });
    const [_, south, __, north] = tileBounds(z, x, y);
    const resolution = metersPerPixel(z, (south + north) / 2);
    const elevations = new Float32Array(TILE_SIZE * TILE_SIZE);

    for (let index = 0; index < elevations.length; index += 1) {
      elevations[index] = elevationAt(data, info.channels, index);
    }

    const rgba = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);
    for (let py = 0; py < TILE_SIZE; py += 1) {
      for (let px = 0; px < TILE_SIZE; px += 1) {
        const gx = gradient(elevations, px, py, 'x', resolution);
        const gy = gradient(elevations, px, py, 'y', resolution);
        const slope = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
        const value = Math.max(0, Math.min(1, slope / 35));
        const offset = (py * TILE_SIZE + px) * 4;
        rgba[offset] = Math.round(245 * value + 244 * (1 - value));
        rgba[offset + 1] = Math.round(91 * value + 211 * (1 - value));
        rgba[offset + 2] = Math.round(42 * value + 170 * (1 - value));
        rgba[offset + 3] = Math.round(45 + 175 * value);
      }
    }

    const tile = await pngFromRgba(rgba);
    cacheSet(cacheKey, tile);
    return pngResponse(tile);
  } catch {
    return transparentTile({ 'X-Terrain-Status': 'empty-or-error' });
  }
}
