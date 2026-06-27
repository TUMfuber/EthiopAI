export const NEXT_RAW_TILE_SOURCES = new Set([
  'rgb',
  'ndvi',
  'chirp-rainfall',
  'srtm-slope',
]);

export function isNextRawTileSource(layerId: string) {
  return NEXT_RAW_TILE_SOURCES.has(layerId);
}
