'use client';

import { CircleMarker, Popup } from 'react-leaflet';

export interface ActionPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  impact: string;
  category: string;
  priority: number;
}

export default function ActionPointMarkers({ points }: { points: ActionPoint[] }) {
  if (!points.length) return null;
  return (
    <>
      {points.map(p => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={10}
          pathOptions={{
            color: '#fff',
            weight: 3,
            fillColor: '#7c3aed',
            fillOpacity: 0.95,
          }}
        >
          <Popup>
            <div style={{ fontFamily: 'system-ui,sans-serif', fontSize: 12, minWidth: 180 }}>
              <strong style={{ fontSize: 13 }}>{p.title}</strong>
              <div style={{ margin: '4px 0', color: '#4b5563' }}>{p.description}</div>
              <div style={{ color: '#16a34a', fontWeight: 600 }}>Impact: {p.impact}</div>
              <div style={{ color: '#6b7280', marginTop: 2, fontSize: 11 }}>
                {p.category} • Priority {(p.priority * 100).toFixed(0)}%
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}
