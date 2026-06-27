export const TILE_SIZE = 256;

export const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

export function responseBody(bytes: Uint8Array) {
  return Uint8Array.from(bytes).buffer;
}

export function transparentTile(headers: Record<string, string> = {}, status = 200) {
  return new Response(responseBody(TRANSPARENT_PNG), {
    status,
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': 'image/png',
      ...headers,
    },
  });
}

export function parseTileCoordinate(value: string) {
  const parsed = Number.parseInt(value.replace(/\.png$/i, ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function tileCornerLonLat(z: number, x: number, y: number) {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return [lon, (latRad * 180) / Math.PI] as const;
}

export function tileBounds(z: number, x: number, y: number) {
  const [west, north] = tileCornerLonLat(z, x, y);
  const [east, south] = tileCornerLonLat(z, x + 1, y + 1);
  return [west, south, east, north] as const;
}

export function metersPerPixel(z: number, latitude: number) {
  return (156543.03392804097 * Math.cos((latitude * Math.PI) / 180)) / 2 ** z;
}
