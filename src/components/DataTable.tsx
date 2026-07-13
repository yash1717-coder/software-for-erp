import React, { useState, useEffect } from 'react';
import { sb, SupabaseFilter } from '../supabaseClient';
import { Icon } from './Icons';
import { Spinner, NoData, Modal } from './SharedUI';

export interface ColumnDefinition {
  key: string;
  label: string;
  badge?: (val: any) => 'online' | 'offline' | 'warning';
}

interface DataTableProps {
  table: string;
  columns: ColumnDefinition[];
  title: string;
  addable?: boolean;
  defaultForm?: { [key: string]: any };
  icon?: string;
  filter?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  table,
  columns,
  title,
  addable = false,
  defaultForm = {},
  icon,
  filter
}) => {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ [key: string]: any }>(defaultForm || {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const loadRecords = async () => {
    setLoading(true);
    const opts: any = { order: 'created_at.desc', limit: 100 };
    if (filter) {
      opts.filter = filter;
    }
    const { data: d, error } = await sb.from(table).select('*', opts);
    if (!error && d) {
      setData(d);
    } else {
      console.error(`Error loading from ${table}:`, error);
      setData([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, [table, filter]);

  const handleSaveRecord = async () => {
    setSaving(true);
    setMsg('');

    // Remove any client-side generated/computed properties before insertion
    const COMPUTED_COLUMNS = ['total_value', 'total_cost', 'net_profit', 'id'];
    const cleanedPayload: { [key: string]: any } = {};

    Object.entries(form).forEach(([k, v]) => {
      if (!COMPUTED_COLUMNS.includes(k)) {
        cleanedPayload[k] = v === '' ? null : v;
      }
    });

    // Add current ISO timestamp for sorting
    cleanedPayload.created_at = new Date().toISOString();

    const { error } = await sb.from(table).insert(cleanedPayload);
    setSaving(false);

    if (error) {
      let message = error;
      try {
        const parsed = JSON.parse(error);
        message = parsed?.message || error;
      } catch (err) {}
      setMsg('Error saving record: ' + message);
      return;
    }

    setShowAdd(false);
    setForm(defaultForm || {});
    setMsg('');
    loadRecords();
  };

  const handleDeleteRecord = async (id: string | number) => {
    if (!window.confirm('Are you sure you want to permanently delete this operational record?')) {
      return;
    }
    const { error } = await sb.from(table).delete({ col: 'id', val: id });
    if (error) {
      alert('Delete operation failed: ' + error);
    } else {
      loadRecords();
    }
  };

  const renderCellContent = (col: ColumnDefinition, row: any) => {
    const val = row[col.key];
    if (col.badge) {
      const badgeClass = col.badge(val);
      const displayString = typeof val === 'boolean' ? (val ? 'YES' : 'NO') : val ?? '—';
      return (
        <span
          className={`inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase ${
            badgeClass === 'online'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : badgeClass === 'offline'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}
        >
          {displayString}
        </span>
      );
    }
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'YES' : 'NO';
    if (col.key.toLowerCase().includes('price') || col.key.toLowerCase().includes('cost') || col.key.toLowerCase().includes('revenue')) {
      return `₹${Number(val).toLocaleString()}`;
    }
    return String(val);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 font-bold tracking-widest uppercase">
          <Icon name={icon || 'chart'} size={15} color="var(--neon-cyan)" />
          {title}
        </div>
        {addable && (
          <button
            onClick={() => {
              setMsg('');
              setShowAdd(true);
            }}
            className="flex items-center gap-1 bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 transition-all text-[11px] font-mono font-bold py-1.5 px-3.5 rounded tracking-wider cursor-pointer shadow-[0_0_12px_rgba(0,245,255,0.08)]"
          >
            <Icon name="plus" size={12} /> ADD ENTRY
          </button>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-slate-950 border border-cyan-500/5 rounded overflow-hidden">
        {loading ? (
          <Spinner />
        ) : !data || data.length === 0 ? (
          <NoData label={`NO RECORDS LOGGED IN ${title}`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cyan-500/5 border-b border-cyan-500/10 text-[9px] text-cyan-400 font-mono tracking-widest uppercase">
                  {columns.map((c) => (
                    <th key={c.key} className="p-3.5">{c.label}</th>
                  ))}
                  <th className="p-3.5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/5 text-xs text-slate-300">
                {data.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-cyan-500/2 transition-colors">
                    {columns.map((c) => (
                      <td key={c.key} className="p-3.5 font-sans">
                        {renderCellContent(c, row)}
                      </td>
                    ))}
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => row.id !== undefined && handleDeleteRecord(row.id)}
                        className="border border-rose-500/20 text-rose-400 hover:border-rose-400 hover:bg-rose-500/5 transition-colors font-mono text-[9px] tracking-widest uppercase py-1 px-2.5 rounded cursor-pointer"
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`ADD NEW ENTRY: ${title}`}>
        <div className="flex flex-col gap-4">
          {Object.keys(defaultForm || {}).map((k) => (
            <div key={k}>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">
                {k.toUpperCase().replace(/_/g, ' ')}
              </label>

              {k.toLowerCase().includes('note') || k.toLowerCase().includes('description') || k.toLowerCase().includes('message') ? (
                <textarea
                  className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2 text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none h-20"
                  value={form[k] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                  placeholder={`Write detailed ${k.replace(/_/g, ' ')}...`}
                />
              ) : k.toLowerCase().includes('status') || k.toLowerCase().includes('result') ? (
                <select
                  className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                  value={form[k] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                >
                  <option value="">— Choose Status —</option>
                  {k.toLowerCase().includes('result')
                    ? ['pending', 'pass', 'fail'].map((s) => (
                        <option key={s} value={s}>{s.toUpperCase()}</option>
                      ))
                    : ['pending', 'active', 'in_progress', 'completed', 'resolved', 'in_stock', 'low', 'out_of_stock'].map((s) => (
                        <option key={s} value={s}>{s.toUpperCase()}</option>
                      ))}
                </select>
              ) : (
                <input
                  className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none font-sans"
                  value={form[k] || ''}
                  onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                  placeholder={`Enter ${k.replace(/_/g, ' ')}`}
                  type={
                    k.includes('date') || k.includes('time')
                      ? k.includes('due') ? 'date' : 'datetime-local'
                      : k.includes('quantity') || k.includes('price') || k.includes('units') || k.includes('cost') || k.includes('hours')
                      ? 'number'
                      : 'text'
                  }
                />
              )}
            </div>
          ))}

          {msg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded text-rose-400 font-mono text-xs">
              {msg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleSaveRecord}
              disabled={saving}
              className="bg-emerald-500/15 border border-emerald-400 text-emerald-400 hover:bg-emerald-500/25 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              {saving ? 'SAVING...' : 'COMMIT RECORD'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="border border-rose-500/30 text-rose-400 hover:bg-rose-500/5 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
