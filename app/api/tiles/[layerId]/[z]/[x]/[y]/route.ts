import { chirpRainfallTile, srtmSlopeTile } from '../../../../../../../modules/map-service/src/server/rasterTiles';
import { isNextRawTileSource } from '../../../../../../../modules/map-service/src/server/rawTileSources';
import { isSentinelProduct, sentinelTile } from '../../../../../../../modules/map-service/src/server/sentinelTiles';
import { parseTileCoordinate, transparentTile } from '../../../../../../../modules/map-service/src/server/tileUtils';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ layerId: string; z: string; x: string; y: string }> }) {
  const { layerId, z, x, y } = await context.params;
  const zValue = parseTileCoordinate(z);
  const xValue = parseTileCoordinate(x);
  const yValue = parseTileCoordinate(y);

  if (zValue === null || xValue === null || yValue === null) {
    return transparentTile({}, 404);
  }

  if (!isNextRawTileSource(layerId)) {
    return transparentTile({}, 404);
  }

  if (isSentinelProduct(layerId)) {
    return sentinelTile(zValue, xValue, yValue, layerId);
  }

  if (layerId === 'chirp-rainfall') {
    return chirpRainfallTile(zValue, xValue, yValue);
  }

  if (layerId === 'srtm-slope') {
    return srtmSlopeTile(zValue, xValue, yValue);
  }

  return transparentTile({}, 404);
}
