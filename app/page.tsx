'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  RAW_LAYER_QUERY_PARAM,
  parseRawLayerIds,
} from '../modules/map-service/src/layers/rawLayers';
import type { Project } from '../modules/map-service/src/components/ProjectMarkers';

const EthiopiaMap = dynamic(
  () => import('../modules/map-service/src/components/EthiopiaMap').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading map...</div>,
  }
);

export default function Page() {
  const [visibleRawLayerIds, setVisibleRawLayerIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setVisibleRawLayerIds(parseRawLayerIds(searchParams.get(RAW_LAYER_QUERY_PARAM)));
  }, []);

  useEffect(() => {
    fetch('/data/projects.json')
      .then((r) => r.json())
      .then((data) => {
        // Convert scraped data to the Project format expected by the map
        const mapped: Project[] = data
          .filter((p: any) => p.lat && p.lng)
          .map((p: any) => ({
            id: typeof p.id === 'number' ? p.id : parseInt(p.id) || Math.random(),
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            type: p.type || '',
            description: p.description || '',
            organization: p.organization || '',
            status: p.status || '',
          }));
        setProjects(mapped);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="page">
      <EthiopiaMap visibleRawLayerIds={visibleRawLayerIds} projects={projects} />
    </main>
  );
}
