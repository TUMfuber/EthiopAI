'use client';

import L from 'leaflet';
import { useMemo, useState } from 'react';
import { CircleMarker, Marker, Popup, useMap, useMapEvent } from 'react-leaflet';

// ── Types ────────────────────────────────────────────────────────────────────

export type LeafNode = {
  type: 'leaf';
  id: string;
  lat: number;
  lng: number;
  label?: string;
};

export type ClusterNode = {
  type: 'cluster';
  id: string;
  lat: number;
  lng: number;
  count: number;
  label?: string;
  children: Array<ClusterNode | LeafNode>;
};

export interface ClusterLayerConfig {
  /** Fill colour for cluster bubbles */
  clusterColor?: string;
  /** Fill colour for individual leaf points */
  leafColor?: string;
  /** Radius in px of leaf CircleMarkers */
  leafRadius?: number;
  /** Fly-to animation duration in seconds */
  flyDuration?: number;
  /** Padding around cluster bounds when flying in, [y, x] pixels */
  flyPadding?: [number, number];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getAllLeaves(node: ClusterNode | LeafNode): LeafNode[] {
  if (node.type === 'leaf') return [node];
  return node.children.flatMap(getAllLeaves);
}

function getVisible(
  nodes: Array<ClusterNode | LeafNode>,
  expanded: Set<string>,
): Array<ClusterNode | LeafNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'leaf') return [node];
    if (!expanded.has(node.id)) return [node];
    return getVisible(node.children, expanded);
  });
}

function makeClusterIcon(count: number, color: string): L.DivIcon {
  const size = count > 150 ? 50 : count > 30 ? 38 : 28;
  const fontSize = size < 38 ? 11 : 13;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:50%;
      border:2.5px solid rgba(255,255,255,0.85);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${fontSize}px;
      font-family:system-ui,sans-serif;
      box-shadow:0 2px 8px rgba(0,0,0,0.35);
      cursor:pointer;
    ">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ClusterLayerProps extends ClusterLayerConfig {
  /** Top-level nodes — clusters or leaves */
  nodes: Array<ClusterNode | LeafNode>;
}

export default function ClusterLayer({
  nodes,
  clusterColor = '#2563eb',
  leafColor = '#1d4ed8',
  leafRadius = 5,
  flyDuration = 0.7,
  flyPadding = [40, 40],
}: ClusterLayerProps) {
  const map = useMap();
  // Map from cluster id → zoom level at which it was expanded
  const [expandedAtZoom, setExpandedAtZoom] = useState<Map<string, number>>(new Map());
  const expanded = useMemo(() => new Set(expandedAtZoom.keys()), [expandedAtZoom]);

  // Collapse any cluster whose expand-zoom is higher than the current zoom
  useMapEvent('zoomend', () => {
    const z = map.getZoom();
    setExpandedAtZoom((prev) => {
      const next = new Map([...prev].filter(([, expandZoom]) => z >= expandZoom));
      return next.size === prev.size ? prev : next;
    });
  });

  const visible = getVisible(nodes, expanded);

  function handleClusterClick(cluster: ClusterNode) {
    const leaves = getAllLeaves(cluster);
    if (leaves.length === 0) return;
    const lats = leaves.map((l) => l.lat);
    const lngs = leaves.map((l) => l.lng);
    const bounds = L.latLngBounds(
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    );
    // Record the zoom Leaflet will land on (not current zoom) so the zoomend
    // fired by the fly animation itself doesn't immediately re-collapse this cluster.
    const destZoom = Math.floor(map.getBoundsZoom(bounds));
    setExpandedAtZoom((prev) => new Map([...prev, [cluster.id, destZoom]]));
    map.flyToBounds(bounds, { padding: flyPadding, duration: flyDuration });
  }

  return (
    <>
      {visible.map((node) => {
        if (node.type === 'cluster') {
          return (
            <Marker
              key={node.id}
              position={[node.lat, node.lng]}
              icon={makeClusterIcon(node.count, clusterColor)}
              eventHandlers={{ click: () => handleClusterClick(node) }}
            >
              {node.label && (
                <Popup>
                  <strong>{node.label}</strong><br />{node.count} points
                </Popup>
              )}
            </Marker>
          );
        }
        return (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lng]}
            radius={leafRadius}
            pathOptions={{ color: 'white', weight: 1, fillColor: leafColor, fillOpacity: 0.9 }}
          >
            {node.label && <Popup>{node.label}</Popup>}
          </CircleMarker>
        );
      })}
    </>
  );
}
