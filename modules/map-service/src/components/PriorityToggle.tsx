'use client';

export default function PriorityToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title="AI Priority Map"
      aria-label="Toggle AI Priority Heatmap"
      aria-pressed={active}
      style={{
        position: 'absolute', bottom: 90, right: 16, zIndex: 1000,
        width: 42, height: 42, border: 'none', borderRadius: 10,
        cursor: 'pointer', fontSize: 20, lineHeight: 1,
        background: active ? '#fef2f2' : 'white',
        outline: active ? '2px solid #dc2626' : '2px solid transparent',
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        transition: 'background 0.15s, outline 0.15s',
      }}
    >
      🔥
    </button>
  );
}
