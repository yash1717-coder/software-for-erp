import React, { useState } from 'react';
import { Database, Save, X, Info, CheckCircle } from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials } from '../supabaseClient';

interface DatabaseConfigModalProps {
  onClose: () => void;
  onSave: () => void;
}

export function DatabaseConfigModal({ onClose, onSave }: DatabaseConfigModalProps) {
  const { url: currentUrl, key: currentKey, isLocal } = getSupabaseCredentials();
  
  const [url, setUrl] = useState(isLocal && currentUrl.includes("sfhnaamxhwmzppmcmvbo") ? '' : currentUrl);
  const [key, setKey] = useState(isLocal && currentKey.includes("sb_publishable") ? '' : currentKey);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('idle');
    setErrMsg('');

    const targetUrl = url.trim();
    const targetKey = key.trim();

    if (!targetUrl || !targetKey) {
      saveSupabaseCredentials('', '');
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
      // Connect test request
      const testHeaders = {
        'apikey': targetKey,
        'Authorization': `Bearer ${targetKey}`
      };
      
      const res = await fetch(`${targetUrl}/rest/v1/`, {
        method: 'GET',
        headers: testHeaders
      });

      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(`Connectivity test returned HTTP ${res.status} ${text || ''}`);
      }

      saveSupabaseCredentials(targetUrl, targetKey);
      setStatus('success');
      onSave();
      setTimeout(onClose, 1000);
    } catch (err: any) {
      console.warn(err);
      saveSupabaseCredentials(targetUrl, targetKey);
      setStatus('error');
      setErrMsg(`Could not reach host, but credentials saved anyway as local configuration override. Error: ${err.message || err}`);
      onSave();
    }
  };

  const handleReset = () => {
    setUrl('');
    setKey('');
    saveSupabaseCredentials('', '');
    setStatus('success');
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
            <span className="font-mono text-xs font-bold tracking-wider uppercase">DATABASE CONNECTION SETUP</span>
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
            INFIEV Manufacturing ERP utilizes <strong className="text-cyan-400">Supabase</strong> for global multi-device synchronization. Supply your project details below to bind your real database.
          </p>

          {/* Status Indicator */}
          <div className={`p-3 rounded border text-xs font-mono ${
            isLocal 
              ? 'bg-amber-500/5 border-amber-500/20 text-amber-400' 
              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${isLocal ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="font-bold">
                STATUS: {isLocal ? 'OFFLINE LOCAL STORAGE (DEMO)' : 'CONNECTED TO REMOTE SUPABASE'}
              </span>
            </div>
            {isLocal && (
              <p className="text-[10px] text-slate-400 mt-1">
                Data is stored in this browser only. Connect your Supabase instance to view and manage data from other mobiles and laptops!
              </p>
            )}
          </div>

          <div className="space-y-4">
            {/* URL */}
            <div>
              <label className="block font-mono text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                Supabase Project URL *
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none transition-colors"
                required
              />
            </div>

            {/* Key */}
            <div>
              <label className="block font-mono text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
                Supabase Anon Public Key *
              </label>
              <textarea
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500/50 rounded px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none transition-colors h-16 resize-none"
                required
              />
            </div>
          </div>

          {/* Vercel specs */}
          <div className="bg-slate-950/80 p-4 rounded border border-slate-800 text-slate-300 text-xs space-y-2 font-sans">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[10px] font-bold tracking-wider uppercase">
              <Info size={12} />
              <span>Synchronize All Devices Automatically</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              To sync all operator and manager devices instantly without pasting credentials, set these <strong className="text-slate-200">Environment Variables</strong> on your Vercel Dashboard, then redeploy:
            </p>
            <div className="p-2 bg-slate-900 rounded font-mono text-[10px] text-cyan-300 space-y-1 select-all border border-slate-800/50">
              <div>VITE_SUPABASE_URL = (your URL)</div>
              <div>VITE_SUPABASE_ANON_KEY = (your key)</div>
            </div>
          </div>

          {/* Feedback */}
          {status === 'success' && (
            <div className="text-xs font-mono text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle size={14} />
              <span>Settings saved successfully! Syncing views...</span>
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
              Reset to Local Mode
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
                Connect
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
