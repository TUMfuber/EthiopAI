'use client';
import { useEffect, useState } from 'react';
import { useMap, useMapEvents, CircleMarker } from 'react-leaflet';

interface DropMarkerProps {
  active: boolean;
  onDrop: (lat: number, lng: number) => void;
}

export default function DropMarker({ active, onDrop }: DropMarkerProps) {
  const map = useMap();
  const [pos, setPos] = useState<[number, number] | null>(null);

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = active ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [active, map]);

  useMapEvents({
    click(e) {
      if (!active) return;
      setPos([e.latlng.lat, e.latlng.lng]);
      onDrop(e.latlng.lat, e.latlng.lng);
    },
  });

  if (!pos) return null;

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
      <CircleMarker center={pos} radius={8} pathOptions={{ color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.8 }} />
      <CircleMarker center={pos} radius={12} pathOptions={{ color: '#16a34a', fillOpacity: 0, weight: 2, className: 'pulse-marker' }} />
    </>
  );
}
