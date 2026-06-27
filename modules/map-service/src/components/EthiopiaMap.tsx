'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import ClusterLayer, { type ClusterNode, type LeafNode } from './ClusterLayer';
import { buildEthiopiaExample } from './ethiopiaExample';
import PriorityOverlays, { type PriorityZones } from './PriorityOverlays';
import ProjectMarkers, { type Project } from './ProjectMarkers';

// ── Map modes ─────────────────────────────────────────────────────────────────

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

// ── Geo helpers ───────────────────────────────────────────────────────────────

const ETHIOPIA_CENTER: [number, number] = [9.145, 40.4897];
const ETHIOPIA_BOUNDS: [[number, number], [number, number]] = [[2.8, 32.7], [15.3, 48.4]];
const WORLD_RING = [[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]];

function extractExteriorRings(geojson: any) {
  const rings: any[] = [];
  const read = (geometry: any) => {
    if (!geometry) return;
    if (geometry.type === 'Polygon') rings.push(geometry.coordinates[0]);
    if (geometry.type === 'MultiPolygon')
      geometry.coordinates.forEach((p: any) => rings.push(p[0]));
  };
  if (geojson.type === 'FeatureCollection') geojson.features.forEach((f: any) => read(f.geometry));
  else if (geojson.type === 'Feature') read(geojson.geometry);
  else read(geojson);
  return rings;
}

function createOutsideMask(boundary: any) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [WORLD_RING, ...extractExteriorRings(boundary)],
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EthiopiaMapProps {
  priorityZones?: PriorityZones;
  projects?: Project[];
}

export default function EthiopiaMap({ priorityZones, projects }: EthiopiaMapProps) {
  const [boundary, setBoundary] = useState<any>(null);
  const [adminBoundary, setAdminBoundary] = useState<any>(null);
  const [mode, setMode] = useState<MapMode>('standard');
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [clusterNodes, setClusterNodes] = useState<Array<ClusterNode | LeafNode>>([]);

  // Load country outline
  useEffect(() => {
    fetch('/data/ethiopia-boundary.geojson')
      .then((r) => r.json())
      .then(setBoundary)
      .catch((e) => console.error('Failed to load Ethiopia boundary:', e));
  }, []);

  // Load admin regions eagerly — needed for both region selector and clustering
  useEffect(() => {
    if (adminBoundary) return;
    fetch('/data/ethiopia-admin.geojson')
      .then((r) => r.json())
      .then((data) => {
        setAdminBoundary(data);
        const names: string[] = data.features.map((f: any) => f.properties?.shapeName ?? '');
        setSelectedRegions(new Set(names));
        // Build cluster tree now that features are available
        setClusterNodes(buildEthiopiaExample(data.features));
      })
      .catch((e) => console.error('Failed to load admin boundary:', e));
  }, [adminBoundary]);

  const outsideMask = useMemo(
    () => (boundary ? createOutsideMask(boundary) : null),
    [boundary],
  );

  const regionNames: string[] = useMemo(
    () => adminBoundary?.features.map((f: any) => f.properties?.shapeName ?? '') ?? [],
    [adminBoundary],
  );

  const allSelected = regionNames.length > 0 && regionNames.every((n) => selectedRegions.has(n));
  const showRegionPanel = regionNames.length > 0;

  // Hide cluster nodes whose region is deselected (non-standard modes only)
  const filteredClusterNodes = useMemo(() => {
    if (!showRegionPanel || regionNames.length === 0) return clusterNodes;
    return clusterNodes.filter(
      (node) => node.type === 'leaf' || selectedRegions.has(node.label ?? ''),
    );
  }, [clusterNodes, selectedRegions, showRegionPanel, regionNames.length]);

  function toggleRegion(name: string) {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleAll() {
    setSelectedRegions(allSelected ? new Set() : new Set(regionNames));
  }

  const tile = TILE_LAYERS[mode];

  return (
    <section className="map-shell" aria-label="Map of Ethiopia" style={{ position: 'relative' }}>

      {/* ── Mode switcher — top-right ─────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 1000,
        display: 'flex', flexDirection: 'column', gap: 4,
        background: 'white', borderRadius: 10, padding: 5,
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
      }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            title={m.label}
            onClick={() => setMode(m.id)}
            aria-label={m.label}
            aria-pressed={mode === m.id}
            style={{
              width: 38, height: 38, border: 'none', borderRadius: 7,
              cursor: 'pointer', fontSize: 20, lineHeight: 1,
              background: mode === m.id ? '#dcfce7' : 'transparent',
              outline: mode === m.id ? '2px solid #16a34a' : '2px solid transparent',
              transition: 'background 0.15s, outline 0.15s',
            }}
          >
            {m.icon}
          </button>
        ))}
      </div>

      {/* ── Region selector — top-left (all non-standard modes) ──────────── */}
      {showRegionPanel && regionNames.length > 0 && (
        <div style={{
          position: 'absolute', top: 16, left: 16, zIndex: 1000,
          background: 'white', borderRadius: 10, padding: '10px 12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', minWidth: 170,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontFamily: 'system-ui,sans-serif', fontWeight: 600, fontSize: 13, color: '#111827' }}>
              Regions
            </span>
            <button
              onClick={toggleAll}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#16a34a', fontFamily: 'system-ui,sans-serif', padding: '2px 4px' }}
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          {regionNames.map((name) => (
            <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer', fontFamily: 'system-ui,sans-serif', fontSize: 12, color: '#374151', userSelect: 'none' }}>
              <input type="checkbox" checked={selectedRegions.has(name)} onChange={() => toggleRegion(name)} style={{ accentColor: '#16a34a', cursor: 'pointer' }} />
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

        {/* Region overlays for non-standard modes — deselected = dark */}
        {showRegionPanel && adminBoundary &&
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

        {/* Outside-Ethiopia dark mask */}
        {outsideMask && (
          <GeoJSON
            data={outsideMask as any}
            interactive={false}
            style={{ color: '#111827', weight: 0, fillColor: '#111827', fillOpacity: 0.65, fillRule: 'evenodd' }}
          />
        )}

        {/* Country border (standard mode only — other modes show region borders) */}
        {boundary && !showRegionPanel && (
          <GeoJSON
            data={boundary}
            interactive={false}
            style={{ color: '#111827', weight: 2, fillOpacity: 0 }}
          />
        )}

        {priorityZones && <PriorityOverlays zones={priorityZones} />}
        {projects && <ProjectMarkers projects={projects} />}

        {/* Example recursive cluster layer — built via AdminRegionStrategy */}
        {filteredClusterNodes.length > 0 && (
          <ClusterLayer
            nodes={filteredClusterNodes}
            clusterColor="#2563eb"
            leafColor="#1d4ed8"
            leafRadius={5}
          />
        )}
      </MapContainer>
    </section>
  );
}
