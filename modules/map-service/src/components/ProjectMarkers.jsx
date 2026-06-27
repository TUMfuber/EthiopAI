import React from "react";
import { Marker, Tooltip } from "react-leaflet";
import L from "leaflet";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function ProjectMarkers({ projects }) {
  return projects.map((p) => (
    <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
      <Tooltip direction="top" sticky>
        <strong>{p.name}</strong>
        <br />
        {p.type} — {p.status}
        <br />
        <em>{p.organization}</em>
        <br />
        {p.description}
      </Tooltip>
    </Marker>
  ));
}
