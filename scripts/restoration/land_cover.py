from __future__ import annotations

import math
import urllib.error
import urllib.request
from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

from .utils import RESOURCES_DIR

TILE_URL = (
    "https://planetarycomputer.microsoft.com/api/data/v1/mosaic/"
    "5e9321fcce88b105d9523c3889722d44/tiles/WebMercatorQuad/{z}/{x}/{y}"
    "?collection=io-lulc-annual-v02&assets=data&colormap_name=io-lulc-9-class&format=png"
)

TILE_SIZE = 256
SAMPLE_ZOOM = 8
TILE_CACHE_DIR = RESOURCES_DIR / "landcover_tiles"

CLASS_COLORS = {
    "water_fraction": (65, 155, 223),
    "tree_fraction": (57, 125, 73),
    "wetland_fraction": (122, 135, 198),
    "cropland_fraction": (228, 150, 53),
    "builtup_fraction": (196, 40, 27),
    "bare_sparse_fraction": (165, 155, 143),
    "snow_ice_fraction": (168, 235, 255),
    "cloud_fraction": (97, 97, 97),
    "grassland_fraction": (227, 226, 195),
}

COLOR_NAMES = list(CLASS_COLORS)
COLOR_ARRAY = np.asarray([CLASS_COLORS[name] for name in COLOR_NAMES], dtype=np.int32)


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
def fetch_tile(zoom: int, x: int, y: int) -> np.ndarray | None:
    cached_path = TILE_CACHE_DIR / str(zoom) / f"{x}_{y}.png"
    if cached_path.exists():
        try:
            return np.asarray(Image.open(cached_path).convert("RGBA"))
        except OSError:
            cached_path.unlink(missing_ok=True)

    url = TILE_URL.format(z=zoom, x=x, y=y)
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            if response.status != 200 or response.headers.get_content_type() != "image/png":
                return None
            content = response.read()
            cached_path.parent.mkdir(parents=True, exist_ok=True)
            cached_path.write_bytes(content)
            image = Image.open(BytesIO(content)).convert("RGBA")
            return np.asarray(image)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError):
        return None


def nearest_class_name(rgb: np.ndarray) -> str | None:
    if rgb.shape[0] < 4 or int(rgb[3]) == 0:
        return None
    diff = COLOR_ARRAY - rgb[:3].astype(np.int32)
    distances = np.sum(diff * diff, axis=1)
    return COLOR_NAMES[int(np.argmin(distances))]


def sample_landcover_fractions(polygon: list[list[float]], samples_per_side: int = 4) -> dict[str, float] | None:
    min_lon = min(point[0] for point in polygon)
    max_lon = max(point[0] for point in polygon)
    min_lat = min(point[1] for point in polygon)
    max_lat = max(point[1] for point in polygon)

    counts = {name: 0 for name in COLOR_NAMES}
    valid_count = 0

    for x_index in range(samples_per_side):
        lon = min_lon + (max_lon - min_lon) * ((x_index + 0.5) / samples_per_side)
        for y_index in range(samples_per_side):
            lat = min_lat + (max_lat - min_lat) * ((y_index + 0.5) / samples_per_side)
            tile_x, tile_y, pixel_x, pixel_y = lon_lat_to_tile(lon, lat, SAMPLE_ZOOM)
            tile = fetch_tile(SAMPLE_ZOOM, tile_x, tile_y)
            if tile is None:
                continue
            class_name = nearest_class_name(tile[pixel_y, pixel_x])
            if class_name is None:
                continue
            counts[class_name] += 1
            valid_count += 1

    if valid_count == 0:
        return None

    fractions = {name: count / valid_count for name, count in counts.items()}
    fractions["shrubland_fraction"] = 0.0
    fractions["landcover_source"] = "IO/Esri 10m annual LULC 2023 raster tiles"
    return fractions
