import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { readFileSync } from 'fs';
import { join } from 'path';

const bedrock = new BedrockRuntimeClient({ region: 'eu-central-1' });

function loadTopZones(filters: string[]) {
  const raw = readFileSync(join(process.cwd(), 'public/data/priority-heatmap.geojson'), 'utf-8');
  const geojson = JSON.parse(raw);
  const features: any[] = geojson.features ?? [];

  const filtered = filters.length > 0
    ? features.filter((f: any) => filters.some((cat) => f.properties.category?.toLowerCase() === cat))
    : features;

  return filtered
    .sort((a: any, b: any) => (b.properties.priority ?? 0) - (a.properties.priority ?? 0))
    .slice(0, 10)
    .map((f: any) => ({
      priority: f.properties.priority,
      category: f.properties.category,
      location: f.properties.location ?? f.properties.name ?? 'Unknown',
      coordinates: f.geometry.coordinates,
    }));
}

export async function GET(request: NextRequest) {
  const filters = (request.nextUrl.searchParams.get('filters') ?? '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  const zones = loadTopZones(filters);

  const prompt = `You are an ecological intervention advisor for Ethiopia. Given these top priority zones, recommend specific ecological interventions. For each zone, suggest one intervention from: reforestation, wetland restoration, soil rehabilitation, agroforestry, terracing, or watershed management.

Priority Zones:
${JSON.stringify(zones, null, 2)}

Return a JSON array (no other text) with exactly ${zones.length} objects, each having:
- id: unique string
- priority: number (from zone data)
- title: short action title
- description: 1-2 sentence description of the intervention
- impact: estimated carbon credit potential or ecological benefit (e.g. "~500 tCO2e/yr")
- location: zone location name
- category: the filter category (biodiversity/carbon/soil/water)`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
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
    console.error('Bedrock error:', error);
    return NextResponse.json(
      [{ id: '1', priority: 0.9, title: 'Service unavailable', description: 'AI recommendations temporarily unavailable.', impact: 'N/A', location: 'N/A', category: filters[0] ?? 'general' }],
      { status: 200 },
    );
  }
}
