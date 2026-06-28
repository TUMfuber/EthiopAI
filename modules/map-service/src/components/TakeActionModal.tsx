'use client';

import { useState } from 'react';

type Props = {
  visible: boolean;
  onClose: () => void;
  location: string;
  lat: number;
  lng: number;
  view: 'ngo' | 'investor';
};

export default function TakeActionModal({ visible, onClose, location, lat, lng, view }: Props) {
  const [step, setStep] = useState<'menu' | 'contact' | 'funding' | 'submitted'>('menu');
  const [form, setForm] = useState({ name: '', email: '', org: '', message: '', amount: '' });

  if (!visible) return null;

  const reset = () => { setStep('menu'); setForm({ name: '', email: '', org: '', message: '', amount: '' }); onClose(); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 440, width: '90%', fontFamily: 'system-ui,sans-serif', position: 'relative' }}>
        <button onClick={reset} style={{ position: 'absolute', top: 12, right: 16, border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>&times;</button>

        {step === 'menu' && (
          <>
            <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Take Action</h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>📍 {location} ({lat.toFixed(2)}°N, {lng.toFixed(2)}°E)</p>
            <button onClick={() => setStep('contact')} style={btnStyle}>
              <span style={{ fontSize: 20 }}>📞</span>
              <div><strong>Contact Local Entities</strong><br/><span style={{ fontSize: 12, color: '#6b7280' }}>Connect with local NGOs, government offices, or community leaders</span></div>
            </button>
            <button onClick={() => setStep('funding')} style={btnStyle}>
              <span style={{ fontSize: 20 }}>💰</span>
              <div><strong>Set Up Funding Offer</strong><br/><span style={{ fontSize: 12, color: '#6b7280' }}>{view === 'investor' ? 'Propose carbon credit investment for this area' : 'Submit grant/funding application for this project'}</span></div>
            </button>
          </>
        )}

        {step === 'contact' && (
          <>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>📞 Contact Local Entities</h2>
            <input placeholder="Your Name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={inputStyle} />
            <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} style={inputStyle} />
            <input placeholder="Organization" value={form.org} onChange={e => setForm(f => ({...f, org: e.target.value}))} style={inputStyle} />
            <textarea placeholder="Message — describe your interest in this area..." value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} style={{...inputStyle, minHeight: 80, resize: 'vertical'}} />
            <button onClick={() => setStep('submitted')} style={submitStyle}>Send Inquiry</button>
          </>
        )}

        {step === 'funding' && (
          <>
            <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>💰 {view === 'investor' ? 'Investment Proposal' : 'Funding Application'}</h2>
            <input placeholder="Your Name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} style={inputStyle} />
            <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} style={inputStyle} />
            <input placeholder="Organization" value={form.org} onChange={e => setForm(f => ({...f, org: e.target.value}))} style={inputStyle} />
            <input placeholder={view === 'investor' ? 'Investment Amount (USD)' : 'Requested Funding (USD)'} value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} style={inputStyle} />
            <textarea placeholder={view === 'investor' ? 'Describe your investment thesis for this area...' : 'Describe your project goals and expected outcomes...'} value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} style={{...inputStyle, minHeight: 80, resize: 'vertical'}} />
            <button onClick={() => setStep('submitted')} style={submitStyle}>{view === 'investor' ? 'Submit Proposal' : 'Submit Application'}</button>
          </>
        )}

        {step === 'submitted' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Submitted Successfully</h2>
            <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>We'll connect you with relevant stakeholders for {location}. You'll receive a response within 48 hours.</p>
            <button onClick={reset} style={submitStyle}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#f9fafb', cursor: 'pointer', textAlign: 'left', marginBottom: 10, transition: 'background 0.15s' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 10, outline: 'none', boxSizing: 'border-box' };
const submitStyle: React.CSSProperties = { width: '100%', padding: '12px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
