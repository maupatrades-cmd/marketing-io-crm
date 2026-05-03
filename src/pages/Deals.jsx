import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from '@/lib/customAuth';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, TrendingUp, ChevronRight, Bell, BellOff, CheckSquare, FileText } from "lucide-react";
import { generateContractPDF } from "@/lib/contractGenerator";
import AppLayout from "@/components/AppLayout";
import { notifyDealStageChange } from "@/lib/notifications.js";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const STAGES = ["new_lead", "discovery_visit", "proposal_sent", "negotiation", "closed_won", "closed_lost", "onboarding"];
const STAGE_COLORS = {
  new_lead: "bg-primary/15 text-primary border-primary/30",
  discovery_visit: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  proposal_sent: "bg-warning/15 text-warning border-warning/30",
  negotiation: "bg-accent/15 text-accent border-accent/30",
  closed_won: "bg-success/15 text-success border-success/30",
  closed_lost: "bg-muted/40 text-muted-foreground border-border/40",
  onboarding: "bg-primary/25 text-primary border-primary/40",
};

const PACKAGES = ["ignite", "accelerate", "dominate", "street_pulse", "township_pulse", "none"];

const EMPTY = {
  client_name: "", client_id: "", deal_type: "core_package", package: "none",
  add_on_name: "", stage: "new_lead", setup_fee: "", monthly_retainer: "",
  probability: "50", source: "inbound", closer_id: "", closer_name: "",
  client_onboarded: false, commission_generated: false, notes: "",
};

// Commission rates — same for field agent AND owner
const SETUP_RATE = 0.10;   // 10% of setup fee
const RETAINER_RATE = 0.10; // 10% of monthly retainer (month 1)

async function generateCloserCommissions(deal) {
  if (!deal.closer_id || deal.commission_generated) return;
  const today = new Date().toISOString().split("T")[0];
  const payroll_month = today.slice(0, 7);
  const commissions = [];

  if (deal.setup_fee > 0) {
    commissions.push({
      staff_id: deal.closer_id,
      staff_name: deal.closer_name || "Owner",
      staff_role: deal.closer_id === "owner" ? "founder" : "field_agent",
      commission_type: "setup_commission",
      deal_id: deal.id,
      client_id: deal.client_id,
      client_name: deal.client_name,
      package_or_addon: deal.package !== "none" ? deal.package : deal.add_on_name,
      base_amount: deal.setup_fee,
      rate_percent: SETUP_RATE * 100,
      commission_amount: Math.round(deal.setup_fee * SETUP_RATE),
      qualifying_event: "Client onboarded — setup fee commission",
      qualifying_event_date: today,
      payroll_month,
      status: "pending",
    });
  }

  if (deal.monthly_retainer > 0) {
    commissions.push({
      staff_id: deal.closer_id,
      staff_name: deal.closer_name || "Owner",
      staff_role: deal.closer_id === "owner" ? "founder" : "field_agent",
      commission_type: "retainer_commission",
      deal_id: deal.id,
      client_id: deal.client_id,
      client_name: deal.client_name,
      package_or_addon: deal.package !== "none" ? deal.package : deal.add_on_name,
      base_amount: deal.monthly_retainer,
      rate_percent: RETAINER_RATE * 100,
      commission_amount: Math.round(deal.monthly_retainer * RETAINER_RATE),
      qualifying_event: "Client onboarded — retainer commission (month 1)",
      qualifying_event_date: today,
      payroll_month,
      status: "pending",
    });
  }

  if (commissions.length > 0) {
    await base44.entities.Commission.bulkCreate(commissions);
    await base44.entities.Deal.update(deal.id, { commission_generated: true });
  }
}

export default function Deals() {
   const [deals, setDeals] = useState([]);
   const [clients, setClients] = useState([]);
   const [users, setUsers] = useState([]);
   const [loading, setLoading] = useState(true);
   const [search, setSearch] = useState("");
   const [stageFilter, setStageFilter] = useState("all");
   const [showForm, setShowForm] = useState(false);
   const [editing, setEditing] = useState(null);
   const [form, setForm] = useState(EMPTY);
   const [saving, setSaving] = useState(false);
   const [notifyClient, setNotifyClient] = useState(true);
   const [selectedDeal, setSelectedDeal] = useState(null);
   const [showDetail, setShowDetail] = useState(false);
   const [generatingContract, setGeneratingContract] = useState(false);
   const [currentUser, setCurrentUser] = useState(null);
   const { toast } = useToast();

   const load = async () => {
     const user = await getCurrentUser();
     if (!user) { window.location.href = '/login'; return; }
     setCurrentUser(user);

     // Role-based redirects
     if (user?.role === "head_of_tech" || user?.role === "driver") {
       window.location.href = "/staff";
       return;
     }
     if (user?.role === "client") {
       window.location.href = "/client-portal";
       return;
     }

     const [d, c, u] = await Promise.all([
       base44.entities.Deal.list("-created_date", 200),
       base44.entities.Client.list("-created_date", 200),
       base44.entities.User.list(),
     ]);

     setDeals(d); 
     setClients(c); 
     setUsers(u); 
     setLoading(false);
   };

   useEffect(() => { load(); }, []);

   const filtered = deals.filter(d => {
     const matchSearch = !search || d.client_name?.toLowerCase().includes(search.toLowerCase());
     const matchStage = stageFilter === "all" || d.stage === stageFilter;

     // Role-based filter
     if (currentUser?.role === "field_agent" && d.closer_id !== currentUser.id) return false;
     if (currentUser?.role === "cpc" && d.cpc_id !== currentUser.id) return false;

     return matchSearch && matchStage;
   });

  const openCreate = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (d) => { setEditing(d); setForm({ ...EMPTY, ...d, setup_fee: d.setup_fee || "", monthly_retainer: d.monthly_retainer || "" }); setShowForm(true); };
  
  const generateContract = async (deal) => {
    setGeneratingContract(true);
    try {
      const client = clients.find(c => c.id === deal.client_id);
      if (!client) throw new Error("Client not found");
      
      // Package data for the generator
      const packageLabel = deal.package !== "none" ? deal.package : deal.add_on_name || "Custom Package";
      const packageData = { label: packageLabel, softSLA: "5", hardSLA: "10", deliverables: [] };
      
      // Generate PDF
      const pdfBlob = await generateContractPDF(deal, client, packageData);
      
      // Create Contract record
      const contractRef = `MIO-MSA-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
      const contract = await base44.entities.Contract.create({
        client_id: deal.client_id,
        client_name: client.business_name,
        deal_id: deal.id,
        package: deal.package,
        status: "draft",
        document_url: URL.createObjectURL(pdfBlob),
      });
      
      // Open PDF in new tab
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank");
      
      toast({ title: "Contract generated", description: "PDF opened in a new tab. Contract saved." });
      setShowDetail(false);
      load();
    } catch (err) {
      toast({ title: "Error generating contract", description: err.message, variant: "destructive" });
    }
    setGeneratingContract(false);
  };

  const save = async () => {
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const data = {
      ...form,
      setup_fee: Number(form.setup_fee) || 0,
      monthly_retainer: Number(form.monthly_retainer) || 0,
      probability: Number(form.probability) || 0,
      ...(form.client_onboarded && !editing?.client_onboarded ? { client_onboarded_date: today } : {}),
    };
    const stageChanged = editing && editing.stage !== form.stage;
    const justOnboarded = form.client_onboarded && !editing?.client_onboarded && !editing?.commission_generated;

    let savedDeal;
    if (editing) {
      await base44.entities.Deal.update(editing.id, data);
      savedDeal = { ...editing, ...data };
    } else {
      savedDeal = await base44.entities.Deal.create(data);
    }

    if (justOnboarded && savedDeal?.closer_id) {
      await generateCloserCommissions(savedDeal);
      toast({ title: "Commissions generated", description: `Setup + retainer commissions created for ${savedDeal.closer_name || "closer"}` });
    }

    if (notifyClient && stageChanged) {
      const client = clients.find(c => c.id === form.client_id);
      if (client?.email) {
        notifyDealStageChange(client, form.stage).then(() => {
          toast({ title: "Notification sent", description: `Email sent to ${client.email}` });
        }).catch(() => {});
      }
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  // Pipeline summary
  const pipeline = STAGES.filter(s => s !== "closed_lost").map(s => ({
    stage: s,
    count: deals.filter(d => d.stage === s).length,
    value: deals.filter(d => d.stage === s).reduce((sum, d) => sum + (d.monthly_retainer || 0), 0),
  }));

  return (
    <AppLayout title="Deals" subtitle={`${deals.filter(d => d.stage === "closed_won").length} won`}>
      {(currentUser?.role === "field_agent" || currentUser?.role === "cpc") && (
        <div className="mb-4 p-3 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm">
          Showing your deals only
        </div>
      )}
      {/* Pipeline strip */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
        {pipeline.map(p => (
          <button key={p.stage} onClick={() => setStageFilter(stageFilter === p.stage ? "all" : p.stage)}
            className={`flex-shrink-0 glass rounded-lg px-3 py-2 text-center cursor-pointer transition-all border ${
              stageFilter === p.stage ? "border-primary/60 shadow-glow-purple" : "border-border/30 hover:border-border/60"
            }`}>
            <p className="text-lg font-bold text-foreground">{p.count}</p>
            <p className="text-xs text-muted-foreground capitalize whitespace-nowrap">{p.stage.replace(/_/g, " ")}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by client…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Button onClick={openCreate} className="gradient-bg text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> Add Deal
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No deals found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
           <div key={d.id} className="glass rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-all cursor-pointer" onClick={() => { setSelectedDeal(d); setShowDetail(true); }}>
             <div className="flex-1 min-w-0">
               <p className="font-semibold text-foreground truncate">{d.client_name || "Unknown Client"}</p>
               <p className="text-xs text-muted-foreground capitalize">{d.deal_type?.replace(/_/g, " ")} · {d.package !== "none" ? d.package : d.add_on_name || "—"}{d.closer_name ? ` · ${d.closer_name}` : ""}</p>
             </div>
             <div className="hidden sm:flex items-center gap-3 shrink-0">
               {d.monthly_retainer > 0 && <span className="text-sm font-semibold text-foreground">R{d.monthly_retainer?.toLocaleString()}/mo</span>}
               {d.probability > 0 && <span className="text-xs text-muted-foreground">{d.probability}%</span>}
               {d.client_onboarded && <Badge className="border text-xs bg-success/15 text-success border-success/30">Onboarded</Badge>}
               <Badge className={`border text-xs capitalize ${STAGE_COLORS[d.stage] || "bg-muted/40 text-muted-foreground border-border/40"}`}>{d.stage?.replace(/_/g, " ")}</Badge>
             </div>
             <Button size="sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); openEdit(d); }}>
               <ChevronRight className="w-4 h-4" />
             </Button>
           </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gradient-text">{editing ? "Edit Deal" : "New Deal"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Client</Label>
              <Select value={form.client_id} onValueChange={v => {
                const c = clients.find(c => c.id === v);
                setForm(f => ({ ...f, client_id: v, client_name: c?.business_name || "" }));
              }}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select client…" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Deal Type</Label>
              <Select value={form.deal_type} onValueChange={v => setForm(f => ({ ...f, deal_type: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="core_package">Core Package</SelectItem>
                  <SelectItem value="add_on">Add-On</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.deal_type === "core_package" ? (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Package</Label>
                <Select value={form.package} onValueChange={v => setForm(f => ({ ...f, package: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{PACKAGES.map(p => <SelectItem key={p} value={p} className="capitalize">{p.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <DField label="Add-On Name" value={form.add_on_name} onChange={v => setForm(f => ({ ...f, add_on_name: v }))} />
            )}
            <DField label="Setup Fee (R)" value={form.setup_fee} onChange={v => setForm(f => ({ ...f, setup_fee: v }))} type="number" />
            <DField label="Monthly Retainer (R)" value={form.monthly_retainer} onChange={v => setForm(f => ({ ...f, monthly_retainer: v }))} type="number" />
            <DField label="Probability %" value={form.probability} onChange={v => setForm(f => ({ ...f, probability: v }))} type="number" />
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Source</Label>
              <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cpc_outbound","field_agent_direct","fnc_referral","inbound","referral","other"].map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Closer / Seller</Label>
              <Select value={form.closer_id || "owner"} onValueChange={v => {
                if (v === "owner") {
                  setForm(f => ({ ...f, closer_id: "owner", closer_name: "Owner (Thapelo)" }));
                } else {
                  const u = users.find(u => u.id === v);
                  setForm(f => ({ ...f, closer_id: v, closer_name: u?.full_name || u?.email || "" }));
                }
              }}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select closer…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner (Thapelo)</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-secondary/50 border-border/50 h-20" />
            </div>
            <div className="col-span-2">
              <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${form.client_onboarded ? "border-success/40 bg-success/8" : "border-border/40 bg-secondary/30"}`}>
                <Checkbox
                  id="onboarded"
                  checked={!!form.client_onboarded}
                  onCheckedChange={v => setForm(f => ({ ...f, client_onboarded: !!v }))}
                  disabled={!!editing?.commission_generated}
                  className="mt-0.5"
                />
                <div>
                  <label htmlFor="onboarded" className={`text-sm font-medium cursor-pointer ${form.client_onboarded ? "text-success" : "text-foreground"}`}>
                    Client Onboarded ✓
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {editing?.commission_generated
                      ? "Commissions already generated for this deal."
                      : "Tick this once the client is fully onboarded. This will auto-generate setup & retainer commissions for the closer."}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setNotifyClient(n => !n)}>
              {notifyClient
                ? <Bell className="w-4 h-4" style={{ color: "#a764e6" }} />
                : <BellOff className="w-4 h-4" style={{ color: "#6b6b85" }} />}
              <span className="text-xs" style={{ color: notifyClient ? "#a8a8c0" : "#6b6b85" }}>
                {notifyClient ? "Email client on stage change" : "No notification"}
              </span>
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="gradient-bg text-white hover:opacity-90">{saving ? "Saving…" : "Save Deal"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deal Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gradient-text">Deal Details</DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Client</Label>
                <p className="text-sm text-foreground font-semibold">{selectedDeal.client_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Package</Label>
                <p className="text-sm text-foreground">{selectedDeal.package !== "none" ? selectedDeal.package : selectedDeal.add_on_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Setup Fee</Label>
                  <p className="text-sm text-foreground font-semibold">R{(selectedDeal.setup_fee || 0).toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Monthly Retainer</Label>
                  <p className="text-sm text-foreground font-semibold">R{(selectedDeal.monthly_retainer || 0).toLocaleString()}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stage</Label>
                <Badge className={`border text-xs capitalize ${STAGE_COLORS[selectedDeal.stage]}`}>{selectedDeal.stage?.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => generateContract(selectedDeal)} 
                  disabled={generatingContract}
                  className="gradient-bg text-white hover:opacity-90"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {generatingContract ? "Generating..." : "Generate Contract"}
                </Button>
                <Button variant="ghost" onClick={() => setShowDetail(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function DField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input type={type} value={value || ""} onChange={e => onChange(e.target.value)} className="bg-secondary/50 border-border/50" />
    </div>
  );
}