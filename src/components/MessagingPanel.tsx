import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { sb } from '../supabaseClient';
import { AppUser, Message } from '../types';
import { Icon } from './Icons';
import { Spinner, NoData } from './SharedUI';

interface MessagingPanelProps {
  user: AppUser;
}

export const MessagingPanel: React.FC<MessagingPanelProps> = ({ user }) => {
  const [room, setRoom] = useState('general');
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load active enterprise users for DM selection
  useEffect(() => {
    const loadStaff = async () => {
      const { data } = await sb.from<AppUser>('app_users').select('user_id,name,role', {
        filter: 'is_active=eq.true'
      });
      const dbUsers = data || [];
      const adminUser: AppUser = { user_id: 'admin01', name: 'Administrator', role: 'admin', is_active: true };

      // Deduplicate if admin exists in DB
      const merged = [adminUser, ...dbUsers.filter((u) => u.user_id !== 'admin01')];
      setUsers(merged);
    };
    loadStaff();
  }, []);

  const rooms = useMemo(() => {
    const dmRooms = users
      .filter((u) => u.user_id !== user?.user_id)
      .map((u) => ({
        key: 'dm_' + u.user_id,
        label: `💬 ${u.name} [${u.role.toUpperCase()}]`
      }));

    return [{ key: 'general', label: '📢 COMPANY BROADCAST' }, ...dmRooms];
  }, [users, user?.user_id]);

  const loadMsgs = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);

    try {
      if (room.startsWith('dm_')) {
        const otherId = room.replace('dm_', '');
        // Fetch both directions of DMs and sort client-side
        const [sent, recv] = await Promise.all([
          sb.from<Message>('messages').select('*', {
            filter: `sender_id=eq.${user.user_id}&recipient_id=eq.${otherId}`,
            limit: 120
          }),
          sb.from<Message>('messages').select('*', {
            filter: `sender_id=eq.${otherId}&recipient_id=eq.${user.user_id}`,
            limit: 120
          })
        ]);

        const merged = [...(sent.data || []), ...(recv.data || [])];
        merged.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
        setMsgs(merged);
      } else {
        const res = await sb.from<Message>('messages').select('*', {
          order: 'created_at.asc',
          limit: 120,
          filter: `room=eq.${room}`
        });
        setMsgs(res.data || []);
      }
    } catch (e) {
      console.error("Chat fetch failed", e);
    }
    setLoading(false);
    
    // Smooth scroll to bottom
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [room, user?.user_id]);

  useEffect(() => {
    loadMsgs();
  }, [room, loadMsgs]);

  // Set up background polling
  useEffect(() => {
    const timer = setInterval(() => {
      loadMsgs();
    }, 5000);
    return () => clearInterval(timer);
  }, [loadMsgs]);

  const handleSendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !user?.user_id) return;

    try {
      if (room.startsWith('dm_')) {
        const recipientId = room.replace('dm_', '');
        const recipientUser = users.find((u) => u.user_id === recipientId);

        // Save DM message
        await sb.from('messages').insert({
          sender_id: user.user_id,
          sender_name: user.name,
          sender_role: user.role,
          recipient_id: recipientId,
          recipient_name: recipientUser?.name || null,
          room: null,
          content: trimmed,
          created_at: new Date().toISOString()
        });

        // Trigger dynamic system notification for the recipient
        await sb.from('notifications').insert({
          recipient_id: recipientId,
          recipient_role: recipientUser?.role,
          sender_id: user.user_id,
          sender_name: user.name,
          title: `💬 DM from ${user.name}`,
          message: trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed,
          type: 'message',
          created_at: new Date().toISOString()
        });
      } else {
        // Group Channel broadcast
        await sb.from('messages').insert({
          sender_id: user.user_id,
          sender_name: user.name,
          sender_role: user.role,
          recipient_id: null,
          recipient_name: null,
          room: room,
          content: trimmed,
          created_at: new Date().toISOString()
        });

        // Broadcast notifications to role groups if needed
        await sb.from('notifications').insert({
          recipient_role: 'all',
          sender_id: user.user_id,
          sender_name: user.name,
          title: `📢 Broadcast to ${room.toUpperCase()}`,
          message: trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed,
          type: 'message',
          created_at: new Date().toISOString()
        });
      }

      setInput('');
      loadMsgs();
    } catch (err) {
      console.error("Failed sending message:", err);
    }
  };

  const roleColors: { [key: string]: string } = {
    admin: 'text-rose-400',
    supervisor: 'text-emerald-400',
    employee: 'text-amber-400'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[550px]">
      {/* Rooms Directory */}
      <div className="bg-slate-950 border border-cyan-500/5 rounded overflow-y-auto md:col-span-1 relative">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
        <div className="p-4 border-b border-cyan-500/5 font-mono text-[10px] font-bold tracking-widest text-cyan-400">
          TEAM CHANNELS
        </div>
        <div className="flex flex-col">
          {rooms.map((r) => (
            <button
              key={r.key}
              onClick={() => setRoom(r.key)}
              className={`w-full text-left py-3 px-4 font-mono text-xs border-l-2 transition-all cursor-pointer ${
                room === r.key
                  ? 'border-cyan-400 bg-cyan-500/5 text-cyan-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-cyan-500/1'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Conversation log */}
      <div className="bg-slate-950 border border-cyan-500/5 rounded flex flex-col md:col-span-3 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/25" />
        <div className="p-4 border-b border-cyan-500/5 font-mono text-[10px] font-bold tracking-widest text-cyan-400">
          {rooms.find((r) => r.key === room)?.label || 'CONVERSATION'}
        </div>

        {/* Message Bubble area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {loading && msgs.length === 0 ? (
            <Spinner />
          ) : msgs.length === 0 ? (
            <NoData label="START CHATTING — NO COMMUNICATIONS LOGGED YET" />
          ) : (
            msgs.map((m, i) => {
              const isMe = m.sender_id === user?.user_id;
              return (
                <div key={m.id || i} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%]">
                    {!isMe && (
                      <div className={`text-[9px] font-bold tracking-widest uppercase mb-1 font-mono ${roleColors[m.sender_role] || 'text-cyan-400'}`}>
                        {m.sender_name} [{m.sender_role.toUpperCase()}]
                      </div>
                    )}
                    <div
                      className={`rounded px-3.5 py-2.5 text-xs font-mono border leading-relaxed ${
                        isMe
                          ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-100'
                          : 'bg-emerald-500/5 border-emerald-500/15 text-slate-100'
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className={`text-[9px] text-slate-600 font-mono mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString() : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-cyan-500/5 flex gap-2 shrink-0">
          <input
            className="bg-cyan-500/5 border border-cyan-500/10 rounded px-3.5 py-2.5 font-mono text-xs text-slate-100 w-full focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/20 outline-none placeholder-slate-600"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write message to thread..."
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim()}
            className="bg-cyan-500/15 border border-cyan-400 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-50 transition-all font-mono text-xs font-bold px-5 rounded tracking-wider cursor-pointer uppercase"
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
};
