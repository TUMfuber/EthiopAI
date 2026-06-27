import { readFile } from 'node:fs/promises';
import path from 'node:path';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

const LOCAL_LAYER_FILES: Record<string, string> = {
  admin_boundaries: 'resources/ethiopia_adm1_geoboundaries.geojson',
  key_biodiversity_areas: 'resources/ethiopia_key_biodiversity_areas.geojson',
  degraded_restorable_land: 'resources/precomputed/degraded_restorable_land.geojson',
  carbon_recovery_potential: 'resources/precomputed/carbon_recovery_potential.geojson',
  water_erosion_benefit: 'resources/precomputed/water_erosion_benefit.geojson',
  biodiversity_livelihood_value: 'resources/precomputed/biodiversity_livelihood_value.geojson',
  restoration_priority_score: 'resources/precomputed/restoration_priority_score.geojson',
};

export async function rawLayerJson(layerId: string) {
  const relativePath = LOCAL_LAYER_FILES[layerId];
  if (!relativePath) return EMPTY_FEATURE_COLLECTION;

  try {
    const filePath = path.join(process.cwd(), relativePath);
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return EMPTY_FEATURE_COLLECTION;
  }
}
