'use client';

type View = 'ngo' | 'investor';

interface ViewSwitcherProps {
  activeView: View;
  onChange: (view: View) => void;
}

export default function ViewSwitcher({ activeView, onChange }: ViewSwitcherProps) {
  const btn = (view: View, label: string, icon: string) => {
    const active = activeView === view;
    return (
      <button
        onClick={() => onChange(view)}
        style={{
          padding: '8px 16px',
          border: active ? 'none' : '1px solid #d1d5db',
          background: active ? '#16a34a' : '#fff',
          color: active ? '#fff' : '#374151',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          borderRadius: view === 'ngo' ? '20px 0 0 20px' : '0 20px 20px 0',
        }}
      >
        {icon} {label}
      </button>
    );
  };

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      borderRadius: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      overflow: 'hidden',
    }}>
      {btn('ngo', 'NGO View', '🌱')}
      {btn('investor', 'Investor View', '💰')}
    </div>
  );
}
