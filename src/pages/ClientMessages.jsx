import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from '@/lib/customAuth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function ClientMessages() {
  const [communications, setCommunications] = useState([]);
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("general_inquiry");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchCommunications = async (clientId) => {
    const comms = await base44.entities.ClientCommunication.filter({ client_id: clientId }, "-created_date", 50);
    setCommunications(Array.isArray(comms) ? comms : []);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    getCurrentUser().then(async (me) => {
      if (!me) { window.location.href = '/login'; return; }
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = Array.isArray(clients) ? clients[0] : clients;
        setClient(c);
        await fetchCommunications(c.id);
      }
      setLoading(false);
    });
  }, []);

  // Real-time polling every 30 seconds
  useEffect(() => {
    if (!client) return;
    const interval = setInterval(() => {
      fetchCommunications(client.id);
    }, 30000);
    return () => clearInterval(interval);
  }, [client]);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || !client || !user) return;
    setSending(true);
    try {
      await base44.entities.ClientCommunication.create({
        client_id: client.id,
        client_name: client.business_name,
        sender_id: user.id,
        sender_name: user.full_name,
        sender_email: user.email,
        message_type: messageType,
        subject: subject.trim(),
        message: message.trim(),
        priority: messageType === "urgent_issue" ? "urgent" : "normal",
      });
      setSubject("");
      setMessage("");
      setMessageType("general_inquiry");
      await fetchCommunications(client.id);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-6">Send a Message to Owner/Admin</h1>

        {/* Message Compose */}
        <div className="glass rounded-xl p-6 mb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Subject *</label>
                <Input 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="e.g., Deliverable question, Payment issue..."
                  className="bg-secondary/50 border-border/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Message Type *</label>
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_inquiry">General Inquiry</SelectItem>
                    <SelectItem value="support_request">Support Request</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="urgent_issue">Urgent Issue</SelectItem>
                    <SelectItem value="billing_inquiry">Billing Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Message *</label>
              <Textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                placeholder="Write your message here..."
                className="bg-secondary/50 border-border/50 min-h-32"
              />
            </div>

            <Button 
              onClick={handleSend} 
              disabled={!subject.trim() || !message.trim() || sending}
              className="gradient-bg text-white w-full md:w-auto"
            >
              <Send className="w-4 h-4 mr-2" />
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </div>

        {/* Communication History */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Message History</h2>
          <p className="text-xs text-muted-foreground text-center mb-4">Last updated: {lastUpdated.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</p>

          <div className="space-y-3">
            {communications.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">No messages sent yet</p>
              </div>
            ) : (
              communications.map(comm => (
                <div key={comm.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{comm.subject}</h3>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                          {comm.message_type.replace(/_/g, ' ')}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          comm.status === 'new' ? 'bg-yellow-500/20 text-yellow-400' :
                          comm.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                          comm.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                          'bg-muted/50 text-muted-foreground'
                        }`}>
                          {comm.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(comm.created_date).toLocaleDateString("en-ZA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{comm.message}</p>

                  {comm.response_message && (
                    <div className="bg-secondary/50 rounded-lg p-3 mt-3 border-l-2 border-primary">
                      <p className="text-xs font-semibold text-foreground mb-1">Response from {comm.responded_by_name}:</p>
                      <p className="text-sm text-muted-foreground">{comm.response_message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(comm.responded_at).toLocaleDateString("en-ZA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}