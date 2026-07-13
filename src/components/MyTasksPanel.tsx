import React, { useState, useEffect } from 'react';
import { sb } from '../supabaseClient';
import { AppUser, Task } from '../types';
import { Icon } from './Icons';
import { Spinner, NoData } from './SharedUI';

interface MyTasksPanelProps {
  user: AppUser;
}

export const MyTasksPanel: React.FC<MyTasksPanelProps> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const loadTasks = async () => {
    setLoading(true);
    const { data } = await sb.from<Task>('tasks').select('*', {
      filter: `assigned_to=eq.${user?.user_id}`,
      order: 'created_at.desc',
      limit: 100
    });
    setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  const handleUpdateStatus = async (task: Task, status: 'in_progress' | 'completed') => {
    if (!task.id) return;
    setUpdating(task.id);
    
    const { error } = await sb.from('tasks').update({ status }, { col: 'id', val: task.id });
    
    if (!error && status === 'completed') {
      // Trigger notification for supervisor
      await sb.from('notifications').insert({
        recipient_role: 'supervisor',
        sender_id: user?.user_id,
        sender_name: user?.name,
        title: `✅ Task completed: ${user?.name}`,
        message: `Finished task allocation "${task.task_title}".`,
        type: 'success',
        created_at: new Date().toISOString()
      });
    }

    setUpdating(null);
    loadTasks();
  };

  const priorityBadges = (v: string) => (v === 'high' || v === 'urgent' ? 'offline' : v === 'medium' ? 'warning' : 'online');
  const statusBadges = (v: string) => (v === 'completed' ? 'online' : v === 'in_progress' ? 'warning' : 'offline');

  const displayedTasks = (tasks || []).filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Filtering header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 font-bold tracking-widest uppercase">
          <Icon name="tasks" size={14} color="var(--neon-cyan)" />
          MY ASSIGNED WORK ALLOCATIONS
        </div>
        <div className="flex border border-cyan-500/10 rounded overflow-hidden">
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase transition-colors cursor-pointer ${
                filter === f ? 'bg-cyan-500/20 text-cyan-400' : 'bg-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-950 border border-cyan-500/5 rounded p-5"><Spinner /></div>
      ) : displayedTasks.length === 0 ? (
        <div className="bg-slate-950 border border-cyan-500/5 rounded p-5">
          <NoData label={`NO ${filter.toUpperCase().replace('_', ' ')} TASKS ON FILE`} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedTasks.map((t) => {
            const isExpanded = expanded === t.id;
            return (
              <div key={t.id} className="bg-slate-950 border border-cyan-500/5 rounded overflow-hidden transition-all duration-200">
                {/* Header view */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : (t.id || null))}
                  className="p-4 flex items-center justify-between cursor-pointer gap-4 hover:bg-cyan-500/2 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="text-lg shrink-0">
                      {t.priority === 'high' || t.priority === 'urgent' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢'}
                    </span>
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-semibold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">
                        {t.task_title}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        Due: {t.due_date || 'N/A'} · Coordinator: {t.assigned_by || 'Supervisor'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase ${
                      priorityBadges(t.priority) === 'online'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : priorityBadges(t.priority) === 'offline'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      {t.priority}
                    </span>
                    <span className={`inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase ${
                      statusBadges(t.status) === 'online'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : statusBadges(t.status) === 'offline'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      {(t.status || '').replace('_', ' ')}
                    </span>
                    <span className={`text-slate-500 text-lg transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'none'}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-cyan-500/5 p-5 flex flex-col gap-4 bg-cyan-950/2 animate-fade-up">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                      {[
                        { label: 'ALLOCATION ID', val: t.id?.slice(0, 8) + '...' },
                        { label: 'COORDINATOR ID', val: t.assigned_by },
                        { label: 'DUE DATE', val: t.due_date || '—' },
                        { label: 'PRIORITY LEVEL', val: (t.priority || '').toUpperCase() },
                        { label: 'STATUS', val: (t.status || '').replace('_', ' ').toUpperCase() },
                        { label: 'ASSIGNMENT DATE', val: t.created_at ? new Date(t.created_at).toLocaleDateString() : '—' }
                      ].map(({ label, val }) => (
                        <div key={label} className="bg-cyan-500/3 border border-cyan-500/5 rounded p-3">
                          <div className="text-[9px] font-bold tracking-widest text-slate-500 font-mono uppercase mb-1">{label}</div>
                          <div className="text-xs text-slate-300 font-mono">{val}</div>
                        </div>
                      ))}
                    </div>

                    {t.description && (
                      <div className="bg-cyan-500/3 border border-cyan-500/5 rounded p-4">
                        <div className="text-[9px] font-bold tracking-widest text-slate-500 font-mono uppercase mb-2">ALLOCATION DESCRIPTION</div>
                        <div className="text-xs text-slate-300 leading-relaxed font-sans">{t.description}</div>
                      </div>
                    )}

                    {t.photo_proof_url && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[9px] font-bold tracking-widest text-slate-500 font-mono uppercase">Snapped proof attachment</div>
                        <img
                          src={t.photo_proof_url}
                          alt="Field proof"
                          className="max-w-xs max-h-40 rounded border border-cyan-500/10 object-contain bg-slate-900"
                        />
                        {t.photo_verified && (
                          <div className="text-emerald-400 font-mono text-[10px] uppercase font-bold flex items-center gap-1">
                            ✓ VERIFIED & APPROVED BY TEAM SUPERVISOR
                          </div>
                        )}
                      </div>
                    )}

                    {t.status !== 'completed' && (
                      <div className="flex flex-wrap gap-2.5 pt-2">
                        {t.status === 'pending' && (
                          <button
                            disabled={updating === t.id}
                            onClick={() => handleUpdateStatus(t, 'in_progress')}
                            className="bg-amber-500/15 border border-amber-400 text-amber-400 hover:bg-amber-500/25 transition-all font-mono text-[10px] font-bold py-1.5 px-4 rounded tracking-widest cursor-pointer uppercase"
                          >
                            ▶ ACTIVATE ALLOCATION
                          </button>
                        )}
                        <button
                          disabled={updating === t.id}
                          onClick={() => handleUpdateStatus(t, 'completed')}
                          className="bg-emerald-500/15 border border-emerald-400 text-emerald-400 hover:bg-emerald-500/25 transition-all font-mono text-[10px] font-bold py-1.5 px-4 rounded tracking-widest cursor-pointer uppercase"
                        >
                          ✓ MARK AS COMPLETED
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
