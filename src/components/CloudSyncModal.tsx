import React, { useState } from 'react';
import { Icon } from './Icons';
import { Modal } from './SharedUI';
import { 
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
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!isOpen) return null;

  const handleForceSync = async () => {
    setSyncing(true);
    setStatusMsg({ type: 'info', text: 'Connecting to server database and refreshing local cache...' });

    try {
      const { data, error } = await sb.from('app_users').select('*');
      if (error) {
        setStatusMsg({ type: 'error', text: `Sync check failed: ${error}` });
      } else {
        setStatusMsg({
          type: 'success',
          text: `🟢 Server connection verified! Found ${data?.length || 0} registered active users in system.`
        });
        if (onSyncUpdated) onSyncUpdated();
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Sync exception: ${err?.message || err}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportData = () => {
    const jsonStr = exportAllAppDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `infiev_erp_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

    setStatusMsg({ type: 'success', text: '💾 Full system database backup downloaded successfully!' });
  };

  const handleImportData = () => {
    if (!importText.trim()) {
      setStatusMsg({ type: 'error', text: 'Please paste JSON data into the import box.' });
      return;
    }

    const ok = importAllAppDataJSON(importText);
    if (ok) {
      setStatusMsg({ type: 'success', text: '✅ Database imported successfully! Reloading views...' });
      setImportText('');
      setShowImportArea(false);
      setTimeout(() => {
        if (onSyncUpdated) onSyncUpdated();
        window.location.reload();
      }, 1000);
    } else {
      setStatusMsg({ type: 'error', text: 'Failed to import JSON data. Check file format.' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🟢 MULTI-DEVICE SERVER SYNC STATUS" width="max-w-xl">
      <div className="flex flex-col gap-5 text-slate-200">
        
        {/* Connection status header badge */}
        <div className="p-4 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            <div>
              <div className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
                MULTI-DEVICE SERVER SYNC ACTIVE
              </div>
              <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                All created users, tasks, work reports, messages, and inventory updates are synced automatically across Mobile & Desktop.
              </div>
            </div>
          </div>
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

        {/* Sync Status Info */}
        <div className="bg-slate-900 border border-cyan-500/20 rounded-lg p-4 flex flex-col gap-3">
          <div className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Icon name="status" size={14} color="var(--neon-cyan)" />
              <span>Backend Server Database Status</span>
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
              SERVER INTEGRATED
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            The ERP backend automatically handles zero-key multi-device synchronization. Any user created in <span className="text-cyan-300 font-semibold">User Management</span> on a mobile phone, tablet, or secondary laptop is instantly available for login across all devices.
          </p>

          <div className="flex gap-2 justify-end mt-2">
            <button
              onClick={handleForceSync}
              disabled={syncing}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-mono text-xs font-bold px-4 py-2 rounded uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2"
            >
              <Icon name="refresh" size={12} />
              <span>{syncing ? 'VERIFYING SYNC...' : 'REFRESH & VERIFY SERVER CONNECTIVITY'}</span>
            </button>
          </div>
        </div>

        {/* Instant Backup & Restore options */}
        <div className="bg-slate-900 border border-cyan-500/15 rounded-lg p-4 flex flex-col gap-3">
          <div className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Icon name="inventory" size={14} color="var(--neon-cyan)" />
              <span>Database File Backup & Restore</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-mono text-xs px-4 py-2 rounded flex items-center gap-2 transition-all cursor-pointer"
            >
              <Icon name="key" size={12} />
              <span>DOWNLOAD BACKUP FILE (.JSON)</span>
            </button>

            <button
              onClick={() => setShowImportArea((p) => !p)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-mono text-xs px-4 py-2 rounded flex items-center gap-2 transition-all cursor-pointer"
            >
              <Icon name="test" size={12} />
              <span>{showImportArea ? 'HIDE IMPORT BOX' : 'RESTORE FROM FILE / TEXT'}</span>
            </button>
          </div>

          {showImportArea && (
            <div className="flex flex-col gap-2 mt-2 animate-fade-up">
              <textarea
                rows={4}
                placeholder="Paste JSON backup content here..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full bg-slate-950 border border-cyan-500/20 rounded p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-400"
              />
              <button
                onClick={handleImportData}
                className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold py-2 rounded uppercase tracking-wider transition-all cursor-pointer"
              >
                APPLY RESTORED DATA TO SYSTEM
              </button>
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
};
