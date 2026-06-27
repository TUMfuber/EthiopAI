'use client';

import dynamic from 'next/dynamic';

const EthiopiaMap = dynamic(
  () => import('../components/map/EthiopiaMap').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading map...</div>,
  }
);

export default function Page() {
  return (
    <main className="page">
      <EthiopiaMap />
    </main>
  );
}
