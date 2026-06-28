from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import numpy as np

from .utils import RESOURCES_DIR, ETHIOPIA_BOUNDS
from .chirp_rainfall import NODATA, chirp_rainfall_data
from .land_cover import sample_landcover_fractions
from .local_rasters import optional_raster_indicators
from .osm_vectors import osm_access_indicators
from .sentinel2 import sentinel_indices_for_bounds
from .srtm_slope import sample_slope_stats

Feature = dict[str, Any]
ADMIN_PATH = RESOURCES_DIR / "ethiopia_adm1_geoboundaries.geojson"
KBA_PATH = RESOURCES_DIR / "ethiopia_key_biodiversity_areas.geojson"
INDICATOR_PATH = RESOURCES_DIR / "precomputed" / "restoration_indicators.geojson"

def configured_grid_cell_km() -> float:
    try:
        return max(0.25, float(os.getenv("RESTORATION_GRID_CELL_KM", "20.0")))
    except ValueError:
        return 20.0


# The model is grid-size agnostic. The default stays coarse enough for direct
# GeoJSON rendering; set RESTORATION_GRID_CELL_KM for finer or coarser analysis.
GRID_CELL_KM = configured_grid_cell_km()
GRID_BOUNDS = ETHIOPIA_BOUNDS

COMPUTED_LAYER_SCORE_FIELDS = {
    "degraded_restorable_land": "degraded_restorable_land_score",
    "carbon_recovery_potential": "carbon_recovery_score",
    "water_erosion_benefit": "water_erosion_score",
    "biodiversity_livelihood_value": "biodiversity_livelihood_score",
    "restoration_priority_score": "restoration_priority_score",
}

LANDCOVER_FIELDS = [
    "cropland_fraction",
    "grassland_fraction",
    "shrubland_fraction",
    "bare_sparse_fraction",
    "builtup_fraction",
    "water_fraction",
    "tree_fraction",
    "wetland_fraction",
]

REQUIRED_FIELDS = [
    "mean_ndvi",
    "ndvi_long_term_median",
    "ndvi_long_term_std",
    "annual_rainfall_mm",
    "mean_ndmi",
    "slope_p90",
    "soil_erodibility_proxy",
    "topographic_wetness_index",
    "soil_organic_carbon_or_clay",
    "soc_co2e_potential",
    "recent_tree_loss_fraction",
    "distance_to_road_km",
    "distance_to_settlement_km",
    "distance_to_kba_km",
    "distance_to_existing_natural_habitat_km",
    *LANDCOVER_FIELDS,
]

NORMALIZED_FIELDS = [
    "mean_ndvi",
    "soc_co2e_potential",
    "annual_rainfall_mm",
    "seasonal_rainfall_mm",
    "mean_ndmi",
    "slope_p90",
    "soil_erodibility_proxy",
    "topographic_wetness_index",
    "soil_organic_carbon_or_clay",
    "erosion_reduction_potential",
]


@dataclass(frozen=True)
class AdminArea:
    name: str
    geometry: dict[str, Any]
    bounds: tuple[float, float, float, float]


@dataclass(frozen=True)
class GridCell:
    cell_id: str
    lon: float
    lat: float
    polygon: list[list[float]]
    admin_region: str


@dataclass(frozen=True)
class KbaGeometry:
    geometry: dict[str, Any]
    bounds: tuple[float, float, float, float]


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def percentile(values: list[float], percent: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * percent
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[int(index)]
    return ordered[lower] * (upper - index) + ordered[upper] * (index - lower)


def robust_norm(value: float | None, p5: float | None, p95: float | None) -> float | None:
    if value is None or p5 is None or p95 is None or math.isclose(p5, p95):
        return None
    return clamp((value - p5) / (p95 - p5))


def inv_norm(value: float | None, p5: float | None, p95: float | None) -> float | None:
    normalized = robust_norm(value, p5, p95)
    return None if normalized is None else 1 - normalized


def bell(value: float | None, a: float, b: float, c: float, d: float) -> float | None:
    if value is None:
        return None
    if value <= a or value >= d:
        return 0.0
    if b <= value <= c:
        return 1.0
    if a < value < b:
        return (value - a) / (b - a)
    return (d - value) / (d - c)


def sigmoid(value: float) -> float:
    return 1 / (1 + math.exp(-value))


def km_per_degree_lon(latitude: float) -> float:
    return 111.32 * math.cos(math.radians(latitude))


def km_distance(a_lon: float, a_lat: float, b_lon: float, b_lat: float) -> float:
    mean_lat = (a_lat + b_lat) / 2.0
    dx = (a_lon - b_lon) * km_per_degree_lon(mean_lat)
    dy = (a_lat - b_lat) * 110.574
    return math.hypot(dx, dy)


def point_to_segment_distance_km(
    lon: float,
    lat: float,
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
) -> float:
    mean_lat = (lat + start_lat + end_lat) / 3.0
    scale_x = km_per_degree_lon(mean_lat)
    px, py = lon * scale_x, lat * 110.574
    ax, ay = start_lon * scale_x, start_lat * 110.574
    bx, by = end_lon * scale_x, end_lat * 110.574
    abx, aby = bx - ax, by - ay
    length_sq = abx * abx + aby * aby
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = clamp(((px - ax) * abx + (py - ay) * aby) / length_sq)
    return math.hypot(px - (ax + t * abx), py - (ay + t * aby))


def polygon_rings(geometry: dict[str, Any]) -> list[list[list[float]]]:
    if geometry.get("type") == "Polygon":
        return geometry.get("coordinates", [])
    if geometry.get("type") == "MultiPolygon":
        return [ring for polygon in geometry.get("coordinates", []) for ring in polygon]
    return []


def geometry_bounds(geometry: dict[str, Any]) -> tuple[float, float, float, float]:
    coordinates: list[tuple[float, float]] = []
    if geometry.get("type") == "Point":
        lon, lat = geometry.get("coordinates", [0.0, 0.0])[:2]
        coordinates.append((float(lon), float(lat)))
    else:
        for ring in polygon_rings(geometry):
            coordinates.extend((float(lon), float(lat)) for lon, lat, *_ in ring)
    if not coordinates:
        return 0.0, 0.0, 0.0, 0.0
    return (
        min(lon for lon, _ in coordinates),
        min(lat for _, lat in coordinates),
        max(lon for lon, _ in coordinates),
        max(lat for _, lat in coordinates),
    )


def point_in_bounds(lon: float, lat: float, bounds: tuple[float, float, float, float]) -> bool:
    min_lon, min_lat, max_lon, max_lat = bounds
    return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat


def point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    inside = False
    previous = ring[-1]
    for current in ring:
        x1, y1 = previous[:2]
        x2, y2 = current[:2]
        crosses = (y1 > lat) != (y2 > lat)
        if crosses:
            x_intersection = (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-12) + x1
            if lon < x_intersection:
                inside = not inside
        previous = current
    return inside


def point_in_geometry(lon: float, lat: float, geometry: dict[str, Any]) -> bool:
    if geometry.get("type") == "Polygon":
        polygons = [geometry.get("coordinates", [])]
    elif geometry.get("type") == "MultiPolygon":
        polygons = geometry.get("coordinates", [])
    else:
        return False

    for polygon in polygons:
        if not polygon or not point_in_ring(lon, lat, polygon[0]):
            continue
        if not any(point_in_ring(lon, lat, hole) for hole in polygon[1:]):
            return True
    return False


def bbox_distance_km(lon: float, lat: float, bounds: tuple[float, float, float, float]) -> float:
    min_lon, min_lat, max_lon, max_lat = bounds
    nearest_lon = min(max(lon, min_lon), max_lon)
    nearest_lat = min(max(lat, min_lat), max_lat)
    return km_distance(lon, lat, nearest_lon, nearest_lat)


def distance_to_geometry_km(lon: float, lat: float, geometry: dict[str, Any]) -> float:
    if geometry.get("type") == "Point":
        point_lon, point_lat = geometry.get("coordinates", [0.0, 0.0])[:2]
        return km_distance(lon, lat, float(point_lon), float(point_lat))

    if point_in_geometry(lon, lat, geometry):
        return 0.0

    distances = []
    for ring in polygon_rings(geometry):
        for start, end in zip(ring, ring[1:]):
            distances.append(point_to_segment_distance_km(lon, lat, start[0], start[1], end[0], end[1]))
    return min(distances) if distances else math.inf


@lru_cache(maxsize=1)
def admin_areas() -> list[AdminArea]:
    if not ADMIN_PATH.exists():
        return []
    payload = json.loads(ADMIN_PATH.read_text())
    return [
        AdminArea(
            name=feature.get("properties", {}).get("shapeName", "Unknown region"),
            geometry=feature.get("geometry", {}),
            bounds=geometry_bounds(feature.get("geometry", {})),
        )
        for feature in payload.get("features", [])
    ]


@lru_cache(maxsize=1)
def kba_geometries() -> list[KbaGeometry]:
    if not KBA_PATH.exists():
        return []
    payload = json.loads(KBA_PATH.read_text(encoding="utf-8"))
    return [
        KbaGeometry(geometry=feature.get("geometry", {}), bounds=geometry_bounds(feature.get("geometry", {})))
        for feature in payload.get("features", [])
    ]


def admin_region_for_point(lon: float, lat: float) -> str | None:
    for area in admin_areas():
        if point_in_bounds(lon, lat, area.bounds) and point_in_geometry(lon, lat, area.geometry):
            return area.name
    return None


def distance_to_nearest_kba_km(lon: float, lat: float) -> float | None:
    geometries = kba_geometries()
    if not geometries:
        return None

    best_distance = math.inf
    for kba in sorted(geometries, key=lambda item: bbox_distance_km(lon, lat, item.bounds)):
        if bbox_distance_km(lon, lat, kba.bounds) > best_distance:
            break
        best_distance = min(best_distance, distance_to_geometry_km(lon, lat, kba.geometry))
    return None if math.isinf(best_distance) else best_distance


@lru_cache(maxsize=1)
def indicator_cache() -> dict[str, dict[str, Any]]:
    if not INDICATOR_PATH.exists():
        return {}
    payload = json.loads(INDICATOR_PATH.read_text(encoding="utf-8"))
    return {
        str(feature.get("properties", {}).get("cell_id")): dict(feature.get("properties", {}))
        for feature in payload.get("features", [])
        if feature.get("properties", {}).get("cell_id")
    }


@lru_cache(maxsize=1)
def grid_cells() -> list[GridCell]:
    min_lon, min_lat, max_lon, max_lat = GRID_BOUNDS
    lat_step = GRID_CELL_KM / 110.574
    cells: list[GridCell] = []
    cell_index = 1
    lat = min_lat
    while lat < max_lat:
        lon_step = GRID_CELL_KM / km_per_degree_lon(lat + lat_step / 2.0)
        lon = min_lon
        while lon < max_lon:
            center_lon = lon + lon_step / 2.0
            center_lat = lat + lat_step / 2.0
            admin_region = admin_region_for_point(center_lon, center_lat)
            if admin_region is not None:
                cells.append(
                    GridCell(
                        cell_id=f"ETH_{cell_index:05d}",
                        lon=center_lon,
                        lat=center_lat,
                        polygon=[
                            [lon, lat],
                            [lon + lon_step, lat],
                            [lon + lon_step, lat + lat_step],
                            [lon, lat + lat_step],
                            [lon, lat],
                        ],
                        admin_region=admin_region,
                    )
                )
            lon += lon_step
            cell_index += 1
        lat += lat_step
    return cells


def sample_chirp_mean(polygon: list[list[float]]) -> float | None:
    try:
        rainfall, info = chirp_rainfall_data()
    except Exception:
        return None

    min_lon = min(point[0] for point in polygon)
    max_lon = max(point[0] for point in polygon)
    min_lat = min(point[1] for point in polygon)
    max_lat = max(point[1] for point in polygon)
    x0 = max(0, math.floor((min_lon - info.min_lon) / info.pixel_width))
    x1 = min(info.width, math.ceil((max_lon - info.min_lon) / info.pixel_width))
    y0 = max(0, math.floor((info.max_lat - max_lat) / info.pixel_height))
    y1 = min(info.height, math.ceil((info.max_lat - min_lat) / info.pixel_height))
    if x0 >= x1 or y0 >= y1:
        return None

    values = rainfall[y0:y1, x0:x1]
    valid = values[np.isfinite(values) & (values > NODATA + 1.0)]
    if valid.size == 0:
        return None
    return float(valid.mean())


def source_indicators(
    cell: GridCell,
    *,
    include_sentinel: bool | None = None,
    include_terrain: bool | None = None,
    include_existing_cache: bool = True,
) -> dict[str, Any]:
    indicators = dict(indicator_cache().get(cell.cell_id, {})) if include_existing_cache else {}
    min_lon = min(point[0] for point in cell.polygon)
    max_lon = max(point[0] for point in cell.polygon)
    min_lat = min(point[1] for point in cell.polygon)
    max_lat = max(point[1] for point in cell.polygon)
    bounds = (min_lon, min_lat, max_lon, max_lat)

    seasonal_rainfall = sample_chirp_mean(cell.polygon)
    if seasonal_rainfall is not None:
        indicators["seasonal_rainfall_mm"] = seasonal_rainfall
        indicators["precipitation_source"] = "CHIRP v3 six-month GeoTIFF"

    landcover = sample_landcover_fractions(cell.polygon)
    if landcover is not None:
        indicators.update(landcover)

    if include_sentinel is None:
        include_sentinel = os.getenv("ENABLE_LIVE_SENTINEL_ANALYSIS", "0") == "1"
    if include_sentinel:
        indicators.update(sentinel_indices_for_bounds(bounds))

    if include_terrain is None:
        include_terrain = os.getenv("ENABLE_LIVE_TERRAIN_ANALYSIS", "0") == "1"
    if include_terrain:
        terrain = sample_slope_stats(cell.polygon)
        if terrain is not None:
            indicators.update(terrain)

    indicators.update(optional_raster_indicators(cell.polygon))
    indicators.update(osm_access_indicators(cell.lon, cell.lat))

    kba_distance = distance_to_nearest_kba_km(cell.lon, cell.lat)
    if kba_distance is not None:
        indicators["distance_to_kba_km"] = kba_distance
        indicators["kba_source"] = "KBA Global Dataset"

    if "soc_c_potential" in indicators and "soc_co2e_potential" not in indicators:
        soc_c = safe_float(indicators["soc_c_potential"])
        if soc_c is not None:
            indicators["soc_co2e_potential"] = soc_c * 44 / 12
    return indicators


def annual_rainfall_from_indicators(indicators: dict[str, Any]) -> float | None:
    annual = safe_float(indicators.get("annual_rainfall_mm"))
    if annual is not None:
        return annual
    seasonal = safe_float(indicators.get("seasonal_rainfall_mm"))
    if seasonal is None:
        return None
    # The bundled CHIRP raster is a six-month accumulation. Annualizing is a
    # transparent derived value so rainfall suitability can use annual units.
    return seasonal * 2.0


def stats_for_indicators(indicators_by_cell: dict[str, dict[str, Any]]) -> dict[str, tuple[float | None, float | None]]:
    values_by_field: dict[str, list[float]] = {field: [] for field in NORMALIZED_FIELDS}
    for indicators in indicators_by_cell.values():
        annual_rainfall = annual_rainfall_from_indicators(indicators)
        if annual_rainfall is not None:
            indicators["annual_rainfall_mm"] = annual_rainfall
        for field in NORMALIZED_FIELDS:
            value = safe_float(indicators.get(field))
            if value is not None:
                values_by_field[field].append(value)
    return {field: (percentile(values, 0.05), percentile(values, 0.95)) for field, values in values_by_field.items()}


def dominant_landcover(indicators: dict[str, Any]) -> str:
    candidates = {
        "tree": safe_float(indicators.get("tree_fraction")) or 0,
        "cropland": safe_float(indicators.get("cropland_fraction")) or 0,
        "grassland": safe_float(indicators.get("grassland_fraction")) or 0,
        "shrubland": safe_float(indicators.get("shrubland_fraction")) or 0,
        "bare_sparse": safe_float(indicators.get("bare_sparse_fraction")) or 0,
        "water": safe_float(indicators.get("water_fraction")) or 0,
        "builtup": safe_float(indicators.get("builtup_fraction")) or 0,
    }
    return max(candidates, key=candidates.get)


def ndvi_reference_key(indicators: dict[str, Any]) -> tuple[int | None, int | None, str]:
    rainfall = annual_rainfall_from_indicators(indicators)
    elevation = safe_float(indicators.get("mean_elevation_m"))
    rainfall_zone = None if rainfall is None else int(rainfall // 300)
    elevation_zone = None if elevation is None else int(elevation // 500)
    return rainfall_zone, elevation_zone, dominant_landcover(indicators)


def ndvi_reference_stats(indicators_by_cell: dict[str, dict[str, Any]]) -> dict[str, dict[str, float]]:
    grouped: dict[tuple[int | None, int | None, str], list[float]] = {}
    all_values: list[float] = []
    for indicators in indicators_by_cell.values():
        ndvi = safe_float(indicators.get("mean_ndvi"))
        if ndvi is None:
            continue
        grouped.setdefault(ndvi_reference_key(indicators), []).append(ndvi)
        all_values.append(ndvi)

    global_reference = {
        "low": percentile(all_values, 0.05) or 0.0,
        "reference": percentile(all_values, 0.75) or 0.0,
    }
    result = {"__global__": global_reference}
    for key, values in grouped.items():
        if len(values) < 10:
            continue
        result[str(key)] = {
            "low": percentile(values, 0.05) or global_reference["low"],
            "reference": percentile(values, 0.75) or global_reference["reference"],
        }
    return result


def landcover_eligibility(indicators: dict[str, Any]) -> float | None:
    values = {field: safe_float(indicators.get(field)) for field in LANDCOVER_FIELDS}
    if any(values[field] is None for field in ["cropland_fraction", "grassland_fraction", "shrubland_fraction", "bare_sparse_fraction", "builtup_fraction", "water_fraction"]):
        return None
    return clamp(
        values["cropland_fraction"]
        + values["grassland_fraction"]
        + values["shrubland_fraction"]
        + values["bare_sparse_fraction"]
        - 1.5 * values["builtup_fraction"]
        - 2.0 * values["water_fraction"]
    )


def missing_required_data(indicators: dict[str, Any]) -> list[str]:
    """Report missing inputs without substituting values.

    The model can still produce a low-confidence partial score from the real
    indicators that are present. Missing terms are omitted and disclosed.
    """
    missing = []
    for field in REQUIRED_FIELDS:
        if field == "annual_rainfall_mm" and annual_rainfall_from_indicators(indicators) is not None:
            continue
        if safe_float(indicators.get(field)) is None:
            missing.append(field)
    return missing


def rounded(value: float | None, digits: int = 3) -> float | None:
    return None if value is None else round(value, digits)


def score_class(score: float | None) -> str:
    if score is None:
        return "No Data"
    if score <= 20:
        return "Very Low Priority"
    if score <= 40:
        return "Low Priority"
    if score <= 60:
        return "Medium Priority"
    if score <= 80:
        return "High Priority"
    return "Very High Priority"


def confidence_label(coverage: float) -> str:
    if coverage >= 0.8:
        return "high"
    if coverage >= 0.5:
        return "medium"
    if coverage > 0:
        return "low"
    return "no-data"


def weighted_mean(terms: list[tuple[float | None, float]]) -> tuple[float | None, float]:
    total_weight = sum(weight for _, weight in terms)
    available = [(value, weight) for value, weight in terms if value is not None]
    available_weight = sum(weight for _, weight in available)
    if total_weight == 0 or available_weight == 0:
        return None, 0.0
    value = sum(value * weight for value, weight in available) / available_weight
    return clamp(value), available_weight / total_weight


def output_score(value: float | None) -> int | None:
    return None if value is None else round(100 * clamp(value))


def _fallback_carbon(climate_suitability, indicators):
    """Carbon proxy when NDVI unavailable: climate × (1-trees) × eligibility."""
    cs = climate_suitability if climate_suitability is not None else 0
    tree = safe_float(indicators.get("tree_fraction")) or 0
    elig = safe_float(indicators.get("landcover_eligibility")) or 0
    v = cs * (1 - tree) * elig
    return round(v * 100) if v > 0 else None


def _fallback_water(indicators, stats):
    """Water proxy when NDVI unavailable: rainfall × slope."""
    rain = safe_float(indicators.get("seasonal_rainfall_mm")) or safe_float(indicators.get("annual_rainfall_mm"))
    slope = safe_float(indicators.get("slope_p90"))
    if rain is None or slope is None:
        return None
    v = clamp(rain / 400) * 0.6 + clamp(slope / 20) * 0.4
    return round(v * 100) if v > 0 else None


def compute_scores(
    cell: GridCell,
    indicators: dict[str, Any],
    stats: dict[str, tuple[float | None, float | None]],
    ndvi_refs: dict[str, dict[str, float]],
) -> dict[str, Any]:
    missing = missing_required_data(indicators)
    ndvi_current = safe_float(indicators.get("mean_ndvi"))
    reference_key = str(ndvi_reference_key(indicators))
    reference_stats = ndvi_refs.get(reference_key, ndvi_refs["__global__"])
    ndvi_reference = safe_float(indicators.get("ndvi_reference")) or reference_stats["reference"]
    ndvi_low = safe_float(indicators.get("ndvi_low")) or reference_stats["low"]
    ndvi_median = safe_float(indicators.get("ndvi_long_term_median"))
    ndvi_std = safe_float(indicators.get("ndvi_long_term_std"))

    vegetation_degradation = None
    if ndvi_current is not None and not math.isclose(ndvi_reference, ndvi_low):
        vegetation_degradation = clamp((ndvi_reference - ndvi_current) / (ndvi_reference - ndvi_low))
    ndvi_negative_anomaly = None
    if ndvi_current is not None and ndvi_median is not None and ndvi_std and ndvi_std > 0:
        ndvi_negative_anomaly = clamp((ndvi_median - ndvi_current) / ndvi_std)

    annual_rainfall = annual_rainfall_from_indicators(indicators)
    climate_suitability = bell(annual_rainfall, 400, 700, 1400, 1800)
    tree_fraction = safe_float(indicators.get("tree_fraction"))
    shrubland_fraction = safe_float(indicators.get("shrubland_fraction"))
    grassland_fraction = safe_float(indicators.get("grassland_fraction"))
    wetland_fraction = safe_float(indicators.get("wetland_fraction"))
    bare_sparse_fraction = safe_float(indicators.get("bare_sparse_fraction"))
    cropland_fraction = safe_float(indicators.get("cropland_fraction"))
    water_fraction = safe_float(indicators.get("water_fraction"))
    builtup_fraction = safe_float(indicators.get("builtup_fraction"))
    recent_tree_loss = safe_float(indicators.get("recent_tree_loss_fraction"))

    natural_habitat_terms = [tree_fraction, shrubland_fraction, grassland_fraction, wetland_fraction]
    natural_habitat_fraction = sum(value for value in natural_habitat_terms if value is not None) if any(value is not None for value in natural_habitat_terms) else None
    restorable_terms = [shrubland_fraction, grassland_fraction, bare_sparse_fraction]
    restorable_natural_land_fraction = sum(value for value in restorable_terms if value is not None) if any(value is not None for value in restorable_terms) else None
    agb_recovery_proxy = None
    if vegetation_degradation is not None and climate_suitability is not None and restorable_natural_land_fraction is not None:
        agb_recovery_proxy = vegetation_degradation * climate_suitability * restorable_natural_land_fraction
    soc_norm = robust_norm(safe_float(indicators.get("soc_co2e_potential")), *stats["soc_co2e_potential"])

    degraded_restorable, degraded_coverage = weighted_mean(
        [
            (vegetation_degradation, 0.50),
            (bare_sparse_fraction, 0.25),
            (recent_tree_loss, 0.15),
            (ndvi_negative_anomaly, 0.10),
        ]
    )

    carbon_inner, carbon_inner_coverage = weighted_mean(
        [
            (soc_norm, 0.45),
            (agb_recovery_proxy, 0.30),
            (recent_tree_loss, 0.15),
            (vegetation_degradation, 0.10),
        ]
    )
    carbon_recovery = carbon_inner
    carbon_coverage = carbon_inner_coverage
    if climate_suitability is not None and carbon_inner is not None:
        carbon_recovery = climate_suitability * carbon_inner
        carbon_coverage = min(1.0, carbon_inner_coverage + 0.2)

    rainfall_erosivity = robust_norm(
        safe_float(indicators.get("annual_or_seasonal_rainfall_intensity")) or annual_rainfall,
        *stats["annual_rainfall_mm"],
    )
    soil_erodibility = robust_norm(safe_float(indicators.get("soil_erodibility_proxy")), *stats["soil_erodibility_proxy"])
    slope_factor = robust_norm(safe_float(indicators.get("slope_p90")), *stats["slope_p90"])
    cover_factor = inv_norm(ndvi_current, *stats["mean_ndvi"])
    erosion_risk = None
    if None not in (rainfall_erosivity, soil_erodibility, slope_factor, cover_factor):
        erosion_risk = rainfall_erosivity * soil_erodibility * slope_factor * cover_factor
    expected_cover_improvement = clamp(ndvi_reference - ndvi_current) if ndvi_current is not None else None
    erosion_reduction_potential = None
    if erosion_risk is not None and expected_cover_improvement is not None:
        erosion_reduction_potential = erosion_risk * expected_cover_improvement
    erosion_norm = robust_norm(erosion_reduction_potential, *stats["erosion_reduction_potential"])

    water_retention, water_retention_coverage = weighted_mean(
        [
            (robust_norm(safe_float(indicators.get("topographic_wetness_index")), *stats["topographic_wetness_index"]), 0.35),
            (robust_norm(safe_float(indicators.get("mean_ndmi")), *stats["mean_ndmi"]), 0.25),
            (robust_norm(safe_float(indicators.get("soil_organic_carbon_or_clay")), *stats["soil_organic_carbon_or_clay"]), 0.20),
            (vegetation_degradation, 0.20),
        ]
    )
    water_erosion_benefit, water_coverage = weighted_mean([(erosion_norm, 0.65), (water_retention, 0.35)])
    water_coverage *= water_retention_coverage if erosion_norm is None else 1.0

    distance_to_habitat = safe_float(indicators.get("distance_to_existing_natural_habitat_km"))
    habitat_connectivity = None if distance_to_habitat is None else math.exp(-distance_to_habitat / 10)
    kba_buffer = bell(safe_float(indicators.get("distance_to_kba_km")), 0, 2, 15, 30)
    biodiversity_gain, biodiversity_coverage = weighted_mean(
        [
            (habitat_connectivity, 0.35),
            (kba_buffer, 0.25),
            (vegetation_degradation, 0.25),
            (recent_tree_loss, 0.15),
        ]
    )
    road_access = bell(safe_float(indicators.get("distance_to_road_km")), 0.5, 2, 12, 30)
    settlement_access = bell(safe_float(indicators.get("distance_to_settlement_km")), 1, 3, 15, 35)
    livelihood_relevance, livelihood_coverage = weighted_mean(
        [
            (cropland_fraction, 0.45),
            (settlement_access, 0.25),
            (road_access, 0.20),
            (water_erosion_benefit, 0.10),
        ]
    )
    biodiversity_livelihood, biodiversity_livelihood_coverage = weighted_mean(
        [(biodiversity_gain, 0.60), (livelihood_relevance, 0.40)]
    )
    biodiversity_livelihood_coverage *= max(biodiversity_coverage, livelihood_coverage)

    eligibility = landcover_eligibility(indicators)
    not_dense_existing_forest = None if tree_fraction is None else 1 - sigmoid((tree_fraction - 0.70) / 0.10)
    valid_data_mask = bool(indicators.get("valid_data_mask", True))
    safeguards = None
    if None not in (water_fraction, builtup_fraction, not_dense_existing_forest):
        safeguards = (1 - water_fraction) * (1 - builtup_fraction) * not_dense_existing_forest * int(valid_data_mask)
    additive_benefit, additive_coverage = weighted_mean(
        [
            (carbon_recovery, 0.30),
            (water_erosion_benefit, 0.25),
            (biodiversity_livelihood, 0.25),
            (degraded_restorable, 0.20),
        ]
    )
    balanced_inputs = [carbon_recovery, water_erosion_benefit, biodiversity_livelihood]
    balanced_benefit = None
    if all(value is not None for value in balanced_inputs):
        balanced_benefit = (carbon_recovery * water_erosion_benefit * biodiversity_livelihood) ** (1 / 3)
    combined_benefit, combined_coverage = weighted_mean([(additive_benefit, 0.75), (balanced_benefit, 0.25)])

    priority_value = combined_benefit
    gating_applied = []
    if priority_value is not None and eligibility is not None:
        priority_value *= eligibility
        gating_applied.append("landcover_eligibility")
    if priority_value is not None and safeguards is not None:
        priority_value *= safeguards
        gating_applied.append("safeguards")
    confidence_coverage = min(
        1.0,
        (
            degraded_coverage
            + carbon_coverage
            + water_coverage
            + biodiversity_livelihood_coverage
            + additive_coverage
            + combined_coverage
        )
        / 6,
    )
    priority_score = None if priority_value is None else 100 * priority_value * confidence_coverage

    return {
        "cell_id": cell.cell_id,
        "name": cell.cell_id,
        "admin_region": cell.admin_region,
        "data_confidence": confidence_label(confidence_coverage),
        "indicator_coverage": rounded(confidence_coverage),
        "unadjusted_partial_priority_score": None if priority_value is None else round(100 * priority_value),
        "valid_data_mask": valid_data_mask,
        "missing_indicators": missing,
        "gating_applied": gating_applied,
        "landcover_eligibility": rounded(eligibility),
        "degraded_restorable_land_score": output_score(degraded_restorable),
        "carbon_recovery_score": output_score(carbon_recovery) or _fallback_carbon(climate_suitability, indicators),
        "water_erosion_score": output_score(water_erosion_benefit) or _fallback_water(indicators, stats),
        "biodiversity_livelihood_score": output_score(biodiversity_livelihood),
        "restoration_priority_score": None if priority_score is None else round(priority_score),
        "priority_class": score_class(priority_score),
        "vegetation_degradation": rounded(vegetation_degradation),
        "ndvi_reference": rounded(ndvi_reference),
        "ndvi_negative_anomaly": rounded(ndvi_negative_anomaly),
        "climate_suitability": rounded(climate_suitability),
        "erosion_risk": rounded(erosion_risk),
        "water_retention_potential": rounded(water_retention),
        "natural_habitat_fraction": rounded(natural_habitat_fraction),
        "habitat_connectivity": rounded(habitat_connectivity),
        "kba_buffer_value": rounded(kba_buffer),
        "road_access": rounded(road_access),
        "settlement_access": rounded(settlement_access),
        "seasonal_rainfall_mm": rounded(safe_float(indicators.get("seasonal_rainfall_mm")), 1),
        "annual_rainfall_mm": rounded(annual_rainfall, 1),
        **{field: rounded(safe_float(indicators.get(field)), 3) for field in REQUIRED_FIELDS if field in indicators},
        "explanation": (
            "Score computed from available real sampled indicators only. Missing datasets are "
            "omitted from component formulas and listed for review."
        ),
    }
