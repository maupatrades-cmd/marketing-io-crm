import { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getCurrentUser } from '@/lib/customAuth';
import { ArrowLeft, Send, MessageSquare, AlertTriangle } from 'lucide-react';

// Round 5 — replaces the 25-line "Coming soon" stub. The client portal
// today uses a single thread per client (see ClientMessages.jsx); this
// detail page exists for deep-link arrivals (notification email links to
// /client/messages/:threadId). It validates the client can read the
// thread, then renders messages and a reply form using the same
// thread-message functions (list-thread-messages, send-thread-message)
// the main inbox page uses.

const ROLE_STYLE = {
  client:            { bg: 'bg-purple-500',   ring: 'ring-purple-500/40',  label: 'You' },
  consultant:        { bg: 'bg-sky-500',      ring: 'ring-sky-500/40',     label: 'Consultant' },
  owner:             { bg: 'bg-amber-500',    ring: 'ring-amber-500/40',   label: 'Owner' },
  admin:             { bg: 'bg-emerald-500',  ring: 'ring-emerald-500/40', label: 'Admin' },
  head_of_marketing: { bg: 'bg-pink-500',     ring: 'ring-pink-500/40',    label: 'Head of Marketing' },
  head_of_tech:      { bg: 'bg-indigo-500',   ring: 'ring-indigo-500/40',  label: 'Head of Tech' },
  system:            { bg: 'bg-slate-600',    ring: 'ring-slate-600/40',   label: 'System' },
};

function timeFmt(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function initials(name) {
  if (!name) return '?';
  return String(name).split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function unwrap(rows) { return Array.isArray(rows) ? rows : (rows ? [rows] : []); }

export default function ClientThreadDetail() {
  const { threadId } = useParams();
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  // Initial load — auth, then thread, then messages.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getCurrentUser().catch(() => null);
        if (!me) { window.location.href = '/login'; return; }
        if (cancelled) return;
        setUser(me);

        // Resolve own client row.
        let cli = null;
        for (const f of [{ client_user_id: me.id }, { app_user_id: me.id }, { email: me.email }]) {
          try {
            const list = await base44.entities.Client.filter(f);
            cli = unwrap(list)[0] || null;
            if (cli) break;
          } catch { /* try next */ }
        }
        if (!cli) {
          setError('We could not find your client record. Contact support.');
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setClient(cli);

        // Resolve the thread by id, validate ownership.
        const threadRows = await base44.entities.ClientThread.filter({ id: threadId }).catch(() => []);
        const t = unwrap(threadRows)[0] || null;
        if (!t) {
          setError('Thread not found.');
          setLoading(false);
          return;
        }
        if (t.client_id !== cli.id) {
          setError('You don’t have access to this thread.');
          setLoading(false);
          return;
        }
        if (cancelled) return;
        setThread(t);

        // Load messages.
        const res = await base44.functions.invoke('list-thread-messages', {
          thread_id: t.id,
          token: localStorage.getItem('mio_session_token'),
        });
        const payload = res?.data ?? res;
        setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load thread.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [threadId]);

  // Poll every 10s.
  useEffect(() => {
    if (!thread?.id) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const res = await base44.functions.invoke('list-thread-messages', {
          thread_id: thread.id,
          token: localStorage.getItem('mio_session_token'),
        });
        const payload = res?.data ?? res;
        if (!cancelled && Array.isArray(payload?.messages)) setMessages(payload.messages);
      } catch { /* swallow */ }
    };
    const handle = setInterval(tick, 10_000);
    return () => { cancelled = true; clearInterval(handle); };
  }, [thread?.id]);

  // Auto-scroll to bottom on message changes.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!thread || !draft.trim() || sending) return;
    setSending(true);
    try {
      await base44.functions.invoke('send-thread-message', {
        thread_id: thread.id,
        message:   draft.trim(),
        token:     localStorage.getItem('mio_session_token'),
      });
      setDraft('');
      // Optimistic refresh
      const res = await base44.functions.invoke('list-thread-messages', {
        thread_id: thread.id,
        token: localStorage.getItem('mio_session_token'),
      });
      const payload = res?.data ?? res;
      if (Array.isArray(payload?.messages)) setMessages(payload.messages);
    } catch (err) {
      setError(err.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <div className="h-8 bg-slate-800 rounded w-48 mb-6 animate-pulse" />
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-8 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !thread) {
    return (
      <div className="min-h-full p-6 md:p-10">
        <div className="max-w-3xl mx-auto">
          <Link to="/client/messages" className="inline-flex items-center gap-2 text-slate-400 text-sm mb-4 hover:text-slate-200">
            <ArrowLeft className="w-4 h-4" /> Back to messages
          </Link>
          <div className="bg-red-500/10 border border-red-400/40 rounded-2xl p-6 text-red-200">
            <AlertTriangle className="w-6 h-6 mb-2" />
            {error || 'Thread not found.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col p-6 md:p-10">
      <div className="max-w-3xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <Link to="/client/messages" className="inline-flex items-center gap-2 text-slate-400 text-sm mb-4 hover:text-slate-200">
          <ArrowLeft className="w-4 h-4" /> Back to messages
        </Link>

        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/60 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <div>
              <div className="text-sm font-semibold text-white">{thread.subject || 'Conversation'}</div>
              <div className="text-xs text-slate-400">{thread.status || 'active'} · {messages.length} messages</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No messages in this thread yet. Send the first one below.</div>
            ) : (
              messages.map((m) => {
                const isSelf = String(m.sender_role || '').toLowerCase() === 'client';
                const style = ROLE_STYLE[m.sender_role] || ROLE_STYLE.consultant;
                if (m.is_system_message) {
                  return (
                    <div key={m.id} className="flex justify-center">
                      <div className="text-[11px] text-slate-400 italic bg-slate-800/40 border border-slate-700/50 rounded-full px-4 py-1.5">
                        {m.message}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className={`flex gap-3 ${isSelf ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-9 h-9 rounded-full ${style.bg} ring-2 ${style.ring} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {initials(m.sender_name)}
                    </div>
                    <div className={`flex flex-col max-w-[75%] ${isSelf ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                        isSelf
                          ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-br-sm'
                          : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-sm'
                      }`}>
                        {m.message}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {style.label} · {timeFmt(m.created_at || m.created_date)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-slate-700/60 px-4 py-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              disabled={sending || thread.status === 'archived'}
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending || thread.status === 'archived'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 text-white text-sm font-semibold disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
