# Scripts

Python utilities for generating geospatial resources used by the Next.js app.

## Setup

```bash
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -r scripts/requirements.txt
```

## Precompute Restoration Layers

The default grid resolution is 50 km.

```bash
npm run precompute
```

Optional live inputs:

```bash
npm run precompute -- --with-sentinel --with-terrain
```

Outputs are written to `resources/precomputed/`.
