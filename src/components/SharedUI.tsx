import React, { useState } from 'react';
import { Icon } from './Icons';

interface NoDataProps {
  label?: string;
}

export const NoData: React.FC<NoDataProps> = ({ label = 'NO DATA AVAILABLE' }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-slate-500 font-mono text-xs tracking-wider gap-3">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-20 text-cyan-400">
      <circle cx="12" cy="12" r="10"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
    <span>{label}</span>
    <span className="text-[10px] text-slate-600 uppercase tracking-widest font-sans">Connect Supabase to populate live records</span>
  </div>
);

export const Spinner: React.FC = () => (
  <div className="flex items-center justify-center p-12">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--neon-cyan)" strokeWidth="2" className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="20" strokeLinecap="round"/>
    </svg>
  </div>
);

interface KPICardProps {
  label: string;
  value: string | number | undefined;
  sub?: string;
  accent?: 'cyan' | 'green' | 'orange' | 'red';
  icon?: string;
}

export const KPICard: React.FC<KPICardProps> = ({ label, value, sub, accent = 'cyan', icon }) => {
  const c = {
    cyan: { bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', text: 'text-cyan-400', edge: 'border-cyan-400' },
    green: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', edge: 'border-emerald-400' },
    orange: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', edge: 'border-amber-400' },
    red: { bg: 'bg-rose-500/5', border: 'border-rose-500/20', text: 'text-rose-400', edge: 'border-rose-400' },
  }[accent];

  return (
    <div className={`relative p-5 overflow-hidden rounded bg-slate-950 border ${c.border} transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(0,245,255,0.05)]`}>
      {/* Visual neon corner decorations */}
      <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${c.edge}`} />
      <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${c.edge}`} />
      
      <div className="flex items-start justify-between">
        <div>
          <div className="text-slate-400 text-[10px] font-bold tracking-widest uppercase font-mono">{label}</div>
          <div className={`${c.text} text-3xl font-mono font-bold mt-2 leading-none`}>
            {value !== undefined && value !== null ? value : '—'}
          </div>
          {sub && <div className="text-slate-500 text-xs mt-2 font-mono">{sub}</div>}
        </div>
        <div className={`${c.text} opacity-40`}>
          <Icon name={icon || 'chart'} size={28} />
        </div>
      </div>
    </div>
  );
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[1000] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-cyan-500/40 rounded shadow-[0_0_50px_rgba(0,245,255,0.15)] w-full max-w-lg overflow-y-auto max-h-[90vh] animate-fade-up">
        <div className="flex items-center justify-between border-b border-slate-800 p-5">
          <div className="font-mono text-xs text-cyan-400 tracking-widest uppercase font-bold">{title}</div>
          <button onClick={onClose} className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

interface PwdInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

export const PwdInput: React.FC<PwdInputProps> = ({ value, onChange, placeholder, className }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2 w-full">
      <input
        className={`bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none ${className || ''}`}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder || 'Password'}
      />
      <button
        type="button"
        className="border border-cyan-500/10 hover:border-cyan-400/40 rounded p-2.5 text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer shrink-0"
        onClick={() => setShow((s) => !s)}
      >
        <Icon name={show ? 'eyeoff' : 'eye'} size={14} />
      </button>
    </div>
  );
};
