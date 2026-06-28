# EthopAI Deployment Guide

## Architecture

```
┌──────────────┐    ┌─────────┐    ┌────────────────────┐    ┌──────────┐
│ Satellite    │───▶│   S3    │───▶│ SageMaker Training │───▶│ Endpoint │
│ Data (NDVI,  │    │ ethopai │    │ (PyTorch)          │    │          │
│ Sentinel-2)  │    │ -ml-data│    └────────────────────┘    └────┬─────┘
└──────────────┘    └─────────┘                                   │
                                                                  ▼
┌──────────┐    ┌─────────────┐    ┌──────────────────┐    ┌──────────┐
│    UI    │◀───│ Next.js API │◀───│    Bedrock        │◀───│ Priority │
│ (Leaflet)│    │ (ethopai.   │    │ (Claude insights) │    │ Scores   │
│          │    │  uberf.vip) │    └──────────────────┘    └──────────┘
└──────────┘    └─────────────┘
```

## Prerequisites

- AWS CLI configured (`aws configure` with eu-central-1)
- Node.js 18+
- Python 3.10+
- pm2 installed globally (`npm i -g pm2`)

## Deployment Steps

### Step 1: Provision AWS Infrastructure

```bash
chmod +x infra/setup-aws.sh
bash infra/setup-aws.sh
```

Creates S3 bucket, IAM role, and SageMaker notebook. Enable Bedrock Claude access via the AWS Console (link printed by script).

### Step 2: Run Satellite Pipeline

```bash
cd modules/satellite-pipeline
npm install
node src/index.js
```

Downloads satellite imagery, computes indices (NDVI, NDWI), and uploads training data to S3.

### Step 3: Deploy SageMaker Model

```bash
node src/deploy-sagemaker.js
```

Trains the priority scoring model and deploys an inference endpoint.

### Step 4: Run Inference

```bash
node src/run-inference.js
```

Generates priority heatmap GeoJSON from the trained model.

### Step 5: Copy Output to Frontend

```bash
cp output/priority-heatmap.geojson ../../public/data/
```

### Step 6: Build and Deploy Frontend

```bash
cd ../../
npm run build
pm2 restart ethopai
```

## Teardown

```bash
bash infra/teardown-aws.sh
```

Removes all AWS resources created by setup-aws.sh.
