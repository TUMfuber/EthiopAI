'use client';

import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';

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
    if (p >= stops[i].val && p <= stops[i + 1].val) { lower = stops[i]; upper = stops[i + 1]; break; }
  }
  const t = upper.val === lower.val ? 0 : (p - lower.val) / (upper.val - lower.val);
  const r = Math.round(lower.r + t * (upper.r - lower.r));
  const g = Math.round(lower.g + t * (upper.g - lower.g));
  const b = Math.round(lower.b + t * (upper.b - lower.b));
  return `rgb(${r},${g},${b})`;
}

export default function PriorityHeatmap({ visible }: { visible: boolean }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!visible || data) return;
    fetch('/data/priority-heatmap.geojson')
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, [visible, data]);

  if (!visible || !data) return null;

  return (
    <GeoJSON
      key="priority-heatmap"
      data={data}
      style={(feature: any) => {
        const color = interpolateColor(feature?.properties?.priority ?? 0);
        return { fillColor: color, fillOpacity: 0.55, color: color, weight: 1, opacity: 0.7 };
      }}
      onEachFeature={(feature, layer) => {
        const p = feature.properties;
        layer.bindTooltip(
          `<b>${p.location}</b><br/>Priority: ${(p.priority * 100).toFixed(0)}%<br/>Category: ${p.category}`,
          { sticky: true }
        );
      }}
    />
  );
}
