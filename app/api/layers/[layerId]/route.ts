import { rawLayerJson } from '../../../../modules/map-service/src/server/rawLayerData';

export async function GET(request: Request, context: { params: Promise<{ layerId: string }> }) {
  const { layerId } = await context.params;
  const url = new URL(request.url);
  const zoom = parseInt(url.searchParams.get('zoom') ?? '6', 10);

  const data = await rawLayerJson(layerId);

  // Dynamic LOD: thin features at low zoom for performance
  if (data.features && data.features.length > 0) {
    const step = zoom >= 8 ? 1 : zoom >= 6 ? 2 : 4;
    if (step > 1) {
      data.features = data.features.filter((_: any, i: number) => i % step === 0);
    }
  }

  return Response.json(data, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
