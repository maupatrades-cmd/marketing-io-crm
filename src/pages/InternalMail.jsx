import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from '@/lib/customAuth';
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Inbox, Mail, MailOpen, PenSquare, X, ChevronLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

export default function InternalMail() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [sent, setSent] = useState([]);
  const [tab, setTab] = useState("inbox");
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ to_id: "", subject: "", body: "" });
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser().then(u => { if (!u) { window.location.href = '/login'; return; } setMe(u); });
    // Load ALL users (staff + any role) so internal mail reaches everyone
    base44.entities.User.list("-created_date", 200).then(all => setUsers(Array.isArray(all) ? all : []));
  }, []);

  useEffect(() => {
    if (!me) return;
    base44.entities.InternalMessage.filter({ to_id: me.id }, "-created_date", 100).then(setInbox);
    base44.entities.InternalMessage.filter({ from_id: me.id }, "-created_date", 100).then(setSent);
  }, [me]);

  const unreadCount = inbox.filter(m => !m.read).length;

  const handleOpen = async (msg) => {
    setSelected(msg);
    if (!msg.read && tab === "inbox") {
      await base44.entities.InternalMessage.update(msg.id, { read: true, read_at: new Date().toISOString() });
      setInbox(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
    }
  };

  const handleSend = async () => {
    if (!form.to_id || !form.subject || !form.body) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSending(true);
    const toUser = users.find(u => u.id === form.to_id);
    await base44.entities.InternalMessage.create({
      from_id: me.id,
      from_name: me.full_name,
      from_email: me.email,
      to_id: form.to_id,
      to_name: toUser?.full_name || "",
      to_email: toUser?.email || "",
      subject: form.subject,
      body: form.body,
      read: false,
    });
    toast({ title: "Message sent!" });
    setForm({ to_id: "", subject: "", body: "" });
    setComposing(false);
    // Refresh sent
    base44.entities.InternalMessage.filter({ from_id: me.id }, "-created_date", 100).then(setSent);
    setSending(false);
  };

  const messages = tab === "inbox" ? inbox : sent;

  return (
    <AppLayout title="Internal Mail" subtitle="Send & receive messages with your team">
      <div className="flex gap-4 h-[calc(100vh-140px)]">

        {/* Sidebar */}
        <div className="w-56 shrink-0 flex flex-col gap-2">
          <Button onClick={() => { setComposing(true); setSelected(null); }} className="gradient-bg text-white border-0 w-full">
            <PenSquare className="w-4 h-4 mr-2" /> Compose
          </Button>
          <div className="glass rounded-xl overflow-hidden">
            <button
              onClick={() => { setTab("inbox"); setSelected(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${tab === "inbox" ? "gradient-bg text-white" : "hover:bg-white/5 text-muted-foreground"}`}
            >
              <Inbox className="w-4 h-4" />
              Inbox
              {unreadCount > 0 && <Badge className="ml-auto bg-red-500 text-white border-0 text-xs px-1.5">{unreadCount}</Badge>}
            </button>
            <button
              onClick={() => { setTab("sent"); setSelected(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${tab === "sent" ? "gradient-bg text-white" : "hover:bg-white/5 text-muted-foreground"}`}
            >
              <Send className="w-4 h-4" />
              Sent
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 flex gap-4 min-w-0">
          <div className={`flex flex-col glass rounded-xl overflow-hidden ${selected || composing ? "w-72 shrink-0" : "flex-1"}`}>
            <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold text-foreground capitalize">{tab}</div>
            <div className="flex-1 overflow-y-auto divide-y divide-white/5">
              {messages.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">No messages</p>
              )}
              {messages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => { setComposing(false); handleOpen(msg); }}
                  className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-all ${selected?.id === msg.id ? "bg-white/10" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {tab === "inbox" && !msg.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    {tab === "inbox" && msg.read && <MailOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    {tab === "sent" && <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${!msg.read && tab === "inbox" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {tab === "inbox" ? msg.from_name : msg.to_name}
                      </p>
                      <p className="text-xs truncate text-muted-foreground">{msg.subject}</p>
                      <p className="text-xs text-muted-foreground/60">{msg.created_date ? format(new Date(msg.created_date), "dd MMM, HH:mm") : ""}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Read Pane */}
          {selected && !composing && (
            <div className="flex-1 glass rounded-xl flex flex-col min-w-0">
              <div className="px-6 py-4 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">{selected.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tab === "inbox" ? `From: ${selected.from_name} (${selected.from_email})` : `To: ${selected.to_name} (${selected.to_email})`}
                    {" · "}{selected.created_date ? format(new Date(selected.created_date), "dd MMM yyyy, HH:mm") : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setSelected(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{selected.body}</p>
              </div>
              {tab === "inbox" && (
                <div className="px-6 py-3 border-t border-white/10">
                  <Button size="sm" onClick={() => {
                    setForm({ to_id: selected.from_id, subject: `Re: ${selected.subject}`, body: "" });
                    setComposing(true);
                    setSelected(null);
                  }} className="gradient-bg text-white border-0">
                    Reply
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Compose Pane */}
          {composing && (
            <div className="flex-1 glass rounded-xl flex flex-col min-w-0">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <p className="font-semibold text-foreground">New Message</p>
                <Button size="icon" variant="ghost" onClick={() => setComposing(false)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="flex-1 p-6 space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">To</label>
                  <select
                    value={form.to_id}
                    onChange={e => setForm(f => ({ ...f, to_id: e.target.value }))}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select recipient…</option>
                    {users.filter(u => u.id !== me?.id).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
                  <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject…" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Message</label>
                  <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your message…" rows={10} />
                </div>
              </div>
              <div className="px-6 py-3 border-t border-white/10">
                <Button onClick={handleSend} disabled={sending} className="gradient-bg text-white border-0">
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}