import L from 'leaflet';
import { GeoJSON, TileLayer } from 'react-leaflet';
import type { RawLayerConfig } from '../layers/rawLayers';

type RawLayerData = Record<string, any>;

interface RawLayerRendererProps {
  layers: RawLayerConfig[];
  apiBaseUrl?: string;
  visibleLayerIds?: string[];
  vectorData?: RawLayerData;
}

function resolveTileUrl(tileUrl: string, apiBaseUrl?: string) {
  return apiBaseUrl && tileUrl.startsWith('/') ? `${apiBaseUrl}${tileUrl}` : tileUrl;
}

export default function RawLayerRenderer({
  layers,
  apiBaseUrl,
  visibleLayerIds = [],
  vectorData = {},
}: RawLayerRendererProps) {
  if (visibleLayerIds.length === 0) return null;

  const visibleIds = new Set(visibleLayerIds);

  return (
    <>
      {layers.map((layer) => {
        if (!visibleIds.has(layer.id)) return null;

        if (layer.kind === 'raster') {
          if (!layer.tileUrl) return null;

          return (
            <TileLayer
              key={layer.id}
              url={resolveTileUrl(layer.tileUrl, apiBaseUrl)}
              attribution={layer.attribution}
              opacity={layer.opacity ?? 0.7}
              minZoom={layer.minZoom}
              minNativeZoom={layer.minNativeZoom}
              maxNativeZoom={layer.maxNativeZoom}
            />
          );
        }

        const data = vectorData[layer.id];
        if (!data) return null;

        return (
          <GeoJSON
            key={layer.id}
            data={data}
            style={{ color: '#7c3aed', weight: 1.5, fillColor: '#8b5cf6', fillOpacity: 0.14 }}
            pointToLayer={(_, latLng) =>
              L.circleMarker(latLng, {
                radius: 5,
                color: '#ffffff',
                weight: 1,
                fillColor: '#7c3aed',
                fillOpacity: 0.9,
              })
            }
            onEachFeature={(feature, leafletLayer) => {
              const properties = feature.properties as Record<string, unknown> | undefined;
              const name = typeof properties?.name === 'string' ? properties.name : layer.name;
              leafletLayer.bindTooltip(name, { permanent: false, direction: 'center' });
            }}
          />
        );
      })}
    </>
  );
}
