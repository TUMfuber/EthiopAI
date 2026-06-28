'use client';
import { useState } from 'react';

interface Props {
  view: 'ngo' | 'investor';
}

const labels: Record<string, string> = {
  '': 'Restoration Priority Score',
  ngo: 'Ecosystem Preservation Need',
  investor: 'Carbon Credit Potential',
};

export default function MapLegend({ view }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ position: 'absolute', bottom: 16, left: 56, zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', padding: open ? 12 : 6, minWidth: open ? 180 : 32, transition: 'all 0.2s' }}>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, width: '100%', textAlign: 'right', padding: 0 }}>
          {open ? '▼' : '▲'}
        </button>
        {open && (
          <>
            <div style={{ height: 12, borderRadius: 4, background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666' }}>
              <span>Low Priority</span>
              <span>High Priority</span>
            </div>
            <div style={{ fontSize: 11, color: '#333', marginTop: 6, fontWeight: 500, textAlign: 'center' }}>
              {labels[view] ?? labels['']}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
