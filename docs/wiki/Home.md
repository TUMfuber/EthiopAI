# EthiopAI Wiki

Welcome to the **EthiopAI** documentation wiki — an AI-powered ecological restoration planning platform for Ethiopia.

---

## 🗂️ Pages

| Page | Description |
|------|-------------|
| [Getting Started](Getting-Started) | Setup guide for developers |
| [Architecture](Architecture) | System design & AWS services |
| [Data Pipeline](Data-Pipeline) | How we collect and process ecological data |
| [Map Layers](Map-Layers) | The 5 priority layers explained |
| [AI Features](AI-Features) | Bedrock recommendations, analysis, action workflow |
| [Deployment](Deployment) | How to deploy on AWS |

---

## 🌍 What is EthiopAI?

EthiopAI helps **NGOs** and **investors** identify where to restore ecosystems in Ethiopia for maximum ecological and financial impact.

The platform combines:
- **Satellite data** — CHIRP rainfall, SRTM elevation, ESA land cover
- **Carbon credit registries** — Verra, Gold Standard, ACR, Plan Vivo, Berkeley DB (scraped via APIs + OpenAI)
- **AI analysis** — AWS Bedrock (Claude) for location-specific recommendations
- **Geospatial scoring** — 2,814 grid cells at 20km resolution scored for carbon, water, biodiversity, and soil

---

## 👁️ Two Perspectives

| NGO View 🌱 | Investor View 💰 |
|-------------|-----------------|
| Ecosystem preservation need | Carbon credit ROI potential |
| Species protection estimate | Payback period & risk |
| Community benefit score | Market price forecast |
| Funding eligibility | Investment opportunity |

---

## ⚡ Quick Links

- **Live app:** [ethopai.uberf.vip](https://ethopai.uberf.vip)
- **Repository:** [github.com/TUMfuber/EthiopAI](https://github.com/TUMfuber/EthiopAI)
- **AWS Services doc:** [AWS_SERVICES.md](https://github.com/TUMfuber/EthiopAI/blob/master/AWS_SERVICES.md)

---

## 🛠️ Tech Stack

```
Frontend:    Next.js 16 · React 19 · Leaflet · TypeScript
Backend:     Node.js API routes · Python geospatial scripts
AI:          AWS Bedrock (Claude Sonnet 4.6) · OpenAI API
Data:        DynamoDB · S3 · SageMaker
Infra:       EC2 · ALB · Lambda · API Gateway
Scraping:    Puppeteer · Registry APIs · Berkeley xlsx
```

---

## 📊 How It Works (30-second version)

1. **Scrape** carbon credit registries for Ethiopian projects
2. **Precompute** a priority grid from rainfall, slope, land cover, biodiversity data
3. **Score** each cell for carbon/water/biodiversity/soil potential
4. **Visualize** as interactive gradient map layers
5. **Analyze** any location with AI (drop a pin → get recommendations)
6. **Act** — contact local entities or set up funding directly from the platform
