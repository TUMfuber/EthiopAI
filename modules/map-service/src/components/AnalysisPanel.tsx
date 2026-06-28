'use client';
import { useEffect, useState } from 'react';

interface AnalysisPanelProps {
  lat: number;
  lng: number;
  view: 'ngo' | 'investor';
  visible: boolean;
  onClose: () => void;
}

interface AnalysisData {
  location: string;
  intervention: string;
  confidence: string;
  [key: string]: any;
}

export default function AnalysisPanel({ lat, lng, view, visible, onClose }: AnalysisPanelProps) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setData(null);
    fetch(`/api/analyze?lat=${lat}&lng=${lng}&view=${view}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [lat, lng, view, visible]);

  if (!visible) return null;

  const row = (label: string, value: any) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      width: '100%',
      maxHeight: 300,
      background: '#fff',
      borderTop: '2px solid #16a34a',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
      zIndex: 2000,
      padding: 16,
      overflowY: 'auto',
      animation: 'slideUp 0.3s ease-out',
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>{view === 'ngo' ? '🌱 NGO Analysis' : '💰 Investor Analysis'}</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {loading && <p style={{ color: '#6b7280' }}>Analyzing location ({lat.toFixed(4)}, {lng.toFixed(4)})...</p>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          {row('Location', data.location)}
          {row('Intervention', data.intervention)}
          {row('Confidence', data.confidence)}
          {view === 'investor' && (
            <>
              {row('Carbon Credits/yr', data.carbonCredits)}
              {row('ROI', data.roi)}
              {row('Payback Period', data.paybackPeriod)}
              {row('Risk Level', data.riskLevel)}
              {row('Market Price', data.marketPrice)}
            </>
          )}
          {view === 'ngo' && (
            <>
              {row('Ecosystem Impact', data.ecosystemImpact)}
              {row('Species Protected', data.speciesProtected)}
              {row('Community Benefit', data.communityBenefit)}
              {row('Funding Eligibility', data.fundingEligibility)}
              {row('Preservation Index', data.preservationIndex)}
            </>
          )}
        </div>
      )}

      {data && (
        <button onClick={() => (window as any).__ethopai_takeAction?.()}
          style={{ marginTop: 12, width: '100%', padding: '12px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          🚀 Take Action
        </button>
      )}
    </div>
  );
}
