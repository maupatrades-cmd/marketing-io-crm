import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Zap, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import InteractionNotesPanel from "@/components/notes/InteractionNotesPanel";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { notifyStaff } from "@/lib/clientNotifier";
import { logClientActivityFromBrowser } from "@/lib/activityLog";

const STATUS_COLORS = {
  pending_verification: "bg-warning/15 text-warning border-warning/30",
  verified: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  converted: "bg-primary/15 text-primary border-primary/30",
  duplicate: "bg-muted/40 text-muted-foreground border-border/40",
};

const SOURCE_OPTIONS = [
  "cpc_outbound", "field_agent_direct", "fnc_referral", "inbound",
  "referral", "phone_call_to_admin", "other",
];

const WARM_CRITERIA = [
  { key: "has_business_premises", label: "Has business premises" },
  { key: "has_trading_history", label: "Has trading history" },
  { key: "decision_maker_contacted", label: "Decision maker contacted" },
  { key: "expressed_interest", label: "Expressed interest" },
  { key: "has_budget_indication", label: "Has budget indication" },
  { key: "not_existing_client", label: "Not an existing client" },
  { key: "valid_contact_details", label: "Valid contact details" },
];

const EMPTY_BASE = {
  business_name: "", contact_person: "", phone: "", email: "",
  address: "", industry: "",
  source: "cpc_outbound", urgency: "normal",
  status: "pending_verification",
  notes: "",
  warm_lead_criteria: {
    has_business_premises: false, has_trading_history: false,
    decision_maker_contacted: false, expressed_interest: false,
    has_budget_indication: false, not_existing_client: false,
    valid_contact_details: false,
  },
};

function defaultSourceForRole(role) {
  if (role === "admin") return "phone_call_to_admin";
  if (role === "field_agent") return "field_agent_direct";
  if (role === "cpc") return "cpc_outbound";
  return "cpc_outbound"; // owner / unknown — they can override.
}

function headingForRole(role) {
  if (role === "admin") return { title: "Capture a New Lead", subtitle: "Owner will review and assign" };
  if (role === "cpc") return { title: "Lead Capture", subtitle: null };
  if (role === "field_agent") return { title: "My Leads", subtitle: null };
  return { title: "All Leads", subtitle: null };
}

// Resolve the owner's user id by checking AppUser first, then the legacy User
// directory. notifyStaff writes recipient_user_id and the bell-icon UI matches
// against whatever id the owner's session is keyed on.
async function findOwnerUserId() {
  try {
    const list = await base44.entities.AppUser.filter({ role: "owner" });
    const u = Array.isArray(list) ? list[0] : list;
    if (u?.id) return u.id;
  } catch { /* fall through */ }
  try {
    const list = await base44.entities.User.filter({ role: "owner" });
    const u = Array.isArray(list) ? list[0] : list;
    if (u?.id) return u.id;
  } catch { /* fall through */ }
  return null;
}

export default function Leads() {
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin";

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_BASE);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [staffOptions, setStaffOptions] = useState([]);
  const { toast } = useToast();

  const heading = useMemo(() => headingForRole(role), [role]);

  // Admin/owner can reassign the lead salesperson
  useEffect(() => {
    if (!['admin','owner'].includes(role)) return;
    base44.entities.AppUser.filter({})
      .then(rows => {
        const list = Array.isArray(rows) ? rows : [];
        setStaffOptions(list.filter(u => ['field_agent','cpc','admin','owner'].includes(u.role)));
      })
      .catch(() => {});
  }, [role]);

  const buildEmptyForm = () => ({
    ...EMPTY_BASE,
    source: defaultSourceForRole(role),
    salesperson_id:   user?.id || '',
    salesperson_name: user?.full_name || user?.email || '',
  });

  const load = () => base44.entities.Lead.list("-created_date", 200)
    .then(d => { setLeads(d); setLoading(false); })
    .catch(() => setLoading(false));

  useEffect(() => {
    if (isAdmin) { setLoading(false); return; }
    load();
    const unsubscribe = base44.entities.Lead.subscribe(e => {
      setLeads(prev =>
        e.type === 'create' ? [e.data, ...prev] :
        e.type === 'update' ? prev.map(l => l.id === e.id ? e.data : l) :
        prev.filter(l => l.id !== e.id)
      );
    });
    return () => unsubscribe();
  }, [isAdmin]);

  const filtered = leads.filter(l => {
    if (role === "field_agent" && l.created_by !== user?.email) return false;
    const matchSearch = !search || l.business_name?.toLowerCase().includes(search.toLowerCase()) || l.contact_person?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openCreate = () => { setEditing(null); setForm(buildEmptyForm()); setShowForm(true); };
  const openEdit = (l) => {
    setEditing(l);
    setForm({
      ...EMPTY_BASE,
      ...l,
      urgency: l.urgency || "normal",
      warm_lead_criteria: { ...EMPTY_BASE.warm_lead_criteria, ...(l.warm_lead_criteria || {}) },
      salesperson_id:   l.submitted_by || user?.id || '',
      salesperson_name: l.submitted_by_name || user?.full_name || user?.email || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.business_name?.trim() || !form.contact_person?.trim() || !form.phone?.trim()) {
      toast({ title: "Business name, contact person and phone are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Lead.update(editing.id, form);
        toast({ title: "Lead updated" });
        setShowForm(false);
        if (!isAdmin) load();
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        submitted_by:      form.salesperson_id   || user?.id || '',
        submitted_by_name: form.salesperson_name || user?.full_name || user?.email || '',
        status: "pending_verification",
        urgency: form.urgency || "normal",
        // Admins should never qualify the lead — strip the criteria object so
        // the row doesn't carry default-false claims that look like "qualified
        // by admin" downstream.
        warm_lead_criteria: isAdmin ? {} : form.warm_lead_criteria,
      };

      const created = await base44.entities.Lead.create(payload);
      const newLead = created?.id ? created : (Array.isArray(created) ? created[0] : null);
      const newLeadId = newLead?.id || created?.id || "";

      // Owner notification + activity log are best-effort — never block toast.
      if (payload.urgency === "urgent") {
        try {
          const ownerId = await findOwnerUserId();
          if (ownerId) {
            await notifyStaff({
              recipientUserId:   ownerId,
              type:              "lead_pending_verification",
              title:             `Urgent lead from ${payload.submitted_by_name || "admin"}`,
              body:              `${payload.business_name} — ${payload.contact_person} — ${payload.phone}. Captured from phone call. Admin marked URGENT.`,
              actionUrl:         newLeadId ? `/owner/leads/${newLeadId}` : "/owner/leads",
              relatedEntityType: "Lead",
              relatedEntityId:   newLeadId,
            });
          } else {
            console.warn("[Leads] urgent lead but no owner user id found");
          }
        } catch (err) {
          console.error("[Leads] notifyStaff failed:", err);
        }
      }

      try {
        if (newLeadId) {
          await logClientActivityFromBrowser({
            clientId:      newLeadId,
            eventType:     "lead_captured",
            eventCategory: "lead",
            eventSummary:  `Lead captured by ${role || "staff"}: ${payload.business_name}`,
            eventMetadata: {
              lead_id:           newLeadId,
              source:            payload.source,
              urgency:           payload.urgency,
              submitted_by_name: payload.submitted_by_name,
            },
          });
        }
      } catch (err) {
        console.error("[Leads] activity log failed:", err);
      }

      toast({
        title: payload.urgency === "urgent"
          ? "Lead captured and owner notified urgently"
          : "Lead captured — owner will review and assign",
      });
      setShowForm(false);
      if (!isAdmin) load();
    } catch (err) {
      console.error("[Leads] save failed:", err);
      toast({
        title: "Couldn't save lead",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const quickStatus = async (lead, status) => {
    await base44.entities.Lead.update(lead.id, { status });
    load();
  };

  const criteriaScore = (lead) => {
    if (!lead.warm_lead_criteria) return 0;
    return Object.values(lead.warm_lead_criteria).filter(Boolean).length;
  };

  const pendingCount = leads.filter(l => l.status === "pending_verification").length;
  const subtitle = isAdmin ? heading.subtitle : `${pendingCount} pending verification`;

  return (
    <AppLayout title={heading.title} subtitle={subtitle}>
      {isAdmin ? (
        // Admin-only: a single capture button. No list, no filters.
        <div className="glass rounded-xl p-12 text-center max-w-xl mx-auto">
          <Zap className="w-12 h-12 text-primary/60 mx-auto mb-3" />
          <p className="text-foreground font-semibold mb-1">Phone-call leads land here</p>
          <p className="text-sm text-muted-foreground mb-6">
            Capture the prospect now. Owner reviews and assigns from their queue.
          </p>
          <Button onClick={openCreate} className="gradient-bg text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-1" /> New Lead
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={openCreate} className="gradient-bg text-white hover:opacity-90">
              <Plus className="w-4 h-4 mr-1" /> Add Lead
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No leads found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(l => {
                const score = criteriaScore(l);
                return (
                  <div key={l.id} onClick={() => setSelected(selected?.id === l.id ? null : l)} className="glass rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground truncate">{l.business_name}</p>
                        {l.urgency === "urgent" && (
                          <Badge className="bg-destructive/15 text-destructive border-destructive/30 border text-[10px] gap-1">
                            <AlertTriangle className="w-3 h-3" /> Urgent
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{l.contact_person} · {l.phone} · <span className="capitalize">{l.source?.replace(/_/g, " ")}</span></p>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1">
                        {[...Array(7)].map((_, i) => (
                          <div key={i} className={`w-1.5 h-3 rounded-full ${i < score ? "bg-primary" : "bg-muted/40"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{score}/7</span>
                      <Badge className={`border text-xs capitalize ${STATUS_COLORS[l.status] || ""}`}>{l.status?.replace(/_/g, " ")}</Badge>
                    </div>
                    {l.status === "pending_verification" && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-success hover:bg-success/10" onClick={(e) => { e.stopPropagation(); quickStatus(l, "verified"); }}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); quickStatus(l, "rejected"); }}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); openEdit(l); }}>
                      Edit
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Expanded lead detail */}
          {selected && (
            <div className="mt-2 glass rounded-xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">{selected.business_name}</h3>
                <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={() => openEdit(selected)}>Edit</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <Info label="Contact" value={selected.contact_person} />
                <Info label="Phone" value={selected.phone} />
                <Info label="Email" value={selected.email} />
                <Info label="Industry" value={selected.industry} />
                <Info label="Source" value={selected.source?.replace(/_/g, " ")} />
                <Info label="Status" value={selected.status?.replace(/_/g, " ")} />
              </div>
              {selected.notes && <p className="text-xs text-muted-foreground italic">{selected.notes}</p>}

              <div className="pt-3 border-t border-border/30">
                <InteractionNotesPanel leadId={selected.id} />
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gradient-text">{editing ? "Edit Lead" : "New Lead"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2"><LField label="Business Name *" value={form.business_name} onChange={v => setForm(f => ({ ...f, business_name: v }))} /></div>
            {/* Salesperson field */}
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Salesperson</Label>
              {['admin','owner'].includes(role) && staffOptions.length > 0 ? (
                <Select
                  value={form.salesperson_id}
                  onValueChange={v => {
                    const s = staffOptions.find(u => u.id === v);
                    setForm(f => ({ ...f, salesperson_id: v, salesperson_name: s?.full_name || s?.email || '' }));
                  }}
                >
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {staffOptions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name || s.email} ({(s.role || '').replace(/_/g,' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="bg-secondary/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground">
                  {form.salesperson_name || user?.full_name || user?.email || 'You'}
                </div>
              )}
            </div>
            <LField label="Contact Person *" value={form.contact_person} onChange={v => setForm(f => ({ ...f, contact_person: v }))} />
            <LField label="Phone *" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            <LField label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
            <LField label="Industry" value={form.industry} onChange={v => setForm(f => ({ ...f, industry: v }))} />
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Status — owner/admin only when editing. Hidden for admin on
                create because admin always submits pending_verification. */}
            {(editing || (!isAdmin && role !== "field_agent")) && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Urgency toggle — primarily for admin's phone-call capture, but
                useful to any role flagging a high-priority lead. */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <Checkbox
                  id="urgency"
                  checked={form.urgency === "urgent"}
                  onCheckedChange={v => setForm(f => ({ ...f, urgency: v ? "urgent" : "normal" }))}
                />
                <span className="text-sm text-foreground">
                  <AlertTriangle className="w-4 h-4 text-destructive inline -mt-0.5 mr-1" />
                  Urgent — owner needs this immediately
                </span>
              </label>
            </div>

            {/* Warm-lead qualification: hidden for admin (admin captures, doesn't
                qualify). Visible for cpc + field_agent + owner. */}
            {!isAdmin && (
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-2 block">Warm Lead Criteria (7-point)</Label>
                <div className="grid grid-cols-1 gap-2">
                  {WARM_CRITERIA.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={key}
                        checked={form.warm_lead_criteria?.[key] || false}
                        onCheckedChange={v => setForm(f => ({ ...f, warm_lead_criteria: { ...f.warm_lead_criteria, [key]: v } }))}
                      />
                      <label htmlFor={key} className="text-sm text-foreground cursor-pointer">{label}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-secondary/50 border-border/50 h-16" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gradient-bg text-white hover:opacity-90">{saving ? "Saving…" : "Save Lead"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function LField({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input value={value || ""} onChange={e => onChange(e.target.value)} className="bg-secondary/50 border-border/50" />
    </div>
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