import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/lib/customAuth";
import { Send, MessageSquare } from "lucide-react";

const ROLE_STYLE = {
  client:     { ring: 'ring-purple-500/40',  bg: 'bg-purple-500',  badge: 'bg-purple-500/15 text-purple-300 border-purple-500/40', label: 'You' },
  consultant: { ring: 'ring-sky-500/40',     bg: 'bg-sky-500',     badge: 'bg-sky-500/15 text-sky-300 border-sky-500/40',         label: 'Consultant' },
  owner:      { ring: 'ring-amber-500/40',   bg: 'bg-amber-500',   badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40',    label: 'Owner' },
  head_of_marketing: { ring: 'ring-pink-500/40', bg: 'bg-pink-500', badge: 'bg-pink-500/15 text-pink-300 border-pink-500/40',     label: 'Head of Marketing' }
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

function MessageBubble({ msg, isSelf, totalParticipants }) {
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
          isSelf
            ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-br-sm'
            : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'
        }`}>
          {msg.message}
        </div>
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

function ParticipantStrip({ thread, owner, consultant, client }) {
  const list = [
    { label: client?.contact_person || 'You', role: 'client' },
    consultant && { label: consultant.full_name, role: 'consultant' },
    owner && { label: owner.full_name || 'Thapelo Maupa', role: 'owner' }
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {list.map((p, i) => {
        const style = ROLE_STYLE[p.role] || ROLE_STYLE.consultant;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full ${style.bg} flex items-center justify-center text-white text-[10px] font-bold ring-2 ${style.ring}`}>
              {initials(p.label)}
            </div>
            <span className="text-xs text-slate-300">{p.label}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ClientMessages() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(null);
  const [consultant, setConsultant] = useState(null);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  // Initial load: user → client → thread + messages.
  useEffect(() => {
    (async () => {
      const me = await getCurrentUser();
      if (!me) { setLoading(false); return; }
      setUser(me);

      const clients = await base44.entities.Client.filter({ email: me.email });
      const c = Array.isArray(clients) ? clients[0] : clients;
      if (!c) { setError('No client account linked to your login.'); setLoading(false); return; }
      setClient(c);

      try {
        const res = await base44.functions.invoke('get-or-create-client-thread', {
          client_id: c.id,
          current_user_id: me.id,
          current_user_role: 'client'
        });
        const data = res.data || {};
        if (data.error) {
          setError(data.error === 'forbidden' ? "You don't have permission to view this thread." : data.error);
        } else {
          setThread(data.thread);
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('[ClientMessages] thread load failed:', err);
        setError('Failed to load thread.');
      }
      setLoading(false);
    })();
  }, []);

  // Resolve owner + consultant once we have a thread (best-effort, names only).
  useEffect(() => {
    if (!thread) return;
    (async () => {
      if (thread.consultant_id) {
        try {
          const u = await base44.entities.User.filter({ id: thread.consultant_id });
          setConsultant(Array.isArray(u) ? u[0] : u);
        } catch (_) {}
      }
      if (thread.owner_id) {
        try {
          const u = await base44.entities.User.filter({ id: thread.owner_id });
          setOwner(Array.isArray(u) ? u[0] : u);
        } catch (_) {}
      }
    })();
  }, [thread?.consultant_id, thread?.owner_id]);

  // Poll every 10s for new messages.
  useEffect(() => {
    if (!thread || !user) return;
    const interval = setInterval(async () => {
      try {
        const res = await base44.functions.invoke('list-thread-messages', {
          thread_id: thread.id,
          current_user_id: user.id,
          current_user_role: 'client'
        });
        const data = res.data || {};
        if (data.thread) setThread(data.thread);
        if (Array.isArray(data.messages)) setMessages(data.messages);
      } catch (err) {
        console.error('[ClientMessages] poll failed:', err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [thread?.id, user?.id]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault?.();
    if (!draft.trim() || !thread || !user || sending) return;
    setSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      thread_id: thread.id,
      sender_id: user.id,
      sender_name: user.full_name || user.first_name || 'You',
      sender_role: 'client',
      message: draft.trim(),
      created_date: new Date().toISOString(),
      read_by: [user.id]
    };
    setMessages(prev => [...prev, optimistic]);
    const text = draft.trim();
    setDraft('');
    try {
      const res = await base44.functions.invoke('send-thread-message', {
        thread_id: thread.id,
        sender_id: user.id,
        message: text,
        token: localStorage.getItem('mio_session_token'),
      });
      const data = res.data || {};
      if (data.error) {
        // Roll back optimistic add and surface the error.
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        setError(data.error === 'forbidden' ? "You can't post here." : 'Send failed.');
        setDraft(text);
      } else if (data.message) {
        // Replace optimistic with the real one.
        setMessages(prev => prev.map(m => m.id === optimistic.id ? data.message : m));
      }
    } catch (err) {
      console.error('[ClientMessages] send failed:', err);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setDraft(text);
      setError('Send failed. Try again.');
    }
    setSending(false);
  };

  if (loading) return <LoadingSpinner />;

  if (error && !thread) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass rounded-xl p-6 text-center max-w-sm">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const totalParticipants = (thread?.participants || []).length || 3;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700/40 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-foreground">Your Marketing iO Team</h1>
          <div className="mt-3">
            <ParticipantStrip thread={thread} owner={owner} consultant={consultant} client={client} />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No messages yet — say hi.</p>
            </div>
          ) : (
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isSelf={msg.sender_id === user?.id}
                totalParticipants={totalParticipants}
              />
            ))
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-slate-700/40 bg-slate-950/60 backdrop-blur-md">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto px-4 py-3 flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            placeholder="Message your team…"
            rows={1}
            className="flex-1 resize-none bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/60 max-h-40"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="shrink-0 flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition"
            style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
        {error && thread && (
          <p className="max-w-4xl mx-auto px-4 pb-2 text-xs text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}