import { AdminRegionStrategy, BuildConfig, buildClusterTree, InputPoint } from './clustering';
import type { ClusterNode, LeafNode } from './ClusterLayer';

// ── Load real project points ──────────────────────────────────────────────────

let cachedPoints: InputPoint[] | null = null;

export async function loadProjectPoints(): Promise<InputPoint[]> {
  if (cachedPoints) return cachedPoints;

  try {
    const res = await fetch('/data/projects.json');
    if (!res.ok) return [];
    const data = await res.json();
    cachedPoints = data
      .filter((p: any) => p.lat && p.lng)
      .map((p: any) => ({
        id: String(p.id),
        lat: p.lat,
        lng: p.lng,
        label: p.name,
        weight: p.creditsIssued
          ? Math.min(p.creditsIssued / 10000000, 1)
          : 0.3,
      }));
    return cachedPoints!;
  } catch {
    return [];
  }
}

// ── Fallback: generate flat points from already-fetched data ──────────────────

export function generateFlatPoints(): InputPoint[] {
  // Return cached if available, otherwise empty (async load hasn't completed)
  return cachedPoints ?? [];
}

// ── Cluster tree ──────────────────────────────────────────────────────────────

const CLUSTER_CONFIG: BuildConfig = {
  maxDepth: 2,
  minClusterSize: 3,
};

/**
 * Build the cluster tree from real project data.
 */
export function buildEthiopiaExample(
  adminFeatures: any[],
): Array<ClusterNode | LeafNode> {
  const points = generateFlatPoints();
  if (points.length === 0) return [];
  const strategy = new AdminRegionStrategy(adminFeatures);
  return buildClusterTree(points, strategy, CLUSTER_CONFIG);
}
