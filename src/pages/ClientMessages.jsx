import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare } from "lucide-react";

export default function ClientMessages() {
  const [messages, setMessages] = useState([]);
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const msgs = await base44.entities.ClientActivityLog.filter({ client_id: c.id }, "-created_date", 100);
        setMessages(msgs);
      }
      setLoading(false);
    });
  }, []);

  const handleSend = async () => {
    if (!newMessage.trim() || !client) return;
    await base44.entities.ClientActivityLog.create({
      client_id: client.id,
      event_type: "note",
      event_label: `Message: ${newMessage.substring(0, 50)}`,
      logged_by: user.id,
      logged_by_name: user.full_name,
    });
    setNewMessage("");
    // Refresh
    const msgs = await base44.entities.ClientActivityLog.filter({ client_id: client.id }, "-created_date", 100);
    setMessages(msgs);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-6">Messages & Communication</h1>

        {/* Message Input */}
        <div className="glass rounded-xl p-4 mb-6">
          <div className="flex gap-2">
            <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleSend()} placeholder="Send a message..." className="bg-secondary/50 border-border/50" />
            <Button onClick={handleSend} className="gradient-bg text-white"><Send className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Messages List */}
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground">No messages</p></div>
          ) : (
            messages.map(m => (
              <div key={m.id} className="glass rounded-xl p-4">
                <p className="font-semibold text-foreground">{m.logged_by_name}</p>
                <p className="text-sm text-muted-foreground mt-1">{m.event_label}</p>
                <p className="text-xs text-muted-foreground mt-2">{new Date(m.created_date).toLocaleDateString("en-ZA", { year: "2-digit", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}