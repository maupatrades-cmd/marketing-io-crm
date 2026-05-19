import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, X, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEscapeKey } from '@/lib/useEscapeKey';

// Owner-initiated thread creation modal.
// Lets the owner pick a client by name/email search and post the first
// message. Uses the existing get-or-create-client-thread + send-thread-message
// functions — no new backend needed.

export default function NewThreadModal({ open, onClose, onCreated, currentUserId }) {
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Close on Escape (only when open and not mid-send).
  useEscapeKey(open && !sending, onClose);

  // Load active clients when the modal opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingClients(true);
      try {
        const rows = await base44.entities.Client.filter({ status: 'active' }, '-last_message_at', 500);
        const list = Array.isArray(rows) ? rows : [];
        if (!cancelled) setClients(list);
      } catch (err) {
        console.error('[NewThreadModal] client load failed:', err);
        if (!cancelled) {
          toast.error('Could not load clients. Please try again.');
        }
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Reset state when modal closes.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedClient(null);
      setMessage('');
      setSending(false);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients.filter(c => {
      const name = String(c.business_name || '').toLowerCase();
      const contact = String(c.contact_person || '').toLowerCase();
      const email = String(c.email || '').toLowerCase();
      return name.includes(q) || contact.includes(q) || email.includes(q);
    }).slice(0, 50);
  }, [clients, query]);

  const handleSend = async () => {
    if (!selectedClient || !message.trim()) return;
    setSending(true);
    try {
      // 1. Get or create the thread.
      const threadRes = await base44.functions.invoke('get-or-create-client-thread', {
        client_id: selectedClient.id,
        token: localStorage.getItem('mio_session_token'),
      });
      const threadData = threadRes?.data ?? threadRes;
      if (threadData?.error || !threadData?.thread?.id) {
        toast.error(threadData?.error || 'Could not start thread.');
        setSending(false);
        return;
      }
      const threadId = threadData.thread.id;

      // 2. Post the first message.
      const sendRes = await base44.functions.invoke('send-thread-message', {
        thread_id: threadId,
        message: message.trim(),
        token: localStorage.getItem('mio_session_token'),
      });
      const sendData = sendRes?.data ?? sendRes;
      if (sendData?.error) {
        toast.error(sendData.error);
        setSending(false);
        return;
      }

      toast.success(`Message sent to ${selectedClient.business_name}.`);
      if (typeof onCreated === 'function') {
        onCreated(threadData.thread);
      }
      onClose();
    } catch (err) {
      console.error('[NewThreadModal] send failed:', err);
      toast.error('Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#16162d',
          border: '1px solid rgba(167,100,230,0.25)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          color: '#f4f4fa',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, margin: 0 }}>New message to a client</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4 }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          {!selectedClient ? (
            <>
              <label style={{ fontSize: '13px', color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                Search for a client
              </label>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#6b7280' }} />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Business name, contact, or email…"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 34px',
                    background: '#0a0a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#f4f4fa',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              {loadingClients ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#a764e6' }} />
                </div>
              ) : filtered.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: '20px 0', fontSize: 14 }}>
                  {query ? 'No clients match that search.' : 'No active clients found.'}
                </p>
              ) : (
                <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
                  {filtered.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedClient(c)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        color: '#f4f4fa',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(167,100,230,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{c.business_name || '(no name)'}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {c.contact_person ? `${c.contact_person} · ` : ''}{c.email || ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ background: '#0a0a2e', padding: '12px 14px', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>Sending to</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{selectedClient.business_name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {selectedClient.contact_person ? `${selectedClient.contact_person} · ` : ''}{selectedClient.email || ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
                >
                  Change
                </button>
              </div>

              <label style={{ fontSize: '13px', color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                Message
              </label>
              <textarea
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message…"
                rows={5}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0a0a2e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: '#f4f4fa',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#cbd5e1',
              borderRadius: 8,
              fontSize: 14,
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selectedClient || !message.trim() || sending}
            style={{
              padding: '8px 16px',
              background: (!selectedClient || !message.trim() || sending)
                ? 'rgba(167,100,230,0.3)'
                : 'linear-gradient(135deg,#a764e6 0%,#ec4899 100%)',
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: (!selectedClient || !message.trim() || sending) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
