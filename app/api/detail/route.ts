import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const boundsStr = searchParams.get('bounds') ?? '';
  const [swLat, swLng, neLat, neLng] = boundsStr.split(',').map(Number);

  if ([swLat, swLng, neLat, neLng].some(isNaN)) {
    return NextResponse.json({ error: 'Invalid bounds' }, { status: 400 });
  }

  const filePath = join(process.cwd(), 'public', 'data', 'priority-heatmap.geojson');
  const raw = await readFile(filePath, 'utf-8');
  const geojson = JSON.parse(raw);

  const matching = (geojson.features ?? []).filter((f: any) => {
    const coords = f.geometry?.coordinates?.[0];
    if (!coords) return false;
    const cLat = (coords[0][1] + coords[2][1]) / 2;
    const cLng = (coords[0][0] + coords[2][0]) / 2;
    return cLat >= swLat && cLat <= neLat && cLng >= swLng && cLng <= neLng;
  });

  const subFeatures: any[] = [];
  for (const f of matching) {
    const coords = f.geometry.coordinates[0];
    const minLng = coords[0][0];
    const minLat = coords[0][1];
    const maxLng = coords[2][0];
    const maxLat = coords[2][1];
    const dLat = (maxLat - minLat) / 3;
    const dLng = (maxLng - minLng) / 3;
    const base = f.properties.priority ?? 0;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const sLat = minLat + r * dLat;
        const sLng = minLng + c * dLng;
        const variation = (Math.random() - 0.5) * 0.15;
        const priority = Math.max(0, Math.min(1, base + variation));
        subFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[sLng, sLat], [sLng + dLng, sLat], [sLng + dLng, sLat + dLat], [sLng, sLat + dLat], [sLng, sLat]]],
          },
          properties: { priority: +priority.toFixed(3), category: f.properties.category, location: f.properties.location },
        });
      }
    }
  }

  return NextResponse.json({ type: 'FeatureCollection', features: subFeatures });
}
