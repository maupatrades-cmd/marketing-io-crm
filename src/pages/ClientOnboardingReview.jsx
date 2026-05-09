import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle2, Clock, AlertCircle, ArrowRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/customAuth";

const STATUS_COLORS = {
  not_started: "bg-muted/40 text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  submitted: "bg-success/15 text-success",
  reviewed: "bg-secondary/40 text-secondary-foreground",
};

// Round 4: SLA red flag if a submission has been waiting > N days for review.
const SLA_DAYS = 3;

function daysSince(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)));
}

export default function ClientOnboardingReview() {
  const [submissions, setSubmissions] = useState([]);
  const [clients, setClients] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [marking, setMarking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSubmissions();
    
    // Subscribe to real-time updates
    const unsubSubs = base44.entities.ClientOnboardingSubmission.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        loadSubmissions();
      } else if (event.type === 'delete') {
        setSubmissions(prev => prev.filter(s => s.id !== event.id));
      }
    });

    const unsubClients = base44.entities.Client.subscribe((event) => {
      if (event.type === 'update' && event.id) {
        setClients(prev => ({ ...prev, [event.id]: event.data }));
      }
    });

    return () => {
      unsubSubs();
      unsubClients();
    };
  }, []);

  const loadSubmissions = async () => {
    try {
      const subs = await base44.entities.ClientOnboardingSubmission.list("-submitted_at", 100);
      setSubmissions(subs);
      
      // Load associated clients
      const clientIds = [...new Set(subs.map(s => s.client_id).filter(Boolean))];
      if (clientIds.length > 0) {
        try {
          const clientData = {};
          for (const id of clientIds) {
            const result = await base44.entities.Client.filter({ id }, "", 1);
            if (result) {
              clientData[id] = Array.isArray(result) ? result[0] : result;
            }
          }
          setClients(clientData);
        } catch (clientErr) {
          console.error("Failed to load client data:", clientErr);
        }
      }
      setLoading(false);
    } catch (err) {
      toast({ title: "Error loading submissions", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  // Sort oldest unreviewed first (Round 4 SLA discipline).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = submissions.filter(s => {
      const client = s.client_name || "";
      return !q || client.toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      // Submitted-and-not-reviewed first, oldest submitted_at first.
      const aPending = a.submission_status === "submitted";
      const bPending = b.submission_status === "submitted";
      if (aPending !== bPending) return aPending ? -1 : 1;
      const at = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity;
      const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity;
      return at - bt;
    });
  }, [submissions, search]);

  const markAsReviewed = async (submission) => {
    setMarking(true);
    try {
      await base44.entities.ClientOnboardingSubmission.update(submission.id, {
        submission_status: "reviewed",
        reviewed_at: new Date().toISOString(),
      });
      loadSubmissions();
      setSelected(null);
      toast({ title: "Marked as reviewed", description: `${submission.client_name}'s form has been marked as reviewed` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setMarking(false);
  };

  // Round 4: review and hand off to head_of_tech in one action. The Task
  // is created with status='open' so head_of_tech sees it; an InternalMessage
  // is also written with recipient_role='head_of_tech' so the assignment is
  // visible in /mail. Round 6 (Task 6A) extends this with auto-creating
  // Deliverables from the deal's FulfilmentTemplate.
  const reviewAndHandOff = async (submission) => {
    setMarking(true);
    try {
      const me = await getCurrentUser().catch(() => null);
      const myId = me?.id || "";
      const myEmail = me?.email || "";

      // 1. Update submission state
      await base44.entities.ClientOnboardingSubmission.update(submission.id, {
        submission_status: "reviewed",
        reviewed_at: new Date().toISOString(),
      });

      // 2. Create a Task for head_of_tech
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      try {
        await base44.entities.Task.create({
          title: `Begin fulfilment — ${submission.client_name}`,
          description: `Onboarding form reviewed. Start fulfilment for ${submission.client_name}. Open the client to see brand assets, business info, and deliverable expectations.`,
          client_id: submission.client_id,
          client_name: submission.client_name,
          deal_id: submission.deal_id || "",
          status: "open",
          priority: "high",
          auto_generated: true,
          due_date: dueDate,
        });
      } catch (taskErr) {
        console.error("[ClientOnboardingReview] Task.create failed (non-fatal):", taskErr);
      }

      // 3. Notify head_of_tech via InternalMessage (recipient_role enum
      //    includes head_of_tech — see InternalMessage.jsonc).
      try {
        await base44.entities.InternalMessage.create({
          from_id:        myId,
          from_email:     myEmail,
          recipient_role: "head_of_tech",
          subject:        `Fulfilment kickoff: ${submission.client_name}`,
          message:        `Onboarding form for ${submission.client_name} has been reviewed and handed off. A Task has been created. Open /clients/${submission.client_id} to review the form details.`,
          message_type:   "general",
          client_id:      submission.client_id,
          client_name:    submission.client_name,
          priority:       "normal",
          status:         "new",
          read:           false,
        });
      } catch (msgErr) {
        console.error("[ClientOnboardingReview] InternalMessage.create failed (non-fatal):", msgErr);
      }

      // 4. Round 6 Task 6A: auto-provision Deliverables from the deal's
      //    FulfilmentTemplate. Look up the Deal to get the package code,
      //    then invoke the server function which is idempotent on
      //    (client_id, deal_id). Wrapped in try/catch — non-fatal if there's
      //    no template for the package or the lookup fails. Admin still
      //    has the Task as a manual fallback.
      try {
        let packageCode = "";
        if (submission.deal_id) {
          try {
            const deals = await base44.entities.Deal.filter({ id: submission.deal_id });
            const deal = Array.isArray(deals) ? deals[0] : deals;
            packageCode = String(deal?.package || "").trim();
          } catch (dealErr) {
            console.error("[ClientOnboardingReview] Deal lookup failed (non-fatal):", dealErr);
          }
        }

        if (packageCode) {
          let token = "";
          try { token = localStorage.getItem("mio_session_token") || ""; } catch { /* ignore */ }
          await base44.functions.invoke("auto-create-deliverables-from-template", {
            token,
            client_id:    submission.client_id,
            deal_id:      submission.deal_id || "",
            package_code: packageCode,
          });
        }
      } catch (delivErr) {
        console.error("[ClientOnboardingReview] auto-Deliverables failed (non-fatal):", delivErr);
      }

      loadSubmissions();
      setSelected(null);
      toast({
        title: "Reviewed & handed off",
        description: `${submission.client_name} routed to head_of_tech. Task created and team notified.`,
      });
    } catch (err) {
      toast({ title: "Hand-off failed", description: err.message, variant: "destructive" });
    }
    setMarking(false);
  };

  return (
    <AppLayout title="Onboarding Forms" subtitle="Client submissions">
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No submissions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
           {filtered.map(s => {
             const days = daysSince(s.submitted_at);
             const overdue = s.submission_status === "submitted" && days > SLA_DAYS;
             const client = clients[s.client_id];
             return (
               <div key={s.id} onClick={() => setSelected(s)} className={`glass rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all ${overdue ? "border border-destructive/40" : ""}`}>
                 <div className={`w-2 h-2 rounded-full shrink-0 ${overdue ? "bg-destructive" : "bg-primary"}`} />
                 <div className="flex-1 min-w-0">
                   <p className="font-semibold text-foreground">{s.client_name}</p>
                   <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                     {client?.contact_person && <p>👤 {client.contact_person}</p>}
                     {client?.phone && <p>📱 {client.phone}</p>}
                     {client?.status && <p>Status: <span className="capitalize">{client.status}</span></p>}
                     {s.submitted_at && <p>{new Date(s.submitted_at).toLocaleDateString()} · {days}d ago</p>}
                   </div>
                 </div>
                 {overdue && (
                   <Badge className="text-xs bg-destructive/15 text-destructive border-destructive/40">
                     SLA: {days}d
                   </Badge>
                 )}
                 <Badge className={`text-xs border ${STATUS_COLORS[s.submission_status]} capitalize`}>{s.submission_status.replace(/_/g, " ")}</Badge>
               </div>
             );
           })}
         </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="gradient-text">{selected.client_name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Business Section */}
              <div>
                <h3 className="font-bold text-foreground mb-3">Business Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoField label="Legal Name" value={selected.business_legal_name} />
                  <InfoField label="Trading Name" value={selected.trading_name} />
                  <InfoField label="CIPC Number" value={selected.cipc_registration_number} />
                  <InfoField label="VAT Number" value={selected.vat_number} />
                  <InfoField label="Employees" value={selected.number_of_employees} />
                  <InfoField label="Year Started" value={selected.year_business_started} />
                </div>
              </div>

              {/* Contact Section */}
              <div>
                <h3 className="font-bold text-foreground mb-3">Primary Contact</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoField label="Name" value={selected.primary_contact_name} />
                  <InfoField label="Role" value={selected.primary_contact_role} />
                  <InfoField label="Phone" value={selected.primary_contact_phone} />
                  <InfoField label="Email" value={selected.primary_contact_email} />
                  <InfoField label="WhatsApp" value={selected.primary_contact_whatsapp} />
                </div>
              </div>

              {/* Brand Section */}
              {selected.brand_colours_primary && (
                <div>
                  <h3 className="font-bold text-foreground mb-3">Brand</h3>
                  <div className="space-y-2 text-sm">
                    <InfoField label="Primary Colour" value={selected.brand_colours_primary} />
                    <InfoField label="Secondary Colour" value={selected.brand_colours_secondary} />
                    <InfoField label="Voice Tone" value={selected.brand_voice_tone} />
                  </div>
                </div>
              )}

              {/* Description Section */}
              {selected.business_description && (
                <div>
                  <h3 className="font-bold text-foreground mb-3">Details</h3>
                  <p className="text-sm text-muted-foreground mb-2">{selected.business_description}</p>
                </div>
              )}

              {/* Submission Status */}
              <div className="border-t border-border/30 pt-4">
                <p className="text-xs text-muted-foreground mb-2">Status: <Badge className={`text-xs border ${STATUS_COLORS[selected.submission_status]} capitalize`}>{selected.submission_status.replace(/_/g, " ")}</Badge></p>
                {selected.submitted_at && <p className="text-xs text-muted-foreground">Submitted: {new Date(selected.submitted_at).toLocaleString()}</p>}
                {selected.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed: {new Date(selected.reviewed_at).toLocaleString()}</p>}
              </div>
            </div>

            {/* Actions */}
            {selected.submission_status === "submitted" && (
              <div className="flex gap-2 mt-6 flex-wrap">
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button variant="outline" onClick={() => markAsReviewed(selected)} disabled={marking}>
                  {marking ? "Working…" : "Mark as Reviewed"}
                </Button>
                <Button onClick={() => reviewAndHandOff(selected)} disabled={marking} className="gradient-bg text-white hover:opacity-90">
                  {marking ? "Working…" : (<>Review &amp; hand off to head_of_tech <ArrowRight className="w-4 h-4 ml-1" /></>)}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}