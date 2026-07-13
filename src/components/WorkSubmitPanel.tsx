import React, { useState, useEffect } from 'react';
import { sb } from '../supabaseClient';
import { AppUser, Task } from '../types';
import { Icon } from './Icons';
import { PhotoUpload } from './PhotoUpload';

interface WorkSubmitPanelProps {
  user: AppUser;
}

export const WORK_ACTIVITIES = [
  // OPERATOR
  "VMC-01 Operation", "VMC-02 Operation", "VMC-03 Operation",
  "Helicoil Fitment / Operation", "Tapping Machine Operation",
  "Welding Machine Operation", "Bend Saw Machine Operation",
  "Hydro Test Machine Operation", "Burr Removing Process",
  "Burr Removal on Machine", "Final Inspection", "Oil Inspection",
  "Online Inspection", "Material Loading to Vehicle",
  "Material Unloading from Vehicle", "5S Activity Implementation",
  "Machine Cleaning", "Machine Oil Filling / Maintenance",
  "Cutting Oil Filling in Machine", "Assembly & Weld Fixture Preparation",
  "Material Delivery Outside", "Material Pickup from Outside Party",
  "Burn / Rework Activity", "Bringing Required Tools from Outside",
  "Collection of Payment from Outside Party", "CAM Programming",
  "Filling the Documents", "New Part Setting on VMC",
  "Electricity Off / Electricity On",
  
  // QUALITY / SUPERVISOR
  "Welding Component Inspection", "Online Inspection During Production",
  "Final Part Inspection", "Calibration Report Maintenance",
  "Final Inspection Report Preparation",
  "Pre-Dispatch Inspection (PDI/PDIR) Report Preparation",
  "PDR / Production Deviation Report Handling",
  "Hydro Test Report Preparation", "Hydro Test Support & Verification",
  "Dispatch Report Preparation", "Rework Inspection & Follow-up",
  "Rejection Analysis & Report Preparation",
  "Customer Feedback Monitoring", "Material Delivery Coordination",
  "Record Maintenance & Documentation",
  "Customer Handling / Customer Visit Support",
  "Customer Mail Communication & Reply", "Store Activities Support",
  "Material Follow-up & Tracking", "Support to Welding Team",
  "Support to Production Team", "Maintain Quality Standards & Process Compliance",
  
  // HR / ADMIN
  "Hiring Activity", "HR Activities", "Interview Taken",
  "Freshers Introduction / Onboarding"
];

export const WorkSubmitPanel: React.FC<WorkSubmitPanelProps> = ({ user }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({
    task_id: '',
    task_title: '',
    work_description: '',
    hours_worked: '',
    units_completed: '',
    notes: '',
    photo_url: ''
  });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPendingTasks = async () => {
      const { data } = await sb.from<Task>('tasks').select('*', {
        filter: `assigned_to=eq.${user?.user_id}&status=neq.completed`
      });
      setTasks(data || []);
    };
    fetchPendingTasks();
  }, [user]);

  const handleSelectTask = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tId = e.target.value;
    const task = tasks.find((t) => t.id === tId);
    setForm((p) => ({
      ...p,
      task_id: tId,
      task_title: task?.task_title || ''
    }));
  };

  const handleSubmitReport = async () => {
    if (!form.work_description) {
      setMsg('Please select a specific work activity.');
      return;
    }
    setSaving(true);
    setMsg('');

    try {
      const reportPayload = {
        employee_id: user?.user_id,
        employee_name: user?.name,
        task_id: form.task_id || null,
        task_title: form.task_title || null,
        work_description: form.work_description,
        hours_worked: form.hours_worked ? Number(form.hours_worked) : null,
        units_completed: form.units_completed ? Number(form.units_completed) : null,
        notes: form.notes || null,
        photo_url: form.photo_url || null,
        status: 'pending' as const,
        submitted_at: new Date().toISOString()
      };

      const { error } = await sb.from('work_reports').insert(reportPayload);

      if (error) {
        setMsg('Submission Error: ' + error);
        setSaving(false);
        return;
      }

      // If tied to an active task and photo is attached, flag as in_progress and append proof
      if (form.task_id) {
        const updatePayload: Partial<Task> = { status: 'in_progress' };
        if (form.photo_url) {
          updatePayload.photo_proof_url = form.photo_url;
        }
        await sb.from('tasks').update(updatePayload, { col: 'id', val: form.task_id });
      }

      // Notify supervisors
      await sb.from('notifications').insert({
        recipient_role: 'supervisor',
        sender_id: user?.user_id,
        sender_name: user?.name,
        title: `📤 Work report logged: ${user?.name}`,
        message: `Logged ${form.work_description} | Hrs: ${form.hours_worked || '—'} | Qty: ${form.units_completed || '—'}`,
        type: 'work',
        created_at: new Date().toISOString()
      });

      setMsg('✅ Work report submitted to your supervisor successfully!');
      setForm({
        task_id: '',
        task_title: '',
        work_description: '',
        hours_worked: '',
        units_completed: '',
        notes: '',
        photo_url: ''
      });
    } catch (err: any) {
      console.error(err);
      setMsg('Failed to submit: ' + (err?.message || String(err)));
    }
    setSaving(false);
  };

  return (
    <div className="bg-slate-950 border border-cyan-500/5 rounded p-6 max-w-2xl relative">
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
      <div className="font-mono text-[10px] font-bold tracking-widest text-cyan-400 uppercase mb-5 flex items-center gap-1.5">
        <Icon name="upload" size={14} color="var(--neon-cyan)" />
        LOG OPERATIONAL WORK REPORT
      </div>

      <div className="flex flex-col gap-4">
        {/* Linked Task Selector */}
        <div>
          <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">
            LINK WORK TO ASSIGNED WORK ALLOCATION (OPTIONAL)
          </label>
          <select
            className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-xs text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
            value={form.task_id}
            onChange={handleSelectTask}
          >
            <option value="">— Independent Work (No linked assignment) —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.task_title} · Due: {t.due_date || 'N/A'} · [{t.priority?.toUpperCase()}]
              </option>
            ))}
          </select>
        </div>

        {/* Work activities */}
        <div>
          <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">
            SPECIFIC OPERATION LOG ACTIVITY *
          </label>
          <select
            className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-xs text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
            value={form.work_description}
            onChange={(e) => setForm((p) => ({ ...p, work_description: e.target.value }))}
          >
            <option value="">— Choose Operational Activity —</option>
            <optgroup label="── VMC / OPERATOR CONTROLS ──" className="font-sans font-bold text-cyan-400">
              {WORK_ACTIVITIES.slice(0, 29).map((a) => (
                <option key={a} value={a} className="text-slate-100 font-normal">{a}</option>
              ))}
            </optgroup>
            <optgroup label="── QUALITY ASSURANCE & MONITORING ──" className="font-sans font-bold text-emerald-400">
              {WORK_ACTIVITIES.slice(29, 51).map((a) => (
                <option key={a} value={a} className="text-slate-100 font-normal">{a}</option>
              ))}
            </optgroup>
            <optgroup label="── CORPORATE HR / ADMINISTRATIVE ──" className="font-sans font-bold text-amber-400">
              {WORK_ACTIVITIES.slice(51).map((a) => (
                <option key={a} value={a} className="text-slate-100 font-normal">{a}</option>
              ))}
            </optgroup>
          </select>
          {form.work_description && (
            <div className="mt-2.5 p-2.5 bg-cyan-500/5 border border-cyan-500/10 rounded font-mono text-[11px] text-cyan-400 flex items-center gap-1.5 animate-fade-up">
              <Icon name="check" size={12} color="var(--neon-cyan)" /> Checked: <strong className="text-slate-100 font-semibold">{form.work_description}</strong>
            </div>
          )}
        </div>

        {/* Hour / units input */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">DURATION (HOURS LOGGED)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none placeholder-slate-600"
              value={form.hours_worked}
              onChange={(e) => setForm((p) => ({ ...p, hours_worked: e.target.value }))}
              placeholder="e.g., 7.5"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">OUTPUT LOG (UNITS COMPLETED)</label>
            <input
              type="number"
              min="0"
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none placeholder-slate-600"
              value={form.units_completed}
              onChange={(e) => setForm((p) => ({ ...p, units_completed: e.target.value }))}
              placeholder="e.g., 35"
            />
          </div>
        </div>

        {/* Narrative */}
        <div>
          <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ADDITIONAL DISPATCH REMARKS</label>
          <textarea
            className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2 text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none h-16 placeholder-slate-600"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Notes regarding job execution, tools required, or material remarks..."
          />
        </div>

        {/* Image proof upload */}
        <PhotoUpload onUpload={(url) => setForm((p) => ({ ...p, photo_url: url }))} label="ATTACH CAM WORK PROOF (REQUIRED FOR VERIFIED STATUS)" />

        {/* Status notification */}
        {msg && (
          <div
            className={`p-3 font-mono text-xs rounded border ${
              msg.startsWith('✅')
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
            }`}
          >
            {msg}
          </div>
        )}

        <button
          onClick={handleSubmitReport}
          disabled={saving}
          className="bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-50 transition-all font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase shadow-[0_0_12px_rgba(0,245,255,0.05)]"
        >
          {saving ? 'TRANSMITTING OPERATION REMARKS...' : 'SUBMIT PRODUCTION WORK REPORT'}
        </button>
      </div>
    </div>
  );
};
