from __future__ import annotations

import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from typing import Literal

import numpy as np
from PIL import Image

PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"

INDEX_EVALSCRIPTS = {
    "ndvi": """
//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 1, sampleType: "FLOAT32" }
  };
}

function evaluatePixel(sample) {
  const invalid = sample.dataMask === 0 || [3, 8, 9, 10, 11].includes(sample.SCL);
  if (invalid) return [-9999];
  return [(sample.B08 - sample.B04) / (sample.B08 + sample.B04)];
}
""".strip(),
    "ndmi": """
//VERSION=3
function setup() {
  return {
    input: ["B08", "B11", "SCL", "dataMask"],
    output: { bands: 1, sampleType: "FLOAT32" }
  };
}

function evaluatePixel(sample) {
  const invalid = sample.dataMask === 0 || [3, 8, 9, 10, 11].includes(sample.SCL);
  if (invalid) return [-9999];
  return [(sample.B08 - sample.B11) / (sample.B08 + sample.B11)];
}
""".strip(),
}


@dataclass
class TokenCache:
    access_token: str | None = None
    expires_at: float = 0


token_cache = TokenCache()


def credentials() -> tuple[str, str] | None:
    client_id = os.getenv("SENTINEL_HUB_CLIENT_ID")
    client_secret = os.getenv("SENTINEL_HUB_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None
    return client_id, client_secret


def access_token() -> str | None:
    creds = credentials()
    if creds is None:
        return None

    if token_cache.access_token and time.time() < token_cache.expires_at - 60:
        return token_cache.access_token

    client_id, client_secret = creds
    body = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read())
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None

    token_cache.access_token = payload["access_token"]
    token_cache.expires_at = time.time() + int(payload.get("expires_in", 300))
    return token_cache.access_token


def time_range() -> dict[str, str]:
    return {
        "from": os.getenv("SENTINEL_HUB_START", "2026-01-01T00:00:00Z"),
        "to": os.getenv("SENTINEL_HUB_END", "2026-03-31T23:59:59Z"),
    }


def max_cloud_coverage() -> int:
    try:
        return max(0, min(100, int(os.getenv("SENTINEL_HUB_MAX_CLOUD", "40"))))
    except ValueError:
        return 40


def numeric_index_payload(bounds: tuple[float, float, float, float], index_name: Literal["ndvi", "ndmi"]) -> dict:
    width, height = numeric_output_size(bounds)
    return {
        "input": {
            "bounds": {
                "bbox": list(bounds),
                "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": time_range(),
                        "maxCloudCoverage": max_cloud_coverage(),
                        "mosaickingOrder": "leastCC",
                    },
                }
            ],
        },
        "output": {
            "width": width,
            "height": height,
            "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}],
        },
        "evalscript": INDEX_EVALSCRIPTS[index_name],
    }


def numeric_output_size(bounds: tuple[float, float, float, float]) -> tuple[int, int]:
    west, south, east, north = bounds
    mean_lat = (south + north) / 2.0
    width_m = abs(east - west) * 111_320 * math.cos(math.radians(mean_lat))
    height_m = abs(north - south) * 110_574
    # Sentinel-2 L2A rejects requests coarser than 1500 m/px. Use a smaller
    # target resolution so large/coarse grid cells still return numeric samples.
    target_resolution_m = 1000
    width = max(16, min(256, math.ceil(width_m / target_resolution_m)))
    height = max(16, min(256, math.ceil(height_m / target_resolution_m)))
    return width, height


def fetch_numeric_index(bounds: tuple[float, float, float, float], index_name: Literal["ndvi", "ndmi"], token: str) -> bytes | None:
    request = urllib.request.Request(
        PROCESS_URL,
        data=json.dumps(numeric_index_payload(bounds, index_name)).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "image/tiff",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status != 200:
                return None
            return response.read()
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None


def mean_float_tiff(content: bytes) -> float | None:
    try:
        image = Image.open(BytesIO(content))
    except OSError:
        return None

    # Sentinel Hub FLOAT32 TIFF samples are big-endian. Reading through Pillow's
    # default float array path can produce nonsensical huge values on some
    # platforms, so decode the sample bytes explicitly.
    values = np.frombuffer(image.tobytes(), dtype=">f4").astype(np.float64)
    valid = values[np.isfinite(values) & (values >= -1.0) & (values <= 1.0)]
    if valid.size == 0:
        return None
    return float(valid.mean())


@lru_cache(maxsize=4096)
def sentinel_index_mean(bounds: tuple[float, float, float, float], index_name: Literal["ndvi", "ndmi"]) -> float | None:
    token = access_token()
    if token is None:
        return None
    content = fetch_numeric_index(bounds, index_name, token)
    if content is None:
        return None
    return mean_float_tiff(content)


def sentinel_indices_for_bounds(bounds: tuple[float, float, float, float]) -> dict[str, float]:
    values: dict[str, float] = {}
    ndvi = sentinel_index_mean(bounds, "ndvi")
    if ndvi is not None:
        values["mean_ndvi"] = ndvi
        values["ndvi_source"] = "Sentinel-2 L2A via Sentinel Hub Process API"
    ndmi = sentinel_index_mean(bounds, "ndmi")
    if ndmi is not None:
        values["mean_ndmi"] = ndmi
        values["ndmi_source"] = "Sentinel-2 L2A via Sentinel Hub Process API"
    return values
