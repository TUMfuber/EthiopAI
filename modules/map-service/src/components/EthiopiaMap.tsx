'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import PriorityOverlays, { type PriorityZones } from './PriorityOverlays';
import ProjectMarkers, { type Project } from './ProjectMarkers';

type MapMode = 'standard' | 'satellite' | 'biodiversity' | 'livelihood';

const MODES: { id: MapMode; label: string; icon: string }[] = [
  { id: 'standard',     label: 'Standard',     icon: '🗺️' },
  { id: 'satellite',    label: 'Satellite',    icon: '🛰️' },
  { id: 'biodiversity', label: 'Biodiversity', icon: '🌿' },
  { id: 'livelihood',   label: 'Livelihood',   icon: '🌾' },
];

// Placeholder: all modes use OSM until real layers are wired up
const TILE_LAYERS: Record<MapMode, { url: string; attribution: string }> = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
  satellite: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
  biodiversity: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
  livelihood: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries',
  },
};

const ETHIOPIA_CENTER: [number, number] = [9.145, 40.4897];

const ETHIOPIA_BOUNDS: [[number, number], [number, number]] = [
  [2.8, 32.7],
  [15.3, 48.4],
];

const WORLD_RING = [
  [-180, -90],
  [-180, 90],
  [180, 90],
  [180, -90],
  [-180, -90],
];

function extractExteriorRings(geojson: any) {
  const rings: any[] = [];
  const readGeometry = (geometry: any) => {
    if (!geometry) return;
    if (geometry.type === 'Polygon') rings.push(geometry.coordinates[0]);
    if (geometry.type === 'MultiPolygon')
      geometry.coordinates.forEach((p: any) => rings.push(p[0]));
  };
  if (geojson.type === 'FeatureCollection')
    geojson.features.forEach((f: any) => readGeometry(f.geometry));
  else if (geojson.type === 'Feature') readGeometry(geojson.geometry);
  else readGeometry(geojson);
  return rings;
}

function createOutsideEthiopiaMask(boundary: any) {
  return {
    type: 'Feature',
    properties: { name: 'Outside Ethiopia mask' },
    geometry: {
      type: 'Polygon',
      coordinates: [WORLD_RING, ...extractExteriorRings(boundary)],
    },
  };
}

interface EthiopiaMapProps {
  priorityZones?: PriorityZones;
  projects?: Project[];
}

export default function EthiopiaMap({ priorityZones, projects }: EthiopiaMapProps) {
  const [boundary, setBoundary] = useState<any>(null);
  const [mode, setMode] = useState<MapMode>('standard');

  useEffect(() => {
    fetch('/data/ethiopia-boundary.geojson')
      .then((r) => r.json())
      .then(setBoundary)
      .catch((e) => console.error('Failed to load Ethiopia boundary:', e));
  }, []);

  const outsideMask = useMemo(
    () => (boundary ? createOutsideEthiopiaMask(boundary) : null),
    [boundary]
  );

  const tile = TILE_LAYERS[mode];

  return (
    <section className="map-shell" aria-label="Map of Ethiopia" style={{ position: 'relative' }}>

      {/* Mode switcher — top-right, above Leaflet (z-index > 400) */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'white',
        borderRadius: 10,
        padding: 5,
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            title={m.label}
            onClick={() => setMode(m.id)}
            style={{
              width: 38,
              height: 38,
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              fontSize: 20,
              lineHeight: 1,
              background: mode === m.id ? '#dcfce7' : 'transparent',
              outline: mode === m.id ? '2px solid #16a34a' : '2px solid transparent',
              transition: 'background 0.15s, outline 0.15s',
            }}
            aria-label={m.label}
            aria-pressed={mode === m.id}
          >
            {m.icon}
          </button>
        ))}
      </div>

      <MapContainer
        center={ETHIOPIA_CENTER}
        zoom={6}
        minZoom={6}
        maxZoom={18}
        maxBounds={ETHIOPIA_BOUNDS}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        className="ethiopia-map"
      >
        {/* key forces Leaflet to remount the tile layer when mode changes */}
        <TileLayer key={mode} attribution={tile.attribution} url={tile.url} />

        {outsideMask && (
          <GeoJSON
            data={outsideMask as any}
            interactive={false}
            style={{ color: '#111827', weight: 0, fillColor: '#111827', fillOpacity: 0.65, fillRule: 'evenodd' }}
          />
        )}

        {boundary && (
          <GeoJSON
            data={boundary}
            interactive={false}
            style={{ color: '#111827', weight: 2, fillOpacity: 0 }}
          />
        )}

        {priorityZones && <PriorityOverlays zones={priorityZones} />}
        {projects && <ProjectMarkers projects={projects} />}
      </MapContainer>
    </section>
  );
}
