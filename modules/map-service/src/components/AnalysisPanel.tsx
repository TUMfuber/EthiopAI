'use client';
import { useEffect, useState } from 'react';

interface Props {
  lat: number;
  lng: number;
  view: 'ngo' | 'investor';
  visible: boolean;
  onClose: () => void;
}

export default function AnalysisPanel({ lat, lng, view, visible, onClose }: Props) {
  const [tab, setTab] = useState<'ngo' | 'investor'>(view);
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => { setTab(view); }, [view]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setData({});
    fetch(`/api/analyze?lat=${lat}&lng=${lng}&view=${tab}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, [lat, lng, tab, visible]);

  if (!visible) return null;

  const skeleton = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ height: 18, borderRadius: 4, background: '#f3f4f6', animation: 'pulse 1.2s infinite' }} />
      ))}
    </div>
  );

  const row = (label: string, value: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 13, textAlign: 'right' }}>{value ?? '—'}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      <div style={{ background: '#fff', borderRadius: 14, width: '90%', maxWidth: 460, maxHeight: '80vh', overflow: 'auto', fontFamily: 'system-ui,sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>📍 {lat.toFixed(3)}°N, {lng.toFixed(3)}°E</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, margin: '12px 20px', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <button onClick={() => setTab('ngo')} style={{ flex: 1, padding: '10px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === 'ngo' ? '#16a34a' : '#fff', color: tab === 'ngo' ? '#fff' : '#374151' }}>🌱 NGO</button>
          <button onClick={() => setTab('investor')} style={{ flex: 1, padding: '10px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === 'investor' ? '#16a34a' : '#fff', color: tab === 'investor' ? '#fff' : '#374151' }}>💰 Investor</button>
        </div>

        {/* Content */}
        <div style={{ padding: '0 20px 20px' }}>
          {loading && skeleton()}

          {!loading && data.location && (
            <>
              {row('Location', data.location)}
              {row('Intervention', data.intervention)}
              {row('Confidence', data.confidence)}
              {tab === 'investor' && (
                <>
                  {row('Carbon Credits/yr', data.carbonCredits)}
                  {row('ROI', data.roi)}
                  {row('Payback Period', data.paybackPeriod)}
                  {row('Risk Level', data.riskLevel)}
                  {row('Market Price', data.marketPrice)}
                </>
              )}
              {tab === 'ngo' && (
                <>
                  {row('Ecosystem Impact', data.ecosystemImpact)}
                  {row('Species Protected', data.speciesProtected)}
                  {row('Community Benefit', data.communityBenefit)}
                  {row('Funding Eligibility', data.fundingEligibility)}
                  {row('Preservation Index', data.preservationIndex)}
                </>
              )}
              <button onClick={() => (window as any).__ethopai_takeAction?.()}
                style={{ marginTop: 16, width: '100%', padding: '12px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                🚀 Take Action
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
