import React, { useState, useEffect } from 'react';
import { Database, Save, X, Info, CheckCircle, Server } from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials } from '../supabaseClient';

interface DatabaseConfigModalProps {
  onClose: () => void;
  onSave: () => void;
}

export function DatabaseConfigModal({ onClose, onSave }: DatabaseConfigModalProps) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    getSupabaseCredentials().then((cfg) => {
      setUrl(cfg.url || '');
      setIsConfigured(cfg.configured);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('idle');
    setErrMsg('');

    const targetUrl = url.trim();
    const targetKey = key.trim();

    if (!targetUrl || !targetKey) {
      await saveSupabaseCredentials('', '');
      setStatus('success');
      onSave();
      setTimeout(onClose, 1000);
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      setStatus('error');
      setErrMsg('Database URL must start with http:// or https://');
      return;
    }

    try {
      const ok = await saveSupabaseCredentials(targetUrl, targetKey);
      if (ok) {
        setStatus('success');
        setIsConfigured(true);
        onSave();
        setTimeout(onClose, 1000);
      } else {
        throw new Error('Server rejected configuration update.');
      }
    } catch (err: any) {
      console.warn(err);
      setStatus('error');
      setErrMsg(`Failed to save server credentials: ${err.message || err}`);
    }
  };

  const handleReset = async () => {
    setUrl('');
    setKey('');
    await saveSupabaseCredentials('', '');
    setStatus('success');
    setIsConfigured(false);
    onSave();
    setTimeout(onClose, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      <div className="bg-slate-900 border border-cyan-500/30 rounded-lg max-w-lg w-full overflow-hidden shadow-2xl shadow-cyan-500/15">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/15 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2 text-cyan-400">
            <Database size={16} className="animate-pulse" />
            <span className="font-mono text-xs font-bold tracking-wider uppercase">BACKEND DATABASE SETUP</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            INFIEV Manufacturing ERP uses a centralized <strong className="text-cyan-400">Full-Stack Express Backend</strong>. All database API keys remain strictly hidden on the server for security and global device sync.
          </p>

          {/* Status Indicator */}
          <div className={`p-3 rounded border text-xs font-mono ${
            isConfigured 
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
              : 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400'
          }`}>
            <div className="flex items-center gap-2">
              <Server size={14} className="text-cyan-400 shrink-0" />
              <span className="font-bold">
                STATUS: {isConfigured ? 'CONNECTED TO REMOTE SUPABASE VIA BACKEND' : 'SERVER DATABASE (SYNCD ACROSS ALL DEVICES)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal">
              All data created by admins or employees is stored directly on the server database and synced across every phone, laptop, and browser connected to this app!
            </p>
          </div>

          <div className="space-y-4">
            {/* URL */}
            <div>
              <label className="block font-mono text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                Supabase Project URL (Stored on Backend)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none transition-colors"
              />
            </div>

            {/* Key */}
            <div>
              <label className="block font-mono text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                Supabase Anon / Service Key (Hidden on Backend)
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="••••••••••••••••••••••••••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Environment Variables Note */}
          <div className="bg-slate-950/80 p-4 rounded border border-slate-800 text-slate-300 text-xs space-y-2 font-sans">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              <Info size={12} />
              <span>Backend Environment Configuration</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              To configure server database credentials persistently on host, set these environment variables on your server:
            </p>
            <div className="p-2 bg-slate-900 rounded font-mono text-[10px] text-cyan-300 space-y-1 select-all border border-slate-800/50">
              <div>SUPABASE_URL = (your URL)</div>
              <div>SUPABASE_ANON_KEY = (your key)</div>
            </div>
          </div>

          {/* Feedback */}
          {status === 'success' && (
            <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle size={14} />
              <span>Server database configuration updated successfully!</span>
            </div>
          )}
          {status === 'error' && (
            <div className="text-xs font-mono text-amber-400 bg-amber-500/10 p-2.5 rounded border border-amber-500/20 flex items-center gap-2">
              <Info size={14} className="shrink-0" />
              <span className="leading-tight">{errMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="text-slate-400 hover:text-slate-200 text-[10px] font-mono hover:underline cursor-pointer"
            >
              Reset Backend Config
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Save size={13} />
                Save Backend Config
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
