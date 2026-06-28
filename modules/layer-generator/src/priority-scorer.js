/**
 * Scores grid cells by different factors.
 * Each mode produces a 0-1 score per cell.
 * The frontend lets the user pick which mode to display.
 */

// Score by KBA (Key Biodiversity Area) overlap
export function scoreBiodiversity(cell, kbaFeatures) {
  let score = 0;
  for (const kba of kbaFeatures) {
    if (cellOverlapsFeature(cell, kba)) {
      score += 1;
    }
  }
  return Math.min(score / 3, 1); // normalize: 3+ KBAs = max
}

// Score by carbon credit density (credits issued in nearby projects)
export function scoreCarbon(cell, projects) {
  let totalCredits = 0;
  for (const p of projects) {
    if (!p.lat || !p.lng) continue;
    const dist = haversine(cell.lat, cell.lng, p.lat, p.lng);
    if (dist < 50) { // within 50km
      totalCredits += p.creditsIssued || 0;
    }
  }
  return Math.min(totalCredits / 1000000, 1); // 1M credits = max
}

// Score by project density
export function scoreProjectDensity(cell, projects) {
  let count = 0;
  for (const p of projects) {
    if (!p.lat || !p.lng) continue;
    const dist = haversine(cell.lat, cell.lng, p.lat, p.lng);
    if (dist < 80) count++;
  }
  return Math.min(count / 5, 1); // 5+ projects nearby = max
}

// Check if grid cell bbox overlaps a GeoJSON feature
function cellOverlapsFeature(cell, feature) {
  const geom = feature.geometry;
  if (!geom) return false;
  const coords = geom.type === "MultiPolygon"
    ? geom.coordinates.flat(1)
    : geom.type === "Polygon"
    ? geom.coordinates
    : geom.type === "Point"
    ? [[geom.coordinates]]
    : [];

  for (const ring of coords) {
    for (const [lng, lat] of ring) {
      if (
        lat >= cell.lat - cell.size / 2 &&
        lat <= cell.lat + cell.size / 2 &&
        lng >= cell.lng - cell.size / 2 &&
        lng <= cell.lng + cell.size / 2
      ) return true;
    }
  }
  return false;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
