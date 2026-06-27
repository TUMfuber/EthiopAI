/**
 * Output schema for map-compatible project data.
 * Matches modules/map-service/src/data/projects.json format.
 */
export const projectSchema = {
  id: "number",
  name: "string",
  lat: "number",
  lng: "number",
  type: "string",           // e.g. Reforestation, Clean Cooking, REDD+
  description: "string",
  organization: "string",   // project developer / NGO
  status: "string",         // Active, Registered, Under Validation
  // Extended fields from registries
  registry: "string",       // Verra_VCS | GoldStandard | CDM
  registryId: "string",
  methodology: "string",
  creditsIssued: "number",
  creditingPeriodStart: "string",
  creditingPeriodEnd: "string",
  sdgContributions: ["string"],
  projectUrl: "string",
};
