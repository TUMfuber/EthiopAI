# Workflow

## Development Workflow

1. Branch from `feature/sat-priority-ai`
2. Develop and test locally (`npm run dev`)
3. Commit with descriptive messages
4. Push branch and open PR to `master`
5. Code review → merge

```bash
git checkout feature/sat-priority-ai
git pull
git checkout -b feature/your-change
# develop...
git push -u origin feature/your-change
# open PR to master
```

## Data Pipeline Workflow

```
1. Scrape     → Run scrapers in modules/data-collection/
2. Precompute → python scripts/precompute_layers.py
3. Patch      → node infra/patch-scores.js (updates DynamoDB)
4. Generate   → Layer generator builds GeoJSON heatmaps
5. Deploy     → Copy to public/data/ or S3
```

### Running the full pipeline

```bash
cd modules/data-collection && npm run scrape
cd ../../scripts && python precompute_layers.py
cd ../infra && node patch-scores.js
npm run build
```

## Deployment Workflow

```bash
ssh ec2-user@<instance>
cd /app/EthiopAI
git pull origin master
npm install
npm run build
pm2 restart EthiopAI
```

Or via the setup script:

```bash
bash infra/full-setup-aws.sh
```

## Adding New Data Sources

1. Create a scraper in `modules/data-collection/`
2. Output normalized JSON matching the existing schema (lat, lng, scores)
3. Update `scripts/precompute_layers.py` to include the new source
4. Run the pipeline to regenerate layers
5. Verify in the frontend map

## Adding New Map Layers

1. Define the layer in `modules/map-service/` (id, name, color scale)
2. Add scoring logic in `scripts/precompute_layers.py`
3. Register the layer in the API route (`app/api/layers/`)
4. Add the layer toggle to the map UI component
5. Run `npm run precompute` to generate the layer data

