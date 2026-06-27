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
  weight?: number;
};

export type ClusterNode = {
  type: 'cluster';
  id: string;
  lat: number;
  lng: number;
  count: number;
  depth: number;
  label?: string;
  weight?: number;    // mean weight of leaf descendants
  maxWeight?: number; // highest weight among leaf descendants
  bounds?: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  children: Array<ClusterNode | LeafNode>;
};

export type ClusterColorMode = 'uniform' | 'average' | 'peak';

export interface ClusterLayerConfig {
  clusterColor?: string;
  leafColor?: string;
  leafRadius?: number;
  flyDuration?: number;
  flyPadding?: [number, number];
  /** How cluster bubble colour is derived from point weights. */
  clusterColorMode?: ClusterColorMode;
  /**
   * Zoom ranges per level. Entry N defines the zoom band where depth-N clusters
   * are shown; the last entry is the leaf / individual-points band.
   * Defaults to LEVELS. Length must match the tree's maxDepth + 1.
   */
  levels?: { minZoom: number; maxZoom: number }[];
}

// ── Level configuration ───────────────────────────────────────────────────────
// One entry per cluster depth. The last entry is the "points" level (leaves).
// Clicking a cluster at depth N flies into it and shows depth N+1.
// Tree maxDepth in buildClusterTree must equal LEVELS.length - 1.
export const LEVELS: { minZoom: number; maxZoom: number }[] = [
  { minZoom: 6,  maxZoom: 7  }, // depth 0 — regional clusters
  { minZoom: 8,  maxZoom: 9  }, // depth 1 — grid sub-clusters
  { minZoom: 10, maxZoom: 18 }, // leaves — individual points
];

// ── Color scale ───────────────────────────────────────────────────────────────

export function weightToColor(weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  return `hsl(${Math.round(w * 120)}, 75%, 42%)`;
}

// ── Visibility ────────────────────────────────────────────────────────────────

/**
 * Return the nodes that should be rendered at `targetDepth`.
 * Clusters shallower than targetDepth are transparently expanded;
 * clusters at or deeper than targetDepth are returned as-is (shown as bubbles).
 */
function getVisible(
  nodes: Array<ClusterNode | LeafNode>,
  targetDepth: number,
): Array<ClusterNode | LeafNode> {
  return nodes.flatMap((node) => {
    if (node.type === 'leaf') return [node];
    if (node.depth >= targetDepth) return [node];
    return getVisible(node.children, targetDepth);
  });
}

/** Map the current zoom to an index into a levels array. */
function zoomToLevelIdx(zoom: number, levels: { minZoom: number; maxZoom: number }[]): number {
  if (zoom < levels[0].minZoom) return 0;
  const idx = levels.findIndex((l) => zoom >= l.minZoom && zoom <= l.maxZoom);
  return idx === -1 ? levels.length - 1 : idx;
}

// ── Cluster icon ──────────────────────────────────────────────────────────────

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
  nodes: Array<ClusterNode | LeafNode>;
}

export default function ClusterLayer({
  nodes,
  clusterColor = '#2563eb',
  leafColor = '#1d4ed8',
  leafRadius = 5,
  flyDuration = 0.8,
  flyPadding = [60, 60],
  clusterColorMode = 'average',
  levels = LEVELS,
}: ClusterLayerProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  function resolveClusterColor(node: ClusterNode): string {
    if (clusterColorMode === 'uniform') return clusterColor;
    if (clusterColorMode === 'peak')
      return node.maxWeight != null ? weightToColor(node.maxWeight) : clusterColor;
    return node.weight != null ? weightToColor(node.weight) : clusterColor;
  }

  useMapEvent('zoomend', () => setZoom(map.getZoom()));

  const levelIdx = useMemo(() => zoomToLevelIdx(zoom, levels), [zoom, levels]);
  const visible  = useMemo(() => getVisible(nodes, levelIdx), [nodes, levelIdx]);

  function handleClusterClick(cluster: ClusterNode) {
    if (!cluster.bounds) return;
    const nextIdx = cluster.depth + 1;
    if (nextIdx >= levels.length) return;

    const { minLat, minLng, maxLat, maxLng } = cluster.bounds;
    const bounds = L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
    const { minZoom, maxZoom } = levels[nextIdx];

    // Zoom to fit the cluster's area, clamped to the next level's zoom range
    const fitZoom   = Math.floor(map.getBoundsZoom(bounds));
    const targetZoom = Math.min(Math.max(fitZoom, minZoom), maxZoom);
    map.flyTo(bounds.getCenter(), targetZoom, { duration: flyDuration });
  }

  return (
    <>
      {visible.map((node) => {
        if (node.type === 'cluster') {
          const color = resolveClusterColor(node);
          return (
            <Marker
              key={node.id}
              position={[node.lat, node.lng]}
              icon={makeClusterIcon(node.count, color)}
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

        const fillColor = node.weight != null ? weightToColor(node.weight) : leafColor;
        return (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lng]}
            radius={leafRadius}
            pathOptions={{ color: 'white', weight: 1, fillColor, fillOpacity: 0.9 }}
          >
            {node.label && (
              <Popup>
                <div style={{ fontFamily: 'system-ui,sans-serif', fontSize: 12, minWidth: 110 }}>
                  <strong>{node.label}</strong>
                  {node.weight != null && (
                    <div style={{ marginTop: 4, color: '#374151' }}>
                      Weight:{' '}
                      <span style={{ color: weightToColor(node.weight), fontWeight: 700 }}>
                        {node.weight.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </Popup>
            )}
          </CircleMarker>
        );
      })}
    </>
  );
}
