import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function QuickUpdateModal({ user, onClose }) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    base44.entities.Client.list("-created_date", 100).then(d => setClients(Array.isArray(d) ? d : []));
  }, []);

  const handleSend = async () => {
    if (!selectedClientId || !message.trim()) {
      toast.error("Please select a client and enter a message");
      return;
    }
    setSending(true);
    try {
      const thread = await base44.functions.invoke("get-or-create-client-thread", {
        client_id: selectedClientId,
      });
      const threadId = thread?.data?.thread_id || thread?.data?.id;
      if (!threadId) throw new Error("Could not get thread");
      await base44.functions.invoke("send-thread-message", {
        thread_id: threadId,
        message: message.trim(),
        sender_id: user?.id,
        sender_name: user?.full_name,
        sender_role: user?.role,
      });
      toast.success("Message sent!");
      onClose();
    } catch (err) {
      toast.error("Failed to send message");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Quick Update</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Client</label>
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm"
            >
              <option value="">Select a client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.business_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your update here..."
              className="w-full p-3 rounded-md border border-input bg-transparent text-sm h-28 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}