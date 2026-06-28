# EthopAI — AWS Services Architecture

## Overview

EthopAI is an interactive ecological mapping platform for Ethiopia that helps NGOs and investors identify high-priority areas for ecosystem restoration and carbon credit projects. The platform uses multiple AWS services to power AI-driven analysis, data processing, and serverless computation.

---

## AWS Services Used

### 1. Amazon Bedrock (AI/ML — Generative AI)

**What it does:** Powers all AI-driven analysis and recommendations in the platform.

**Model:** Claude Sonnet 4.6 via cross-region inference profile (`us.anthropic.claude-sonnet-4-6`)

**Region:** us-west-2

**Use cases:**
- **AI Recommendations Panel** — When a user clicks 🔥 and selects filters (Biodiversity, Carbon, Soil, Water), Bedrock generates specific ecological intervention recommendations for the top 20 priority zones. Each recommendation includes a title, description, estimated impact, and exact coordinates.
- **Drop Pin Analysis** — When a user drops a pin anywhere on the map, Bedrock analyzes that location and provides:
  - *Investor view:* Carbon credits/year, ROI, payback period, risk level, market price
  - *NGO view:* Ecosystem impact score, species protected, community benefit, funding eligibility

**How it's called:** Next.js API routes (`/api/recommendations`, `/api/analyze`) invoke Bedrock via the AWS SDK (`@aws-sdk/client-bedrock-runtime`), using the `InvokeModel` API with the Anthropic messages format.

---

### 2. Amazon DynamoDB (Database — NoSQL)

**What it does:** Caches AI responses so repeated queries are instant instead of waiting 5-10 seconds for Bedrock.

**Table:** `ethopai-recommendations`

**Region:** us-west-2

**Billing:** On-demand (pay-per-request)

**Schema:**
- Partition key: `filterKey` (String) — e.g., `"biodiversity,carbon"` or `"analyze-8.5-39.2-investor"`
- Attributes: `data` (JSON string of cached response), `ttl` (24-hour expiry)

**How it works:**
1. User requests recommendations → API checks DynamoDB first
2. Cache hit → return instantly (<50ms)
3. Cache miss → call Bedrock, save result to DynamoDB, return to user
4. After 24 hours, TTL expires the cache so fresh recommendations are generated

---

### 3. AWS Lambda (Compute — Serverless)

**What it does:** Runs the ML detail service that enriches map cells with live external data when users zoom in.

**Function:** `ethopai-ml-detail`

**Region:** us-west-2

**Runtime:** Node.js 20.x

**Memory:** 512 MB

**Timeout:** 30 seconds

**What it fetches per grid cell:**
- NASA MODIS API → Vegetation index (NDVI, 250m resolution)
- Open-Meteo API → Precipitation data (last 30 days average)
- ISRIC SoilGrids API → Soil organic carbon content (0-30cm depth)
- Open Elevation API → Terrain height

**How it works:** At zoom level 8+, the frontend calls the Lambda to get higher-resolution data. The Lambda subdivides visible cells, enriches each sub-cell with live satellite/climate data, runs a prediction model, and returns fine-grained priority scores.

---

### 4. Amazon API Gateway (Networking — HTTP API)

**What it does:** Exposes the Lambda function as a public HTTPS endpoint.

**API:** `ethopai-detail-api`

**API ID:** `k7jyplmxjd`

**Endpoint:** `https://k7jyplmxjd.execute-api.us-west-2.amazonaws.com/detail`

**Region:** us-west-2

**Configuration:**
- Protocol: HTTP API (v2)
- Route: `GET /detail`
- CORS: Allows all origins
- Auto-deploy enabled

---

### 5. Amazon S3 (Storage — Object Store)

**What it does:** Stores training data and model artifacts for the ML pipeline.

**Bucket:** `ethopai-ml-data-123965497004`

**Region:** us-west-2

**Contents:**
- `training/training-data.json` — Merged dataset (elevation + priority layers) used for model training
- `training/source.tar.gz` — SageMaker training code (PyTorch model)
- `output/priority-heatmap.geojson` — Generated priority heatmap

---

### 6. Amazon SageMaker (AI/ML — Model Training & Inference)

**What it does:** Trains and hosts the priority scoring ML model.

**Region:** us-west-2

**Training job configuration:**
- Instance: ml.m5.large
- Framework: PyTorch 2.0 (CPU)
- Input: 5 features (elevation, carbon, biodiversity, water, land_degradation)
- Output: Priority score (0-1)
- Training time: ~5-10 minutes

**Inference endpoint:**
- Name: `ethopai-priority-endpoint`
- Instance: ml.t2.medium
- Accepts JSON batches of grid cells, returns priority predictions

**Note:** The SageMaker endpoint is optional — the system uses heuristic scoring as a fallback when the endpoint isn't deployed.

---

### 7. Amazon EC2 (Compute — Virtual Server)

**What it does:** Hosts the main Next.js application.

**Instance:** Running in a VPC (subnet `10.0.18.x`)

**Region:** (existing infrastructure)

**Setup:**
- Application: Next.js with PM2 process manager
- Domain: `ethopai.uberf.vip` (via Cloudflare DNS + AWS ALB + ACM cert)
- Git-based deployment: `git pull && npm run build && pm2 restart`

---

### 8. AWS IAM (Security — Identity & Access)

**Roles created:**
- `ethopai-lambda-role` — Allows Lambda execution + CloudWatch Logs
- `WSParticipantRole` — Used by EC2 and for SageMaker PassRole

**Permissions:**
- Bedrock InvokeModel (Claude Sonnet 4.6)
- DynamoDB GetItem/PutItem on `ethopai-recommendations`
- S3 read/write on `ethopai-ml-data-*`
- Lambda execution
- SageMaker (training jobs, endpoints)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                              │
│                                                                  │
│  Map (Leaflet) ── Canvas Heatmap ── Drop Pin ── Recommendations │
└───────────┬──────────────┬────────────────┬─────────────────────┘
            │              │                │
            ▼              ▼                ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────────┐
│   EC2         │  │ API Gateway  │  │  EC2 API Routes  │
│   Next.js     │  │ /detail      │  │  /api/analyze    │
│   Static      │  └──────┬───────┘  │  /api/recommend  │
│   Assets      │         │          └────────┬─────────┘
└───────────────┘         ▼                   │
                  ┌───────────────┐           ▼
                  │    Lambda     │    ┌─────────────┐
                  │  ML Enricher  │    │  DynamoDB   │◄── Cache
                  │  (MODIS,Soil, │    │  (check)    │
                  │   Precip,Elev)│    └──────┬──────┘
                  └───────────────┘           │ miss
                                              ▼
                                      ┌─────────────┐
                                      │   Bedrock   │
                                      │   Claude    │
                                      │  Sonnet 4.6 │
                                      └─────────────┘

┌─────────────────── TRAINING PIPELINE (offline) ──────────────────┐
│                                                                    │
│  Python Precompute ──► S3 (training data) ──► SageMaker Training  │
│  (CHIRP rainfall,       │                      │                   │
│   land cover,           │                      ▼                   │
│   elevation,            │              SageMaker Endpoint          │
│   KBA proximity)        │              (optional inference)        │
│                         │                                          │
└─────────────────────────┴──────────────────────────────────────────┘
```

---

## Cost Considerations

| Service | Estimated Cost | Notes |
|---------|---------------|-------|
| Bedrock | ~$0.003 per analysis call | Claude Sonnet 4.6 input/output tokens |
| DynamoDB | ~$0 (on-demand, low traffic) | Caching reduces Bedrock calls 10x |
| Lambda | ~$0 (free tier covers it) | Only invoked at high zoom |
| API Gateway | ~$0 (free tier: 1M requests) | Low traffic |
| S3 | ~$0.02/month | Small GeoJSON files |
| SageMaker | ~$0.10/hr when endpoint is active | Can be shut down when not demoing |
| EC2 | (existing) | Already running |

**Total estimated cost for demo usage: < $5/month**

---

## How to Reproduce

```bash
# 1. Infrastructure
bash infra/setup-aws.sh

# 2. Generate training data
cd modules/satellite-pipeline && npm install && node src/index.js

# 3. Generate heatmap from precomputed layers
node src/generate-heatmap.js

# 4. (Optional) Train ML model
node src/deploy-sagemaker.js

# 5. Deploy Lambda
cd services/ml-detail && bash deploy.sh

# 6. Build and serve
cd ~/EthopAI && npm run build && pm2 restart 0 --update-env
```
