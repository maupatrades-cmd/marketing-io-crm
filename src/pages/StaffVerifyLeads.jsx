import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";
import { CheckCircle2, XCircle, AlertCircle, Plus, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function StaffVerifyLeads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clarificationOpen, setClarificationOpen] = useState(false);
  const [clarificationLead, setClarificationLead] = useState(null);
  const [clarificationMsg, setClarificationMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadLeadOpen, setLoadLeadOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    business_name: "",
    contact_person: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [verifiedLead, setVerifiedLead] = useState(null);

  // Admin-only access check
  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "owner") {
      navigate("/staff");
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        const allLeads = await base44.entities.Lead.list("-created_date", 200);
        const pending = allLeads.filter((l) => l.status === "pending_verification");
        setLeads(pending);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  const handleApprove = async (lead) => {
    try {
      setSubmitting(true);
      const updated = await base44.entities.Lead.update(lead.id, {
        status: "verified",
        verified_date: new Date().toISOString().split('T')[0],
      });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setVerifiedLead({ ...lead, status: "verified", verified_date: new Date().toISOString().split('T')[0] });
      setDetailOpen(true);
    } catch (error) {
      console.error("Error approving lead:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClarification = async (lead) => {
    try {
      setSubmitting(true);
      await base44.entities.Lead.update(lead.id, {
        status: "needs_clarification",
        notes: `Clarification requested: ${clarificationMsg}`,
      });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setClarificationOpen(false);
      setClarificationMsg("");
    } catch (error) {
      console.error("Error requesting clarification:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (lead) => {
    try {
      setSubmitting(true);
      await base44.entities.Lead.update(lead.id, {
        status: "rejected",
      });
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    } catch (error) {
      console.error("Error rejecting lead:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadLead = async () => {
    if (!newLead.business_name.trim() || !newLead.contact_person.trim()) return;

    try {
      setSubmitting(true);
      const lead = await base44.entities.Lead.create({
        business_name: newLead.business_name,
        contact_person: newLead.contact_person,
        email: newLead.email,
        phone: newLead.phone,
        notes: newLead.notes,
        status: "pending_verification",
        warm_lead_criteria: {
          has_business_premises: false,
          has_trading_history: false,
          decision_maker_contacted: false,
          expressed_interest: false,
          has_budget_indication: false,
        },
      });

      setLeads((prev) => [lead, ...prev]);
      setNewLead({
        business_name: "",
        contact_person: "",
        email: "",
        phone: "",
        notes: "",
      });
      setLoadLeadOpen(false);
    } catch (error) {
      console.error("Error loading lead:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout title="Verify Leads" subtitle={`${leads.length} pending`}>
      {/* Load Lead Button */}
      <div className="mb-6">
        <Button
          onClick={() => setLoadLeadOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Load Lead
        </Button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-success/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No leads to verify</p>
          </div>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="glass rounded-xl p-6 space-y-4 border-l-4 border-warning">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground text-lg">{lead.business_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {lead.contact_person} · {lead.phone}
                  </p>
                </div>
                <Badge className="bg-warning/20 text-warning border-0">Pending</Badge>
              </div>

              {/* Qualification Criteria */}
              <div className="bg-secondary/30 p-4 rounded-lg">
                <p className="text-sm font-semibold text-foreground mb-3">Qualification Criteria</p>
                <div className="space-y-2 text-sm">
                  {[
                    { key: "has_business_premises", label: "Business premises" },
                    { key: "has_trading_history", label: "Trading history" },
                    { key: "decision_maker_contacted", label: "Decision maker contacted" },
                    { key: "expressed_interest", label: "Expressed interest" },
                    { key: "has_budget_indication", label: "Budget indication" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      {lead.warm_lead_criteria?.[key] ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      <span className="text-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {lead.notes && (
                <div className="bg-secondary/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">CPC Notes</p>
                  <p className="text-sm text-foreground">{lead.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReject(lead)}
                  disabled={submitting}
                  className="gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClarificationLead(lead);
                    setClarificationOpen(true);
                  }}
                  disabled={submitting}
                  className="gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Clarification
                </Button>
                <Button
                  onClick={() => handleApprove(lead)}
                  disabled={submitting}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clarification Modal */}
      <Dialog open={clarificationOpen} onOpenChange={setClarificationOpen}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gradient-text">Request Clarification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Textarea
              placeholder="What information do you need clarified?"
              value={clarificationMsg}
              onChange={(e) => setClarificationMsg(e.target.value)}
              className="min-h-24 bg-secondary/50 border-border/50"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setClarificationOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleClarification(clarificationLead)}
                disabled={submitting || !clarificationMsg.trim()}
              >
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Verified Lead Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gradient-text flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" />
              Lead Verified
            </DialogTitle>
          </DialogHeader>
          {verifiedLead && (
            <div className="space-y-4 mt-4">
              {/* Business Info */}
              <div className="bg-success/5 border border-success/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Business Name</p>
                <p className="font-semibold text-foreground">{verifiedLead.business_name}</p>
              </div>

              {/* Contact Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-secondary/30 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Contact Person</p>
                  <p className="text-sm font-medium text-foreground">{verifiedLead.contact_person}</p>
                </div>
                <div className="bg-secondary/30 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="text-sm font-medium text-foreground">{verifiedLead.phone}</p>
                </div>
              </div>

              {verifiedLead.email && (
                <div className="bg-secondary/30 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium text-foreground">{verifiedLead.email}</p>
                </div>
              )}

              {/* Timestamp */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Verified</p>
                  <p className="text-sm text-foreground">{formatDistanceToNow(new Date(), { addSuffix: true })}</p>
                </div>
              </div>

              {verifiedLead.notes && (
                <div className="bg-secondary/30 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{verifiedLead.notes}</p>
                </div>
              )}

              <Button
                onClick={() => setDetailOpen(false)}
                className="w-full gradient-bg text-white hover:opacity-90"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Load Lead Modal */}
      <Dialog open={loadLeadOpen} onOpenChange={setLoadLeadOpen}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gradient-text">Load New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Business Name *</label>
              <Input
                placeholder="e.g., Tech Solutions Ltd"
                value={newLead.business_name}
                onChange={(e) => setNewLead({ ...newLead, business_name: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Contact Person *</label>
              <Input
                placeholder="e.g., John Doe"
                value={newLead.contact_person}
                onChange={(e) => setNewLead({ ...newLead, contact_person: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Phone</label>
              <Input
                placeholder="+27 123 456 7890"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Notes</label>
              <Textarea
                placeholder="CPC notes, context, or observations..."
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                className="min-h-20 bg-secondary/50 border-border/50"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setLoadLeadOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleLoadLead}
                disabled={submitting || !newLead.business_name.trim() || !newLead.contact_person.trim()}
              >
                Load Lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}