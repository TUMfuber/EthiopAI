# Architecture

## System Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Browser   │────▶│  Next.js App │────▶│   AWS Services  │
│  (Leaflet)  │◀────│  (EC2/ALB)   │◀────│                 │
└─────────────┘     └──────┬───────┘     │ • Bedrock Claude│
                           │             │ • DynamoDB      │
                    ┌──────▼───────┐     │ • Lambda        │
                    │  API Routes  │────▶│ • S3            │
                    └──────────────┘     │ • SageMaker     │
                                         └─────────────────┘
┌───────────────────────────────────────────────────────┐
│              Python Preprocessing Pipeline             │
│  Scraping → Scoring → GeoJSON Generation → S3/Public  │
└───────────────────────────────────────────────────────┘
```

## Module Breakdown

### `modules/map-service/`
Map UI components, layer definitions, Leaflet integration, and map-specific server helpers.

### `modules/data-collection/`
Scrapers for carbon credit registries (Verra, Gold Standard, ACR, Plan Vivo, Berkeley DB). Outputs raw data for preprocessing.

### `modules/satellite-pipeline/`
Sentinel Hub integration for live satellite imagery. Handles tile fetching and caching.

### `modules/layer-generator/`
Generates the 5 priority layers from precomputed scores. Converts grid data to renderable GeoJSON heatmaps.

### `services/ml-detail/`
ML service for detailed location analysis. Invokes Bedrock Claude for AI recommendations and SageMaker for scoring models.

## Data Flow

```
1. Scraping      → Fetch registry data (Verra, Gold Standard, etc.)
2. Preprocessing → Python computes per-cell scores (carbon, water, biodiversity, soil)
3. Scoring       → Normalize and weight into 5 priority layers
4. Visualization → Frontend renders 2814-cell grid as gradient overlays
5. AI Analysis   → User drop-pin triggers Bedrock Claude for location-specific recommendations
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/layers/[id]` | GET | Returns GeoJSON for a specific priority layer |
| `/api/recommendations` | POST | AI recommendations for selected region |
| `/api/analyze` | POST | Drop-pin analysis with full scoring breakdown |
| `/api/detail` | GET | Detailed cell data from DynamoDB |

## AWS Integration

Services are provisioned via scripts in `infra/`. Key integrations:

- **Bedrock Claude** — AI recommendations and natural language analysis
- **DynamoDB** — Grid cell storage (2814 cells × scoring dimensions)
- **Lambda** — Serverless API handlers for analysis endpoints
- **S3** — Static assets, precomputed layers, satellite tile cache
- **SageMaker** — ML model hosting for restoration scoring
- **EC2/ALB** — Next.js application hosting

See [AWS_SERVICES.md](../AWS_SERVICES.md) for full infrastructure documentation.

