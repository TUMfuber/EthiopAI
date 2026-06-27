import { rawLayerJson } from '../../../../modules/map-service/src/server/rawLayerData';

export async function GET(_request: Request, context: { params: Promise<{ layerId: string }> }) {
  const { layerId } = await context.params;

  return Response.json(await rawLayerJson(layerId), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
