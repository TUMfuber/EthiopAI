'use client';

import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';

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

    if (geometry.type === 'Polygon') {
      rings.push(geometry.coordinates[0]);
    }

    if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon: any) => {
        rings.push(polygon[0]);
      });
    }
  };

  if (geojson.type === 'FeatureCollection') {
    geojson.features.forEach((feature: any) => {
      readGeometry(feature.geometry);
    });
  }

  if (geojson.type === 'Feature') {
    readGeometry(geojson.geometry);
  }

  if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
    readGeometry(geojson);
  }

  return rings;
}

function createOutsideEthiopiaMask(ethiopiaBoundary: any) {
  const ethiopiaRings = extractExteriorRings(ethiopiaBoundary);

  return {
    type: 'Feature',
    properties: {
      name: 'Outside Ethiopia mask',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [WORLD_RING, ...ethiopiaRings],
    },
  };
}

export default function EthiopiaMap() {
  const [ethiopiaBoundary, setEthiopiaBoundary] = useState<any>(null);

  useEffect(() => {
    fetch('/data/ethiopia-boundary.geojson')
      .then((response) => response.json())
      .then((data) => setEthiopiaBoundary(data))
      .catch((error) => {
        console.error('Failed to load Ethiopia boundary:', error);
      });
  }, []);

  const outsideMask = useMemo(() => {
    if (!ethiopiaBoundary) return null;
    return createOutsideEthiopiaMask(ethiopiaBoundary);
  }, [ethiopiaBoundary]);

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
            style={{
              color: '#111827',
              weight: 0,
              fillColor: '#111827',
              fillOpacity: 0.65,
              fillRule: 'evenodd',
            }}
          />
        )}

        {ethiopiaBoundary && (
          <GeoJSON
            data={ethiopiaBoundary as any}
            interactive={false}
            style={{
              color: '#111827',
              weight: 2,
              fillOpacity: 0,
            }}
          />
        )}
      </MapContainer>
    </section>
  );
}