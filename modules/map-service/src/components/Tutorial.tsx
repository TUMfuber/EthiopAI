'use client';
import { useState, useEffect } from 'react';

const steps = [
  { title: 'Welcome to EthopAI', body: 'EthopAI visualizes Ethiopia\'s ecological priority zones, helping you identify where conservation and investment efforts matter most.' },
  { title: 'Choose Your Perspective', body: 'Toggle between NGO and Investor modes. NGO focuses on preservation priority, while Investor highlights carbon credit ROI opportunities.' },
  { title: 'Explore the Map', body: 'Use the mode icons to switch layers: ⭐ Overall priority, 🌳 Carbon sequestration, 💧 Erosion risk, 🏔️ Land degradation, 🦋 Biodiversity hotspots.' },
  { title: 'Drop a Pin', body: 'Click the pin button, then click anywhere on the map to analyze that location. You\'ll get detailed ecological metrics for the selected area.' },
  { title: 'AI Recommendations', body: 'Press the 🔥 button to generate AI-powered intervention suggestions based on satellite data and ecological models.' },
];

export default function Tutorial({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(visible);

  useEffect(() => { setShow(visible); if (visible) setStep(0); }, [visible]);

  const finish = () => {
    localStorage.setItem('ethopai-tutorial-done', 'true');
    setShow(false);
    onClose();
  };

  if (!show) return (
    <button onClick={() => setShow(true)} style={{ position: 'fixed', bottom: 80, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#1a73e8', color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
  );

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', position: 'relative' }}>
          <button onClick={finish} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#666' }}>Skip</button>
          <h2 style={{ margin: '0 0 8px', fontSize: 20 }}>{steps[step].title}</h2>
          <p style={{ margin: '0 0 24px', color: '#444', lineHeight: 1.5 }}>{steps[step].body}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 16 }}>
            {steps.map((_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === step ? '#1a73e8' : '#ccc' }} />)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(s => s - 1)} disabled={step === 0} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 6, background: '#fff', cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.4 : 1 }}>Back</button>
            <button onClick={step === steps.length - 1 ? finish : () => setStep(s => s + 1)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1a73e8', color: '#fff', cursor: 'pointer' }}>{step === steps.length - 1 ? 'Done' : 'Next'}</button>
          </div>
        </div>
      </div>
      <button onClick={() => setShow(true)} style={{ position: 'fixed', bottom: 80, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#1a73e8', color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
    </>
  );
}
