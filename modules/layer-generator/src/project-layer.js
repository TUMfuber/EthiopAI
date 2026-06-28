import { readFileSync } from "fs";

export function buildProjectLayer(projectsPath) {
  const projects = JSON.parse(readFileSync(projectsPath, "utf-8"));

  const features = projects
    .filter((p) => p.lat && p.lng)
    .map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        name: p.name,
        type: p.type,
        description: p.description,
        organization: p.organization,
        status: p.status,
        registry: p.registry,
        methodology: p.methodology,
        creditsIssued: p.creditsIssued || 0,
        projectUrl: p.projectUrl || "",
      },
    }));

  return { type: "FeatureCollection", features };
}
