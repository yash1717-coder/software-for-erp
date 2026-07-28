import React, { useState, useEffect } from 'react';
import { askAI } from '../aiClient';
import { sb } from '../supabaseClient';
import { Icon } from './Icons';

interface AIHistoryItem {
  id?: string;
  q: string;
  a: string;
  timestamp: string;
}

export const AIInsights: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<AIHistoryItem[]>([]);
  const [context, setContext] = useState<any | null>(null);

  const presets = [
    'Analyze production efficiency and suggest improvements',
    'Identify inventory bottlenecks and reorder recommendations',
    'Evaluate workforce productivity trends',
    'Predict equipment downtime risks',
    'Generate a weekly manufacturing performance summary'
  ];

  // Load persistent AI history from DB and LocalStorage
  const loadHistory = async () => {
    let combined: AIHistoryItem[] = [];

    // 1. Check LocalStorage history
    try {
      const stored = localStorage.getItem('infiev_ai_chat_history');
      if (stored) {
        combined = JSON.parse(stored);
      }
    } catch {
      // ignore
    }

    // 2. Fetch DB history
    try {
      const { data } = await sb.from('messages').select('*', {
        filter: 'room=eq.ai_insights',
        order: 'created_at.asc',
        limit: 50
      });

      if (data && data.length) {
        const dbItems: AIHistoryItem[] = data.map((m: any) => {
          try {
            const parsed = JSON.parse(m.content);
            return {
              id: m.id,
              q: parsed.q || m.content,
              a: parsed.a || '',
              timestamp: m.created_at || new Date().toISOString()
            };
          } catch {
            return {
              id: m.id,
              q: m.content,
              a: '',
              timestamp: m.created_at || new Date().toISOString()
            };
          }
        });

        // Merge DB items with LocalStorage, deduplicating by Q&A
        const existingMap = new Map<string, AIHistoryItem>();
        combined.forEach(item => existingMap.set(item.q + '|' + item.a.substring(0, 30), item));
        dbItems.forEach(item => existingMap.set(item.q + '|' + item.a.substring(0, 30), item));

        combined = Array.from(existingMap.values()).sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }
    } catch (e) {
      console.warn("DB history fetch failed:", e);
    }

    setHistory(combined);
  };

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save history item to LocalStorage and DB
  const saveHistoryItem = async (q: string, a: string) => {
    const newItem: AIHistoryItem = {
      q,
      a,
      timestamp: new Date().toISOString()
    };

    const updated = [...history, newItem];
    setHistory(updated);

    try {
      localStorage.setItem('infiev_ai_chat_history', JSON.stringify(updated));
    } catch {
      // ignore
    }

    try {
      await sb.from('messages').insert({
        sender_id: 'user',
        recipient_id: 'ai_assistant',
        room: 'ai_insights',
        content: JSON.stringify({ q, a }),
        created_at: newItem.timestamp
      });
    } catch (e) {
      console.warn("Save history to DB failed:", e);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('infiev_ai_chat_history');
    } catch {
      // ignore
    }
  };

  // Dynamically load active Supabase database records to ground reasoning
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
    setResponse(res);
    setLoading(false);
    if (!overridePrompt) {
      setPrompt('');
    }

    await saveHistoryItem(question, res);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      {/* Sidebar presets */}
      <div className="bg-slate-950 border border-cyan-500/10 rounded-lg p-4 h-fit md:col-span-1 relative shadow-lg">
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40 rounded-tl" />
        <div className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-4 flex items-center justify-between">
          <span>PRESET REPORT SCRIPTS</span>
        </div>
        <div className="flex flex-col gap-1.5 divide-y divide-cyan-500/10 text-xs text-slate-300 font-sans">
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => handleAskAI(p)}
              disabled={loading}
              className="text-left py-2.5 px-2 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all rounded cursor-pointer leading-relaxed group flex items-start gap-2"
            >
              <span className="text-cyan-500/60 font-mono text-[10px] mt-0.5 group-hover:text-cyan-400">0{i+1}.</span>
              <span>{p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat log */}
      <div className="md:col-span-3 flex flex-col gap-5">
        {/* Ask Bar */}
        <div className="bg-slate-950 border border-cyan-500/10 rounded-lg p-4 relative shadow-lg">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40 rounded-tl" />
          <div className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="ai" size={14} color="var(--neon-cyan)" />
              <span>INFIEV AI MANUFACTURING INTELLIGENCE COMMAND</span>
            </div>
            <span className="text-[9px] text-emerald-400 font-mono tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
              ONLINE
            </span>
          </div>
          <div className="flex gap-2 w-full">
            <input
              className="bg-cyan-500/5 border border-cyan-500/15 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none placeholder-slate-500 transition-all"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Query factory intelligence (e.g., 'Summarize current VMC workload'...)"
              onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
              disabled={loading}
            />
            <button
              onClick={() => handleAskAI()}
              disabled={loading || !prompt.trim()}
              className="shrink-0 bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-40 transition-all font-mono text-xs font-bold px-6 rounded tracking-wider cursor-pointer uppercase shadow-[0_0_12px_rgba(0,245,255,0.1)] flex items-center gap-2"
            >
              <Icon name="ai" size={14} color="var(--neon-cyan)" />
              {loading ? 'ANALYZING...' : 'ANALYZE'}
            </button>
          </div>
        </div>

        {/* Loading placeholder */}
        {loading && (
          <div className="bg-slate-950 border border-cyan-500/15 rounded-lg p-6 text-center shadow-lg animate-pulse">
            <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase flex items-center justify-center gap-2">
              <span className="animate-spin text-sm">◈</span>
              RE-INDEXING ENTERPRISE KNOWLEDGE BASE & RUNNING COGNITIVE INFERENCE...
            </div>
          </div>
        )}

        {/* Active Analysis Panel */}
        {response && !loading && (
          <div className="bg-slate-950 border border-cyan-500/15 rounded-lg p-5 relative shadow-xl animate-fade-up">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40 rounded-tl" />
            <div className="font-mono text-[9px] font-bold tracking-widest text-emerald-400 uppercase mb-3 flex items-center justify-between">
              <span>◈ LATEST ANALYSIS RESULTS</span>
              <span className="text-slate-500">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap p-4 rounded border bg-cyan-500/5 border-cyan-500/10 text-slate-100 shadow-inner">
              {response}
            </div>
          </div>
        )}

        {/* Historical interactions list */}
        {history.length > 0 && (
          <div className="bg-slate-950 border border-cyan-500/10 rounded-lg p-5 relative shadow-lg">
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-500/40 rounded-tl" />
            <div className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono">[{history.length}]</span>
                <span>AI CHAT & COMMAND HISTORY</span>
              </span>
              <button
                onClick={clearHistory}
                className="text-[9px] text-rose-400 hover:text-rose-300 hover:underline uppercase tracking-wider font-mono cursor-pointer"
              >
                Clear History
              </button>
            </div>
            <div className="flex flex-col gap-4 max-h-[450px] overflow-y-auto pr-1 divide-y divide-cyan-500/10">
              {[...history].reverse().map((h, i) => (
                <div key={h.id || i} className="pt-4 first:pt-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[12px] text-cyan-300 font-mono font-bold flex items-center gap-2">
                      <span className="text-cyan-500/70 text-[10px]">▶</span>
                      <span>QUERY: {h.q}</span>
                    </div>
                    {h.timestamp && (
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-200 font-mono mt-1.5 bg-slate-900/60 border border-cyan-500/10 p-3.5 rounded-lg whitespace-pre-wrap leading-relaxed shadow-sm">
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
