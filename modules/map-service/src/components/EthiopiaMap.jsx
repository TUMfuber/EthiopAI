import React from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import PriorityOverlays from "./PriorityOverlays";
import ProjectMarkers from "./ProjectMarkers";
import "leaflet/dist/leaflet.css";

const ETHIOPIA_CENTER = [9.0, 38.7];
const ETHIOPIA_BOUNDS = [[3.4, 33.0], [14.9, 48.0]];

export default function EthiopiaMap({ priorityZones, projects }) {
  return (
    <MapContainer
      center={ETHIOPIA_CENTER}
      zoom={6}
      minZoom={5}
      maxBounds={ETHIOPIA_BOUNDS}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {priorityZones && <PriorityOverlays zones={priorityZones} />}
      {projects && <ProjectMarkers projects={projects} />}
    </MapContainer>
  );
}
