import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, "..", "output", "raw-projects.json");
const OUTPUT = join(__dirname, "..", "output", "projects.json");

const client = new OpenAI();

const ENRICH_PROMPT = `You are a carbon credit analyst. Given a project record, return a JSON object with:
- "type": classify into one of: Reforestation, REDD+, Clean Cooking, Renewable Energy, Wetland Conservation, Agroforestry, Carbon Storage, Biodiversity, Other
- "description": 1-2 sentence summary of what the project does
- "carbonMetrics": { "annualReductionTCO2": estimated annual tonnes CO2 reduced/removed, "methodology": methodology name }
Only return valid JSON, no markdown.`;

const GEOCODE_PROMPT = `You are a geolocation expert for ecological projects in Ethiopia. Given a project, return JSON with:
- "lat": best estimate latitude (number, must be within Ethiopia: 3.4 to 14.9)
- "lng": best estimate longitude (number, must be within Ethiopia: 33.0 to 48.0)
- "projectUrl": a real, verifiable URL for this project (official registry page, news article, or organization page — NOT a guess)

Use your knowledge of Ethiopian geography. For example:
- Humbo is in Wolaita Zone: ~6.75, 37.83
- Bale Mountains: ~6.8, 39.9
- Tigray/EthioTrees: ~13.5, 39.0
- Addis Ababa area: ~9.0, 38.7
- Oromia region center: ~8.0, 39.0

If the project is nationwide or you cannot determine a specific location, use the center of the most relevant region.
If you cannot find a real URL, return the best known URL or empty string.
Only return valid JSON, no markdown.`;

async function enrichProject(project) {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: ENRICH_PROMPT },
      { role: "user", content: JSON.stringify(project) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 200,
  });
  return JSON.parse(res.choices[0].message.content);
}

async function geocodeProject(project) {
  // First: search the web for the real project URL
  const searchQuery = `${project.name} ${project.organization || ""} ${project.registry || ""} carbon credit project`;
  let realUrl = "";

  try {
    const searchRes = await fetch(
      `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=3`,
      { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" } }
    );
    if (searchRes.ok) {
      const html = await searchRes.text();
      // Extract first real URL from Google results
      const urlMatches = html.match(/https?:\/\/(?:www\.)?(?!google\.com|gstatic|googleapis)[^\s"<>]+/g);
      if (urlMatches && urlMatches.length > 0) {
        realUrl = urlMatches[0].replace(/&amp;/g, "&").split("&")[0];
      }
    }
  } catch (e) {}

  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: GEOCODE_PROMPT },
      { role: "user", content: JSON.stringify({
        name: project.name,
        organization: project.organization,
        type: project.type,
        registry: project.registry,
        webSearchResult: realUrl || "no result found",
      }) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 150,
  });
  const geo = JSON.parse(res.choices[0].message.content);
  // Prefer web-scraped URL over AI-generated one
  if (realUrl && realUrl.length > 10) geo.projectUrl = realUrl;
  return geo;
}

async function main() {
  const raw = JSON.parse(readFileSync(INPUT, "utf-8"));
  console.log(`Enriching ${raw.length} projects...\n`);

  const enriched = [];
  for (const project of raw) {
    try {
      // Classify all projects
      const ai = await enrichProject(project);
      const result = {
        ...project,
        type: ai.type || project.type,
        description: ai.description || project.description,
        carbonMetrics: ai.carbonMetrics || null,
      };

      // Geocode + verify URL for ai-research projects missing coords
      if (project.source === "ai-research" && (!project.lat || !project.lng)) {
        const geo = await geocodeProject(project);
        if (geo.lat && geo.lng) {
          result.lat = geo.lat;
          result.lng = geo.lng;
        }
        if (geo.projectUrl) {
          result.projectUrl = geo.projectUrl;
        }
        console.log(`✓ ${project.name} → (${result.lat}, ${result.lng})`);
      } else {
        console.log(`✓ ${project.name}`);
      }

      enriched.push(result);
    } catch (e) {
      console.log(`✗ ${project.name}: ${e.message}`);
      enriched.push(project);
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(enriched, null, 2));
  console.log(`\nSaved ${enriched.length} enriched projects to output/projects.json`);
}

main().catch(console.error);
