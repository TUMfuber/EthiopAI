from __future__ import annotations

import json
import math
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from .utils import RESOURCES_DIR

Feature = dict[str, Any]


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
    t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / length_sq))
    return math.hypot(px - (ax + t * abx), py - (ay + t * aby))


def configured_path(env_name: str, fallback_name: str) -> Path:
    configured = os.getenv(env_name)
    if configured:
        return Path(configured).expanduser()
    return RESOURCES_DIR / fallback_name


def geometry_bounds(geometry: dict[str, Any]) -> tuple[float, float, float, float]:
    points = list(iter_points(geometry))
    if not points:
        return 0.0, 0.0, 0.0, 0.0
    return (
        min(lon for lon, _ in points),
        min(lat for _, lat in points),
        max(lon for lon, _ in points),
        max(lat for _, lat in points),
    )


def iter_points(geometry: dict[str, Any]):
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    if kind == "Point":
        yield float(coordinates[0]), float(coordinates[1])
    elif kind == "MultiPoint" or kind == "LineString":
        for lon, lat, *_ in coordinates:
            yield float(lon), float(lat)
    elif kind == "MultiLineString" or kind == "Polygon":
        for line in coordinates:
            for lon, lat, *_ in line:
                yield float(lon), float(lat)
    elif kind == "MultiPolygon":
        for polygon in coordinates:
            for ring in polygon:
                for lon, lat, *_ in ring:
                    yield float(lon), float(lat)


def bbox_distance_km(lon: float, lat: float, bounds: tuple[float, float, float, float]) -> float:
    min_lon, min_lat, max_lon, max_lat = bounds
    nearest_lon = min(max(lon, min_lon), max_lon)
    nearest_lat = min(max(lat, min_lat), max_lat)
    return km_distance(lon, lat, nearest_lon, nearest_lat)


def line_distance_km(lon: float, lat: float, coordinates: list[list[float]]) -> float:
    distances = [
        point_to_segment_distance_km(lon, lat, start[0], start[1], end[0], end[1])
        for start, end in zip(coordinates, coordinates[1:])
    ]
    return min(distances) if distances else math.inf


def geometry_distance_km(lon: float, lat: float, geometry: dict[str, Any]) -> float:
    kind = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    if kind == "Point":
        return km_distance(lon, lat, float(coordinates[0]), float(coordinates[1]))
    if kind == "MultiPoint":
        return min(km_distance(lon, lat, float(point[0]), float(point[1])) for point in coordinates)
    if kind == "LineString":
        return line_distance_km(lon, lat, coordinates)
    if kind == "MultiLineString":
        return min(line_distance_km(lon, lat, line) for line in coordinates)
    if kind == "Polygon":
        return min(line_distance_km(lon, lat, ring) for ring in coordinates)
    if kind == "MultiPolygon":
        return min(line_distance_km(lon, lat, ring) for polygon in coordinates for ring in polygon)
    return math.inf


@lru_cache(maxsize=2)
def load_features(path: Path) -> tuple[tuple[Feature, tuple[float, float, float, float]], ...]:
    if not path.exists():
        return ()

    payload = json.loads(path.read_text(encoding="utf-8"))
    return tuple(
        (feature, geometry_bounds(feature.get("geometry", {})))
        for feature in payload.get("features", [])
        if feature.get("geometry")
    )


def nearest_distance_km(lon: float, lat: float, path: Path) -> float | None:
    features = load_features(path)
    if not features:
        return None

    best_distance = math.inf
    for feature, bounds in sorted(features, key=lambda item: bbox_distance_km(lon, lat, item[1])):
        if bbox_distance_km(lon, lat, bounds) > best_distance:
            break
        best_distance = min(best_distance, geometry_distance_km(lon, lat, feature.get("geometry", {})))
    return None if math.isinf(best_distance) else best_distance


def osm_access_indicators(lon: float, lat: float) -> dict[str, Any]:
    indicators: dict[str, Any] = {}

    road_path = configured_path("OSM_ROADS_GEOJSON", "osm_roads.geojson")
    road_distance = nearest_distance_km(lon, lat, road_path)
    if road_distance is not None:
        indicators["distance_to_road_km"] = road_distance
        indicators["roads_source"] = str(road_path)

    settlement_path = configured_path("OSM_SETTLEMENTS_GEOJSON", "osm_settlements.geojson")
    settlement_distance = nearest_distance_km(lon, lat, settlement_path)
    if settlement_distance is not None:
        indicators["distance_to_settlement_km"] = settlement_distance
        indicators["settlements_source"] = str(settlement_path)

    return indicators
