import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import { writeFileSync, mkdirSync } from "fs";

const REGION = "us-west-2";
const ENDPOINT_NAME = "ethopai-priority-endpoint";
const client = new SageMakerRuntimeClient({ region: REGION });

async function invokeEndpoint(cells) {
  const { Body } = await client.send(new InvokeEndpointCommand({
    EndpointName: ENDPOINT_NAME,
    ContentType: "application/json",
    Body: JSON.stringify(cells)
  }));
  return JSON.parse(new TextDecoder().decode(Body));
}

async function main() {
  const grid = [];
  for (let lat = 3; lat <= 15; lat += 0.1) {
    for (let lng = 33; lng <= 48; lng += 0.1) {
      grid.push({ lat: +lat.toFixed(1), lng: +lng.toFixed(1), elevation: 0.5, carbon: 0.5, biodiversity: 0.5, water: 0.5, land_degradation: 0.5 });
    }
  }

  const features = [];
  const BATCH = 500;

  for (let i = 0; i < grid.length; i += BATCH) {
    const batch = grid.slice(i, i + BATCH);
    const cells = batch.map(({ elevation, carbon, biodiversity, water, land_degradation }) => ({ elevation, carbon, biodiversity, water, land_degradation }));
    const results = await invokeEndpoint(cells);
    for (let j = 0; j < batch.length; j++) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [batch[j].lng, batch[j].lat] },
        properties: { priority: results[j].priority }
      });
    }
    if (i % 5000 === 0) console.log(`Processed ${i + batch.length}/${grid.length}`);
  }

  const geojson = { type: "FeatureCollection", features };
  mkdirSync("output", { recursive: true });
  writeFileSync("output/priority-heatmap.geojson", JSON.stringify(geojson));
  console.log(`Done. ${features.length} points written to output/priority-heatmap.geojson`);
}

main().catch(console.error);
