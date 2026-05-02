import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, DollarSign, CheckCircle2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";

const PACKAGE_DATA = {
  ignite:         { label: "Ignite",         setup: 3980,  monthly: 490,  term: 12 },
  accelerate:     { label: "Accelerate",     setup: 6500,  monthly: 890,  term: 12 },
  dominate:       { label: "Dominate",       setup: 9800,  monthly: 1490, term: 12 },
  street_pulse:   { label: "Street Pulse",   setup: 700,   monthly: 4000, term: 3  },
  township_pulse: { label: "Township Pulse", setup: 2200,  monthly: 0,    term: 1  },
  add_on:         { label: "Add-On",         setup: 0,     monthly: 0,    term: 12 },
};

const ADD_ONS = [
  "ai_chatbot","whatsapp_automation","reputation_management","google_business_profile",
  "email_newsletter","short_form_video","sms_marketing","staff_training_workshop",
  "marketing_audit","competitor_analysis","ai_content_writing","crm_training_setup",
  "print_signage","domain_hosting_email","website_maintenance","paid_ads_management",
  "ecommerce_setup","business_plan","website_design_only","business_plan_website_bundle",
];

const SETUP_RATE = 0.10;
const RETAINER_RATE = 0.10;

const today = () => new Date().toISOString().split("T")[0];
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};
const plusMonths = (date, n) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
};

export default function LogSale() {
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  // Client selection
  const [isNewClient, setIsNewClient] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClient, setNewClient] = useState({ business_name: "", contact_person: "", phone: "", email: "", address: "" });

  // Deal
  const [selectedPackage, setSelectedPackage] = useState("");
  const [selectedAddOn, setSelectedAddOn] = useState("");
  const [setupFee, setSetupFee] = useState(0);
  const [monthlyFee, setMonthlyFee] = useState(0);
  const [term, setTerm] = useState(12);

  // Attribution
  const [closerId, setCloserId] = useState("");
  const [closerName, setCloserName] = useState("");
  const [cpcId, setCpcId] = useState("");
  const [cpcName, setCpcName] = useState("");

  // Dates
  const [closeDate, setCloseDate] = useState(today());
  const [startDate, setStartDate] = useState(plusDays(7));

  // Notes
  const [notes, setNotes] = useState("");

  useEffect(() => {
    Promise.all([
      base44.entities.Client.list("-created_date", 200),
      base44.entities.User.list(),
      base44.auth.me(),
    ]).then(([c, u, me]) => {
      setClients(c);
      setUsers(u);
      setCurrentUser(me);
      setCloserId(me?.id || "");
      setCloserName(me?.full_name || me?.email || "");
      setLoading(false);
    });
  }, []);

  const handlePackageChange = (pkg) => {
    setSelectedPackage(pkg);
    if (pkg !== "add_on") {
      const p = PACKAGE_DATA[pkg];
      setSetupFee(p.setup);
      setMonthlyFee(p.monthly);
      setTerm(p.term);
    } else {
      setSetupFee(0);
      setMonthlyFee(0);
      setTerm(12);
    }
  };

  const totalDealValue = setupFee + (monthlyFee * term);

  const handleSubmit = async () => {
    if (!selectedPackage) { toast({ title: "Select a package", variant: "destructive" }); return; }
    if (!isNewClient && !selectedClientId) { toast({ title: "Select a client", variant: "destructive" }); return; }
    if (isNewClient && !newClient.business_name) { toast({ title: "Enter client name", variant: "destructive" }); return; }

    setSaving(true);
    const d = today();
    const payroll_month = d.slice(0, 7);

    // 1. Create client if new
    let clientId = selectedClientId;
    let clientName = clients.find(c => c.id === selectedClientId)?.business_name || "";

    if (isNewClient) {
      const created = await base44.entities.Client.create({
        business_name: newClient.business_name,
        contact_person: newClient.contact_person,
        phone: newClient.phone,
        email: newClient.email,
        address: newClient.address,
        status: "onboarding",
      });
      clientId = created.id;
      clientName = created.business_name;
    }

    // 2. Create Deal
    const deal = await base44.entities.Deal.create({
      client_id: clientId,
      client_name: clientName,
      deal_type: selectedPackage === "add_on" ? "add_on" : "core_package",
      package: selectedPackage !== "add_on" ? selectedPackage : "none",
      add_on_name: selectedPackage === "add_on" ? selectedAddOn : "",
      stage: "closed_won",
      setup_fee: setupFee,
      monthly_retainer: monthlyFee,
      probability: 100,
      closer_id: closerId,
      closer_name: closerName,
      notes,
    });

    // 3. Commission for closer
    const commissions = [];
    if (setupFee > 0) {
      commissions.push({
        staff_id: closerId,
        staff_name: closerName,
        staff_role: "field_agent",
        commission_type: "setup_commission",
        deal_id: deal.id,
        client_id: clientId,
        client_name: clientName,
        package_or_addon: selectedPackage !== "add_on" ? selectedPackage : selectedAddOn,
        base_amount: setupFee,
        rate_percent: SETUP_RATE * 100,
        commission_amount: Math.round(setupFee * SETUP_RATE),
        qualifying_event: "Closed sale — setup fee commission",
        qualifying_event_date: d,
        payroll_month,
        status: "pending",
      });
    }
    if (monthlyFee > 0) {
      commissions.push({
        staff_id: closerId,
        staff_name: closerName,
        staff_role: "field_agent",
        commission_type: "retainer_commission",
        deal_id: deal.id,
        client_id: clientId,
        client_name: clientName,
        package_or_addon: selectedPackage !== "add_on" ? selectedPackage : selectedAddOn,
        base_amount: monthlyFee,
        rate_percent: RETAINER_RATE * 100,
        commission_amount: Math.round(monthlyFee * RETAINER_RATE),
        qualifying_event: "Closed sale — retainer commission (month 1)",
        qualifying_event_date: d,
        payroll_month,
        status: "pending",
      });
    }

    // 4. CPC closure bonus R250
    if (cpcId) {
      commissions.push({
        staff_id: cpcId,
        staff_name: cpcName,
        staff_role: "cpc",
        commission_type: "cpc_closure_bonus",
        deal_id: deal.id,
        client_id: clientId,
        client_name: clientName,
        package_or_addon: selectedPackage !== "add_on" ? selectedPackage : selectedAddOn,
        base_amount: 250,
        rate_percent: 100,
        commission_amount: 250,
        qualifying_event: "CPC qualified lead — closure bonus",
        qualifying_event_date: d,
        payroll_month,
        status: "pending",
      });
    }

    if (commissions.length > 0) {
      await base44.entities.Commission.bulkCreate(commissions);
      await base44.entities.Deal.update(deal.id, { commission_generated: true });
    }

    // 5. Contract (draft)
    await base44.entities.Contract.create({
      client_id: clientId,
      client_name: clientName,
      deal_id: deal.id,
      package: selectedPackage !== "add_on" ? selectedPackage : "add_on",
      add_on_name: selectedPackage === "add_on" ? selectedAddOn : "",
      setup_fee: setupFee,
      monthly_retainer: monthlyFee,
      initial_term_months: term,
      contract_start_date: startDate,
      contract_end_date: plusMonths(startDate, term),
      status: "draft",
      auto_renews: true,
    });

    // 6. Setup fee invoice
    await base44.entities.Invoice.create({
      client_id: clientId,
      client_name: clientName,
      deal_id: deal.id,
      invoice_type: "setup_fee",
      description: `Setup fee — ${selectedPackage !== "add_on" ? selectedPackage.replace(/_/g, " ") : selectedAddOn.replace(/_/g, " ")}`,
      amount: setupFee,
      total_amount: setupFee,
      issue_date: d,
      due_date: plusDays(7),
      status: "sent",
    });

    // 7. Auto-create ClientOnboarding record
    const adminUsers = users.filter(u => u.role === "admin" || u.role === "owner");
    const assignedAdmin = adminUsers[0] || null;
    await base44.entities.ClientOnboarding.create({
      deal_id: deal.id,
      client_id: clientId,
      client_name: clientName,
      assigned_admin_id: assignedAdmin?.id || closerId,
      assigned_admin_name: assignedAdmin?.full_name || closerName,
      current_phase: "phase1_contract_signed",
      overall_status: "in_progress",
      p1_client_added_to_crm: true,
      deal_won_date: d,
    });

    // 8. Auto tasks
    const adminUser = adminUsers[0];
    await base44.entities.Task.bulkCreate([
      {
        title: `Begin onboarding for ${clientName}`,
        description: `New sale logged. Package: ${selectedPackage.replace(/_/g, " ")}. Start date: ${startDate}.`,
        client_id: clientId,
        client_name: clientName,
        deal_id: deal.id,
        assigned_to: adminUser?.id || closerId,
        assigned_to_name: adminUser?.full_name || closerName,
        status: "open",
        priority: "high",
        due_date: plusDays(1),
        auto_generated: true,
      },
      ...(setupFee > 0 ? [{
        title: `Follow up on setup fee payment with ${clientName}`,
        description: `Setup invoice of R${setupFee.toLocaleString()} was issued. Follow up if not paid within 5 days.`,
        client_id: clientId,
        client_name: clientName,
        deal_id: deal.id,
        assigned_to: closerId,
        assigned_to_name: closerName,
        status: "open",
        priority: "medium",
        due_date: plusDays(5),
        auto_generated: true,
      }] : []),
    ]);

    setSaving(false);
    setDone(true);
    toast({
      title: "Sale logged!",
      description: `Setup invoice R${setupFee.toLocaleString()} issued. Onboarding queue updated.`,
    });
  };

  if (loading) return (
    <AppLayout title="Log a Sale">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (done) return (
    <AppLayout title="Log a Sale">
      <div className="max-w-lg mx-auto mt-16 glass rounded-2xl p-10 text-center">
        <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Sale Logged!</h2>
        <p className="text-muted-foreground mb-6">Deal, contract, invoice and onboarding task have been created.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setDone(false); setSelectedPackage(""); setSelectedClientId(""); setIsNewClient(false); setNewClient({ business_name: "", contact_person: "", phone: "", email: "", address: "" }); setNotes(""); setCpcId(""); setCpcName(""); }}>
            Log Another Sale
          </Button>
          <Button className="gradient-bg text-white" onClick={() => window.location.href = "/deals"}>
            View Deals
          </Button>
        </div>
      </div>
    </AppLayout>
  );

  const cpcs = users.filter(u => u.role === "cpc");

  return (
    <AppLayout title="Log a Sale" subtitle="Record a closed deal">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Step 1 — Client */}
        <Section step="1" title="Client">
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setIsNewClient(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${!isNewClient ? "gradient-bg text-white border-transparent" : "border-border/50 text-muted-foreground hover:border-border"}`}
            >
              Existing Client
            </button>
            <button
              onClick={() => setIsNewClient(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${isNewClient ? "gradient-bg text-white border-transparent" : "border-border/50 text-muted-foreground hover:border-border"}`}
            >
              New Client
            </button>
          </div>
          {!isNewClient ? (
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select existing client…" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <F label="Business Name *" value={newClient.business_name} onChange={v => setNewClient(n => ({ ...n, business_name: v }))} className="col-span-2" />
              <F label="Contact Person" value={newClient.contact_person} onChange={v => setNewClient(n => ({ ...n, contact_person: v }))} />
              <F label="Phone" value={newClient.phone} onChange={v => setNewClient(n => ({ ...n, phone: v }))} />
              <F label="Email" value={newClient.email} onChange={v => setNewClient(n => ({ ...n, email: v }))} />
              <F label="City" value={newClient.address} onChange={v => setNewClient(n => ({ ...n, address: v }))} />
            </div>
          )}
        </Section>

        {/* Step 2 — Package */}
        <Section step="2" title="Deal Details">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {Object.entries(PACKAGE_DATA).map(([key, p]) => (
              <button
                key={key}
                onClick={() => handlePackageChange(key)}
                className={`p-3 rounded-xl border text-left transition-all ${selectedPackage === key ? "border-primary/60 bg-primary/10 shadow-glow-purple" : "border-border/40 bg-secondary/30 hover:border-border"}`}
              >
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.setup > 0 ? `R${p.setup.toLocaleString()} setup` : ""}
                  {p.monthly > 0 ? ` · R${p.monthly.toLocaleString()}/mo` : ""}
                  {p.setup === 0 && p.monthly === 0 ? "Configure below" : ""}
                </p>
              </button>
            ))}
          </div>

          {selectedPackage === "add_on" && (
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground mb-1 block">Add-On Service</Label>
              <Select value={selectedAddOn} onValueChange={setSelectedAddOn}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Select add-on…" /></SelectTrigger>
                <SelectContent>
                  {ADD_ONS.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedPackage && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Setup Fee (R)</Label>
                <Input type="number" value={setupFee} onChange={e => setSetupFee(Number(e.target.value))} className="bg-secondary/50 border-border/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Monthly (R)</Label>
                <Input type="number" value={monthlyFee} onChange={e => setMonthlyFee(Number(e.target.value))} className="bg-secondary/50 border-border/50" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Term (months)</Label>
                <Input type="number" value={term} onChange={e => setTerm(Number(e.target.value))} className="bg-secondary/50 border-border/50" />
              </div>
              <div className="col-span-3 glass rounded-xl p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Deal Value</span>
                <span className="text-xl font-bold gradient-text">R{totalDealValue.toLocaleString()}</span>
              </div>
            </div>
          )}
        </Section>

        {/* Step 3 — Attribution */}
        <Section step="3" title="Closer Attribution">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Closer (who closed this deal?)</Label>
              <Select value={closerId} onValueChange={v => {
                const u = users.find(u => u.id === v);
                setCloserId(v);
                setCloserName(u?.full_name || u?.email || "");
              }}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}{u.id === currentUser?.id ? " (you)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Originating CPC <span className="text-muted-foreground/60">(optional — earns R250 bonus)</span></Label>
              <Select value={cpcId || "none"} onValueChange={v => {
                if (v === "none") { setCpcId(""); setCpcName(""); return; }
                const u = users.find(u => u.id === v);
                setCpcId(v);
                setCpcName(u?.full_name || u?.email || "");
              }}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="No CPC" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No CPC</SelectItem>
                  {cpcs.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* Step 4 — Dates */}
        <Section step="4" title="Important Dates">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Close Date</Label>
              <Input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} className="bg-secondary/50 border-border/50" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Expected Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-secondary/50 border-border/50" />
            </div>
          </div>
        </Section>

        {/* Step 5 — Notes */}
        <Section step="5" title="Notes">
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes about this sale…" className="bg-secondary/50 border-border/50 h-24" />
        </Section>

        {/* Submit */}
        <div className="glass rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            {selectedPackage && (
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-primary/15 text-primary border-primary/30 border text-xs">Deal ✓</Badge>
                {setupFee > 0 && <Badge className="bg-success/15 text-success border-success/30 border text-xs">Invoice R{setupFee.toLocaleString()}</Badge>}
                <Badge className="bg-accent/15 text-accent border-accent/30 border text-xs">Contract Draft</Badge>
                <Badge className="bg-warning/15 text-warning border-warning/30 border text-xs">Onboarding Task</Badge>
              </div>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={saving || !selectedPackage}
            className="gradient-bg text-white hover:opacity-90 px-8 shrink-0"
          >
            {saving ? "Logging Sale…" : "Log Sale"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ step, title, children }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-xs font-bold text-white shrink-0">{step}</div>
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function F({ label, value, onChange, className = "" }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="bg-secondary/50 border-border/50" />
    </div>
  );
}