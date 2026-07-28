import React, { useState, useEffect } from 'react';
import { sb } from '../supabaseClient';
import { AppUser } from '../types';
import { Icon } from './Icons';
import { Modal, PwdInput, Spinner, NoData } from './SharedUI';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  
  // Create user form
  const [form, setForm] = useState({
    user_id: '',
    name: '',
    password: '',
    role: 'employee' as 'employee' | 'supervisor' | 'admin',
    department: '',
    contact: '',
    is_active: true
  });

  // Edit user form
  const [editForm, setEditForm] = useState<Partial<AppUser>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState<'all' | 'supervisor' | 'employee' | 'admin'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = async () => {
    if (users === null) {
      setLoading(true);
    }
    const { data, error } = await sb.from<AppUser>('app_users').select('*', {
      order: 'created_at.desc'
    });
    if (!error && data) {
      // Normalize user records to have both name and full_name
      const normalized = data.map((u: any) => ({
        ...u,
        name: u.name || u.full_name || u.user_id || 'User',
        full_name: u.full_name || u.name || u.user_id || 'User',
        department: u.department || '',
        contact: u.contact || u.email || ''
      }));
      setUsers(normalized);
    } else {
      if (users === null) setUsers([]);
      console.error("Error loading users:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!form.user_id.trim() || !form.password || !form.name.trim()) {
      setMsg('User ID, Name and Password are required.');
      return;
    }
    setSaving(true);
    setMsg('');

    const payload: any = {
      user_id: form.user_id.trim(),
      name: form.name.trim(),
      full_name: form.name.trim(),
      password: form.password,
      role: form.role,
      department: form.department.trim(),
      contact: form.contact.trim(),
      is_active: true,
      created_at: new Date().toISOString()
    };

    const { error } = await sb.from('app_users').insert(payload);
    setSaving(false);

    if (error) {
      setMsg('Error creating account: ' + error);
      return;
    }

    setShowAdd(false);
    setForm({
      user_id: '',
      name: '',
      password: '',
      role: 'employee',
      department: '',
      contact: '',
      is_active: true
    });
    loadUsers();
  };

  const handleUpdateUser = async () => {
    if (!editForm.user_id) return;
    setSaving(true);
    setMsg('');

    const payload: any = {
      name: editForm.name?.trim(),
      full_name: editForm.name?.trim(),
      department: editForm.department?.trim(),
      contact: editForm.contact?.trim(),
      role: editForm.role,
      is_active: editForm.is_active,
    };

    if (editForm.password) {
      payload.password = editForm.password;
    }

    const { error } = await sb.from('app_users').update(payload, { col: 'user_id', val: editForm.user_id });
    setSaving(false);

    if (error) {
      setMsg('Error updating user: ' + error);
      return;
    }

    setShowEdit(false);
    setEditUser(null);
    loadUsers();
  };

  const toggleUserActiveStatus = async (user: AppUser) => {
    if (!user.user_id) return;
    await sb.from('app_users').update({ is_active: !user.is_active }, { col: 'user_id', val: user.user_id });
    loadUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId) return;
    if (!window.confirm(`Are you absolutely sure you want to permanently delete user "${userId}"? This action cannot be undone.`)) {
      return;
    }
    const { error } = await sb.from('app_users').delete({ col: 'user_id', val: userId });
    if (error) {
      alert('Failed to delete user: ' + error);
    } else {
      loadUsers();
    }
  };

  const openEditModal = (user: AppUser) => {
    setEditUser(user);
    setEditForm({ ...user, password: '' });
    setMsg('');
    setShowEdit(true);
  };

  // Filter and Search logic
  const displayedUsers = (users || []).filter((u) => {
    if (!u) return false;
    const matchesFilter = filter === 'all' ? true : u.role === filter;
    const searchLower = (searchQuery || '').toLowerCase();
    const userName = (u.name || u.full_name || '').toLowerCase();
    const userId = (u.user_id || '').toLowerCase();
    const dept = (u.department || '').toLowerCase();
    const matchesSearch =
      userName.includes(searchLower) ||
      userId.includes(searchLower) ||
      dept.includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon name="shield" size={18} color="var(--neon-cyan)" />
          <span className="font-mono text-sm tracking-widest text-cyan-400 font-bold uppercase">
            User Access Control
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-1.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-400 outline-none w-48"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex border border-cyan-500/10 rounded overflow-hidden">
            {(['all', 'admin', 'supervisor', 'employee'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r)}
                className={`px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase transition-colors cursor-pointer ${
                  filter === r
                    ? 'bg-cyan-500/20 text-cyan-400 border-r border-cyan-500/20 last:border-0'
                    : 'bg-transparent text-slate-400 hover:text-slate-200 border-r border-cyan-500/10 last:border-0'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setMsg('');
              setShowAdd(true);
            }}
            className="flex items-center gap-1.5 bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 transition-all text-xs font-mono font-bold py-1.5 px-4 rounded tracking-wider cursor-pointer shadow-[0_0_15px_rgba(0,245,255,0.1)]"
          >
            <Icon name="plus" size={12} /> CREATE USER
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-cyan-950/10 border border-cyan-500/15 rounded p-4 flex gap-3.5 items-start">
        <Icon name="key" size={16} color="var(--neon-cyan)" className="shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed font-mono">
          As an Administrator, you can manage access credentials. Supervisors and employees log into the platform utilizing the unique <span className="text-cyan-400 font-bold">User ID</span> and <span className="text-cyan-400 font-bold">Password</span> established here. Access is strictly disabled if account status is set to inactive.
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-950 border border-cyan-500/5 rounded overflow-hidden">
        {loading ? (
          <Spinner />
        ) : displayedUsers.length === 0 ? (
          <NoData label="NO USERS CONFIGURED" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-cyan-500/5 border-b border-cyan-500/10 text-[10px] text-cyan-400 font-mono tracking-widest uppercase">
                  <th className="p-4">USER ID</th>
                  <th className="p-4">NAME</th>
                  <th className="p-4">ROLE</th>
                  <th className="p-4">DEPARTMENT</th>
                  <th className="p-4">CONTACT INFO</th>
                  <th className="p-4">STATUS</th>
                  <th className="p-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/5 font-sans text-sm text-slate-300">
                {displayedUsers.map((u, i) => (
                  <tr key={u.id || i} className="hover:bg-cyan-500/2 transition-colors">
                    <td className="p-4">
                      <span className="font-mono text-xs font-semibold text-cyan-400 bg-cyan-950/20 border border-cyan-500/10 px-2 py-0.5 rounded">
                        {u.user_id}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-slate-200">{u.name || u.full_name || '—'}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase ${
                          u.role === 'admin'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : u.role === 'supervisor'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">{u.department || '—'}</td>
                    <td className="p-4 text-slate-400 font-mono text-xs">{u.contact || '—'}</td>
                    <td className="p-4">
                      <span
                        className={`inline-block font-mono text-[9px] tracking-widest px-2 py-0.5 rounded border uppercase ${
                          u.is_active
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}
                      >
                        {u.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2 shrink-0">
                        <button
                          onClick={() => openEditModal(u)}
                          className="flex items-center gap-1 border border-amber-500/25 hover:border-amber-400 hover:bg-amber-500/5 transition-colors text-amber-400 font-mono text-[10px] tracking-widest uppercase py-1 px-2.5 rounded cursor-pointer"
                        >
                          <Icon name="edit" size={10} /> EDIT
                        </button>
                        <button
                          onClick={() => toggleUserActiveStatus(u)}
                          className={`font-mono text-[10px] tracking-widest uppercase py-1 px-2.5 rounded border cursor-pointer transition-colors ${
                            u.is_active
                              ? 'border-rose-500/25 text-rose-400 hover:bg-rose-500/5 hover:border-rose-400'
                              : 'border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/5 hover:border-emerald-400'
                          }`}
                        >
                          {u.is_active ? 'DISABLE' : 'ENABLE'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.user_id)}
                          className="border border-rose-500/25 hover:border-rose-500 hover:bg-rose-500/10 transition-colors text-rose-400 font-mono text-[10px] tracking-widest uppercase py-1 px-2.5 rounded cursor-pointer"
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

      {/* CREATE MODAL */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="CREATE NEW SECURITY ACCOUNT">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">USER ID (LOGIN KEY) *</label>
              <input
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none"
                value={form.user_id}
                onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
                placeholder="e.g., operator_01, sup_sharma"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">FULL NAME *</label>
              <input
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none font-sans"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Name of user"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ACCESS PASSWORD *</label>
            <PwdInput
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Set initial password"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ASSIGN SECURITY ROLE *</label>
              <select
                className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as any }))}
              >
                <option value="employee">EMPLOYEE</option>
                <option value="supervisor">SUPERVISOR</option>
                <option value="admin">ADMINISTRATOR</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">DEPARTMENT</label>
              <input
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none font-sans"
                value={form.department}
                onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                placeholder="e.g., Weld Shop, QC, VMC"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">CONTACT DIRECTORY / EMAIL</label>
            <input
              className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none"
              value={form.contact}
              onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))}
              placeholder="Contact number or email address"
            />
          </div>

          {msg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded text-rose-400 font-mono text-xs">
              {msg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleCreateUser}
              disabled={saving}
              className="bg-emerald-500/15 border border-emerald-400 text-emerald-400 hover:bg-emerald-500/25 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              {saving ? 'PROVISIONING...' : 'PROVISION ACCOUNT'}
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setMsg('');
              }}
              className="border border-rose-500/30 text-rose-400 hover:bg-rose-500/5 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`UPDATE PROFILE: ${editUser?.user_id}`}>
        <div className="flex flex-col gap-4">
          <div className="p-3 bg-cyan-950/10 border border-cyan-500/15 rounded text-xs text-slate-400 font-mono">
            Modifying credentials for <span className="text-cyan-400">{editUser?.name}</span>. Leave password blank if you do not want to alter it.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">FULL NAME</label>
              <input
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-sans"
                value={editForm.name || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ASSIGN ROLE</label>
              <select
                className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
                value={editForm.role || 'employee'}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as any }))}
              >
                <option value="employee">EMPLOYEE</option>
                <option value="supervisor">SUPERVISOR</option>
                <option value="admin">ADMINISTRATOR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">NEW SECURITY PASSWORD (LEAVE BLANK TO RETAIN CURRENT)</label>
            <PwdInput
              value={editForm.password || ''}
              onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Enter new password or leave blank"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">DEPARTMENT</label>
              <input
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none"
                value={editForm.department || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, department: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">CONTACT DIRECTORY</label>
              <input
                className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-sm text-slate-100 w-full focus:border-cyan-400 outline-none"
                value={editForm.contact || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, contact: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold tracking-widest text-slate-400 font-mono uppercase mb-2">ACCOUNT STATUS</label>
            <select
              className="bg-slate-900 border border-cyan-500/10 rounded px-3.5 py-2.5 text-sm text-slate-100 w-full focus:border-cyan-400 outline-none font-mono"
              value={editForm.is_active ? 'true' : 'false'}
              onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.value === 'true' }))}
            >
              <option value="true">ACTIVE</option>
              <option value="false">INACTIVE / LOCKED</option>
            </select>
          </div>

          {msg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded text-rose-400 font-mono text-xs">
              {msg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4">
            <button
              onClick={handleUpdateUser}
              disabled={saving}
              className="bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 font-mono text-xs font-bold py-2.5 rounded tracking-widest cursor-pointer uppercase transition-colors"
            >
              {saving ? 'SAVING...' : 'COMMIT CHANGES'}
            </button>
            <button
              onClick={() => {
                setShowEdit(false);
                setMsg('');
              }}
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
