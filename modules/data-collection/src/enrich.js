import { readFileSync, writeFileSync } from "fs";
import OpenAI from "openai";

const INPUT = new URL("../output/raw-projects.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const OUTPUT = new URL("../output/projects.json", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");

const client = new OpenAI(); // uses OPENAI_API_KEY env var

const SYSTEM_PROMPT = `You are a carbon credit analyst. Given a project record, return a JSON object with:
- "type": classify into one of: Reforestation, REDD+, Clean Cooking, Renewable Energy, Wetland Conservation, Agroforestry, Carbon Storage, Other
- "description": 1-2 sentence summary of what the project does (infer from name, methodology, type)
- "carbonMetrics": { "annualReductionTCO2": estimated annual tonnes CO2 reduced/removed, "methodology": methodology name }
Only return valid JSON, no markdown.`;

async function enrichProject(project) {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(project) },
    ],
    response_format: { type: "json_object" },
    max_tokens: 200,
  });
  return JSON.parse(res.choices[0].message.content);
}

async function main() {
  const raw = JSON.parse(readFileSync(INPUT, "utf-8"));
  console.log(`Enriching ${raw.length} projects with AI...\n`);

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

  writeFileSync(OUTPUT, JSON.stringify(enriched, null, 2));
  console.log(`\nSaved ${enriched.length} enriched projects to output/projects.json`);
}

main().catch(console.error);
