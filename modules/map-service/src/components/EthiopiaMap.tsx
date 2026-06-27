'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import PriorityOverlays, { type PriorityZones } from './PriorityOverlays';
import ProjectMarkers, { type Project } from './ProjectMarkers';

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

  return (
    <section className="map-shell" aria-label="Map of Ethiopia">
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
          attribution="&copy; OpenStreetMap contributors | Ethiopia boundary: geoBoundaries"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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
