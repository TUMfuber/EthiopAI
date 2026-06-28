'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface HeatPoint { lat: number; lng: number; value: number; }

function createHeatCanvas(map: L.Map, points: HeatPoint[], radius: number): L.Layer {
  const CanvasLayer = L.GridLayer.extend({
    createTile(coords: L.Coords) {
      const tile = document.createElement('canvas');
      const size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;
      const ctx = tile.getContext('2d')!;

      const nw = map.unproject([coords.x * size.x, coords.y * size.y], coords.z);
      const se = map.unproject([(coords.x + 1) * size.x, (coords.y + 1) * size.y], coords.z);
      const pad = radius * 2;

      for (const p of points) {
        if (p.lat < se.lat - 1 || p.lat > nw.lat + 1 || p.lng < nw.lng - 1 || p.lng > se.lng + 1) continue;
        const px = map.project([p.lat, p.lng], coords.z);
        const x = px.x - coords.x * size.x;
        const y = px.y - coords.y * size.y;
        if (x < -pad || x > size.x + pad || y < -pad || y > size.y + pad) continue;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const alpha = Math.min(0.7, p.value * 0.8);
        const color = valueToColor(p.value);
        grad.addColorStop(0, `rgba(${color},${alpha})`);
        grad.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      return tile;
    },
  });

  return new (CanvasLayer as any)({ opacity: 0.75, pane: 'overlayPane' });
}

function valueToColor(v: number): string {
  const clamped = Math.max(0, Math.min(1, v));
  let r: number, g: number, b: number;
  if (clamped < 0.33) {
    const t = clamped / 0.33;
    r = Math.round(t * 255); g = 204 + Math.round(t * 51); b = Math.round((1 - t) * 0);
  } else if (clamped < 0.66) {
    const t = (clamped - 0.33) / 0.33;
    r = 255; g = Math.round(255 - t * 115); b = 0;
  } else {
    const t = (clamped - 0.66) / 0.34;
    r = 255; g = Math.round(140 - t * 140); b = 0;
  }
  return `${r},${g},${b}`;
}

export default function PriorityHeatmap({ visible }: { visible: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const [points, setPoints] = useState<HeatPoint[]>([]);

  useEffect(() => {
    if (!visible || points.length > 0) return;
    fetch('/data/priority-heatmap.geojson')
      .then(r => r.json())
      .then(data => {
        setPoints((data.features ?? []).map((f: any) => ({
          lat: f.properties.lat,
          lng: f.properties.lng,
          value: f.properties.priority,
        })));
      })
      .catch(console.error);
  }, [visible, points.length]);

  useEffect(() => {
    if (!visible || points.length === 0) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
      return;
    }

    if (layerRef.current) map.removeLayer(layerRef.current);
    const layer = createHeatCanvas(map, points, 25);
    layer.addTo(map);
    layerRef.current = layer;

    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [visible, points, map]);

  return null;
}
