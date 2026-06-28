'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap, useMapEvent } from 'react-leaflet';
import L from 'leaflet';
import type { EthopaiLayerConfig } from '../layers/ethopaiLayers';

type Props = {
  layer: EthopaiLayerConfig;
  data?: any;
};

function scoreToColor(score: number | null, maxScore: number): string {
  if (score === null || maxScore <= 0) return '180,180,180';
  const ratio = Math.max(0, Math.min(1, score / maxScore));
  // Green (high) → Yellow → Orange → Red (low opportunity = grey)
  // Inverted: high score = green = good
  if (ratio >= 0.75) return '22,101,52';   // dark green
  if (ratio >= 0.5) return '22,163,74';    // green
  if (ratio >= 0.35) return '132,204,22';  // lime
  if (ratio >= 0.2) return '250,204,21';   // yellow
  return '249,115,22';                      // orange
}

function createGradientLayer(map: L.Map, features: any[], layer: EthopaiLayerConfig, radius: number): L.Layer {
  const points: { lat: number; lng: number; score: number }[] = [];

  for (const f of features) {
    const props = f.properties;
    const score = props?.[layer.scoreProperty] ?? props?.score ?? null;
    if (score === null) continue;
    // Get centroid from polygon
    const coords = f.geometry?.coordinates?.[0];
    if (!coords) continue;
    const lngs = coords.map((c: number[]) => c[0]);
    const lats = coords.map((c: number[]) => c[1]);
    const lat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
    const lng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
    points.push({ lat, lng, score });
  }

  const CanvasLayer = L.GridLayer.extend({
    createTile(coords: L.Coords) {
      const tile = document.createElement('canvas');
      const size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;
      const ctx = tile.getContext('2d')!;

      for (const p of points) {
        const px = map.project([p.lat, p.lng], coords.z);
        const x = px.x - coords.x * size.x;
        const y = px.y - coords.y * size.y;
        if (x < -radius * 2 || x > size.x + radius * 2 || y < -radius * 2 || y > size.y + radius * 2) continue;

        const color = scoreToColor(p.score, layer.maxScore);
        const alpha = 0.6;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, `rgba(${color},${alpha})`);
        grad.addColorStop(0.7, `rgba(${color},${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      return tile;
    },
  });

  return new (CanvasLayer as any)({ opacity: 0.85, pane: 'overlayPane' });
}

export default function EthopaiLayerRenderer({ layer, data }: Props) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const [zoom, setZoom] = useState(map.getZoom());

  useMapEvent('zoomend', () => setZoom(map.getZoom()));

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; }
    if (!data?.features?.length) return;

    // Radius scales with zoom for consistent visual density
    const radius = Math.max(15, 35 - (zoom - 6) * 4);
    const gradLayer = createGradientLayer(map, data.features, layer, radius);
    gradLayer.addTo(map);
    layerRef.current = gradLayer;

    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null; } };
  }, [data, layer, map, zoom]);

  return null;
}
