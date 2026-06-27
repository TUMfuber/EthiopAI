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
- "description": 1-2 sentence summary of what the project does (use facts from the record)
- "carbonMetrics": { "annualReductionTCO2": estimated annual tonnes CO2, "methodology": methodology name }
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

async function main() {
  const raw = JSON.parse(readFileSync(INPUT, "utf-8"));
  console.log(`Enriching ${raw.length} projects...\n`);

  const enriched = [];
  for (const project of raw) {
    try {
      const ai = await enrichProject(project);
      enriched.push({
        ...project,
        type: ai.type || project.type,
        description: ai.description || project.description,
        carbonMetrics: ai.carbonMetrics || null,
      });
      console.log(`✓ ${project.name}`);
    } catch (e) {
      console.log(`✗ ${project.name}: ${e.message}`);
      enriched.push(project);
    }
  }

  // Filter: only keep projects with coordinates
  const valid = enriched.filter((p) => {
    if (p.lat && p.lng) return true;
    console.log(`  ⊘ Dropping "${p.name}" — no verified location`);
    return false;
  });

  writeFileSync(OUTPUT, JSON.stringify(valid, null, 2));
  console.log(`\nSaved ${valid.length} verified projects (dropped ${enriched.length - valid.length})`);
}

main().catch(console.error);
