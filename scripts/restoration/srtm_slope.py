from __future__ import annotations

import math
import urllib.error
import urllib.request
from functools import lru_cache
from io import BytesIO

import numpy as np
from PIL import Image

from .utils import tile_bounds

TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
TILE_SIZE = 256
SAMPLE_ZOOM = 10


@lru_cache(maxsize=512)
def fetch_terrarium_tile(z: int, x: int, y: int) -> bytes | None:
    url = TERRARIUM_URL.format(z=z, x=x, y=y)
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            if response.status != 200 or response.headers.get_content_type() != "image/png":
                return None
            return response.read()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None


def terrarium_to_elevation(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    return (rgb[:, :, 0] * 256.0 + rgb[:, :, 1] + rgb[:, :, 2] / 256.0) - 32768.0


def meters_per_pixel(z: int, latitude: float) -> float:
    return 156543.03392804097 * math.cos(math.radians(latitude)) / (2**z)


def lon_lat_to_tile(lon: float, lat: float, zoom: int) -> tuple[int, int, int, int]:
    lat = max(min(lat, 85.05112878), -85.05112878)
    n = 2**zoom
    x_float = (lon + 180.0) / 360.0 * n
    lat_rad = math.radians(lat)
    y_float = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    x_tile = int(math.floor(x_float))
    y_tile = int(math.floor(y_float))
    pixel_x = int((x_float - x_tile) * TILE_SIZE)
    pixel_y = int((y_float - y_tile) * TILE_SIZE)
    return x_tile, y_tile, max(0, min(TILE_SIZE - 1, pixel_x)), max(0, min(TILE_SIZE - 1, pixel_y))


@lru_cache(maxsize=512)
def slope_array_for_tile(z: int, x: int, y: int) -> tuple[np.ndarray, np.ndarray] | None:
    tile = fetch_terrarium_tile(z, x, y)
    if tile is None:
        return None

    bounds = tile_bounds(z, x, y)
    latitude = (bounds[1] + bounds[3]) / 2.0
    elevation = terrarium_to_elevation(Image.open(BytesIO(tile)))
    resolution = meters_per_pixel(z, latitude)
    gradient_y, gradient_x = np.gradient(elevation, resolution, resolution)
    slope = np.degrees(np.arctan(np.hypot(gradient_x, gradient_y)))
    return elevation, slope


def sample_slope_stats(polygon: list[list[float]], samples_per_side: int = 4) -> dict[str, float] | None:
    """Sample real elevation tiles and derive mean elevation plus slope stats."""

    min_lon = min(point[0] for point in polygon)
    max_lon = max(point[0] for point in polygon)
    min_lat = min(point[1] for point in polygon)
    max_lat = max(point[1] for point in polygon)
    elevations = []
    slopes = []

    for x_index in range(samples_per_side):
        lon = min_lon + (max_lon - min_lon) * ((x_index + 0.5) / samples_per_side)
        for y_index in range(samples_per_side):
            lat = min_lat + (max_lat - min_lat) * ((y_index + 0.5) / samples_per_side)
            tile_x, tile_y, pixel_x, pixel_y = lon_lat_to_tile(lon, lat, SAMPLE_ZOOM)
            arrays = slope_array_for_tile(SAMPLE_ZOOM, tile_x, tile_y)
            if arrays is None:
                continue
            elevation, slope = arrays
            elevations.append(float(elevation[pixel_y, pixel_x]))
            slopes.append(float(slope[pixel_y, pixel_x]))

    if not slopes:
        return None

    slope_values = np.asarray(slopes, dtype=np.float32)
    return {
        "mean_elevation_m": float(np.mean(elevations)),
        "mean_slope": float(np.mean(slope_values)),
        "slope_p90": float(np.percentile(slope_values, 90)),
        "slope_source": "Mapzen Terrarium elevation tiles derived from SRTM",
    }
