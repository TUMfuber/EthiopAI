from __future__ import annotations

import math
import os
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from .utils import RESOURCES_DIR
from .chirp_rainfall import GeoTiffInfo, read_geotiff_info

NODATA = -9999.0


def raster_path(env_name: str, fallback_name: str) -> Path:
    configured = os.getenv(env_name)
    if configured:
        return Path(configured).expanduser()
    return RESOURCES_DIR / fallback_name


def raster_mean(path: Path, polygon: list[list[float]], nodata: float = NODATA) -> float | None:
    if not path.exists():
        return None

    try:
        image = Image.open(path)
        info = read_geotiff_info(image)
        values = np.asarray(image, dtype=np.float32)
    except (OSError, KeyError, ValueError):
        return None

    window = raster_window(info, polygon)
    if window is None:
        return None

    x0, y0, x1, y1 = window
    data = values[y0:y1, x0:x1]
    valid = data[np.isfinite(data) & (data > nodata + 1.0)]
    if valid.size == 0:
        return None
    return float(valid.mean())


def raster_fraction(path: Path, polygon: list[list[float]], minimum_value: float = 1.0, nodata: float = NODATA) -> float | None:
    if not path.exists():
        return None

    try:
        image = Image.open(path)
        info = read_geotiff_info(image)
        values = np.asarray(image, dtype=np.float32)
    except (OSError, KeyError, ValueError):
        return None

    window = raster_window(info, polygon)
    if window is None:
        return None

    x0, y0, x1, y1 = window
    data = values[y0:y1, x0:x1]
    valid = data[np.isfinite(data) & (data > nodata + 1.0)]
    if valid.size == 0:
        return None
    return float((valid >= minimum_value).sum() / valid.size)


def raster_window(info: GeoTiffInfo, polygon: list[list[float]]) -> tuple[int, int, int, int] | None:
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
    return x0, y0, x1, y1


def optional_raster_indicators(polygon: list[list[float]]) -> dict[str, Any]:
    """Read optional real GeoTIFF inputs from data_cache or configured paths.

    These files are not bundled because they are large. If a file is absent, the
    corresponding indicator remains missing instead of being approximated.
    """

    indicators: dict[str, Any] = {}

    tree_loss_path = raster_path("TREE_COVER_LOSS_RASTER", "umd_tree_cover_loss_2001_2024.tif")
    tree_loss = raster_fraction(tree_loss_path, polygon)
    if tree_loss is not None:
        indicators["recent_tree_loss_fraction"] = tree_loss
        indicators["tree_loss_source"] = str(tree_loss_path)

    soc_path = raster_path("SOIL_CARBON_RESPONSE_RASTER", "gsocseq_soil_carbon_response.tif")
    soc = raster_mean(soc_path, polygon)
    if soc is not None:
        indicators["soc_co2e_potential"] = soc
        indicators["soil_carbon_source"] = str(soc_path)

    clay_or_soc_path = raster_path("SOIL_ORGANIC_CARBON_OR_CLAY_RASTER", "soil_organic_carbon_or_clay.tif")
    clay_or_soc = raster_mean(clay_or_soc_path, polygon)
    if clay_or_soc is not None:
        indicators["soil_organic_carbon_or_clay"] = clay_or_soc
        indicators["soil_water_source"] = str(clay_or_soc_path)

    erodibility_path = raster_path("SOIL_ERODIBILITY_RASTER", "soil_erodibility_proxy.tif")
    erodibility = raster_mean(erodibility_path, polygon)
    if erodibility is not None:
        indicators["soil_erodibility_proxy"] = erodibility
        indicators["soil_erodibility_source"] = str(erodibility_path)

    wetness_path = raster_path("TOPOGRAPHIC_WETNESS_RASTER", "topographic_wetness_index.tif")
    wetness = raster_mean(wetness_path, polygon)
    if wetness is not None:
        indicators["topographic_wetness_index"] = wetness
        indicators["wetness_source"] = str(wetness_path)

    return indicators
