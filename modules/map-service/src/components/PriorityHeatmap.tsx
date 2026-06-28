'use client';

import { useEffect, useState } from 'react';
import { CircleMarker } from 'react-leaflet';

interface Feature {
  geometry: { coordinates: [number, number] };
  properties: { priority: number; [k: string]: any };
}

function interpolateColor(priority: number): string {
  const stops = [
    { val: 0.0, r: 0x00, g: 0xcc, b: 0x00 },
    { val: 0.4, r: 0xff, g: 0xff, b: 0x00 },
    { val: 0.7, r: 0xff, g: 0x8c, b: 0x00 },
    { val: 1.0, r: 0xff, g: 0x00, b: 0x00 },
  ];
  const p = Math.max(0, Math.min(1, priority));
  let lower = stops[0], upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i].val && p <= stops[i + 1].val) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }
  const t = upper.val === lower.val ? 0 : (p - lower.val) / (upper.val - lower.val);
  const r = Math.round(lower.r + t * (upper.r - lower.r));
  const g = Math.round(lower.g + t * (upper.g - lower.g));
  const b = Math.round(lower.b + t * (upper.b - lower.b));
  return `rgb(${r},${g},${b})`;
}

export default function PriorityHeatmap({ visible }: { visible: boolean }) {
  const [features, setFeatures] = useState<Feature[]>([]);

  useEffect(() => {
    if (!visible || features.length > 0) return;
    fetch('/data/priority-heatmap.geojson')
      .then((r) => r.json())
      .then((data) => setFeatures(data.features ?? []))
      .catch(console.error);
  }, [visible, features.length]);

  if (!visible) return null;

  return (
    <>
      {features.map((f, i) => {
        const [lng, lat] = f.geometry.coordinates;
        const color = interpolateColor(f.properties.priority);
        return (
          <CircleMarker
            key={i}
            center={[lat, lng]}
            radius={4}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 1 }}
          />
        );
      })}
    </>
  );
}
