import React from "react";
import { GeoJSON } from "react-leaflet";

const COLORS = {
  most: "#e63946",
  middle: "#f4a261",
  least: "#2a9d8f",
};

function style(priority) {
  return { color: COLORS[priority], weight: 2, fillOpacity: 0.35 };
}

export default function PriorityOverlays({ zones }) {
  return (
    <>
      {zones.mostRelevant && (
        <GeoJSON data={zones.mostRelevant} style={() => style("most")} />
      )}
      {zones.middleRelevant && (
        <GeoJSON data={zones.middleRelevant} style={() => style("middle")} />
      )}
      {zones.leastRelevant && (
        <GeoJSON data={zones.leastRelevant} style={() => style("least")} />
      )}
    </>
  );
}
