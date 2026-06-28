#!/bin/bash
set -e

echo "=== EthopAI Setup: Full Data Pipeline ==="
echo ""

# 1. Data collection
echo "--- Step 1: Data Collection ---"
cd modules/data-collection
npm install
npm run scrape
npm run research
npm run enrich
cd ../..

# 2. Layer generation
echo ""
echo "--- Step 2: Layer Generation ---"
cd modules/layer-generator
npm install
npm run generate
cd ../..

echo ""
echo "=== Setup Complete ==="
echo "Layers ready at public/data/"
echo "Run 'npm run dev' to start the frontend."
