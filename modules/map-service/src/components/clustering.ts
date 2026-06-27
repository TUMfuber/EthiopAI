import type { ClusterNode, LeafNode } from './ClusterLayer';

// ── Public types ──────────────────────────────────────────────────────────────

export interface InputPoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface PartitionGroup {
  key: string;
  label: string;
  lat: number; // centroid
  lng: number; // centroid
  points: InputPoint[];
}

export interface BuildConfig {
  /** How many levels of clustering. 1 = top level only, children become leaves. */
  maxDepth: number;
  /**
   * Groups with fewer than this many points are emitted as leaves immediately,
   * skipping further subdivision. Default: 1.
   */
  minClusterSize?: number;
}

// ── Abstract strategy ─────────────────────────────────────────────────────────

/**
 * Defines one level of spatial partitioning.
 * `buildClusterTree` calls `partition` recursively at each depth level.
 */
export abstract class ClusterStrategy {
  abstract partition(
    points: InputPoint[],
    parentId: string,
    depth: number,
  ): PartitionGroup[];
}

// ── Grid strategy ─────────────────────────────────────────────────────────────

/**
 * Divides the bounding box of `points` into an N×N grid and groups points
 * by which cell they fall into. Empty cells are omitted.
 */
export class GridStrategy extends ClusterStrategy {
  constructor(private readonly divisions = 3) {
    super();
  }

  partition(points: InputPoint[], parentId: string, _depth: number): PartitionGroup[] {
    if (points.length === 0) return [];

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const latMin = Math.min(...lats), latMax = Math.max(...lats);
    const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);

    // Avoid zero-size cells when all points are identical
    const latRange = latMax - latMin || 1;
    const lngRange = lngMax - lngMin || 1;
    const d = this.divisions;

    const buckets = new Map<string, InputPoint[]>();

    for (const p of points) {
      const r = Math.min(Math.floor(((p.lat - latMin) / latRange) * d), d - 1);
      const c = Math.min(Math.floor(((p.lng - lngMin) / lngRange) * d), d - 1);
      const key = `${parentId}-g${r}_${c}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(p);
    }

    return [...buckets.entries()].map(([key, pts]) => ({
      key,
      label: key,
      ...centroid(pts),
      points: pts,
    }));
  }
}

// ── Admin-region strategy ─────────────────────────────────────────────────────

/**
 * At depth 0: groups points by administrative region using point-in-polygon
 * tests against GeoJSON features.
 * At deeper depths: delegates to `subStrategy` (default: GridStrategy(3)).
 *
 * Points that don't fall inside any region are silently dropped.
 */
export class AdminRegionStrategy extends ClusterStrategy {
  private readonly regions: RegionEntry[];
  private readonly sub: ClusterStrategy;

  constructor(features: any[], sub?: ClusterStrategy) {
    super();
    this.regions = features.map((f) => ({
      feature: f,
      label: f.properties?.shapeName ?? f.properties?.name ?? 'Unknown',
      bbox: featureBbox(f),
    }));
    this.sub = sub ?? new GridStrategy(3);
  }

  partition(points: InputPoint[], parentId: string, depth: number): PartitionGroup[] {
    if (depth > 0) return this.sub.partition(points, parentId, depth);

    const buckets = new Map<string, InputPoint[]>(
      this.regions.map((r) => [r.label, []]),
    );

    for (const p of points) {
      const region = this.regions.find(
        (r) =>
          p.lat >= r.bbox.minLat &&
          p.lat <= r.bbox.maxLat &&
          p.lng >= r.bbox.minLng &&
          p.lng <= r.bbox.maxLng &&
          pointInFeature(p.lat, p.lng, r.feature),
      );
      if (region) buckets.get(region.label)!.push(p);
      // points outside all regions are dropped
    }

    return [...buckets.entries()]
      .filter(([, pts]) => pts.length > 0)
      .map(([label, pts]) => ({
        key: `${parentId}-${label}`,
        label,
        ...centroid(pts),
        points: pts,
      }));
  }
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Recursively build a cluster tree from flat points.
 *
 * @param points    Flat array of input points
 * @param strategy  Partitioning strategy (determines grouping at each depth)
 * @param config    maxDepth and optional minClusterSize
 * @param parentId  ID prefix for generated nodes (default "root")
 * @param depth     Current depth (start at 0)
 */
export function buildClusterTree(
  points: InputPoint[],
  strategy: ClusterStrategy,
  config: BuildConfig,
  parentId = 'root',
  depth = 0,
): Array<ClusterNode | LeafNode> {
  const { maxDepth, minClusterSize = 1 } = config;

  if (depth >= maxDepth || points.length <= minClusterSize) {
    return points.map((p) => ({ type: 'leaf' as const, ...p }));
  }

  const groups = strategy.partition(points, parentId, depth);

  return groups.map((g) => {
    const children = buildClusterTree(g.points, strategy, config, g.key, depth + 1);
    return {
      type: 'cluster' as const,
      id: g.key,
      lat: g.lat,
      lng: g.lng,
      count: g.points.length,
      label: g.label,
      children,
    } satisfies ClusterNode;
  });
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

interface RegionEntry {
  feature: any;
  label: string;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

function centroid(points: InputPoint[]): { lat: number; lng: number } {
  const n = points.length;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
  };
}

function featureBbox(feature: any) {
  const coords: [number, number][] = [];
  const collect = (geom: any) => {
    if (geom.type === 'Polygon')
      geom.coordinates.forEach((ring: any) => ring.forEach((c: any) => coords.push(c)));
    if (geom.type === 'MultiPolygon')
      geom.coordinates.forEach((poly: any) =>
        poly.forEach((ring: any) => ring.forEach((c: any) => coords.push(c))),
      );
  };
  collect(feature.geometry);
  return {
    minLng: Math.min(...coords.map((c) => c[0])),
    maxLng: Math.max(...coords.map((c) => c[0])),
    minLat: Math.min(...coords.map((c) => c[1])),
    maxLat: Math.max(...coords.map((c) => c[1])),
  };
}

/** Ray-casting point-in-polygon for a single ring. GeoJSON coords are [lng, lat]. */
function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; // xi=lng, yi=lat
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lat: number, lng: number, rings: [number, number][][]): boolean {
  if (!pointInRing(lat, lng, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lat, lng, rings[i])) return false; // inside a hole
  }
  return true;
}

function pointInFeature(lat: number, lng: number, feature: any): boolean {
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') return pointInPolygon(lat, lng, coordinates);
  if (type === 'MultiPolygon')
    return coordinates.some((poly: any) => pointInPolygon(lat, lng, poly));
  return false;
}
