import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/lib/customAuth";
import AppLayout from "@/components/AppLayout";
import { Send, MessageSquare, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ROLE_STYLE = {
  client:     { ring: 'ring-purple-500/40', bg: 'bg-purple-500', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/40', label: 'Client' },
  consultant: { ring: 'ring-sky-500/40',    bg: 'bg-sky-500',    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/40',         label: 'Consultant' },
  owner:      { ring: 'ring-amber-500/40',  bg: 'bg-amber-500',  badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',    label: 'You' }
};

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}
function timeFmt(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}
function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function Bubble({ msg, isSelf, totalParticipants }) {
  if (msg.is_system_message) {
    return (
      <div className="flex justify-center my-3">
        <div className="text-[11px] text-slate-400 italic bg-slate-800/40 border border-slate-700/50 rounded-full px-4 py-1.5">
          {msg.message}
        </div>
      </div>
    );
  }
  const style = ROLE_STYLE[msg.sender_role] || ROLE_STYLE.consultant;
  const readByAll = totalParticipants && Array.isArray(msg.read_by) && msg.read_by.length >= totalParticipants;
  return (
    <div className={`flex gap-3 my-3 ${isSelf ? 'flex-row-reverse' : ''}`}>
      <div className={`w-9 h-9 rounded-full ${style.bg} flex items-center justify-center text-white text-xs font-bold ring-2 ${style.ring} shrink-0`}>
        {initials(msg.sender_name)}
      </div>
      <div className={`flex-1 min-w-0 max-w-[75%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isSelf ? 'bg-gradient-to-br from-amber-600 to-orange-600 text-white rounded-br-sm'
                 : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'
        }`}>{msg.message}</div>
        <div className={`flex items-center gap-2 mt-1 text-[10px] text-slate-500 ${isSelf ? 'flex-row-reverse' : ''}`}>
          <span className="font-medium text-slate-400">{isSelf ? 'You' : msg.sender_name}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
          <span title={timeFmt(msg.created_date)}>{timeFmt(msg.created_date)}</span>
          {isSelf && readByAll && <span className="text-emerald-400">✓✓ Read</span>}
        </div>
      </div>
    </div>
  );
}

function ThreadList({ threads, onSelect }) {
  if (threads.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center text-muted-foreground">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
        No active client threads yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {threads.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="w-full text-left glass rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-all"
        >
          <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">{initials(t.client_name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground truncate">{t.client_name || 'Unknown client'}</p>
              {(t.unread_count_owner || 0) > 0 && (
                <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">
                  {t.unread_count_owner} new
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {t.last_message_preview || 'No messages yet'}
            </p>
          </div>
          <span className="text-xs text-muted-foreground/70 shrink-0 whitespace-nowrap">
            {relTime(t.last_message_at)}
          </span>
        </button>
      ))}
    </div>
  );
}

export default function OwnerInbox() {
  const [user, setUser] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selected, setSelected] = useState(null); // { thread, messages }
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  // Load current user + thread list.
  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      if (!me) { window.location.href = '/login'; return; }
      setUser(me);
      try {
        const all = await base44.entities.ClientThread.filter({ status: 'active' }, '-last_message_at', 100);
        setThreads(Array.isArray(all) ? all : (all ? [all] : []));
      } catch (err) {
        console.error('[OwnerInbox] thread list failed:', err);
        setError('Failed to load inbox.');
      }
      setLoading(false);
    })();
  }, []);

  // Poll thread list every 20s (not actively selected) so badges stay fresh.
  useEffect(() => {
    if (selected) return;
    const t = setInterval(async () => {
      try {
        const all = await base44.entities.ClientThread.filter({ status: 'active' }, '-last_message_at', 100);
        setThreads(Array.isArray(all) ? all : (all ? [all] : []));
      } catch (_) {}
    }, 20000);
    return () => clearInterval(t);
  }, [selected]);

  // Open a thread: hit get-or-create-client-thread to load messages + reset
  // unread for the owner role.
  const openThread = async (t) => {
    if (!user) return;
    setSelected({ thread: t, messages: [] });
    try {
      const res = await base44.functions.invoke('get-or-create-client-thread', {
        client_id: t.client_id,
        current_user_id: user.id,
        current_user_role: 'owner'
      });
      const data = res.data || {};
      if (data.error) {
        setError(data.error === 'forbidden' ? "You don't have permission to view this thread." : data.error);
        setSelected(null);
      } else {
        setSelected({ thread: data.thread, messages: data.messages || [] });
        // Refresh the list-item so its unread badge clears immediately.
        setThreads(prev => prev.map(x => x.id === data.thread.id ? data.thread : x));
      }
    } catch (err) {
      console.error('[OwnerInbox] open failed:', err);
      setError('Failed to open thread.');
      setSelected(null);
    }
  };

  // Poll messages on the open thread every 10s.
  useEffect(() => {
    if (!selected?.thread?.id || !user?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await base44.functions.invoke('list-thread-messages', {
          thread_id: selected.thread.id,
          current_user_id: user.id,
          current_user_role: 'owner'
        });
        const data = res.data || {};
        if (data.thread || data.messages) {
          setSelected(prev => prev ? {
            thread: data.thread || prev.thread,
            messages: Array.isArray(data.messages) ? data.messages : prev.messages
          } : prev);
        }
      } catch (_) {}
    }, 10000);
    return () => clearInterval(interval);
  }, [selected?.thread?.id, user?.id]);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selected?.messages?.length]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!draft.trim() || !selected?.thread || !user || sending) return;
    setSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      thread_id: selected.thread.id,
      sender_id: user.id,
      sender_name: user.full_name || 'Owner',
      sender_role: 'owner',
      message: draft.trim(),
      created_date: new Date().toISOString(),
      read_by: [user.id]
    };
    setSelected(prev => ({ ...prev, messages: [...prev.messages, optimistic] }));
    const text = draft.trim();
    setDraft('');
    try {
      const res = await base44.functions.invoke('send-thread-message', {
        thread_id: selected.thread.id,
        sender_id: user.id,
        message: text
      });
      const data = res.data || {};
      if (data.error) {
        setSelected(prev => ({ ...prev, messages: prev.messages.filter(m => m.id !== optimistic.id) }));
        setDraft(text);
        setError('Send failed.');
      } else if (data.message) {
        setSelected(prev => ({
          ...prev,
          messages: prev.messages.map(m => m.id === optimistic.id ? data.message : m)
        }));
      }
    } catch (err) {
      console.error('[OwnerInbox] send failed:', err);
      setSelected(prev => ({ ...prev, messages: prev.messages.filter(m => m.id !== optimistic.id) }));
      setDraft(text);
      setError('Send failed. Try again.');
    }
    setSending(false);
  };

  const totalUnread = threads.reduce((s, t) => s + (t.unread_count_owner || 0), 0);

  return (
    <AppLayout title="Inbox" subtitle={totalUnread > 0 ? `${totalUnread} unread` : 'All caught up'}>
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : selected ? (
        <div className="flex flex-col h-[calc(100vh-180px)]">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => { setSelected(null); setError(''); }}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" /> All threads
            </button>
            <h2 className="text-base font-bold text-foreground">{selected.thread?.client_name}</h2>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto glass rounded-xl px-4 py-2">
            {selected.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No messages yet.</p>
            ) : (
              selected.messages.map(m => (
                <Bubble
                  key={m.id}
                  msg={m}
                  isSelf={m.sender_id === user?.id}
                  totalParticipants={(selected.thread?.participants || []).length || 3}
                />
              ))
            )}
          </div>
          <form onSubmit={handleSend} className="mt-3 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
              placeholder="Reply as Owner…"
              rows={1}
              className="flex-1 resize-none bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/60 max-h-40"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition"
              style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)' }}
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
      ) : (
        <div>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <ThreadList threads={threads} onSelect={openThread} />
        </div>
      )}
    </AppLayout>
  );
}
