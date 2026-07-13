import React, { useState } from 'react';
import { askAI } from '../aiClient';
import { sb } from '../supabaseClient';
import { Icon } from './Icons';

export const AIInsights: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const [context, setContext] = useState<any | null>(null);

  const presets = [
    'Analyze production efficiency and suggest improvements',
    'Identify inventory bottlenecks and reorder recommendations',
    'Evaluate workforce productivity trends',
    'Predict equipment downtime risks',
    'Generate a weekly manufacturing performance summary'
  ];

  // Dynamically load active Supabase database records to ground Groq's reasoning
  const fetchBusinessContext = async () => {
    try {
      const [prod, inv, tasks, elec] = await Promise.all([
        sb.from('production_orders').select('status,quantity,product_name', { limit: 20 }),
        sb.from('inventory_items').select('item_name,quantity,min_stock', { limit: 20 }),
        sb.from('tasks').select('status,priority', { limit: 20 }),
        sb.from('electricity_downtimes').select('duration_hours,status', { limit: 10 })
      ]);
      return {
        production: prod.data || [],
        inventory: inv.data || [],
        tasks: tasks.data || [],
        electricity: elec.data || []
      };
    } catch (err) {
      console.error("Context gather failed:", err);
      return null;
    }
  };

  const handleAskAI = async (overridePrompt?: string) => {
    const question = (overridePrompt || prompt).trim();
    if (!question) return;

    setLoading(true);
    setResponse('');

    let ctx = context;
    if (!ctx) {
      ctx = await fetchBusinessContext();
      setContext(ctx);
    }

    const res = await askAI(question, ctx);
    setHistory((h) => [...h, { q: question, a: res }]);
    setResponse(res);
    setLoading(false);
    if (!overridePrompt) {
      setPrompt('');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      {/* Sidebar presets */}
      <div className="bg-slate-950 border border-cyan-500/5 rounded p-4 h-fit md:col-span-1 relative">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
        <div className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-4">
          PRESET REPORT SCRIPTS
        </div>
        <div className="flex flex-col gap-1 divide-y divide-cyan-500/5 text-xs text-slate-400 font-sans">
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => handleAskAI(p)}
              disabled={loading}
              className="text-left py-2.5 px-1 hover:text-cyan-400 hover:bg-cyan-500/2 transition-colors cursor-pointer leading-relaxed"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main chat log */}
      <div className="md:col-span-3 flex flex-col gap-4">
        {/* Ask Bar */}
        <div className="bg-slate-950 border border-cyan-500/5 rounded p-4 relative">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
          <div className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-3 flex items-center gap-1.5">
            <Icon name="ai" size={14} color="var(--neon-cyan)" />
            INFIEV LLaMA-3.3 INTELLIGENCE COMMAND
          </div>
          <div className="flex gap-2 w-full">
            <input
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none placeholder-slate-600"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Query factory intelligence (e.g., 'Summarize current VMC workload'...)"
              onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              disabled={loading}
            />
            <button
              onClick={() => handleAskAI()}
              disabled={loading || !prompt.trim()}
              className="shrink-0 bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-50 transition-all font-mono text-xs font-bold px-5 rounded tracking-wider cursor-pointer uppercase shadow-[0_0_12px_rgba(0,245,255,0.05)]"
            >
              {loading ? 'ANALYZING...' : 'ANALYZE'}
            </button>
          </div>
        </div>

        {/* Loading placeholder */}
        {loading && (
          <div className="bg-slate-950 border border-cyan-500/5 rounded p-6 text-center">
            <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">
              ◈ RE-INDEXING ENTERPRISE KNOWLEDGE BASE & RUNNING COGNITIVE INFERENCE...
            </div>
          </div>
        )}

        {/* Active Analysis Panel */}
        {response && !loading && (
          <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 relative animate-fade-up">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
            <div
              className={`font-mono text-[9px] font-bold tracking-widest uppercase mb-3 ${
                response.startsWith('❌') ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              ◈ COGNITIVE INFERENCE COMPLETED
            </div>
            <div
              className={`font-mono text-xs leading-relaxed whitespace-pre-wrap p-4 rounded border ${
                response.startsWith('❌')
                  ? 'bg-rose-500/5 border-rose-500/15 text-rose-400'
                  : 'bg-cyan-500/2 border-cyan-500/5 text-slate-200'
              }`}
            >
              {response}
            </div>
          </div>
        )}

        {/* Historical interactions list */}
        {history.length > 0 && (
          <div className="bg-slate-950 border border-cyan-500/5 rounded p-5 relative">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-slate-700" />
            <div className="font-mono text-[9px] font-bold tracking-widest text-slate-500 uppercase mb-4">
              COMMAND HISTORY
            </div>
            <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto divide-y divide-cyan-500/5">
              {[...history].reverse().map((h, i) => (
                <div key={i} className="pt-3 first:pt-0">
                  <div className="text-[11px] text-cyan-400 font-mono font-bold">QUERY: {h.q}</div>
                  <div className="text-[11px] text-slate-300 font-mono mt-2 bg-slate-900/30 border border-slate-900 p-3 rounded whitespace-pre-wrap leading-relaxed">
                    {h.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
