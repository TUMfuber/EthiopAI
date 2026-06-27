'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  RAW_LAYER_QUERY_PARAM,
  parseRawLayerIds,
} from '../modules/map-service/src/layers/rawLayers';

const EthiopiaMap = dynamic(
  () => import('../modules/map-service/src/components/EthiopiaMap').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading map...</div>,
  }
);

export default function Page() {
  const [visibleRawLayerIds, setVisibleRawLayerIds] = useState<string[]>([]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setVisibleRawLayerIds(parseRawLayerIds(searchParams.get(RAW_LAYER_QUERY_PARAM)));
  }, []);

  return (
    <main className="page">
      <EthiopiaMap visibleRawLayerIds={visibleRawLayerIds} />
    </main>
  );
}
