import { GeoJSON } from 'react-leaflet';
import type { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import type { EthopaiLayerConfig } from '../layers/ethopaiLayers';

type EthopaiLayerRendererProps = {
  layer: EthopaiLayerConfig;
  data?: FeatureCollection;
};

function numericProperty(properties: GeoJsonProperties | null | undefined, key: string) {
  const value = properties?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scoreColor(score: number | null, maxScore: number) {
  if (score === null || maxScore <= 0) return '#d1d5db';

  const ratio = Math.max(0, Math.min(1, score / maxScore));
  if (ratio >= 0.8) return '#166534';
  if (ratio >= 0.6) return '#16a34a';
  if (ratio >= 0.4) return '#84cc16';
  if (ratio >= 0.2) return '#facc15';
  return '#f97316';
}

function featureScore(feature: Feature, layer: EthopaiLayerConfig) {
  return numericProperty(feature.properties, layer.scoreProperty) ?? numericProperty(feature.properties, 'score');
}

export default function EthopaiLayerRenderer({ layer, data }: EthopaiLayerRendererProps) {
  if (!data) return null;

  return (
    <GeoJSON
      key={layer.id}
      data={data}
      style={(feature) => {
        const score = feature ? featureScore(feature as Feature, layer) : null;
        const hasScore = score !== null;
        return {
          color: hasScore ? '#14532d' : '#9ca3af',
          weight: hasScore ? 0.8 : 0.4,
          fillColor: scoreColor(score, layer.maxScore),
          fillOpacity: hasScore ? 0.42 : 0.1,
        };
      }}
      onEachFeature={(feature, leafletLayer) => {
        const properties = feature.properties as Record<string, unknown> | undefined;
        const name = typeof properties?.name === 'string' ? properties.name : layer.name;
        const region = typeof properties?.admin_region === 'string' ? properties.admin_region : null;
        const score = featureScore(feature as Feature, layer);
        const scoreText = score === null ? 'No score' : `Score: ${score}`;
        const label = [name, region, scoreText].filter(Boolean).join(' | ');
        leafletLayer.bindTooltip(label, { permanent: false, direction: 'center' });
      }}
    />
  );
}
