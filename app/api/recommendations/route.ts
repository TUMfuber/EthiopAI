import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { readFileSync } from 'fs';
import { join } from 'path';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });

function loadTopZones(filters: string[]) {
  const raw = readFileSync(join(process.cwd(), 'public/data/priority-heatmap.geojson'), 'utf-8');
  const geojson = JSON.parse(raw);
  const features: any[] = geojson.features ?? [];

  const filtered = filters.length > 0
    ? features.filter((f: any) => filters.some(cat => f.properties.category?.toLowerCase() === cat))
    : features;

  return filtered
    .sort((a: any, b: any) => (b.properties.priority ?? 0) - (a.properties.priority ?? 0))
    .slice(0, 10)
    .map((f: any) => ({
      priority: f.properties.priority,
      category: f.properties.category,
      location: f.properties.location ?? 'Unknown',
      lat: f.properties.lat,
      lng: f.properties.lng,
    }));
}

export async function GET(request: NextRequest) {
  const filters = (request.nextUrl.searchParams.get('filters') ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const zones = loadTopZones(filters);

  const prompt = `You are an ecological intervention advisor for Ethiopia. Given these high-priority zones, recommend ONE specific intervention per zone. Be precise about what to do at each exact location.

Priority Zones (with coordinates):
${JSON.stringify(zones, null, 2)}

Return a JSON array (no other text) with exactly ${zones.length} objects:
- id: unique string (e.g. "rec-1")
- priority: number from zone
- title: short action (e.g. "Reforestation - Native Juniperus")
- description: 1-2 sentences about the specific intervention
- impact: estimated benefit (e.g. "~2,500 tCO2e/yr" or "Restore 500ha wetland habitat")
- location: zone name from input
- category: from input
- lat: exact latitude from zone
- lng: exact longitude from zone`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'us.anthropic.claude-sonnet-4-6',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const response = await bedrock.send(command);
    const body = JSON.parse(new TextDecoder().decode(response.body));
    const text = body.content?.[0]?.text ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json(recommendations);
  } catch (error: any) {
    console.error('Bedrock error:', error?.message ?? error);
    return NextResponse.json([], { status: 200 });
  }
}
