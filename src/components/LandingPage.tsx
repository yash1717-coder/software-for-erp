import React, { useState } from 'react';
import { appAuth } from '../supabaseClient';
import { AppUser } from '../types';
import { Icon } from './Icons';
import { PwdInput } from './SharedUI';

interface LandingPageProps {
  onLogin: (user: AppUser) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [activeCard, setActiveCard] = useState<'admin' | 'supervisor' | 'employee' | null>(null);
  const [form, setForm] = useState({ id: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roles = [
    { key: 'admin' as const, label: 'ADMINISTRATOR', icon: 'dashboard', color: 'cyan', desc: 'Full system access, live financials & workforce provisioning' },
    { key: 'supervisor' as const, label: 'SUPERVISOR', icon: 'supervisor', color: 'green', desc: 'Team coordination, work task allocation & QA review' },
    { key: 'employee' as const, label: 'EMPLOYEE', icon: 'users', color: 'orange', desc: 'Operational reporting, direct messaging & live GPS tracker' },
  ];

  const handleAuthenticate = async () => {
    if (!form.id || !form.password) {
      setError('Please fill in both required fields.');
      return;
    }
    setLoading(true);
    setError('');

    if (activeCard === 'admin') {
      // Admin: Authenticate against local hardcoded dashboard constants
      if (form.id === 'admin01' && form.password === 'admin91') {
        setTimeout(() => {
          setLoading(false);
          onLogin({
            user_id: 'admin01',
            name: 'Administrator Profile',
            role: 'admin',
            is_active: true
          });
        }, 600);
      } else {
        setLoading(false);
        setError('Incorrect Administrator key credentials.');
      }
      return;
    }

    // Supervisor or Employee: Authenticate against the Supabase `app_users` table
    try {
      const { ok, user, msg } = await appAuth.login(form.id.trim(), form.password, activeCard || '');
      setLoading(false);
      if (!ok || !user) {
        setError(msg || 'Authentication failed. Please verify credentials.');
        return;
      }
      onLogin(user);
    } catch (err: any) {
      setLoading(false);
      setError('Connection Error: ' + (err?.message || String(err)));
    }
  };

  const borderColors: { [key: string]: string } = {
    cyan: 'hover:border-cyan-400 focus:border-cyan-400',
    green: 'hover:border-emerald-400 focus:border-emerald-400',
    orange: 'hover:border-amber-400 focus:border-amber-400',
  };

  const textColors: { [key: string]: string } = {
    cyan: 'text-cyan-400',
    green: 'text-emerald-400',
    orange: 'text-amber-400',
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[8%] left-[4%] w-[500px] h-[500px] rounded-full bg-cyan-500/[0.035] blur-3xl pointer-events-none" />
      <div className="absolute bottom-[8%] right-[4%] w-[350px] h-[350px] rounded-full bg-emerald-500/[0.03] blur-3xl pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,245,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,245,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        {/* BRAND IDENTITY */}
        <div className="text-center mb-12 animate-fade-up">
          <div className="font-mono text-5xl md:text-6xl font-black tracking-widest text-slate-100 flex items-center justify-center gap-1">
            <span className="text-cyan-400">INFIEV</span>
            <span className="text-slate-400 font-light text-3xl md:text-4xl tracking-normal"> ERP</span>
          </div>
          <div className="text-slate-500 text-[10px] tracking-[6px] font-mono font-semibold uppercase mt-3">
            MANUFACTURING INTELLIGENCE PLATFORM
          </div>
          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-mono text-[10px] font-bold tracking-widest uppercase">
              ENTERPRISE PLATFORM CORE ONLINE
            </span>
          </div>
        </div>

        {/* ROLE CHOOSER */}
        {!activeCard ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl animate-fade-up">
            {roles.map((r) => (
              <div
                key={r.key}
                onClick={() => {
                  setActiveCard(r.key);
                  setError('');
                  setForm({ id: '', password: '' });
                }}
                className="bg-slate-900 border border-cyan-500/10 rounded p-8 text-center cursor-pointer transition-all duration-300 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(0,245,255,0.05)] flex flex-col h-full group"
              >
                <div className={`mb-5 flex justify-center opacity-80 group-hover:opacity-100 transition-opacity`}>
                  <Icon name={r.icon} size={36} color={r.key === 'admin' ? 'var(--neon-cyan)' : r.key === 'supervisor' ? '#10b981' : '#f59e0b'} />
                </div>
                <div className={`font-mono text-xs font-bold tracking-widest uppercase mb-3 ${textColors[r.color]}`}>
                  {r.label}
                </div>
                <div className="text-slate-400 text-xs font-sans leading-relaxed flex-1">
                  {r.desc}
                </div>
                <div className="mt-6 pt-5 border-t border-slate-800 font-mono text-[9px] text-slate-500 uppercase tracking-widest group-hover:text-cyan-400 transition-colors">
                  Authorize Access →
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full max-w-md animate-fade-up">
            <div className="bg-slate-900 border border-cyan-500/15 rounded p-8 shadow-[0_0_40px_rgba(3,5,8,0.7)] relative">
              <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-cyan-400" />
              
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={() => {
                    setActiveCard(null);
                    setError('');
                  }}
                  className="font-mono text-[10px] tracking-widest text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer uppercase flex items-center gap-1"
                >
                  ← BACK
                </button>
                <span className="text-slate-600 font-mono text-xs">|</span>
                <div className="font-mono text-xs font-bold tracking-widest text-cyan-400 uppercase">
                  {roles.find((r) => r.key === activeCard)?.label} LOGIN
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ACCESS IDENTITY KEY (USER ID)</label>
                  <input
                    className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none placeholder-slate-600"
                    placeholder={activeCard === 'admin' ? 'e.g., admin01' : 'Enter User ID'}
                    value={form.id}
                    onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">SECURITY ACCESS PASSWORD</label>
                  <PwdInput
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Enter Password"
                  />
                </div>

                {activeCard !== 'admin' && (
                  <div className="p-3.5 bg-cyan-950/15 border border-cyan-500/10 rounded font-mono text-[10px] text-slate-400 leading-relaxed">
                    Credentials must be registered inside Supabase. Admin access is required to register new personnel accounts.
                  </div>
                )}

                {error && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded text-rose-400 font-mono text-xs font-semibold">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleAuthenticate}
                  disabled={loading}
                  className="w-full mt-2 py-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400 text-cyan-400 font-mono text-xs font-bold tracking-widest uppercase rounded cursor-pointer transition-all shadow-[0_0_15px_rgba(0,245,255,0.05)]"
                >
                  {loading ? 'RUNNING SECURITY HANDSHAKE...' : 'INITIATE SECURE HANDSHAKE'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-16 text-slate-600 font-mono text-[10px] tracking-widest uppercase text-center">
          v2.5.0 — INFIEV MANUFACTURING SYSTEMS © 2026
        </div>
      </div>
    </div>
  );
};
