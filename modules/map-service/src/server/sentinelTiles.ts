import { metersPerPixel, tileBounds, transparentTile } from './tileUtils';
import { serverEnv } from './serverEnv';

type SentinelProduct = 'rgb' | 'ndvi';

const PROCESS_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';
const TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const MIN_SENTINEL_ZOOM = 6;
const SENTINEL_MAX_METERS_PER_PIXEL = 1500;
const TILE_OUTPUT_SIZE = 256;
const LOW_ZOOM_OUTPUT_SIZE = 512;

const RGB_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: ["B04", "B03", "B02", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  return [
    2.5 * sample.B04,
    2.5 * sample.B03,
    2.5 * sample.B02,
    sample.dataMask
  ];
}
`.trim();

const NDVI_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: { bands: 4, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  let value = Math.max(0.0, Math.min(1.0, (ndvi + 1.0) / 2.0));
  return [
    1.0 - value,
    value,
    0.0,
    sample.dataMask
  ];
}
`.trim();

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentials() {
  const clientId = serverEnv('SENTINEL_HUB_CLIENT_ID');
  const clientSecret = serverEnv('SENTINEL_HUB_CLIENT_SECRET');
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function evalscriptForProduct(product: SentinelProduct) {
  if (product === 'rgb') return RGB_EVALSCRIPT;
  return NDVI_EVALSCRIPT;
}

async function accessToken() {
  const creds = credentials();
  if (!creds) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) return null;

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 300) * 1000,
  };
  return cachedToken.value;
}

function outputSizeForTile(z: number, bounds: readonly [number, number, number, number]) {
  const [, south, , north] = bounds;
  const metersPerOutputPixel = metersPerPixel(z, (south + north) / 2);

  return metersPerOutputPixel > SENTINEL_MAX_METERS_PER_PIXEL ? LOW_ZOOM_OUTPUT_SIZE : TILE_OUTPUT_SIZE;
}

function processPayload(bounds: readonly [number, number, number, number], product: SentinelProduct, outputSize: number) {
  return {
    input: {
      bounds: {
        bbox: [...bounds],
        properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: {
            timeRange: {
              from: serverEnv('SENTINEL_HUB_START') ?? '2026-01-01T00:00:00Z',
              to: serverEnv('SENTINEL_HUB_END') ?? '2026-03-31T23:59:59Z',
            },
            maxCloudCoverage: Number.parseInt(serverEnv('SENTINEL_HUB_MAX_CLOUD') ?? '40', 10),
            mosaickingOrder: 'leastCC',
          },
        },
      ],
    },
    output: {
      width: outputSize,
      height: outputSize,
      responses: [{ identifier: 'default', format: { type: 'image/png' } }],
    },
    evalscript: evalscriptForProduct(product),
  };
}

export function isSentinelProduct(layerId: string): layerId is SentinelProduct {
  return layerId === 'rgb' || layerId === 'ndvi';
}

export async function sentinelTile(z: number, x: number, y: number, product: SentinelProduct) {
  try {
    if (z < MIN_SENTINEL_ZOOM) {
      return transparentTile({
        'X-Sentinel-Hub-Status': 'unsupported-resolution',
        'X-Sentinel-Min-Zoom': String(MIN_SENTINEL_ZOOM),
      });
    }

    const token = await accessToken();
    if (!token) {
      const status = credentials() ? 'auth-error' : 'missing-credentials';
      return transparentTile({ 'X-Sentinel-Hub-Status': status });
    }

    const bounds = tileBounds(z, x, y);
    const outputSize = outputSizeForTile(z, bounds);
    const response = await fetch(PROCESS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'image/png',
      },
      body: JSON.stringify(processPayload(bounds, product, outputSize)),
    });

    if (!response.ok || !response.body) {
      return transparentTile({ 'X-Sentinel-Hub-Status': 'empty-or-error' });
    }

    return new Response(response.body, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': response.headers.get('Content-Type') ?? 'image/png',
        'X-Sentinel-Output-Size': String(outputSize),
      },
    });
  } catch {
    return transparentTile({ 'X-Sentinel-Hub-Status': 'unexpected-error' });
  }
}
