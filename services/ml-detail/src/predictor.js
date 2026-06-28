import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime';

const client = new SageMakerRuntimeClient({ region: 'us-west-2' });
const ENDPOINT = 'ethopai-priority-endpoint';

function heuristic(features) {
  const ndvi = features.ndvi ?? 0.5;
  const precip = features.precipitation ?? 2;
  const soc = features.soil_carbon ?? 15;
  const elev = features.elevation ?? 500;

  const precipNorm = Math.min(precip / 10, 1);
  const socNorm = Math.min(soc / 50, 1);
  const slopeNorm = Math.min(elev / 3000, 1);
  const climateSuit = precipNorm * 0.7 + 0.3;
  const habitatConn = ndvi > 0.3 ? 0.8 : 0.4;

  const carbon_score = (1 - ndvi) * climateSuit * socNorm;
  const water_score = precipNorm * slopeNorm * (1 - ndvi);
  const biodiversity_score = ndvi * habitatConn;
  const soil_score = socNorm * (1 - slopeNorm * 0.3);
  const priority = carbon_score * 0.3 + water_score * 0.2 + biodiversity_score * 0.3 + soil_score * 0.2;

  return { priority, carbon_score, water_score, biodiversity_score, soil_score };
}

export async function predict(cellsData) {
  try {
    const cmd = new InvokeEndpointCommand({
      EndpointName: ENDPOINT,
      ContentType: 'application/json',
      Body: JSON.stringify(cellsData),
    });
    const res = await client.send(cmd);
    return JSON.parse(Buffer.from(res.Body).toString());
  } catch {
    return cellsData.map(heuristic);
  }
}
