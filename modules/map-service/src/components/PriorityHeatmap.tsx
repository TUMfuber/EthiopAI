'use client';

import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export default function PriorityHeatmap({ visible }: { visible: boolean }) {
  const map = useMap();
  const [layer, setLayer] = useState<any>(null);
  const [points, setPoints] = useState<[number, number, number][]>([]);

  useEffect(() => {
    if (!visible || points.length > 0) return;
    fetch('/data/priority-heatmap.geojson')
      .then(r => r.json())
      .then(data => {
        const pts: [number, number, number][] = (data.features ?? []).map((f: any) => [
          f.properties.lat,
          f.properties.lng,
          f.properties.priority,
        ]);
        setPoints(pts);
      })
      .catch(console.error);
  }, [visible, points.length]);

  useEffect(() => {
    if (!visible || points.length === 0) {
      if (layer) { map.removeLayer(layer); setLayer(null); }
      return;
    }
    if (layer) return;

    const heat = (L as any).heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 10,
      max: 1.0,
      gradient: { 0.0: '#00cc00', 0.3: '#7aff00', 0.5: '#ffff00', 0.7: '#ff8c00', 1.0: '#ff0000' },
    }).addTo(map);
    setLayer(heat);

    return () => { map.removeLayer(heat); };
  }, [visible, points, map, layer]);

  // Remove layer when toggled off
  useEffect(() => {
    if (!visible && layer) { map.removeLayer(layer); setLayer(null); }
  }, [visible, layer, map]);

  return null;
}
