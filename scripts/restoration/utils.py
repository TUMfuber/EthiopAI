from __future__ import annotations

import math
from pathlib import Path
from typing import Any

Feature = dict[str, Any]
FeatureCollection = dict[str, Any]

ROOT_DIR = Path(__file__).resolve().parents[2]
RESOURCES_DIR = ROOT_DIR / "resources"
PRECOMPUTED_DIR = RESOURCES_DIR / "precomputed"

ETHIOPIA_BOUNDS = (32.752242216397, 3.150365379220944, 48.2092554996693, 15.096023192612002)


def feature_collection(features: list[Feature]) -> FeatureCollection:
    return {"type": "FeatureCollection", "features": features}


def tile_corner_lon_lat(z: int, x: int, y: int) -> tuple[float, float]:
    n = 2**z
    lon = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    return lon, math.degrees(lat_rad)


def tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    west, north = tile_corner_lon_lat(z, x, y)
    east, south = tile_corner_lon_lat(z, x + 1, y + 1)
    return west, south, east, north
