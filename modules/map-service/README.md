# @ethopai/map-service

Map module for EthopAI — interactive Ethiopia map with boundary mask, priority overlays, and project markers.

## Structure

```
modules/map-service/src/
├── components/
│   ├── EthiopiaMap.tsx        # Main map with mask + boundary + overlay/marker slots
│   ├── PriorityOverlays.tsx   # Colored GeoJSON zones (most/middle/least)
│   ├── ProjectMarkers.tsx     # Markers with hover tooltips
│   └── RawLayerRenderer.tsx   # Internal raw evidence layer renderer
├── data/
│   ├── priorityZones.json     # Sample priority zone polygons
│   └── projects.json          # Sample project entries
├── layers/
│   └── rawLayers.ts           # Hidden raw evidence layer definitions
├── server/
│   └── rawTileSources.ts      # Next API data-source helpers
└── index.ts                   # Module exports
```

## Usage

```tsx
import { EthiopiaMap } from '../modules/map-service/src';
import type { PriorityZones, Project } from '../modules/map-service/src';

// Without layers (just masked Ethiopia map)
<EthiopiaMap />

// With priority overlays and project markers
<EthiopiaMap priorityZones={zones} projects={projects} />

// Raw evidence layers are integrated but hidden by default.
// Pass IDs only from an internal feature flag or future layer control.
<EthiopiaMap visibleRawLayerIds={['ndvi']} />
```

## Layers

| Layer | Color | Purpose |
|-------|-------|---------|
| Most Relevant | 🔴 Red | Highest biodiversity/carbon value |
| Middle Relevant | 🟠 Orange | Moderate ecological significance |
| Least Relevant | 🟢 Green | Lower priority areas |

Raw evidence layers are registered in `layers/rawLayers.ts` with
`defaultVisible: false` and `showInLayerControls: false`, so they do not appear
in the main frontend UI. The settings panel can reveal a separate raw-layer
selector for user review.

Relative raster tile URLs are served through same-origin Next API routes under
`app/api/tiles`. Raw raster sources (`rgb`, `ndvi`, `chirp-rainfall`,
and `srtm-slope`) are generated directly by Next server routes. Direct external
raster sources keep their provider URLs. KBA, admin region, and precomputed
restoration layers use files in `resources/`.

The app page also supports hidden URL activation for internal/user review:

```text
/?rawLayers=ndvi
/?rawLayers=rgb,forest_loss
/?rawLayers=all
```

This also keeps raw layers out of the main UI.

When raw layers are active, the map is not constrained to Ethiopia bounds.
The outside-Ethiopia context mask remains visible so Ethiopia keeps the same
highlight treatment as the initial screen.

## Dependencies

Uses the root `package.json` dependencies: `leaflet`, `react-leaflet`, `next`, `react`.
