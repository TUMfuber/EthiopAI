'use client';

import { useCallback, useEffect, useState } from 'react';

interface Recommendation {
  id: string;
  priority: number;
  title: string;
  description: string;
  impact: string;
  location: string;
  category: string;
}

const FILTERS = ['Biodiversity', 'Carbon', 'Soil', 'Water'] as const;

function badgeColor(p: number): string {
  if (p >= 0.8) return '#dc2626';
  if (p >= 0.6) return '#ea580c';
  if (p >= 0.4) return '#ca8a04';
  return '#16a34a';
}

export default function RecommendationPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [active, setActive] = useState<Set<string>>(new Set(['Biodiversity', 'Carbon']));
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const toggle = (f: string) => setActive((prev) => {
    const next = new Set(prev);
    next.has(f) ? next.delete(f) : next.add(f);
    return next;
  });

  const fetchRecs = useCallback(async () => {
    if (active.size === 0) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/recommendations?filters=${[...active].map(s => s.toLowerCase()).join(',')}`);
      if (res.ok) setItems(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [active]);

  useEffect(() => { if (visible) fetchRecs(); }, [visible, fetchRecs]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: 380, height: '100vh',
      background: '#fff', zIndex: 1000, overflowY: 'auto',
      boxShadow: '-2px 0 12px rgba(0,0,0,0.15)', fontFamily: 'system-ui,sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>AI Recommendations</h2>
        <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => toggle(f)} style={{
            padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid #d1d5db',
            background: active.has(f) ? '#16a34a' : '#f9fafb',
            color: active.has(f) ? '#fff' : '#374151',
          }}>{f}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px 20px' }}>
        {loading && <p style={{ color: '#6b7280', fontSize: 13 }}>Loading recommendations...</p>}
        {!loading && items.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No recommendations yet.</p>}
        {items.map((item) => (
          <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 10,
                fontSize: 11, fontWeight: 700, color: '#fff',
                background: badgeColor(item.priority),
              }}>{item.priority.toFixed(2)}</span>
              <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{item.category}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 6 }}>{item.description}</div>
            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Impact: {item.impact}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>📍 {item.location}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
