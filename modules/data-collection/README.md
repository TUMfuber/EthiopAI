# @ethopai/data-collection

Scrapes Ethiopian carbon credit projects from public registries and enriches them with AI classification.

## Sources

| Registry | API | Auth |
|----------|-----|------|
| Verra VCS | `registry.verra.org/uiapi/resource/resourceSummary` | None |
| Gold Standard | `registry.goldstandard.org/api/projects` | None |

## Usage

```bash
cd modules/data-collection
npm install

# Step 1: Scrape registries → output/raw-projects.json
npm run scrape

# Step 2: AI enrichment → output/projects.json (needs OPENAI_API_KEY)
export OPENAI_API_KEY=sk-...
npm run enrich

# Or both:
npm run all
```

## Output

`output/projects.json` — array of project objects compatible with `modules/map-service/src/data/projects.json`:

```json
{
  "id": 1360,
  "name": "Humbo Assisted Natural Regeneration",
  "lat": 6.77,
  "lng": 37.83,
  "type": "Reforestation",
  "description": "Assisted natural regeneration restoring 2,728 ha of native forest...",
  "organization": "World Vision",
  "status": "Registered",
  "registry": "Verra_VCS",
  "registryId": "1360",
  "methodology": "AR-AM0001",
  "creditsIssued": 165000,
  "sdgContributions": ["SDG 13", "SDG 15"],
  "carbonMetrics": {
    "annualReductionTCO2": 24000,
    "methodology": "AR-AM0001"
  }
}
```

## Structure

```
data-collection/
├── src/
│   ├── scrape.js              # Orchestrates all scrapers
│   ├── enrich.js              # AI classification + metric extraction
│   ├── schema.js              # Output schema definition
│   └── scrapers/
│       ├── verra.js           # Verra VCS registry
│       └── goldstandard.js    # Gold Standard registry
├── output/                    # Generated data (gitignored)
└── package.json
```
