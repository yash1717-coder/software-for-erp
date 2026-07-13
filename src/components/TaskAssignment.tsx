import React, { useState, useEffect } from 'react';
import { sb } from '../supabaseClient';
import { AppUser, Task } from '../types';
import { Icon } from './Icons';
import { Spinner, NoData, Modal } from './SharedUI';

interface TaskAssignmentProps {
  user: AppUser;
}

export const TaskAssignment: React.FC<TaskAssignmentProps> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Task | null>(null);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  
  const [form, setForm] = useState({
    task_title: '',
    assigned_to: '',
    assigned_to_name: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'pending' as 'pending' | 'in_progress' | 'completed',
    due_date: '',
    description: '',
    assigned_by: user?.user_id || ''
  });

  const [editForm, setEditForm] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showVerify, setShowVerify] = useState<Task | null>(null);

  const loadAssignmentsAndStaff = async () => {
    setLoading(true);
    const [tRes, eRes] = await Promise.all([
      sb.from<Task>('tasks').select('*', { order: 'created_at.desc', limit: 100 }),
      sb.from<AppUser>('app_users').select('user_id,name,department', {
        filter: 'role=eq.employee&is_active=eq.true'
      })
    ]);

    setTasks(tRes.data);
    setEmployees(eRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadAssignmentsAndStaff();
  }, [user]);

  const handleSaveTask = async () => {
    if (!form.task_title.trim()) {
      setMsg('Please fill in a descriptive task title.');
      return;
    }
    if (!form.assigned_to) {
      setMsg('Please assign an employee.');
      return;
    }

    setSaving(true);
    setMsg('');

    const payload: Partial<Task> = {
      ...form,
      created_at: new Date().toISOString()
    };

    const { error } = await sb.from('tasks').insert(payload);
    
    if (error) {
      setMsg('Error saving task: ' + error);
      setSaving(false);
      return;
    }

    // Trigger alerts to recipient employee
    await sb.from('notifications').insert({
      recipient_id: form.assigned_to,
      recipient_role: 'employee',
      sender_id: user?.user_id,
      sender_name: user?.name,
      title: '📋 New Work Task Assigned',
      message: `"${form.task_title}" — Priority: ${form.priority.toUpperCase()} | Due: ${form.due_date || 'TBD'}`,
      type: 'task',
      created_at: new Date().toISOString()
    });

    setSaving(false);
    setShowAdd(false);
    setForm({
      task_title: '',
      assigned_to: '',
      assigned_to_name: '',
      priority: 'medium',
      status: 'pending',
      due_date: '',
      description: '',
      assigned_by: user?.user_id || ''
    });
    loadAssignmentsAndStaff();
  };

  const handleSaveEdit = async () => {
    if (!editForm.id) return;
    setSaving(true);

    const { error } = await sb.from('tasks').update({
      task_title: editForm.task_title,
      priority: editForm.priority,
      status: editForm.status,
      due_date: editForm.due_date,
      description: editForm.description
    }, { col: 'id', val: editForm.id });

    if (!error) {
      await sb.from('notifications').insert({
        recipient_id: editForm.assigned_to,
        recipient_role: 'employee',
        sender_id: user?.user_id,
        sender_name: user?.name,
        title: '✏️ Task Assignment Modified',
        message: `"${editForm.task_title}" has been updated. Status: ${editForm.status?.toUpperCase()}`,
        type: 'task',
        created_at: new Date().toISOString()
      });
    }

    setSaving(false);
    setShowEdit(null);
    loadAssignmentsAndStaff();
  };

  const handleVerifyPhoto = async (task: Task, approved: boolean) => {
    if (!task.id) return;

    await sb.from('tasks').update({
      photo_verified: approved,
      verified_by: user?.user_id,
      verified_at: new Date().toISOString(),
      status: approved ? 'completed' : 'pending'
    }, { col: 'id', val: task.id });

    // Inform employee of decision
    await sb.from('notifications').insert({
      recipient_id: task.assigned_to,
      recipient_role: 'employee',
      sender_id: user?.user_id,
      sender_name: user?.name,
      title: approved ? '✅ Task Approved & Verified' : '⚠️ Task Photo Rejected',
      message: approved
        ? `Your completed photo proof for "${task.task_title}" has been approved!`
        : `Your submission for "${task.task_title}" needs adjustments. Please check remarks and resubmit.`,
      type: approved ? 'success' : 'warning',
      created_at: new Date().toISOString()
    });

    setShowVerify(null);
    loadAssignmentsAndStaff();
  };

  const handleDeleteTask = async (id: string | number) => {
    if (!window.confirm('Delete this task?')) return;
    await sb.from('tasks').delete({ col: 'id', val: id });
    loadAssignmentsAndStaff();
  };

  const handleEmployeeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUserId = e.target.value;
    const empObj = employees.find((x) => x.user_id === selectedUserId);
    setForm((p) => ({
      ...p,
      assigned_to: selectedUserId,
      assigned_to_name: empObj?.name || ''
    }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400 font-bold tracking-widest uppercase">
          <Icon name="tasks" size={15} color="var(--neon-cyan)" />
          TEAM OPERATIONS TASKS
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 transition-all text-xs font-mono font-bold py-1.5 px-4 rounded tracking-wider cursor-pointer shadow-[0_0_12px_rgba(0,245,255,0.08)]"
        >
          <Icon name="plus" size={12} /> ASSIGN WORK
        </button>
      </div>

      <div className="bg-slate-950 border border-cyan-500/5 rounded overflow-hidden">
        {loading ? (
          <Spinner />
        ) : !tasks || tasks.length === 0 ? (
          <NoData label="NO ACTIVE WORK ASSIGNED" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cyan-500/5 border-b border-cyan-500/10 text-[9px] text-cyan-400 font-mono tracking-widest uppercase">
                  <th className="p-4">TASK DETAILS</th>
                  <th className="p-4">ASSIGNED STAFF</th>
                  <th className="p-4">PRIORITY</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4">DUE DATE</th>
                  <th className="p-4">FIELD PROOF</th>
                  <th className="p-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/5 text-xs text-slate-300">
                {tasks.map((t, i) => (
                  <tr key={t.id || i} className="hover:bg-cyan-500/2 transition-colors">
                    <td className="p-4 max-w-xs">
                      <div className="font-semibold text-slate-100">{t.task_title}</div>
                      <div className="text-[10px] text-slate-500 truncate mt-1">{t.description || 'No description logged.'}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-cyan-400 font-bold text-xs">{t.assigned_to}</div>
                      <div className="text-slate-400 text-xs mt-0.5">{t.assigned_to_name}</div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase ${
                          t.priority === 'urgent' || t.priority === 'high'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            : t.priority === 'medium'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase ${
                          t.status === 'completed'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : t.status === 'in_progress'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}
                      >
                        {t.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-400">{t.due_date || '—'}</td>
                    <td className="p-4">
                      {t.photo_proof_url ? (
                        t.photo_verified ? (
                          <span className="inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
                            ✓ VERIFIED
                          </span>
                        ) : (
                          <button
                            onClick={() => setShowVerify(t)}
                            className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400 text-amber-400 font-mono text-[9px] tracking-widest uppercase px-2 py-1 rounded cursor-pointer animate-pulse"
                          >
                            REVIEW PROOF
                          </button>
                        )
                      ) : (
                        <span className="text-slate-600 font-mono text-[10px]">NO PROOF</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button
                          onClick={() => {
                            setEditForm({ ...t });
                            setShowEdit(t);
                          }}
                          className="border border-amber-500/20 text-amber-400 hover:border-amber-400 hover:bg-amber-500/5 transition-colors font-mono text-[9px] tracking-widest uppercase py-1 px-2.5 rounded cursor-pointer"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => t.id && handleDeleteTask(t.id)}
                          className="border border-rose-500/20 text-rose-400 hover:border-rose-400 hover:bg-rose-500/5 transition-colors font-mono text-[9px] tracking-widest uppercase py-1 px-2.5 rounded cursor-pointer"
                        >
                          DELETE
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ASSIGN MODAL */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="ALLOCATE NEW TEAM TASK">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ALLOCATION TITLE *</label>
            <input
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none"
              value={form.task_title}
              onChange={(e) => setForm((p) => ({ ...p, task_title: e.target.value }))}
              placeholder="e.g., Run QC calibration on VMC-02"
            />
          </div>

          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">CHOOSE RESPONSIBLE STAFF ENTRY *</label>
            <select
              className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
              value={form.assigned_to}
              onChange={handleEmployeeSelect}
            >
              <option value="">— Select Personnel —</option>
              {employees.map((e) => (
                <option key={e.user_id} value={e.user_id}>
                  {e.user_id} — {e.name} ({e.department || 'All'})
                </option>
              ))}
            </select>
            {form.assigned_to && (
              <div className="mt-2 font-mono text-[11px] text-emerald-400">
                ✓ Target Staff: {form.assigned_to_name} ({form.assigned_to})
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">PRIORITY LEVEL</label>
              <select
                className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as any }))}
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
                <option value="urgent">URGENT</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">DUE DATE</label>
              <input
                type="date"
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">NARRATIVE DESCRIPTION</label>
            <textarea
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none h-20"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Task coordinates, material batch reference details..."
            />
          </div>

          {msg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded text-rose-400 font-mono text-xs">
              {msg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleSaveTask}
              disabled={saving}
              className="bg-emerald-500/15 border border-emerald-400 text-emerald-400 hover:bg-emerald-500/25 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              {saving ? 'SAVING...' : 'COMMIT ALLOCATION'}
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

      {/* EDIT MODAL */}
      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title={`EDIT TASK ALLOCATION`}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ALLOCATION TITLE</label>
            <input
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none"
              value={editForm.task_title || ''}
              onChange={(e) => setEditForm((p) => ({ ...p, task_title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">PRIORITY</label>
              <select
                className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-xs text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                value={editForm.priority || 'medium'}
                onChange={(e) => setEditForm((p) => ({ ...p, priority: e.target.value as any }))}
              >
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
                <option value="urgent">URGENT</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">STATUS</label>
              <select
                className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-xs text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                value={editForm.status || 'pending'}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as any }))}
              >
                <option value="pending">PENDING</option>
                <option value="in_progress">IN PROGRESS</option>
                <option value="completed">COMPLETED</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">DUE DATE</label>
              <input
                type="date"
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-2.5 py-2 text-xs text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                value={editForm.due_date || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, due_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">NARRATIVE DETAILS</label>
            <textarea
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none h-20"
              value={editForm.description || ''}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              {saving ? 'UPDATING...' : 'SAVE REVISIONS'}
            </button>
            <button
              onClick={() => setShowEdit(null)}
              className="border border-rose-500/30 text-rose-400 hover:bg-rose-500/5 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      </Modal>

      {/* VERIFY PROOF MODAL */}
      {showVerify && (
        <Modal open={!!showVerify} onClose={() => setShowVerify(null)} title={`VERIFY COMPLETED PHOTO PROOF`}>
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-cyan-950/15 border border-cyan-500/10 rounded text-xs text-slate-300 font-mono">
              Staff Member: <span className="text-cyan-400">{showVerify.assigned_to_name} ({showVerify.assigned_to})</span>
            </div>

            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">SUBMITTED FIELD ATTACHMENT</label>
              <img
                src={showVerify.photo_proof_url}
                alt="Verification Proof"
                className="w-full max-h-72 object-contain border border-cyan-500/10 rounded bg-slate-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => handleVerifyPhoto(showVerify, true)}
                className="bg-emerald-500/15 border border-emerald-400 text-emerald-400 hover:bg-emerald-500/25 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
              >
                ✓ APPROVE & COMPLETE
              </button>
              <button
                onClick={() => handleVerifyPhoto(showVerify, false)}
                className="border border-rose-500/30 text-rose-400 hover:bg-rose-500/5 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
              >
                ✗ REJECT PROOF
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
