# @ethopai/map-service

Map module for EthopAI — interactive Ethiopia map with boundary mask, priority overlays, and project markers.

## Structure

```
modules/map-service/src/
├── components/
│   ├── EthiopiaMap.tsx        # Main map with mask + boundary + overlay/marker slots
│   ├── PriorityOverlays.tsx   # Colored GeoJSON zones (most/middle/least)
│   └── ProjectMarkers.tsx     # Markers with hover tooltips
├── data/
│   ├── priorityZones.json     # Sample priority zone polygons
│   └── projects.json          # Sample project entries
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
```

## Layers

| Layer | Color | Purpose |
|-------|-------|---------|
| Most Relevant | 🔴 Red | Highest biodiversity/carbon value |
| Middle Relevant | 🟠 Orange | Moderate ecological significance |
| Least Relevant | 🟢 Green | Lower priority areas |

## Dependencies

Uses the root `package.json` dependencies: `leaflet`, `react-leaflet`, `next`, `react`.
