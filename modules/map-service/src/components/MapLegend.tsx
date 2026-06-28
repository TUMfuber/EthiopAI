'use client';
import { useState } from 'react';

interface Props {
  view: 'ngo' | 'investor';
}

export default function MapLegend({ view }: Props) {
  const [open, setOpen] = useState(true);

  const title = view === 'ngo' ? 'Preservation Priority' : view === 'investor' ? 'Credit Opportunity' : 'Restoration Score';
  const leftLabel = view === 'ngo' ? 'Least Needed' : view === 'investor' ? 'Low ROI' : 'Low Priority';
  const rightLabel = view === 'ngo' ? 'Most Needed' : view === 'investor' ? 'High ROI' : 'High Priority';

  return (
    <div style={{ position: 'absolute', bottom: 16, left: 56, zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', padding: open ? 12 : 6, minWidth: open ? 190 : 32, transition: 'all 0.2s' }}>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, width: '100%', textAlign: 'right', padding: 0 }}>
          {open ? '▼' : '▲'}
        </button>
        {open && (
          <>
            <div style={{ fontSize: 11, color: '#333', marginBottom: 6, fontWeight: 600, textAlign: 'center' }}>{title}</div>
            <div style={{ height: 12, borderRadius: 4, background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e)', margin: '0 0 4px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666' }}>
              <span>{leftLabel}</span>
              <span>{rightLabel}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
