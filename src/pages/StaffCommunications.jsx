import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import AppLayout from "@/components/AppLayout";
import { Plus, Search, Phone, MessageCircle, Mail, MapPin, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const CHANNEL_ICONS = {
  phone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  in_person: MapPin,
  sms: MessageSquare,
};

const OUTCOME_COLORS = {
  meeting_scheduled: "bg-success/20 text-success",
  objection_raised: "bg-warning/20 text-warning",
  follow_up_needed: "bg-info/20 text-info",
  closed_won: "bg-success/20 text-success",
  no_response: "bg-muted/40 text-muted-foreground",
  other: "bg-secondary/40 text-foreground",
};

export default function StaffCommunications() {
  const { user } = useAuth();
  const [communications, setCommunications] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    channel: "phone",
    direction: "outbound",
    subject: "",
    body: "",
    outcome: "other",
    next_action: "",
    next_action_due_date: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch all clients (for autocomplete)
        const allClients = await base44.entities.Client.list();
        setClients(allClients);

        // Fetch communications for current user
        const allComms = await base44.entities.ClientActivityLog.list("-created_date", 200);
        const myComms = allComms.filter((c) => c.created_by === user?.id);
        setCommunications(myComms);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchData();
  }, [user]);

  const handleAddCommunication = async () => {
    if (!form.client_id || !form.body.trim()) return;

    try {
      setSubmitting(true);
      const selectedClient = clients.find((c) => c.id === form.client_id);

      await base44.entities.ClientActivityLog.create({
        client_id: form.client_id,
        client_name: selectedClient?.business_name || "",
        event_type: "note",
        event_label: `${form.direction.charAt(0).toUpperCase() + form.direction.slice(1)} ${form.channel}: ${form.subject}`,
        communication_channel: form.channel,
        communication_direction: form.direction,
        communication_outcome: form.outcome,
        next_action: form.next_action,
        next_action_due_date: form.next_action_due_date,
      });

      // Reset form and refresh
      setForm({
        client_id: "",
        channel: "phone",
        direction: "outbound",
        subject: "",
        body: "",
        outcome: "other",
        next_action: "",
        next_action_due_date: "",
      });
      setShowForm(false);

      // Refetch
      const allComms = await base44.entities.ClientActivityLog.list("-created_date", 200);
      const myComms = allComms.filter((c) => c.created_by === user?.id);
      setCommunications(myComms);
    } catch (error) {
      console.error("Error adding communication:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredComms = communications.filter(
    (c) =>
      c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.event_label?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Communications" subtitle={`${communications.length} total`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search communications…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/50 border-border/50"
            />
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Log Communication
          </Button>
        </div>

        {/* Communications List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : filteredComms.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No communications logged</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredComms.map((comm) => {
              const Icon = CHANNEL_ICONS[comm.communication_channel] || MessageCircle;
              return (
                <div key={comm.id} className="glass rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-primary shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-semibold text-foreground">{comm.client_name}</p>
                          <p className="text-sm text-muted-foreground">{comm.event_label}</p>
                        </div>
                        {comm.communication_outcome && (
                          <Badge className={`text-xs capitalize shrink-0 ${OUTCOME_COLORS[comm.communication_outcome] || ""}`}>
                            {comm.communication_outcome?.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      {comm.next_action && (
                        <div className="bg-secondary/20 p-2 rounded text-xs mt-2">
                          <p className="text-muted-foreground">Next: {comm.next_action}</p>
                          {comm.next_action_due_date && (
                            <p className="text-muted-foreground">Due: {comm.next_action_due_date}</p>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(comm.created_date), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Communication Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gradient-text">Log Communication</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Client */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Client *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Channel</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="in_person">In-Person</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Direction */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Subject</Label>
              <Input
                placeholder="Brief subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>

            {/* Body */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
              <Textarea
                placeholder="Details of communication…"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="min-h-24 bg-secondary/50 border-border/50"
              />
            </div>

            {/* Outcome */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Outcome</Label>
              <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                  <SelectItem value="objection_raised">Objection Raised</SelectItem>
                  <SelectItem value="follow_up_needed">Follow-up Needed</SelectItem>
                  <SelectItem value="closed_won">Closed Won</SelectItem>
                  <SelectItem value="no_response">No Response</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Next Action */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Next Action</Label>
              <Input
                placeholder="What's the next step?"
                value={form.next_action}
                onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>

            {/* Due Date */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Due Date</Label>
              <Input
                type="date"
                value={form.next_action_due_date}
                onChange={(e) => setForm({ ...form, next_action_due_date: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddCommunication}
                disabled={submitting || !form.client_id || !form.body.trim()}
              >
                {submitting ? "Saving..." : "Log Communication"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}