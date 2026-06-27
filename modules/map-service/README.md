# @ethopai/map-service

Interactive map module for EthopAI — displays Ethiopia with zoomable tiles, priority overlay layers, and ecological project markers.

## Quick Start

```bash
cd EthopAI/modules/map-service
npm install
npm run dev
```

## Usage

```jsx
import { EthiopiaMap } from "@ethopai/map-service";
import priorityZones from "./data/priorityZones.json";
import projects from "./data/projects.json";

function App() {
  return (
    <div style={{ height: "100vh" }}>
      <EthiopiaMap priorityZones={priorityZones} projects={projects} />
    </div>
  );
}
```

## Layers

| Layer | Color | Meaning |
|-------|-------|---------|
| Most Relevant | Red | Highest biodiversity/carbon value — top priority |
| Middle Relevant | Orange | Moderate ecological significance |
| Least Relevant | Green | Lower priority areas |

## Project Markers

Markers appear at project locations. Hover to see a tooltip with:
- Project name and type
- Organization running it
- Status and description

## Data Format

- `src/data/priorityZones.json` — GeoJSON FeatureCollections keyed by `mostRelevant`, `middleRelevant`, `leastRelevant`
- `src/data/projects.json` — Array of `{ id, name, lat, lng, type, description, organization, status }`

## Structure

```
map-service/
├── src/
│   ├── components/
│   │   ├── EthiopiaMap.jsx       # Main map container
│   │   ├── PriorityOverlays.jsx  # Colored zone layers
│   │   └── ProjectMarkers.jsx    # Markers with hover tooltips
│   ├── data/
│   │   ├── priorityZones.json    # Sample priority zones
│   │   └── projects.json         # Sample project entries
│   └── index.js                  # Module exports
└── package.json
```
