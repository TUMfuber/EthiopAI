# 🌍 EthopAI

**AI-powered ecological restoration planning platform for Ethiopia**

![Build Status](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

![Screenshot](docs/screenshot.png)

## What is EthopAI?

EthopAI helps NGOs and investors identify optimal locations for ecological restoration across Ethiopia. The platform combines satellite imagery, carbon credit registry data, and AI analysis to score regions by restoration potential. Users can explore priority maps, receive AI-powered recommendations, and take action by connecting with funding entities and local partners.

## Features

- Interactive map with 5 priority layers (Carbon, Water, Biodiversity, Soil, Composite)
- AI-powered recommendations via AWS Bedrock Claude
- NGO/Investor dual perspective views
- Drop-pin location analysis with detailed scoring
- Carbon/Water/Biodiversity/Soil scoring per grid cell
- Satellite view with Sentinel imagery
- Guided tutorial for new users
- Take Action workflow (contact entities, set up funding)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Leaflet |
| Preprocessing | Python 3.10+ (geospatial scripts) |
| AI/ML | AWS Bedrock (Claude), SageMaker |
| Infrastructure | AWS Lambda, DynamoDB, S3, EC2, ALB |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- AWS CLI configured

### Setup

```bash
git clone https://github.com/your-org/EthopAI.git
cd EthopAI
npm install
bash setup.sh
npm run dev
```

Open `http://localhost:3000`.

For Python preprocessing:

```bash
cd scripts
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
npm run precompute
```

## Architecture

The platform follows a serverless-first architecture: Next.js frontend on EC2/ALB, AWS Lambda for API functions, DynamoDB for grid data, S3 for static assets, and Bedrock for AI analysis.

See [AWS_SERVICES.md](AWS_SERVICES.md) for infrastructure details and [DEPLOY.md](DEPLOY.md) for deployment instructions.

## Data Pipeline

```
Carbon Credit Registries (Verra, Gold Standard, ACR, Plan Vivo, Berkeley DB)
    → Scraping via APIs + Puppeteer + OpenAI API (AI research agent)
    → Python preprocessing & priority scoring
    → Priority grid (2814 cells, 20km resolution)
    → AWS Bedrock (Claude) for recommendations
    → Frontend renders as gradient heatmap layers
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to the branch and open a Pull Request

## License

MIT
