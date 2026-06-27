import { GeoJSON } from 'react-leaflet';
import type { FeatureCollection } from 'geojson';

export interface PriorityZones {
  mostRelevant?: FeatureCollection;
  middleRelevant?: FeatureCollection;
  leastRelevant?: FeatureCollection;
}

const COLORS: Record<string, string> = {
  most: '#e63946',
  middle: '#f4a261',
  least: '#2a9d8f',
};

function style(priority: string) {
  return { color: COLORS[priority], weight: 2, fillOpacity: 0.35 };
}

export default function PriorityOverlays({ zones }: { zones: PriorityZones }) {
  return (
    <>
      {zones.mostRelevant && <GeoJSON data={zones.mostRelevant} style={() => style('most')} />}
      {zones.middleRelevant && <GeoJSON data={zones.middleRelevant} style={() => style('middle')} />}
      {zones.leastRelevant && <GeoJSON data={zones.leastRelevant} style={() => style('least')} />}
    </>
  );
}
