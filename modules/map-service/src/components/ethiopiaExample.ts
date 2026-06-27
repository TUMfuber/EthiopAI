import { AdminRegionStrategy, BuildConfig, buildClusterTree, InputPoint } from './clustering';
import type { ClusterNode, LeafNode } from './ClusterLayer';

// ── Seeded RNG ────────────────────────────────────────────────────────────────

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── Flat point generation ─────────────────────────────────────────────────────

const ETHIOPIA_BOX = { latMin: 3.4, latMax: 14.9, lngMin: 33.0, lngMax: 47.9 };
const TOTAL_POINTS = 2465;

/**
 * Generate random points scattered across Ethiopia's bounding box.
 * Points outside actual borders are still generated — AdminRegionStrategy
 * will assign those to "Other" during clustering.
 */
export function generateFlatPoints(seed = 42): InputPoint[] {
  const rand = lcg(seed);
  const { latMin, latMax, lngMin, lngMax } = ETHIOPIA_BOX;
  return Array.from({ length: TOTAL_POINTS }, (_, i) => ({
    id: `pt-${i}`,
    lat: latMin + rand() * (latMax - latMin),
    lng: lngMin + rand() * (lngMax - lngMin),
    label: `Point ${i + 1}`,
    weight: rand(),
  }));
}

// ── Cluster tree ──────────────────────────────────────────────────────────────

const CLUSTER_CONFIG: BuildConfig = {
  maxDepth: 2,       // level 0 = admin region, level 1 = grid zone, level 2 = leaves
  minClusterSize: 5, // groups of ≤5 points become leaves directly
};

/**
 * Build the Ethiopia example cluster tree.
 * Call this once the admin GeoJSON features are available.
 *
 * Strategy:
 *   depth 0 → AdminRegionStrategy  (groups by shapeName via PiP)
 *   depth 1 → GridStrategy(3)      (3×3 grid sub-zones within each region)
 *   depth 2 → leaves
 */
export function buildEthiopiaExample(
  adminFeatures: any[],
): Array<ClusterNode | LeafNode> {
  const points = generateFlatPoints();
  const strategy = new AdminRegionStrategy(adminFeatures);
  return buildClusterTree(points, strategy, CLUSTER_CONFIG);
}
