from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def load_env(path: Path, *, override: bool = False) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        if not override and key in os.environ:
            continue
        os.environ[key] = value.strip().strip("'\"")


load_env(ROOT.parent / ".env")
load_env(ROOT.parent / ".env.local", override=True)
load_env(ROOT / ".env", override=True)

from restoration.precompute import PrecomputeOptions, precompute_restoration_layers


def main() -> None:
    parser = argparse.ArgumentParser(description="Precompute Ethiopia restoration-priority GeoJSON layers.")
    parser.add_argument("--offset", type=int, default=0, help="First grid-cell index to process.")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of grid cells to process.")
    parser.add_argument("--with-sentinel", action="store_true", help="Include live Sentinel Hub NDVI/NDMI sampling.")
    parser.add_argument("--with-terrain", action="store_true", help="Include live SRTM/Mapzen terrain slope sampling.")
    parser.add_argument(
        "--progress-interval",
        type=int,
        default=10,
        help="Print progress every N processed cells. Use 0 to disable progress output.",
    )
    args = parser.parse_args()

    result = precompute_restoration_layers(
        PrecomputeOptions(
            offset=max(0, args.offset),
            limit=args.limit,
            include_sentinel=args.with_sentinel,
            include_terrain=args.with_terrain,
            progress_interval=max(0, args.progress_interval),
        )
    )
    for key, value in result.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
