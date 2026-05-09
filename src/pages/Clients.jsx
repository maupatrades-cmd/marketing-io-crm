import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from '@/lib/customAuth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Users, AlertTriangle, ChevronRight, CheckCircle2, ClipboardList, History, Mail } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { notifyOnboardingMilestone } from "@/lib/notifications.js";
import { useToast } from "@/components/ui/use-toast";
import ClientTaskChecklist, { ONBOARDING_TASKS } from "@/components/clients/ClientTaskChecklist";
import ClientActivityFeed from "@/components/clients/ClientActivityFeed";
import TaskWidget from "@/components/tasks/TaskWidget";
import InteractionNotesPanel from "@/components/notes/InteractionNotesPanel";

const STATUS_COLORS = {
  lead: "bg-warning/15 text-warning border-warning/30",
  prospect: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  onboarding: "bg-primary/15 text-primary border-primary/30",
  active: "bg-success/15 text-success border-success/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted/40 text-muted-foreground border-border/40",
  churned: "bg-muted/40 text-muted-foreground border-border/40",
};

const PACKAGE_LABELS = {
  ignite: "Ignite", accelerate: "Accelerate", dominate: "Dominate",
  street_pulse: "Street Pulse", township_pulse: "Township Pulse", none: "—",
};

const LEAD_SCORE_BADGES = {
  hot:         { label: "Hot",         emoji: "🔥", className: "bg-destructive/15 text-destructive border-destructive/40" },
  warm:        { label: "Warm",        emoji: "☀️", className: "bg-orange-500/15 text-orange-400 border-orange-500/40" },
  nurture:     { label: "Nurture",     emoji: "🌱", className: "bg-success/15 text-success border-success/40" },
  cold:        { label: "Cold",        emoji: "❄️", className: "bg-muted/40 text-muted-foreground border-border/40" },
  unqualified: { label: "Unqualified", emoji: "—",  className: "bg-muted/30 text-muted-foreground/70 border-border/30" },
};

const EMPTY_CLIENT = {
  business_name: "", contact_person: "", email: "", phone: "",
  industry: "", status: "lead", package: "none",
  monthly_retainer: "", setup_fee_amount: "", notes: "", source: "inbound",
};

export default function Clients() {
   const [clients, setClients] = useState([]);
   const [loading, setLoading] = useState(true);
   const [search, setSearch] = useState("");
   const [statusFilter, setStatusFilter] = useState("all");
   const [showForm, setShowForm] = useState(false);
   const [editing, setEditing] = useState(null);
   const [form, setForm] = useState(EMPTY_CLIENT);
   const [saving, setSaving] = useState(false);
   const [selected, setSelected] = useState(null);
   const [sendingWelcomePack, setSendingWelcomePack] = useState(false);
   const navigate = useNavigate();
   const { toast } = useToast();

   const ONBOARDING_FIELDS = ["onboarding_form_returned", "debit_mandate_signed", "brand_assets_received", "setup_fee_paid", "go_live_acknowledged"];

   const load = async () => {
     const user = await getCurrentUser();
     if (!user) { window.location.href = '/login'; return; }
     if (user?.role !== "owner" && user?.role !== "admin") {
       window.location.href = "/staff/clients";
       return;
     }
     const d = await base44.entities.Client.list("-created_date", 200);
     setClients(d);
     setLoading(false);
   };
   useEffect(() => { load(); }, []);

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.business_name?.toLowerCase().includes(search.toLowerCase()) || c.contact_person?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => { setEditing(null); setForm(EMPTY_CLIENT); setShowForm(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY_CLIENT, ...c }); setShowForm(true); };

  const logActivity = (clientId, clientName, event_type, event_label, from_value = null, to_value = null) => {
    base44.entities.ClientActivityLog.create({
      client_id: clientId,
      client_name: clientName,
      event_type,
      event_label,
      ...(from_value ? { from_value } : {}),
      ...(to_value ? { to_value } : {}),
    }).catch(() => {});
  };

  const createOnboardingTasks = async (clientId, clientName) => {
    const existing = await base44.entities.Task.filter({ client_id: clientId });
    if (existing.length > 0) return; // already created
    await base44.entities.Task.bulkCreate(
      ONBOARDING_TASKS.map(t => ({
        title: t.title,
        client_id: clientId,
        client_name: clientName,
        priority: t.priority,
        status: "todo",
      }))
    );
  };

  const save = async () => {
    setSaving(true);
    const data = { ...form, monthly_retainer: Number(form.monthly_retainer) || 0, setup_fee_amount: Number(form.setup_fee_amount) || 0 };
    const justMovedToOnboarding = editing && editing.status !== "onboarding" && data.status === "onboarding";

    const MILESTONE_LABELS = {
      setup_fee_paid: "Setup Fee Paid",
      onboarding_form_returned: "Onboarding Form Returned",
      debit_mandate_signed: "Debit Mandate Signed",
      brand_assets_received: "Brand Assets Received",
      go_live_acknowledged: "Go-Live Acknowledged",
    };

    if (editing) {
      await base44.entities.Client.update(editing.id, data);

      // Log status change
      if (editing.status !== data.status) {
        logActivity(editing.id, data.business_name, "status_change",
          `Status changed from "${editing.status?.replace(/_/g, " ")}" to "${data.status?.replace(/_/g, " ")}"`,
          editing.status, data.status);
      }

      // Log milestone changes
      ONBOARDING_FIELDS.forEach(field => {
        if (!editing[field] && data[field]) {
          logActivity(editing.id, data.business_name, "milestone",
            `Milestone reached: ${MILESTONE_LABELS[field] || field.replace(/_/g, " ")}`);
        }
      });

      if (justMovedToOnboarding) {
        await createOnboardingTasks(editing.id, data.business_name);
        toast({ title: "Onboarding checklist created", description: `${ONBOARDING_TASKS.length} tasks added for ${data.business_name}` });
      }
      ONBOARDING_FIELDS.forEach(field => {
        if (!editing[field] && data[field] && data.email) {
          notifyOnboardingMilestone(data, field).then(() => {
            toast({ title: "Client notified", description: `Email sent: ${field.replace(/_/g, " ")}` });
          }).catch(() => {});
        }
      });
    } else {
      const created = await base44.entities.Client.create(data);
      if (created?.id) {
        // Log initial status on creation
        logActivity(created.id, data.business_name, "status_change",
          `Client created with status "${data.status?.replace(/_/g, " ")}"`, null, data.status);
        if (data.status === "onboarding") {
          await createOnboardingTasks(created.id, data.business_name);
          toast({ title: "Onboarding checklist created", description: `${ONBOARDING_TASKS.length} tasks added for ${data.business_name}` });
        }

        // Fire portal invitation. Failure does NOT roll back the Client record.
        if (data.email) {
          let token = "";
          try { token = localStorage.getItem("mio_session_token") || ""; } catch { /* ignore */ }
          try {
            const res = await base44.functions.invoke("provision-client-user", {
              token,
              client_id: created.id,
            });
            const payload = res?.data ?? res;
            if (payload?.success && payload?.already_exists) {
              toast({ title: "Client added", description: `Portal access already exists for ${data.email}` });
            } else if (payload?.success) {
              toast({ title: "Client added", description: `Portal invitation sent to ${data.email}` });
            } else {
              console.error("provision-client-user failed:", payload);
              toast({
                title: "Client added but invitation email failed",
                description: "You can resend from the client detail page.",
                variant: "destructive",
              });
            }
          } catch (err) {
            console.error("provision-client-user error:", err);
            toast({
              title: "Client added but invitation email failed",
              description: "You can resend from the client detail page.",
              variant: "destructive",
            });
          }
        }
      }
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const resendWelcomePack = async (client) => {
    setSendingWelcomePack(true);
    try {
      // Find the client's deal
      const deals = await base44.entities.Deal.filter({ client_id: client.id, stage: "closed_won" });
      const deal = Array.isArray(deals) ? deals[0] : deals;
      
      if (!deal) {
        toast({ title: "No closed deal found", description: "Welcome Pack can only be sent for closed-won deals", variant: "destructive" });
        setSendingWelcomePack(false);
        return;
      }

      // Send welcome pack via function
      await base44.functions.invoke("sendWelcomePack", {
        dealId: deal.id,
        clientId: client.id
      });

      toast({ title: "Welcome Pack sent", description: `Email sent to ${client.email}` });
    } catch (err) {
      toast({ title: "Error sending Welcome Pack", description: err.message, variant: "destructive" });
    }
    setSendingWelcomePack(false);
  };

  return (
    <AppLayout title="Clients" subtitle={`${clients.filter(c => c.status === "active").length} active`}>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-secondary/50 border-border/50">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="gradient-bg text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> Add Client
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No clients found</p>
        </div>
      ) : (
        <div className="space-y-2">
           {filtered.map(c => (
             <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
               className="glass rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{c.business_name?.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{c.business_name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.contact_person} · {c.email}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                {c.lead_score && LEAD_SCORE_BADGES[c.lead_score] && (
                  <Badge className={`border text-xs ${LEAD_SCORE_BADGES[c.lead_score].className}`}>
                    <span className="mr-1">{LEAD_SCORE_BADGES[c.lead_score].emoji}</span>
                    {LEAD_SCORE_BADGES[c.lead_score].label}
                  </Badge>
                )}
                <Badge className={`border text-xs ${STATUS_COLORS[c.status] || "bg-muted/40 text-muted-foreground border-border/40"} capitalize`}>{c.status?.replace(/_/g, " ")}</Badge>
                <span className="text-xs text-muted-foreground">{PACKAGE_LABELS[c.package] || "—"}</span>
                {c.monthly_retainer > 0 && <span className="text-sm font-semibold text-foreground">R{c.monthly_retainer?.toLocaleString()}/mo</span>}
                {c.acceleration_triggered && <AlertTriangle className="w-4 h-4 text-destructive" />}
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground/40 transition-transform ${selected?.id === c.id ? "rotate-90" : ""}`} />
            </div>
          ))}
        </div>
      )}

      {/* Detail moved to /clients/:id */}
       {false && (
        <div className="mt-2 glass rounded-xl p-5 space-y-4 animate-fade-in">
         <div className="flex items-center justify-between">
           <h3 className="font-semibold text-foreground">{selected.business_name}</h3>
           <div className="flex gap-2">
             <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 gap-1" onClick={() => resendWelcomePack(selected)} disabled={sendingWelcomePack}>
               <Mail className="w-3 h-3" /> {sendingWelcomePack ? "Sending..." : "Resend Welcome Pack"}
             </Button>
             <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => openEdit(selected)}>Edit</Button>
           </div>
         </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <Info label="Phone" value={selected.phone} />
            <Info label="Industry" value={selected.industry} />
            <Info label="Source" value={selected.source?.replace(/_/g, " ")} />
            <Info label="Debit Order" value={selected.debit_order_date} />
            <Info label="Contract Start" value={selected.contract_start_date} />
            <Info label="Go-Live" value={selected.go_live_date} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "setup_fee_paid", label: "Setup Fee Paid" },
              { key: "onboarding_form_returned", label: "Onboarding Form" },
              { key: "debit_mandate_signed", label: "Debit Mandate" },
              { key: "brand_assets_received", label: "Brand Assets" },
              { key: "go_live_acknowledged", label: "Go-Live ACK" },
            ].map(({ key, label }) => (
              <div key={key} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${selected[key] ? "border-success/30 text-success bg-success/10" : "border-border/30 text-muted-foreground"}`}>
                <CheckCircle2 className="w-3 h-3" /> {label}
              </div>
            ))}
          </div>
          {selected.notes && <p className="text-xs text-muted-foreground italic">{selected.notes}</p>}

          {/* Task Checklist */}
          <div className="pt-3 border-t border-border/30">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Onboarding Tasks</h4>
            </div>
            <ClientTaskChecklist client={selected} />
          </div>

          {/* Open Tasks */}
          <div className="pt-3 border-t border-border/30">
            <TaskWidget clientId={selected.id} title="Open Tasks" limit={5} />
          </div>

          {/* Interaction Notes */}
           <div className="pt-3 border-t border-border/30">
             <InteractionNotesPanel clientId={selected.id} />
           </div>

          {/* Activity Log */}
           <div className="pt-3 border-t border-border/30">
             <div className="flex items-center gap-2 mb-3">
               <History className="w-4 h-4 text-primary" />
               <h4 className="text-sm font-semibold text-foreground">Activity Log</h4>
             </div>
             <ClientActivityFeed clientId={selected.id} />
           </div>
          </div>
          )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gradient-text">{editing ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2"><FormField label="Business Name *" value={form.business_name} onChange={v => setForm(f => ({ ...f, business_name: v }))} /></div>
            <FormField label="Contact Person *" value={form.contact_person} onChange={v => setForm(f => ({ ...f, contact_person: v }))} />
            <FormField label="Email *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
            <FormField label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            <FormField label="Industry" value={form.industry} onChange={v => setForm(f => ({ ...f, industry: v }))} />
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Package</Label>
              <Select value={form.package} onValueChange={v => setForm(f => ({ ...f, package: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PACKAGE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <FormField label="Monthly Retainer (R)" value={form.monthly_retainer} onChange={v => setForm(f => ({ ...f, monthly_retainer: v }))} type="number" />
            <FormField label="Setup Fee (R)" value={form.setup_fee_amount} onChange={v => setForm(f => ({ ...f, setup_fee_amount: v }))} type="number" />
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-secondary/50 border-border/50 h-20" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gradient-bg text-white hover:opacity-90">{saving ? "Saving…" : "Save Client"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function FormField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input type={type} value={value || ""} onChange={e => onChange(e.target.value)} className="bg-secondary/50 border-border/50" />
    </div>
  );
}