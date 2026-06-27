from __future__ import annotations

import json
import math
import sys
import time
from dataclasses import dataclass
from typing import Any

from .utils import PRECOMPUTED_DIR, feature_collection
from .restoration_priority import (
    INDICATOR_PATH,
    COMPUTED_LAYER_SCORE_FIELDS,
    GridCell,
    compute_scores,
    grid_cells,
    indicator_cache,
    km_distance,
    ndvi_reference_stats,
    safe_float,
    source_indicators,
    stats_for_indicators,
)

SCORED_GRID_PATH = PRECOMPUTED_DIR / "restoration_priority_grid.geojson"


@dataclass(frozen=True)
class PrecomputeOptions:
    offset: int = 0
    limit: int | None = None
    include_sentinel: bool = True
    include_terrain: bool = True
    progress_interval: int = 10


def precompute_restoration_layers(options: PrecomputeOptions) -> dict[str, Any]:
    """Build real indicator and scored-grid caches for the computed layers."""

    cells = grid_cells()
    end = None if options.limit is None else options.offset + max(0, options.limit)
    selected_cells = cells[options.offset : end]
    existing = load_indicator_cache()
    indicators_by_cell: dict[str, dict[str, Any]] = {cell.cell_id: dict(existing.get(cell.cell_id, {})) for cell in cells}

    progress = ProgressReporter(
        total=len(selected_cells),
        interval=options.progress_interval,
        label="Sampling indicators",
    )
    progress.start()
    for index, cell in enumerate(selected_cells, start=1):
        indicators_by_cell[cell.cell_id].update(
            source_indicators(
                cell,
                include_sentinel=options.include_sentinel,
                include_terrain=options.include_terrain,
                include_existing_cache=False,
            )
        )
        progress.update(index)
    progress.finish()

    print("Deriving natural habitat distances...", file=sys.stderr, flush=True)
    add_natural_habitat_distances(cells, indicators_by_cell)
    print("Computing score statistics...", file=sys.stderr, flush=True)
    stats = stats_for_indicators(indicators_by_cell)
    ndvi_refs = ndvi_reference_stats(indicators_by_cell)
    add_erosion_reduction_stats(cells, indicators_by_cell, stats, ndvi_refs)

    print("Writing precomputed GeoJSON layers...", file=sys.stderr, flush=True)
    indicator_features = []
    scored_features = []
    for cell in cells:
        indicators = indicators_by_cell[cell.cell_id]
        indicator_features.append(grid_feature(cell, indicators))
        scored_features.append(grid_feature(cell, compute_scores(cell, indicators, stats, ndvi_refs)))

    write_geojson(INDICATOR_PATH, feature_collection(indicator_features))
    write_geojson(SCORED_GRID_PATH, feature_collection(scored_features))
    layer_paths = write_layer_geojsons(scored_features)
    indicator_cache.cache_clear()

    return {
        "cells_total": len(cells),
        "cells_precomputed_this_run": len(selected_cells),
        "indicator_cache": str(INDICATOR_PATH),
        "scored_grid_cache": str(SCORED_GRID_PATH),
        "layers": {layer_id: str(path) for layer_id, path in layer_paths.items()},
        "include_sentinel": options.include_sentinel,
        "include_terrain": options.include_terrain,
    }


class ProgressReporter:
    def __init__(self, total: int, interval: int, label: str) -> None:
        self.total = total
        self.interval = interval
        self.label = label
        self.started_at = 0.0
        self.last_line_length = 0
        self.current = 0

    def start(self) -> None:
        self.started_at = time.monotonic()
        if self.interval > 0:
            self._write(0)

    def update(self, current: int) -> None:
        if self.interval <= 0:
            return
        if current == self.total or current % self.interval == 0:
            self._write(current)

    def finish(self) -> None:
        if self.interval <= 0:
            return
        if self.current != self.total:
            self._write(self.total)
        print(file=sys.stderr, flush=True)

    def _write(self, current: int) -> None:
        self.current = current
        elapsed = max(0.0, time.monotonic() - self.started_at)
        rate = current / elapsed if elapsed > 0 and current > 0 else 0.0
        remaining = self.total - current
        eta = remaining / rate if rate > 0 else None
        percent = (current / self.total * 100) if self.total else 100.0
        width = 24
        filled = int(width * current / self.total) if self.total else width
        bar = "#" * filled + "-" * (width - filled)
        line = (
            f"\r{self.label}: [{bar}] {current}/{self.total} "
            f"({percent:5.1f}%) elapsed {format_duration(elapsed)} "
            f"rate {rate:5.2f} cells/s ETA {format_duration(eta)}"
        )
        padding = " " * max(0, self.last_line_length - len(line))
        self.last_line_length = len(line)
        print(line + padding, end="", file=sys.stderr, flush=True)


def format_duration(seconds: float | None) -> str:
    if seconds is None:
        return "--:--"
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def load_indicator_cache() -> dict[str, dict[str, Any]]:
    if not INDICATOR_PATH.exists():
        return {}
    payload = json.loads(INDICATOR_PATH.read_text(encoding="utf-8"))
    return {
        str(feature.get("properties", {}).get("cell_id")): dict(feature.get("properties", {}))
        for feature in payload.get("features", [])
        if feature.get("properties", {}).get("cell_id")
    }


def write_geojson(path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def write_layer_geojsons(scored_features: list[dict[str, Any]]) -> dict[str, Any]:
    paths = {}
    for layer_id, score_field in COMPUTED_LAYER_SCORE_FIELDS.items():
        path = PRECOMPUTED_DIR / f"{layer_id}.geojson"
        paths[layer_id] = path
        write_geojson(
            path,
            feature_collection([layer_feature(feature, layer_id, score_field) for feature in scored_features]),
        )
    return paths


def layer_feature(feature: dict[str, Any], layer_id: str, score_field: str) -> dict[str, Any]:
    properties = dict(feature.get("properties", {}))
    properties["layer_id"] = layer_id
    properties["score"] = properties.get(score_field)
    return {
        **feature,
        "properties": properties,
    }


def grid_feature(cell: GridCell, properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "Feature",
        "id": cell.cell_id,
        "properties": {
            "cell_id": cell.cell_id,
            "name": cell.cell_id,
            "admin_region": cell.admin_region,
            **properties,
        },
        "geometry": {"type": "Polygon", "coordinates": [cell.polygon]},
    }


def natural_habitat_fraction(indicators: dict[str, Any]) -> float | None:
    values = [
        safe_float(indicators.get("tree_fraction")),
        safe_float(indicators.get("shrubland_fraction")),
        safe_float(indicators.get("grassland_fraction")),
        safe_float(indicators.get("wetland_fraction")),
    ]
    available = [value for value in values if value is not None]
    if not available:
        return None
    return sum(available)


def add_natural_habitat_distances(cells: list[GridCell], indicators_by_cell: dict[str, dict[str, Any]]) -> None:
    habitat_points = [
        (cell.lon, cell.lat)
        for cell in cells
        if (natural_habitat_fraction(indicators_by_cell[cell.cell_id]) or 0) >= 0.5
    ]
    if not habitat_points:
        return

    bins: dict[tuple[int, int], list[tuple[float, float]]] = {}
    bin_size = 0.5
    for lon, lat in habitat_points:
        bins.setdefault((math.floor(lon / bin_size), math.floor(lat / bin_size)), []).append((lon, lat))

    for cell in cells:
        indicators = indicators_by_cell[cell.cell_id]
        if safe_float(indicators.get("distance_to_existing_natural_habitat_km")) is not None:
            continue

        start_x = math.floor(cell.lon / bin_size)
        start_y = math.floor(cell.lat / bin_size)
        best_distance = math.inf
        for radius in range(0, 16):
            candidates = []
            for x_index in range(start_x - radius, start_x + radius + 1):
                for y_index in range(start_y - radius, start_y + radius + 1):
                    candidates.extend(bins.get((x_index, y_index), []))
            if not candidates:
                continue
            best_distance = min(km_distance(cell.lon, cell.lat, lon, lat) for lon, lat in candidates)
            break

        if math.isfinite(best_distance):
            indicators["distance_to_existing_natural_habitat_km"] = best_distance
            indicators["natural_habitat_source"] = "Derived from IO/Esri land-cover fractions"


def add_erosion_reduction_stats(
    cells: list[GridCell],
    indicators_by_cell: dict[str, dict[str, Any]],
    stats: dict[str, tuple[float | None, float | None]],
    ndvi_refs: dict[str, dict[str, float]],
) -> None:
    from .restoration_priority import clamp, inv_norm, ndvi_reference_key, percentile, robust_norm

    values = []
    for cell in cells:
        indicators = indicators_by_cell[cell.cell_id]
        reference_key = str(ndvi_reference_key(indicators))
        reference_stats = ndvi_refs.get(reference_key, ndvi_refs["__global__"])
        ndvi_current = safe_float(indicators.get("mean_ndvi"))
        if ndvi_current is None:
            continue
        ndvi_reference = safe_float(indicators.get("ndvi_reference")) or reference_stats["reference"]
        rainfall = robust_norm(safe_float(indicators.get("annual_rainfall_mm")), *stats["annual_rainfall_mm"])
        soil = robust_norm(safe_float(indicators.get("soil_erodibility_proxy")), *stats["soil_erodibility_proxy"])
        slope = robust_norm(safe_float(indicators.get("slope_p90")), *stats["slope_p90"])
        cover = inv_norm(ndvi_current, *stats["mean_ndvi"])
        if None in (rainfall, soil, slope, cover):
            continue
        values.append(rainfall * soil * slope * cover * clamp(ndvi_reference - ndvi_current))

    if values:
        stats["erosion_reduction_potential"] = (percentile(values, 0.05), percentile(values, 0.95))
