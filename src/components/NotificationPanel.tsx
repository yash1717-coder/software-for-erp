import React, { useState, useEffect } from 'react';
import { sb } from '../supabaseClient';
import { AppUser, Notification } from '../types';
import { Icon } from './Icons';
import { Spinner, NoData } from './SharedUI';

interface NotificationPanelProps {
  user: AppUser;
  onClose: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({ user, onClose }) => {
  const [notifs, setNotifs] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      // We query notifications where either recipient_id matches user, OR recipient_role matches user's role.
      // Postgres OR grouping using PostgREST url format
      const isRoleAdmin = user?.role === 'admin';
      const filterStr = isRoleAdmin
        ? `or(recipient_role.eq.admin,recipient_id.eq.${user?.user_id})`
        : `or(recipient_id.eq.${user?.user_id},recipient_role.eq.${user?.role},recipient_role.eq.all)`;

      const { data } = await sb.from<Notification>('notifications').select('*', {
        order: 'created_at.desc',
        limit: 30,
        filter: filterStr
      });

      setNotifs(data || []);
      setLoading(false);

      // Best-effort mark notifications as read for current user
      if (data && data.length > 0 && user?.user_id) {
        await sb.from('notifications').update({ is_read: true }, { col: 'recipient_id', val: user.user_id });
      }
    };
    fetchAlerts();
  }, [user]);

  const typeColors = {
    task: 'border-l-cyan-400',
    success: 'border-l-emerald-400',
    warning: 'border-l-amber-500',
    work: 'border-l-cyan-400',
    message: 'border-l-emerald-400',
    info: 'border-l-slate-500'
  };

  const typeIcons = {
    task: 'tasks',
    success: 'check',
    warning: 'alert',
    work: 'upload',
    message: 'chat',
    info: 'bell'
  };

  return (
    <div className="fixed top-[54px] right-0 w-90 h-[calc(100vh-54px)] bg-slate-900 border-l border-cyan-500/15 z-[200] flex flex-col animate-fade-up shadow-[-10px_0_40px_rgba(3,5,8,0.9)]">
      <div className="p-4 border-b border-cyan-500/10 flex items-center justify-between shrink-0">
        <div className="font-mono text-xs text-cyan-400 tracking-widest font-bold uppercase flex items-center gap-1.5">
          <Icon name="bell" size={13} color="var(--neon-cyan)" /> SYSTEM ALERTS
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5">
        {loading ? (
          <Spinner />
        ) : !notifs || notifs.length === 0 ? (
          <NoData label="SYSTEM CLEAR — NO ALERTS" />
        ) : (
          notifs.map((n, i) => (
            <div
              key={n.id || i}
              className={`bg-slate-950 border border-cyan-500/2 rounded p-3.5 border-l-2 ${typeColors[n.type] || 'border-l-cyan-400'} hover:border-cyan-500/10 transition-colors`}
            >
              <div className="flex gap-2.5">
                <span className="mt-0.5 opacity-60 text-cyan-400 shrink-0">
                  <Icon name={typeIcons[n.type] || 'bell'} size={12} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-[11px] text-slate-100 uppercase tracking-wider">{n.title}</div>
                  <div className="font-sans text-xs text-slate-400 mt-1.5 leading-relaxed">{n.message}</div>
                  <div className="text-[9px] font-mono text-slate-600 mt-2.5">
                    Sender: {n.sender_name || 'Enterprise Core'} · {n.created_at ? new Date(n.created_at).toLocaleTimeString() : ''}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
