'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import PriorityOverlays, { type PriorityZones } from './PriorityOverlays';
import ProjectMarkers, { type Project } from './ProjectMarkers';

type MapMode = 'standard' | 'satellite' | 'biodiversity' | 'livelihood' | 'administrative';

const MODES: { id: MapMode; label: string; icon: string }[] = [
  { id: 'standard',       label: 'Standard',       icon: '🗺️' },
  { id: 'administrative', label: 'Administrative', icon: '🏛️' },
  { id: 'satellite',      label: 'Satellite',      icon: '🛰️' },
  { id: 'biodiversity',   label: 'Biodiversity',   icon: '🌿' },
  { id: 'livelihood',     label: 'Livelihood',     icon: '🌾' },
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
  administrative: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors | Admin boundaries: geoBoundaries',
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
  const [adminBoundary, setAdminBoundary] = useState<any>(null);
  const [mode, setMode] = useState<MapMode>('standard');
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/data/ethiopia-boundary.geojson')
      .then((r) => r.json())
      .then(setBoundary)
      .catch((e) => console.error('Failed to load Ethiopia boundary:', e));
  }, []);

  useEffect(() => {
    if (mode !== 'administrative' || adminBoundary) return;
    fetch('/data/ethiopia-admin.geojson')
      .then((r) => r.json())
      .then((data) => {
        setAdminBoundary(data);
        // select all regions by default
        const names: string[] = data.features.map((f: any) => f.properties?.shapeName ?? '');
        setSelectedRegions(new Set(names));
      })
      .catch((e) => console.error('Failed to load admin boundary:', e));
  }, [mode, adminBoundary]);

  const outsideMask = useMemo(
    () => (boundary ? createOutsideEthiopiaMask(boundary) : null),
    [boundary]
  );

  const regionNames: string[] = useMemo(
    () => adminBoundary?.features.map((f: any) => f.properties?.shapeName ?? '') ?? [],
    [adminBoundary]
  );

  const allSelected = regionNames.length > 0 && regionNames.every((n) => selectedRegions.has(n));

  function toggleRegion(name: string) {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelectedRegions(new Set());
    else setSelectedRegions(new Set(regionNames));
  }

  const tile = TILE_LAYERS[mode];

  return (
    <section className="map-shell" aria-label="Map of Ethiopia" style={{ position: 'relative' }}>

      {/* Mode switcher — top-right */}
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

      {/* Region selector — top-left, only in administrative mode */}
      {mode === 'administrative' && regionNames.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
          background: 'white',
          borderRadius: 10,
          padding: '10px 12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          minWidth: 170,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 600, fontSize: 13, color: '#111827' }}>
              Regions
            </span>
            <button
              onClick={toggleAll}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 11,
                color: '#16a34a',
                fontFamily: 'system-ui, sans-serif',
                padding: '2px 4px',
              }}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          {regionNames.map((name) => (
            <label
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '3px 0',
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 12,
                color: '#374151',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={selectedRegions.has(name)}
                onChange={() => toggleRegion(name)}
                style={{ accentColor: '#16a34a', cursor: 'pointer' }}
              />
              {name}
            </label>
          ))}
        </div>
      )}

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
        <TileLayer key={mode} attribution={tile.attribution} url={tile.url} />

        {/* Administrative regions — one GeoJSON per region so style updates independently */}
        {mode === 'administrative' && adminBoundary &&
          adminBoundary.features.map((feature: any) => {
            const name: string = feature.properties?.shapeName ?? '';
            const active = selectedRegions.has(name);
            return (
              <GeoJSON
                key={`${name}-${active}`}
                data={feature}
                interactive={true}
                style={{
                  color: '#374151',
                  weight: 1.5,
                  fillColor: active ? '#ffffff' : '#111827',
                  fillOpacity: active ? 0.05 : 0.75,
                }}
                onEachFeature={(_, layer) => {
                  layer.bindTooltip(name, { permanent: false, direction: 'center' });
                }}
              />
            );
          })
        }

        {outsideMask && (
          <GeoJSON
            data={outsideMask as any}
            interactive={false}
            style={{ color: '#111827', weight: 0, fillColor: '#111827', fillOpacity: 0.65, fillRule: 'evenodd' }}
          />
        )}

        {boundary && mode !== 'administrative' && (
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
