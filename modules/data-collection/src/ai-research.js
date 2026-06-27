import "dotenv/config";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import OpenAI from "openai";
import puppeteer from "puppeteer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "output");
const OUTPUT_FILE = join(OUTPUT_DIR, "ai-researched-projects.json");

const client = new OpenAI();

// AI generates a list of project names to search for
const DISCOVER_PROMPT = `List ALL known carbon credit, biodiversity, and ecological NGO projects in Ethiopia. 
Return ONLY a JSON array of objects with: {"name": "Project Name", "organization": "Org Name", "registry": "GoldStandard/CDM/Verra/PlanVivo/Unregistered"}
Include: Humbo ANR, Oromia OFLP, Ethiopia Clean Cooking, EthioTrees, Great Green Wall Ethiopia, Bale Mountains REDD+, any Gold Standard cookstove/water projects, any biodiversity projects.
No markdown, just the JSON array.`;

// AI extracts structured data from a real web page
const EXTRACT_PROMPT = `You are extracting project data from a real webpage. Given the page text, extract:
{
  "name": "exact project name",
  "lat": latitude (number, in Ethiopia 3.4-14.9) or null,
  "lng": longitude (number, in Ethiopia 33.0-48.0) or null,
  "type": "Reforestation/REDD+/Clean Cooking/Renewable Energy/Wetland Conservation/Agroforestry/Carbon Storage/Biodiversity/Other",
  "description": "2-3 sentence factual summary from the page",
  "organization": "implementing org from the page",
  "status": "Active/Completed/Planning",
  "methodology": "methodology if mentioned",
  "creditsIssued": number or 0,
  "sdgContributions": ["SDG X"] or []
}
Only use facts from the page text. If coordinates are not on the page, infer from place names mentioned. Only return valid JSON.`;

async function main() {
  console.log("AI Research Agent: Discovering Ethiopian projects...\n");

  // Step 1: AI discovers project names to research
  const discoverRes = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: DISCOVER_PROMPT }],
    temperature: 0.3,
    max_tokens: 2000,
  });
  const content = discoverRes.choices[0].message.content.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const projectsToResearch = JSON.parse(content);
  console.log(`Found ${projectsToResearch.length} projects to research\n`);

  // Step 2: Launch browser and research each project
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
  });

  const verified = [];

  for (const proj of projectsToResearch) {
    console.log(`  🔍 ${proj.name}...`);
    const result = await researchProject(proj, browser);
    if (result) {
      verified.push(result);
      console.log(`    ✓ ${result.projectUrl}`);
    } else {
      console.log(`    ✗ could not verify`);
    }
  }

  await browser.close();

  console.log(`\nVerified ${verified.length}/${projectsToResearch.length} projects`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(verified, null, 2));

  // Merge into raw-projects.json
  const rawPath = join(OUTPUT_DIR, "raw-projects.json");
  if (existsSync(rawPath)) {
    const existing = JSON.parse(readFileSync(rawPath, "utf-8"));
    const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));
    const newProjects = verified.filter((p) => !existingNames.has(p.name.toLowerCase()));
    const merged = [...existing, ...newProjects];
    writeFileSync(rawPath, JSON.stringify(merged, null, 2));
    console.log(`Merged ${newProjects.length} new projects into raw-projects.json (total: ${merged.length})`);
  } else {
    writeFileSync(rawPath, JSON.stringify(verified, null, 2));
  }
}

async function researchProject(proj, browser) {
  try {
    const page = await browser.newPage();
    await page.setDefaultTimeout(15000);

    // Search DuckDuckGo
    const query = `"${proj.name}" ${proj.organization || ""} Ethiopia`;
    await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      waitUntil: "domcontentloaded",
    });

    const resultUrls = await page.evaluate(() => {
      return [...document.querySelectorAll("a.result__a")].slice(0, 3).map((a) => {
        let href = a.href;
        if (href.includes("uddg=")) href = decodeURIComponent(href.split("uddg=")[1]).split("&")[0];
        return href;
      }).filter((u) => u && !u.includes("duckduckgo"));
    });

    if (resultUrls.length === 0) {
      await page.close();
      return null;
    }

    // Visit the best result
    const projectUrl = resultUrls[0];
    await page.goto(projectUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 4000) || "");
    await page.close();

    if (pageText.length < 100) return null;

    // AI extracts structured data from real page content
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: `Project searched: ${proj.name}\nOrg: ${proj.organization}\nRegistry: ${proj.registry}\n\nPage URL: ${projectUrl}\nPage content:\n${pageText}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    });

    const extracted = JSON.parse(res.choices[0].message.content);

    return {
      id: `research-${proj.name.toLowerCase().replace(/\s+/g, "-").substring(0, 30)}`,
      name: extracted.name || proj.name,
      lat: extracted.lat || null,
      lng: extracted.lng || null,
      type: extracted.type || "",
      description: extracted.description || "",
      organization: extracted.organization || proj.organization || "",
      status: extracted.status || "",
      registry: proj.registry || "",
      registryId: "",
      methodology: extracted.methodology || "",
      creditsIssued: extracted.creditsIssued || 0,
      creditingPeriodStart: "",
      creditingPeriodEnd: "",
      sdgContributions: extracted.sdgContributions || [],
      projectUrl,
      source: "ai-research",
    };
  } catch (e) {
    return null;
  }
}

main().catch(console.error);
