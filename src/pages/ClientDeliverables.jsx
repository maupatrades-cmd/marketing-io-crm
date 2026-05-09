import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/lib/customAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Clock, AlertCircle, MessageSquare, X, TrendingUp } from "lucide-react";
import FeedbackSurveyModal from "@/components/deliverables/FeedbackSurveyModal";
import ClientDeliverablesDashboard from "@/components/client/ClientDeliverablesDashboard";
import DeliverableCard from "@/components/deliverables/DeliverableCard";
import DeliverableStats from "@/components/deliverables/DeliverableStats";

export default function ClientDeliverables() {
  const [deliverables, setDeliverables] = useState([]);
  const [client, setClient] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedDeliv, setSelectedDeliv] = useState(null);
  const [modalType, setModalType] = useState(null); // "request_changes", "reject"
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [surveyDeliverable, setSurveyDeliverable] = useState(null);
  const [ratedIds, setRatedIds] = useState(new Set());

  const today = new Date();

  useEffect(() => {
    const interval = setInterval(() => {
      setDeliverables(prev => [...prev]); // Force re-render for countdown updates
    }, 60000); // Update every minute

    // Subscribe to real-time deliverable updates
    const unsubscribe = base44.entities.Deliverable.subscribe((event) => {
      if (client && event.data.client_id === client.id) {
        if (event.type === "create") {
          setDeliverables(prev => [event.data, ...prev]);
        } else if (event.type === "update") {
          setDeliverables(prev => prev.map(d => d.id === event.id ? event.data : d));
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe?.();
    };
  }, [client]);

  useEffect(() => {
    getCurrentUser().then(async (me) => {
      if (!me) { setLoading(false); return; }
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = Array.isArray(clients) ? clients[0] : clients;
        setClient(c);
        const [dels, existingFeedback] = await Promise.all([
          base44.entities.Deliverable.filter({ client_id: c.id }, "-created_date", 100),
          base44.entities.DeliverableFeedback.filter({ client_id: c.id }),
        ]);
        setDeliverables(Array.isArray(dels) ? dels : [dels]);
        setRatedIds(new Set((Array.isArray(existingFeedback) ? existingFeedback : []).map(f => f.deliverable_id)));
      }
      setLoading(false);
    });
  }, []);

  const handleApprove = async (id) => {
    setSubmitting(true);
    try {
      await base44.entities.Deliverable.update(id, { 
        approval_status: "approved", 
        approved_date: new Date().toISOString() 
      });
      setDeliverables(prev => prev.map(d => d.id === id ? { ...d, approval_status: "approved" } : d));
      // Trigger feedback survey if not already rated
      if (!ratedIds.has(id)) {
        const del = deliverables.find(d => d.id === id);
        if (del) setSurveyDeliverable(del);
      }
    } catch (err) {
      console.error("Approval error:", err);
    }
    setSubmitting(false);
  };

  const handleRequestChanges = async () => {
    setSubmitting(true);
    try {
      await base44.entities.Deliverable.update(selectedDeliv.id, {
        approval_status: "changes_requested",
        client_change_notes: note,
      });
      
      // Create task for staff
      await base44.entities.Task.create({
        title: `[Client] requested changes on ${selectedDeliv.title}`,
        client_id: client?.id,
        assigned_to: selectedDeliv.assigned_to,
        priority: "high",
        status: "open",
      });

      setDeliverables(prev => prev.map(d => d.id === selectedDeliv.id ? { ...d, approval_status: "changes_requested" } : d));
      setSelectedDeliv(null);
      setModalType(null);
      setNote("");
    } catch (err) {
      console.error("Request changes error:", err);
    }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      await base44.entities.Deliverable.update(selectedDeliv.id, {
        approval_status: "rejected",
        client_change_notes: note,
      });

      // Notify admin (escalation)
      await base44.entities.Task.create({
        title: `[ESCALATION] Client rejected ${selectedDeliv.title}`,
        client_id: client?.id,
        assigned_to: selectedDeliv.assigned_to,
        priority: "urgent",
        status: "open",
      });

      setDeliverables(prev => prev.map(d => d.id === selectedDeliv.id ? { ...d, approval_status: "rejected" } : d));
      setSelectedDeliv(null);
      setModalType(null);
      setNote("");
    } catch (err) {
      console.error("Reject error:", err);
    }
    setSubmitting(false);
  };

  const getDaysLeftBadge = (scheduledDate) => {
    const scheduled = new Date(scheduledDate);
    const daysLeft = Math.ceil((scheduled - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return <Badge className="bg-red-600">Auto-approving today</Badge>;
    if (daysLeft === 1) return <Badge className="bg-red-600">1 day left</Badge>;
    if (daysLeft <= 3) return <Badge className="bg-orange-600">{daysLeft} days left</Badge>;
    if (daysLeft <= 5) return <Badge className="bg-yellow-600">{daysLeft} days left</Badge>;
    return null;
  };

  // Group by service
  const grouped = {};
  deliverables.forEach(d => {
    const service = d.product || "General";
    if (!grouped[service]) grouped[service] = [];
    grouped[service].push(d);
  });

  // Sort by status: active first, then completed
  const sortedServices = Object.keys(grouped).sort((a, b) => {
    const aActive = grouped[a].some(d => d.approval_status !== "approved");
    const bActive = grouped[b].some(d => d.approval_status !== "approved");
    return bActive - aActive;
  });

  const filtered = deliverables.filter(d => filter === "all" || (filter === "review" ? ["pending_client_review", "client_reviewing"].includes(d.approval_status) : d.approval_status === filter));
  const forReview = deliverables.filter(d => ["pending_client_review", "client_reviewing"].includes(d.approval_status));

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Deliverables</h1>
        {forReview.length > 0 && <p className="text-warning font-semibold mb-6">{forReview.length} awaiting your review</p>}

        {/* Dashboard View */}
        {client && (
          <div className="mb-8">
            <ClientDeliverablesDashboard clientId={client.id} />
          </div>
        )}

        <hr className="border-slate-700 my-8" />
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Performance Overview</h2>
        </div>
        {client && <DeliverableStats deliverables={deliverables} />}

        <hr className="border-slate-700 my-8" />
        <h2 className="text-xl font-semibold text-foreground mb-4">Detailed View</h2>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {["all", "pending_client_review", "approved", "changes_requested", "rejected"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${filter === f ? "gradient-bg text-white" : "bg-secondary text-muted-foreground"}`}>
              {f === "all" ? "All" : f.replace(/_/g, " ").charAt(0).toUpperCase() + f.replace(/_/g, " ").slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {sortedServices.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground">No deliverables</p></div>
          ) : (
            sortedServices.map(service => (
              <div key={service}>
                <h3 className="font-semibold text-lg mb-3 text-foreground">{service}</h3>
                <div className="space-y-3">
                  {grouped[service].map(d => {
                    const isForReview = ["pending_client_review", "client_reviewing"].includes(d.approval_status);
                    return (
                      <DeliverableCard
                        key={d.id}
                        deliverable={d}
                        onApprove={handleApprove}
                        onRequestChanges={(deliv) => { setSelectedDeliv(deliv); setModalType("request_changes"); }}
                        onReject={(deliv) => { setSelectedDeliv(deliv); setModalType("reject"); }}
                        onRate={() => setSurveyDeliverable(d)}
                        isRated={ratedIds.has(d.id)}
                        isForReview={isForReview}
                        submitting={submitting}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Feedback Survey Modal */}
      {surveyDeliverable && (
        <FeedbackSurveyModal
          deliverable={surveyDeliverable}
          client={client}
          onDone={() => {
            setRatedIds(prev => new Set([...prev, surveyDeliverable.id]));
            setSurveyDeliverable(null);
          }}
        />
      )}

      {/* Request Changes Modal */}
      <Dialog open={modalType === "request_changes"} onOpenChange={(open) => { if (!open) { setModalType(null); setNote(""); } }}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">What needs to change?</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe the changes needed..." rows={4} className="bg-secondary/50 border-border/50" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
              <Button onClick={handleRequestChanges} className="gradient-bg text-white" disabled={submitting || !note.trim()}>
                {submitting ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={modalType === "reject"} onOpenChange={(open) => { if (!open) { setModalType(null); setNote(""); } }}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Reject Deliverable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Reason for rejection</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain why this deliverable is being rejected..." rows={4} className="bg-secondary/50 border-border/50" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
              <Button onClick={handleReject} className="bg-destructive hover:bg-destructive/90" disabled={submitting || !note.trim()}>
                {submitting ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}