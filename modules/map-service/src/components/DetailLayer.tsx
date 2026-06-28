'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMap, useMapEvent } from 'react-leaflet';
import L from 'leaflet';

const API_URL = process.env.NEXT_PUBLIC_DETAIL_API_URL || '/api/detail';

function priorityToColor(v: number): string {
  const c = Math.max(0, Math.min(1, v));
  if (c < 0.33) {
    const t = c / 0.33;
    return `rgb(${Math.round(t * 255)},${204 + Math.round(t * 51)},0)`;
  } else if (c < 0.66) {
    const t = (c - 0.33) / 0.33;
    return `rgb(255,${Math.round(255 - t * 115)},0)`;
  }
  const t = (c - 0.66) / 0.34;
  return `rgb(255,${Math.round(140 - t * 140)},0)`;
}

export default function DetailLayer({ visible }: { visible: boolean }) {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const layersRef = useRef<L.Rectangle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearRects = useCallback(() => {
    layersRef.current.forEach((r) => map.removeLayer(r));
    layersRef.current = [];
  }, [map]);

  const fetchDetail = useCallback(async () => {
    const zoom = map.getZoom();
    if (zoom < 8 || !visible) return;

    const center = map.getCenter();
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const url = `${API_URL}?lat=${center.lat}&lng=${center.lng}&zoom=${zoom}&bounds=${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return;
      const data = await res.json();

      clearRects();
      const features = data.features ?? [];
      for (const f of features) {
        if (f.geometry?.type !== 'Polygon') continue;
        const coords = f.geometry.coordinates[0]; // [[lng,lat],...]
        const rect = L.rectangle([[coords[0][1], coords[0][0]], [coords[2][1], coords[2][0]]], {
          weight: 0,
          fillColor: priorityToColor(f.properties?.priority ?? 0),
          fillOpacity: 0.55,
          interactive: false,
        });
        rect.addTo(map);
        layersRef.current.push(rect);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') console.error('DetailLayer fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [map, visible, clearRects]);

  const debouncedFetch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fetchDetail, 500);
  }, [fetchDetail]);

  useMapEvent('moveend', debouncedFetch);
  useMapEvent('zoomend', debouncedFetch);

  useEffect(() => {
    if (!visible) {
      clearRects();
      return;
    }
    if (map.getZoom() >= 8) debouncedFetch();
  }, [visible, map, debouncedFetch, clearRects]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      clearRects();
    };
  }, [clearRects]);

  if (!visible || !loading) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 1000,
        width: 12,
        height: 12,
        borderRadius: '50%',
        background: '#16a34a',
        animation: 'detailPulse 1s infinite',
      }}
    >
      <style>{`@keyframes detailPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}`}</style>
    </div>
  );
}
