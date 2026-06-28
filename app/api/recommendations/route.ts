import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { readFileSync } from 'fs';
import { join } from 'path';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const dynamo = new DynamoDBClient({ region: 'us-west-2' });
const TABLE = 'ethopai-recommendations';

function jitter() {
  return (Math.random() - 0.5) * 0.1; // ±0.05°
}

function shuffleSimilar(zones: any[]) {
  for (let i = 0; i < zones.length; i++) {
    let j = i;
    while (j < zones.length && Math.abs(zones[j].priority - zones[i].priority) < 0.05) j++;
    // Fisher-Yates shuffle within the similar block
    for (let k = j - 1; k > i; k--) {
      const r = i + Math.floor(Math.random() * (k - i + 1));
      [zones[k], zones[r]] = [zones[r], zones[k]];
    }
    i = j - 1;
  }
  return zones;
}

function loadTopZones(filters: string[]) {
  const raw = readFileSync(join(process.cwd(), 'public/data/priority-heatmap.geojson'), 'utf-8');
  const geojson = JSON.parse(raw);
  const features: any[] = geojson.features ?? [];
  const filtered = filters.length > 0
    ? features.filter((f: any) => filters.some(cat => f.properties.category?.toLowerCase() === cat))
    : features;
  const sorted = filtered
    .sort((a: any, b: any) => (b.properties.priority ?? 0) - (a.properties.priority ?? 0))
    .slice(0, 20)
    .map((f: any) => ({
      priority: f.properties.priority,
      category: f.properties.category,
      location: f.properties.location ?? 'Unknown',
      lat: (f.properties.lat ?? 0) + jitter(),
      lng: (f.properties.lng ?? 0) + jitter(),
    }));
  return shuffleSimilar(sorted);
}

async function getCached(key: string) {
  try {
    const { Item } = await dynamo.send(new GetItemCommand({ TableName: TABLE, Key: { filterKey: { S: key } } }));
    if (Item?.data?.S) return JSON.parse(Item.data.S);
  } catch {}
  return null;
}

async function setCache(key: string, data: any[]) {
  try {
    await dynamo.send(new PutItemCommand({
      TableName: TABLE,
      Item: { filterKey: { S: key }, data: { S: JSON.stringify(data) }, ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) } },
    }));
  } catch {}
}

export async function GET(request: NextRequest) {
  const filters = (request.nextUrl.searchParams.get('filters') ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const cacheKey = filters.sort().join(',') || 'all';

  // Check DynamoDB cache first
  const cached = await getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  const zones = loadTopZones(filters);
  if (zones.length === 0) return NextResponse.json([]);

  const prompt = `You are an ecological intervention advisor for Ethiopia. Given these high-priority zones, recommend ONE specific intervention per zone.

Priority Zones:
${JSON.stringify(zones, null, 2)}

Return a JSON array (no other text) with exactly ${zones.length} objects:
- id: unique string
- priority: number from zone
- title: short action title
- description: 1-2 sentences
- impact: estimated benefit
- location: zone name
- category: from input
- lat: from zone
- lng: from zone`;

  try {
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: 'us.anthropic.claude-sonnet-4-6',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    }));
    const body = JSON.parse(new TextDecoder().decode(response.body));
    const text = body.content?.[0]?.text ?? '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Cache in DynamoDB
    await setCache(cacheKey, recommendations);

    return NextResponse.json(recommendations);
  } catch (error: any) {
    console.error('Bedrock error:', error?.message ?? error);
    return NextResponse.json([], { status: 200 });
  }
}
