'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap, useMapEvent } from 'react-leaflet';
import L from 'leaflet';

interface HeatPoint { lat: number; lng: number; value: number; }

function valueToRGB(v: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, v));
  if (c < 0.25) return [0, Math.round(204 + c * 4 * 51), 0];
  if (c < 0.5) { const t = (c - 0.25) * 4; return [Math.round(t * 255), 255, 0]; }
  if (c < 0.75) { const t = (c - 0.5) * 4; return [255, Math.round(255 - t * 115), 0]; }
  const t = (c - 0.75) * 4;
  return [255, Math.round(140 - t * 140), 0];
}

function drawHeatmap(canvas: HTMLCanvasElement, map: L.Map, points: HeatPoint[], radius: number) {
  const size = map.getSize();
  canvas.width = size.x;
  canvas.height = size.y;
  canvas.style.width = size.x + 'px';
  canvas.style.height = size.y + 'px';

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size.x, size.y);

  const bounds = map.getBounds();
  const zoom = map.getZoom();
  // Cap at ~200 rendered points max
  const step = zoom >= 9 ? 1 : zoom >= 8 ? 3 : zoom >= 7 ? 6 : zoom >= 6 ? 12 : 20;

  let count = 0;
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    if (p.lat < bounds.getSouth() || p.lat > bounds.getNorth() ||
        p.lng < bounds.getWest() || p.lng > bounds.getEast()) continue;

    const px = map.latLngToContainerPoint([p.lat, p.lng]);
    const [r, g, b] = valueToRGB(p.value);
    const alpha = Math.min(0.65, 0.3 + p.value * 0.4);
    const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.7, `rgba(${r},${g},${b},${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px.x, px.y, radius, 0, Math.PI * 2);
    ctx.fill();
    count++;
  }
}

export default function PriorityHeatmap({ visible }: { visible: boolean }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [points, setPoints] = useState<HeatPoint[]>([]);

  // Load data
  useEffect(() => {
    if (!visible || points.length > 0) return;
    fetch('/data/priority-heatmap.geojson')
      .then(r => r.json())
      .then(data => {
        setPoints((data.features ?? []).map((f: any) => ({
          lat: f.properties.lat, lng: f.properties.lng, value: f.properties.priority,
        })));
      })
      .catch(console.error);
  }, [visible, points.length]);

  // Create canvas overlay
  useEffect(() => {
    if (!visible) {
      if (canvasRef.current) { canvasRef.current.remove(); canvasRef.current = null; }
      return;
    }
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '400';
      map.getContainer().querySelector('.leaflet-overlay-pane')?.appendChild(canvas);
      canvasRef.current = canvas;
    }
    return () => { if (canvasRef.current) { canvasRef.current.remove(); canvasRef.current = null; } };
  }, [visible, map]);

  // Redraw on move/zoom
  const redraw = () => {
    if (!canvasRef.current || !visible || points.length === 0) return;
    // Radius in pixels = half the grid spacing at current zoom
    const p1 = map.latLngToContainerPoint([9, 38]);
    const p2 = map.latLngToContainerPoint([9.15, 38]);
    const gridPixels = Math.abs(p2.y - p1.y);
    const radius = Math.max(10, gridPixels * 1.2);
    drawHeatmap(canvasRef.current, map, points, radius);

    // Position canvas at map origin
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvasRef.current, topLeft);
  };

  useMapEvent('moveend', redraw);
  useMapEvent('zoomend', redraw);

  useEffect(() => { if (visible && points.length > 0) redraw(); }, [visible, points]);

  return null;
}
