from __future__ import annotations

import threading
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image

from .utils import RESOURCES_DIR

CHIRP_FILE_NAME = "chirp-v3.0.2025.091011120102.tif"
NODATA = -9999.0
CHIRP_SOURCE_URL = (
    "https://data.chc.ucsb.edu/products/CHIRP-v3.0/6-monthly/global/tifs/"
    f"{CHIRP_FILE_NAME}"
)
CHIRP_CACHE_PATH = RESOURCES_DIR / CHIRP_FILE_NAME

_download_lock = threading.Lock()


@dataclass(frozen=True)
class GeoTiffInfo:
    min_lon: float
    max_lat: float
    pixel_width: float
    pixel_height: float
    width: int
    height: int


def ensure_chirp_file() -> Path:
    if CHIRP_CACHE_PATH.exists():
        return CHIRP_CACHE_PATH

    with _download_lock:
        if CHIRP_CACHE_PATH.exists():
            return CHIRP_CACHE_PATH

        RESOURCES_DIR.mkdir(parents=True, exist_ok=True)
        partial_path = CHIRP_CACHE_PATH.with_suffix(".tmp")
        urllib.request.urlretrieve(CHIRP_SOURCE_URL, partial_path)
        partial_path.replace(CHIRP_CACHE_PATH)

    return CHIRP_CACHE_PATH


def read_geotiff_info(image: Image.Image) -> GeoTiffInfo:
    pixel_scale = image.tag_v2[33550]
    tiepoint = image.tag_v2[33922]
    width, height = image.size

    return GeoTiffInfo(
        min_lon=float(tiepoint[3]),
        max_lat=float(tiepoint[4]),
        pixel_width=float(pixel_scale[0]),
        pixel_height=float(pixel_scale[1]),
        width=width,
        height=height,
    )


@lru_cache(maxsize=1)
def chirp_rainfall_data() -> tuple[np.ndarray, GeoTiffInfo]:
    path = ensure_chirp_file()
    image = Image.open(path)
    info = read_geotiff_info(image)
    return np.asarray(image, dtype=np.float32), info
