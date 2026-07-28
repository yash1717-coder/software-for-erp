import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import { Modal } from './SharedUI';
import { 
  getDirectSupabaseConfig, 
  saveDirectSupabaseConfig, 
  clearDirectSupabaseConfig, 
  exportAllAppDataJSON, 
  importAllAppDataJSON,
  getFallbackStore,
  sb
} from '../supabaseClient';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncUpdated?: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose, onSyncUpdated }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const cfg = getDirectSupabaseConfig();
      if (cfg) {
        setUrl(cfg.url);
        setKey(cfg.key);
        setConnected(true);
      } else {
        setUrl('');
        setKey('');
        setConnected(false);
      }
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndConnect = async () => {
    if (!url.trim() || !key.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter both Supabase Project URL and Anon/Publishable Key.' });
      return;
    }

    if (!url.includes('supabase.co')) {
      setStatusMsg({ type: 'error', text: 'URL must be a valid Supabase domain (e.g. https://xyz.supabase.co)' });
      return;
    }

    setTesting(true);
    setStatusMsg({ type: 'info', text: 'Testing database connection...' });

    try {
      saveDirectSupabaseConfig(url, key);

      // Verify connection by querying app_users
      const { data, error } = await sb.from('app_users').select('*', { limit: 1 });

      if (error) {
        setStatusMsg({ type: 'error', text: `Connection test failed: ${error}` });
        setConnected(false);
      } else {
        setConnected(true);
        setStatusMsg({ 
          type: 'success', 
          text: `🟢 Successfully connected to Supabase! Multi-device sync is now ACTIVE across Mobile and Desktop.` 
        });

        // Prompt auto-push local data
        autoPushLocalData();

        if (onSyncUpdated) onSyncUpdated();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Failed to test connection: ${err?.message || err}` });
      setConnected(false);
    } finally {
      setTesting(false);
    }
  };

  const autoPushLocalData = async () => {
    setPushing(true);
    try {
      const store = getFallbackStore();
      const tables = Object.keys(store);
      let totalPushed = 0;

      for (const t of tables) {
        const items = store[t];
        if (items && items.length > 0) {
          await sb.from(t).insert(items);
          totalPushed += items.length;
        }
      }

      setStatusMsg({
        type: 'success',
        text: `🟢 Connected & synced ${totalPushed} local items to Cloud Supabase!`
      });
    } catch {
      // ignore
    } finally {
      setPushing(false);
    }
  };

  const handleDisconnect = () => {
    clearDirectSupabaseConfig();
    setUrl('');
    setKey('');
    setConnected(false);
    setStatusMsg({ type: 'info', text: 'Switched back to Local Device Storage mode.' });
    if (onSyncUpdated) onSyncUpdated();
  };

  const handleExportData = () => {
    const jsonStr = exportAllAppDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `infiev_erp_data_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

    setStatusMsg({ type: 'success', text: '💾 Enterprise database backup downloaded successfully!' });
  };

  const handleImportData = () => {
    if (!importText.trim()) {
      setStatusMsg({ type: 'error', text: 'Please paste JSON data into the import box.' });
      return;
    }

    const ok = importAllAppDataJSON(importText);
    if (ok) {
      setStatusMsg({ type: 'success', text: '✅ Database imported successfully! Refreshing view...' });
      setImportText('');
      setShowImportArea(false);
      setTimeout(() => {
        if (onSyncUpdated) onSyncUpdated();
        window.location.reload();
      }, 1000);
    } else {
      setStatusMsg({ type: 'error', text: 'Failed to import JSON data. Check format.' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚡ MULTI-DEVICE CLOUD DATABASE SYNC" width="max-w-2xl">
      <div className="flex flex-col gap-5 text-slate-200">
        
        {/* Connection status header badge */}
        <div className={`p-4 rounded-lg border flex items-center justify-between ${
          connected 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider">
                {connected ? 'LIVE CLOUD SUPABASE SYNC ACTIVE' : 'LOCAL DEVICE STORAGE MODE'}
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                {connected 
                  ? 'All users, orders, inventory, and AI chat history sync live between Mobile & Desktop.' 
                  : 'Data is currently saved on this browser/device. Connect Supabase or import data to sync across devices.'}
              </div>
            </div>
          </div>
          {connected && (
            <button
              onClick={handleDisconnect}
              className="text-[10px] font-mono px-3 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded hover:bg-rose-500/30 transition-all cursor-pointer"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Feedback message banner */}
        {statusMsg && (
          <div className={`p-3 rounded text-xs font-mono leading-relaxed border ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : statusMsg.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* Supabase connection inputs */}
        <div className="bg-slate-900 border border-cyan-500/15 rounded-lg p-4 flex flex-col gap-3">
          <div className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Icon name="key" size={14} color="var(--neon-cyan)" />
            <span>Connect Supabase Database for Multi-Device Access</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Supabase URL
              </label>
              <input
                type="text"
                placeholder="https://xyz.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-cyan-500/20 rounded px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Supabase Anon / Public Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiI..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full bg-slate-950 border border-cyan-500/20 rounded px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-1">
            <button
              onClick={handleTestAndConnect}
              disabled={testing || pushing}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-mono text-xs font-bold px-5 py-2 rounded uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
            >
              {testing ? 'TESTING CONNECTION...' : pushing ? 'SYNCING DATA...' : 'SAVE & SYNC CLOUD DATABASE'}
            </button>
          </div>
        </div>

        {/* Manual Export & Import fallback options */}
        <div className="bg-slate-900 border border-cyan-500/15 rounded-lg p-4 flex flex-col gap-3">
          <div className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Icon name="inventory" size={14} color="var(--neon-cyan)" />
              <span>Instant Backup & Device Transfer (JSON)</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-mono text-xs px-4 py-2 rounded flex items-center gap-2 transition-all cursor-pointer"
            >
              <Icon name="key" size={12} />
              <span>EXPORT DATA FILE (.JSON)</span>
            </button>

            <button
              onClick={() => setShowImportArea((p) => !p)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-mono text-xs px-4 py-2 rounded flex items-center gap-2 transition-all cursor-pointer"
            >
              <Icon name="test" size={12} />
              <span>{showImportArea ? 'HIDE IMPORT BOX' : 'IMPORT DATA FILE / TEXT'}</span>
            </button>
          </div>

          {showImportArea && (
            <div className="flex flex-col gap-2 mt-2 animate-fade-up">
              <textarea
                rows={4}
                placeholder="Paste backup JSON data here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full bg-slate-950 border border-cyan-500/20 rounded p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-400"
              />
              <button
                onClick={handleImportData}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold py-2 rounded uppercase tracking-wider transition-all cursor-pointer"
              >
                APPLY IMPORTED DATA TO SYSTEM
              </button>
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
};
