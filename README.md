# EthopAI

## Vision

Recognize valuable locations for biodiversity, carbon storage, and other regional factors so resources can be focused where protection and restoration matter most.

## Project Structure

- `app/`: Next.js pages and API routes.
- `modules/map-service/`: map UI, raw layer definitions, and map-specific server helpers.
- `scripts/`: Python precompute scripts for generating restoration GeoJSON layers.
- `resources/`: Source and generated geospatial resources used by scripts and Next API routes.

## Run Locally

Install frontend dependencies:

```bash
npm install
```

Install script dependencies:

```bash
cd scripts
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Precompute the five restoration layers from the `EthopAI` folder:

```bash
npm run precompute
```

Live Sentinel and terrain sampling are opt-in:

```bash
npm run precompute -- --with-sentinel --with-terrain
```

Start the frontend in another terminal:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Raw Layers

Raw layers are hidden from the main map UI by default. Open map settings and enable the raw layer selector to inspect them.

KBA and admin boundaries use the Ethiopia files in `resources/`. Raster layers are not clipped to Ethiopia in the frontend. Raw raster tiles are served by same-origin Next API routes.

Sentinel raw tiles read `SENTINEL_HUB_*` values from the Next process environment, root `.env.local`, root `.env`, or `scripts/.env`.
