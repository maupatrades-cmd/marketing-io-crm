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
import { CheckCircle2, XCircle, AlertCircle, Plus, Clock, Star, Zap } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import LeadQualificationForm from "@/components/lead/LeadQualificationForm";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [newLead, setNewLead] = useState({
    business_name: "",
    contact_person: "",
    email: "",
    phone: "",
    notes: "",
    source: "phone_call_to_admin",
    best_time_to_call_date: "",
    best_time_to_call_time: "",
    interested_products: [],
  });
  const [detailOpen, setDetailOpen] = useState(false);
  const [verifiedLead, setVerifiedLead] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState("");

  const PACKAGES = [
    { id: "ignite", label: "Ignite" },
    { id: "accelerate", label: "Accelerate" },
    { id: "dominate", label: "Dominate" },
    { id: "street_pulse", label: "Street Pulse" },
    { id: "township_pulse", label: "Township Pulse" },
    { id: "not_sure", label: "Not Sure Yet" },
  ];

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
        const pending = allLeads.filter((l) => l.status === "pending_verification" || l.status === "verified");
        setLeads(pending);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  // Apply date filters
  useEffect(() => {
    let filtered = leads;
    if (dateFrom) {
      filtered = filtered.filter(l => new Date(l.created_date) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(l => new Date(l.created_date) <= new Date(dateTo));
    }
    setFilteredLeads(filtered);
  }, [leads, dateFrom, dateTo]);

  const handleApprove = async (lead) => {
    try {
      setSubmitting(true);
      const verifiedDate = new Date().toISOString().split('T')[0];
      
      // Update lead status
      await base44.entities.Lead.update(lead.id, {
        status: "verified",
        verified_date: verifiedDate,
      });

      // Auto-create a Client record from the verified lead
      await base44.entities.Client.create({
        business_name: lead.business_name,
        contact_person: lead.contact_person,
        email: lead.email,
        phone: lead.phone,
        address: lead.address || "",
        industry: lead.industry || "",
        status: "prospect",
        source: lead.source,
        package: lead.interested_products?.[0] || "none",
      });

      // Keep the lead in the list
      const updatedLeads = leads.map((l) =>
        l.id === lead.id ? { ...l, status: "verified", verified_date: verifiedDate } : l
      );
      setLeads(updatedLeads);
      setVerifiedLead({ ...lead, status: "verified", verified_date: verifiedDate });
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

  const handleMarkUrgent = async (lead) => {
    try {
      setSubmitting(true);
      // Create activity log and notify owner
      await base44.functions.invoke("send-owner-lead-notification", {
        lead_id: lead.id,
        urgency: "urgent",
        lead_name: lead.business_name,
      });
      
      // Update lead with urgency
      await base44.entities.Lead.update(lead.id, {
        urgency: "urgent",
      });
      
      // Update in list
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, urgency: "urgent" } : l))
      );
    } catch (error) {
      console.error("Error marking urgent:", error);
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
        source: newLead.source,
        status: "pending_verification",
        best_time_to_call_date: newLead.best_time_to_call_date,
        best_time_to_call_time: newLead.best_time_to_call_time,
        interested_products: newLead.interested_products,
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
        source: "phone_call_to_admin",
        best_time_to_call_date: "",
        best_time_to_call_time: "",
        interested_products: [],
      });
      setLoadLeadOpen(false);
    } catch (error) {
      console.error("Error loading lead:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout title="Verify Leads" subtitle={`${filteredLeads.length} leads (${leads.filter(l => l.status === "pending_verification").length} pending, ${leads.filter(l => l.status === "verified").length} verified)`}>
      {/* Load Lead Button + Filters */}
      <div className="mb-6 space-y-4">
        <Button
          onClick={() => setLoadLeadOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Load Lead
        </Button>

        {/* Date Filters */}
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
           <div className="text-center py-12">
             <p className="text-muted-foreground">Loading leads...</p>
           </div>
         ) : filteredLeads.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-success/30 mx-auto mb-3" />
              <p className="text-muted-foreground">{dateFrom || dateTo ? "No leads match these dates" : "No leads to verify"}</p>
            </div>
          ) : (
            filteredLeads.map((lead) => (
             <div key={lead.id} className={`glass rounded-xl p-6 space-y-4 border-l-4 ${lead.status === "verified" ? "border-success" : "border-warning"}`}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-foreground text-lg">{lead.business_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {lead.contact_person} · {lead.phone}
                  </p>
                </div>
                <Badge className={lead.status === "verified" ? "bg-success/20 text-success border-0" : "bg-warning/20 text-warning border-0"}>
                  {lead.status === "verified" ? "Verified" : "Pending"}
                </Badge>
              </div>

              {/* Qualification Form Inline */}
              <LeadQualificationForm
                initialData={lead}
                onSave={async (qualificationData) => {
                  try {
                    setSubmitting(true);
                    await base44.entities.Lead.update(lead.id, {
                      ...qualificationData,
                      qualified_by: user?.id,
                      qualification_complete: 
                        Object.values(qualificationData.warm_lead_criteria_v2 || {}).filter(c => c.answer !== null).length === 7 &&
                        qualificationData.qualification_extras?.lead_temperature !== null,
                    });
                    
                    // Update local state
                    setLeads(prev => prev.map(l => 
                      l.id === lead.id 
                        ? { ...l, ...qualificationData, qualified_by: user?.id }
                        : l
                    ));
                  } catch (error) {
                    console.error("Error saving qualification:", error);
                  } finally {
                    setSubmitting(false);
                  }
                }}
              />

              {/* Best Time to Call */}
              {lead.best_time_to_call_date && (
                <div className="bg-secondary/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Best Time to Call Back</p>
                  <div className="flex gap-2 text-sm text-foreground">
                    <Clock className="w-4 h-4 shrink-0 text-primary" />
                    <span>{format(new Date(lead.best_time_to_call_date), "MMM dd, yyyy")} at {lead.best_time_to_call_time}</span>
                  </div>
                </div>
              )}

              {/* Interested Products */}
              {lead.interested_products?.length > 0 && (
                <div className="bg-secondary/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Interested Products</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.interested_products.map((pkg) => (
                      <Badge key={pkg} variant="secondary" className="bg-primary/20 text-primary border-0">
                        {PACKAGES.find((p) => p.id === pkg)?.label || pkg}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {lead.notes && (
                <div className="bg-secondary/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">CPC Notes</p>
                  <p className="text-sm text-foreground">{lead.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end flex-wrap">
                {lead.status !== "verified" && (
                  <>
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
                  </>
                )}
                {lead.status === "verified" && (
                  <Button
                    onClick={() => handleMarkUrgent(lead)}
                    disabled={submitting}
                    className="gap-2 bg-rose-500 hover:bg-rose-600"
                  >
                    <Star className="w-4 h-4" />
                    Mark Urgent
                  </Button>
                )}
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
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="gradient-text">Load New Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4 flex-1 overflow-y-auto pr-4">
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
               <label className="text-sm font-medium text-foreground mb-1 block">Source</label>
               <select
                 value={newLead.source}
                 onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                 className="w-full px-3 py-2 rounded-md border border-input bg-secondary/50 text-foreground text-sm"
               >
                 <option value="phone_call_to_admin">Phone Call to Admin</option>
                 <option value="cpc_outbound">CPC Outbound</option>
                 <option value="field_agent_direct">Field Agent Direct</option>
                 <option value="inbound">Inbound</option>
                 <option value="referral">Referral</option>
               </select>
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-sm font-medium text-foreground mb-1 block">Best Time to Call (Date)</label>
                 <Input
                   type="date"
                   value={newLead.best_time_to_call_date}
                   onChange={(e) => setNewLead({ ...newLead, best_time_to_call_date: e.target.value })}
                   className="bg-secondary/50 border-border/50"
                 />
               </div>
               <div>
                 <label className="text-sm font-medium text-foreground mb-1 block">Best Time to Call (Time)</label>
                 <Input
                   type="time"
                   value={newLead.best_time_to_call_time}
                   onChange={(e) => setNewLead({ ...newLead, best_time_to_call_time: e.target.value })}
                   className="bg-secondary/50 border-border/50"
                 />
               </div>
             </div>
             <div>
               <label className="text-sm font-medium text-foreground mb-2 block">Interested Products</label>
               <div className="space-y-2">
                 {PACKAGES.map((pkg) => (
                   <label key={pkg.id} className="flex items-center gap-2 cursor-pointer">
                     <input
                       type="checkbox"
                       checked={newLead.interested_products.includes(pkg.id)}
                       onChange={(e) => {
                         if (e.target.checked) {
                           setNewLead({
                             ...newLead,
                             interested_products: [...newLead.interested_products, pkg.id],
                           });
                         } else {
                           setNewLead({
                             ...newLead,
                             interested_products: newLead.interested_products.filter((p) => p !== pkg.id),
                           });
                         }
                       }}
                       className="rounded border-input"
                     />
                     <span className="text-sm text-foreground">{pkg.label}</span>
                   </label>
                 ))}
               </div>
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
            <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card to-transparent pt-4 pb-2 flex justify-end gap-2 -mx-6 px-6">
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