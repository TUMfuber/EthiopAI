import { NextRequest, NextResponse } from 'next/server';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { readFileSync } from 'fs';
import { join } from 'path';

const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const dynamo = new DynamoDBClient({ region: 'us-west-2' });
const TABLE = 'ethopai-recommendations';

function findNearestCell(lat: number, lng: number) {
  const raw = readFileSync(join(process.cwd(), 'public/data/priority-heatmap.geojson'), 'utf-8');
  const { features } = JSON.parse(raw);
  let best: any = null, bestDist = Infinity;
  for (const f of features) {
    const [fLng, fLat] = f.geometry.type === 'Point'
      ? f.geometry.coordinates
      : f.geometry.coordinates[0][0];
    const d = (fLat - lat) ** 2 + (fLng - lng) ** 2;
    if (d < bestDist) { bestDist = d; best = f.properties; }
  }
  return best;
}

async function getCached(key: string) {
  try {
    const { Item } = await dynamo.send(new GetItemCommand({ TableName: TABLE, Key: { filterKey: { S: key } } }));
    if (Item?.data?.S) return JSON.parse(Item.data.S);
  } catch {}
  return null;
}

async function setCache(key: string, data: any) {
  try {
    await dynamo.send(new PutItemCommand({
      TableName: TABLE,
      Item: { filterKey: { S: key }, data: { S: JSON.stringify(data) }, ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) } },
    }));
  } catch {}
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = parseFloat(sp.get('lat') ?? '0');
  const lng = parseFloat(sp.get('lng') ?? '0');
  const view = sp.get('view') as 'ngo' | 'investor' ?? 'ngo';

  const cacheKey = `analyze-${lat}-${lng}-${view}`;
  const cached = await getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  const cell = findNearestCell(lat, lng);

  const investorFields = `Return JSON with: location (string), intervention (string), confidence (string), carbonCredits (string, estimated tonnes/yr), roi (string, percentage), paybackPeriod (string), riskLevel (string: Low/Medium/High), marketPrice (string, USD estimate)`;
  const ngoFields = `Return JSON with: location (string), intervention (string), confidence (string), ecosystemImpact (string, score /100), speciesProtected (string, estimated count), communityBenefit (string), fundingEligibility (string: Eligible/Partial/Ineligible), preservationIndex (string, score /100)`;

  const prompt = `You are an ecological analysis engine for Ethiopia. Given this cell data from a priority heatmap:
${JSON.stringify(cell)}
Location: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E

${view === 'investor' ? investorFields : ngoFields}

Return ONLY valid JSON, no other text.`;

  try {
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: 'us.anthropic.claude-sonnet-4-6',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({ anthropic_version: 'bedrock-2023-05-31', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
    }));
    const body = JSON.parse(new TextDecoder().decode(response.body));
    const text = body.content?.[0]?.text ?? '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    await setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Analyze error:', error?.message ?? error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
