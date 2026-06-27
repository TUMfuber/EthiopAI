import "dotenv/config";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "ai-researched-projects.json");

const client = new OpenAI();

const RESEARCH_PROMPT = `You are a carbon credit researcher. List ALL known carbon credit and ecological NGO projects in Ethiopia.

For each project provide this exact JSON structure:
{
  "id": "unique-id",
  "name": "Full Project Name",
  "lat": latitude or null,
  "lng": longitude or null,
  "type": "one of: Reforestation, REDD+, Clean Cooking, Renewable Energy, Wetland Conservation, Agroforestry, Carbon Storage, Other",
  "description": "2-3 sentence description of the project",
  "organization": "implementing organization",
  "status": "Active/Completed/Planning",
  "registry": "GoldStandard/Verra_VCS/PlanVivo/CDM/Unregistered",
  "registryId": "registry ID if known or empty string",
  "methodology": "methodology used",
  "creditsIssued": estimated total credits issued (number),
  "creditingPeriodStart": "start year",
  "creditingPeriodEnd": "end year",
  "sdgContributions": ["SDG X", "SDG Y"],
  "projectUrl": "URL to project page or registry entry"
}

Include projects from these registries/sources:
- Gold Standard (cookstoves, water purification, energy projects in Ethiopia)
- Verra/VCS
- CDM/UNFCCC (Humbo, etc.)
- Plan Vivo
- Any other known NGO projects (even if not on a carbon registry)

Known Ethiopian projects to include (research details for these):
- Humbo Assisted Natural Regeneration (World Vision, CDM — Africa's first forestry carbon credits)
- Oromia Forested Landscape Program (OFLP)
- Ethiopia Clean Cooking Energy Programme
- Paradigm/UpEnergy cookstove projects
- EthioTrees (Plan Vivo, Tigray)
- Great Green Wall Ethiopia component
- Bale Mountains Eco-Region REDD+
- Any Gold Standard cookstove/water projects in Ethiopia

Return ONLY a JSON array. No markdown, no explanation.`;

async function main() {
  console.log("AI Agent: Researching Ethiopian carbon/ecological projects...\n");

  const res = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: RESEARCH_PROMPT }],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const content = res.choices[0].message.content.trim();
  // Strip markdown code fences if present
  const json = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const projects = JSON.parse(json);

  console.log(`AI Agent found ${projects.length} projects\n`);
  projects.forEach((p) => console.log(`  • ${p.name} (${p.registry})`));

  writeFileSync(OUTPUT_FILE, JSON.stringify(projects, null, 2));
  console.log(`\nSaved to output/ai-researched-projects.json`);

  // Merge with existing raw-projects if available
  const rawPath = join(OUTPUT_DIR, "raw-projects.json");
  if (existsSync(rawPath)) {
    const existing = JSON.parse(readFileSync(rawPath, "utf-8"));
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
    const newProjects = projects.filter((p) => !existingNames.has(p.name.toLowerCase()));
    const merged = [...existing, ...newProjects];
    writeFileSync(rawPath, JSON.stringify(merged, null, 2));
    console.log(`Merged ${newProjects.length} new projects into raw-projects.json (total: ${merged.length})`);
  }
}

main().catch(console.error);
