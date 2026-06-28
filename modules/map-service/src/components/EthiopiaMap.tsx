'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

const ETHIOPIA_CENTER: [number, number] = [9.145, 40.4897];
const ETHIOPIA_BOUNDS: [[number, number], [number, number]] = [[2.8, 32.7], [15.3, 48.4]];
const WORLD_RING = [[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]];

const SCORING_MODES = [
  { id: 'biodiversity', label: 'Biodiversity (KBA)' },
  { id: 'carbon', label: 'Carbon Credits' },
  { id: 'project_density', label: 'Project Density' },
];

const PRIORITY_COLORS: Record<string, string> = {
  most: '#e63946',
  middle: '#f4a261',
  least: '#2a9d8f',
};

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function extractExteriorRings(geojson: any) {
  const rings: any[] = [];
  const readGeometry = (g: any) => {
    if (!g) return;
    if (g.type === 'Polygon') rings.push(g.coordinates[0]);
    if (g.type === 'MultiPolygon') g.coordinates.forEach((p: any) => rings.push(p[0]));
  };
  if (geojson.type === 'FeatureCollection') geojson.features.forEach((f: any) => readGeometry(f.geometry));
  else if (geojson.type === 'Feature') readGeometry(geojson.geometry);
  else readGeometry(geojson);
  return rings;
}

export default function EthiopiaMap() {
  const [boundary, setBoundary] = useState<any>(null);
  const [projects, setProjects] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<string>('biodiversity');
  const [zones, setZones] = useState<any>(null);
  const [showProjects, setShowProjects] = useState(true);

  useEffect(() => {
    fetch('/data/ethiopia-boundary.geojson').then((r) => r.json()).then(setBoundary).catch(console.error);
    fetch('/data/projects.geojson').then((r) => r.json()).then(setProjects).catch(console.error);
  }, []);

  useEffect(() => {
    fetch(`/data/zones-${activeMode}.geojson`).then((r) => r.json()).then(setZones).catch(() => setZones(null));
  }, [activeMode]);

  const outsideMask = useMemo(() => {
    if (!boundary) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...extractExteriorRings(boundary)] },
    };
  }, [boundary]);

  return (
    <section className="map-shell" aria-label="Map of Ethiopia">
      <div className="layer-controls">
        <label>
          <strong>Priority Layer:</strong>
          <select value={activeMode} onChange={(e) => setActiveMode(e.target.value)}>
            {SCORING_MODES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={showProjects} onChange={(e) => setShowProjects(e.target.checked)} />
          Show Projects
        </label>
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
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {outsideMask && (
          <GeoJSON data={outsideMask as any} interactive={false}
            style={{ color: '#111827', weight: 0, fillColor: '#111827', fillOpacity: 0.65, fillRule: 'evenodd' }} />
        )}

        {boundary && (
          <GeoJSON data={boundary} interactive={false}
            style={{ color: '#111827', weight: 2, fillOpacity: 0 }} />
        )}

        {zones && (
          <GeoJSON
            key={activeMode}
            data={zones}
            style={(feature: any) => ({
              color: PRIORITY_COLORS[feature?.properties?.priority] || '#888',
              weight: 0.5,
              fillColor: PRIORITY_COLORS[feature?.properties?.priority] || '#888',
              fillOpacity: feature?.properties?.score * 0.6 || 0.2,
            })}
          />
        )}

        {showProjects && projects?.features?.map((f: any) => (
          <Marker key={f.properties.id} position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]} icon={markerIcon}>
            <Tooltip direction="top" sticky>
              <strong>{f.properties.name}</strong><br />
              {f.properties.type} — {f.properties.status}<br />
              <em>{f.properties.organization}</em><br />
              {f.properties.description?.substring(0, 120)}
              {f.properties.creditsIssued > 0 && <><br />Credits: {f.properties.creditsIssued.toLocaleString()}</>}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}
