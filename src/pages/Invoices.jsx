import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, FileText, AlertTriangle, XCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";
import { notifyClient } from "@/lib/clientNotifier";
import { PRODUCT_CATALOG, getProductById } from "@/data/ProductCatalog";
import CancelInvoiceModal from "@/components/invoices/CancelInvoiceModal";

const CUSTOM_PRODUCT_ID = "__custom__";

const MONTHLY_INVOICE_TYPES = new Set(["monthly_retainer", "add_on_monthly", "per_sms"]);

function prettyInvoiceType(t) {
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function priceForType(product, invoiceType) {
  if (!product) return 0;
  if (MONTHLY_INVOICE_TYPES.has(invoiceType)) return Number(product.monthly_price || 0);
  return Number(product.setup_price || 0);
}

const STATUS_COLORS = {
  draft: "bg-muted/40 text-muted-foreground border-border/40",
  sent: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  paid: "bg-success/15 text-success border-success/30",
  overdue: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted/40 text-muted-foreground border-border/40",
  partial: "bg-warning/15 text-warning border-warning/30",
};

const INVOICE_TYPES = [
  "setup_fee","monthly_retainer","add_on_setup","add_on_monthly",
  "once_off","per_sms","cancellation_fee","acceleration_amount",
];

const EMPTY = {
  client_id: "", client_name: "", invoice_type: "monthly_retainer",
  product_id: "", description: "", amount: "",
  vat_applicable: false, due_date: "",
  status: "sent", payment_method: "", notes: "",
};

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const { toast } = useToast();

  const load = () => Promise.all([
    base44.entities.Invoice.list("-created_date", 200),
    base44.entities.Client.list("-created_date", 200),
  ]).then(([inv, c]) => { setInvoices(inv); setClients(c); setLoading(false); });

  useEffect(() => { load(); }, []);

  const filtered = invoices.filter(i => {
    const matchSearch = !search || i.client_name?.toLowerCase().includes(search.toLowerCase()) || i.invoice_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const save = async () => {
    if (!form.client_id) {
      toast({ title: "Pick a client first", variant: "destructive" });
      return;
    }
    const amount = Number(form.amount) || 0;
    if (amount <= 0) {
      toast({ title: "Amount must be greater than zero", variant: "destructive" });
      return;
    }

    const product = form.product_id && form.product_id !== CUSTOM_PRODUCT_ID
      ? getProductById(form.product_id)
      : null;
    const description = (form.description || product?.name || prettyInvoiceType(form.invoice_type) || "Invoice item").trim();

    const lineItem = {
      product_id:   product ? product.id : "",
      product_name: product ? product.name : "",
      description,
      amount,
      quantity:     1,
    };

    setSaving(true);
    try {
      const res = await base44.functions.invoke("create-invoice", {
        client_id:  form.client_id,
        line_items: [lineItem],
        type:       form.invoice_type,
        due_date:   form.due_date || null,
        send_email: true,
      });
      const payload = res?.data ?? res;
      if (payload?.success) {
        toast({
          title: "Invoice created",
          description: payload.invoice_number ? `${payload.invoice_number} — email sent to client.` : "Email sent to client.",
        });
        setShowForm(false);
        load();
      } else {
        console.error("create-invoice failed:", payload);
        toast({
          title: "Couldn't create invoice",
          description: payload?.error || "Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("create-invoice error:", err);
      toast({
        title: "Couldn't create invoice",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    const extra = status === "paid" ? { payment_date: new Date().toISOString().split("T")[0] } : {};
    await base44.entities.Invoice.update(id, { status, ...extra });
    if (status === "paid") {
      const inv = invoices.find(i => i.id === id);
      if (inv?.client_id) {
        notifyClient({
          clientId: inv.client_id,
          type: "payment_received",
          title: `Payment received — R${(inv.total_amount || inv.amount || 0).toLocaleString()}`,
          body: "Thank you. Your payment has cleared and we're moving forward with your service.",
          relatedEntityType: "Invoice",
          relatedEntityId: id,
          actionUrl: "/client/invoices",
        });
      }
    }
    load();
  };

  const totalOverdue = invoices.filter(i => i.status === "overdue" || i.status === "failed").reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);
  const totalOutstanding = invoices.filter(i => ["sent", "overdue", "failed", "partial"].includes(i.status)).reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);
  const totalCollected = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);

  return (
    <AppLayout title="Invoices" subtitle="Billing & payments">
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SumCard label="Outstanding" value={totalOutstanding} color="text-warning" />
        <SumCard label="Overdue / Failed" value={totalOverdue} color="text-destructive" />
        <SumCard label="Collected (All Time)" value={totalCollected} color="text-success" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by client or invoice #…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-secondary/50 border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setForm(EMPTY); setShowForm(true); }} className="gradient-bg text-white hover:opacity-90">
          <Plus className="w-4 h-4 mr-1" /> New Invoice
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(inv => (
            <div key={inv.id} className="glass rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{inv.client_name || "Unknown"}</p>
                  {(inv.status === "overdue" || inv.status === "failed") && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {inv.invoice_number ? `${inv.invoice_number} · ` : ""}{inv.invoice_type?.replace(/_/g, " ")}
                  {inv.due_date ? ` · Due ${new Date(inv.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-base font-bold text-foreground">R{(inv.total_amount || inv.amount || 0).toLocaleString()}</span>
                <Badge className={`border text-xs ${STATUS_COLORS[inv.status] || ""}`}>{inv.status}</Badge>
                {inv.status === "sent" && (
                  <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10 text-xs h-7" onClick={() => updateStatus(inv.id, "paid")}>
                    Mark Paid
                  </Button>
                )}
                {inv.status === "overdue" && (
                  <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-7" onClick={() => updateStatus(inv.id, "failed")}>
                    Mark Failed
                  </Button>
                )}
                {inv.status !== "cancelled" && inv.status !== "paid" && (
                  <Button size="sm" variant="outline" className="border-muted-foreground/30 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 text-xs h-7 gap-1" onClick={() => setCancelTarget(inv)}>
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CancelInvoiceModal
        invoice={cancelTarget}
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={() => { setCancelTarget(null); load(); }}
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="gradient-text">New Invoice</DialogTitle>
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
              <Label className="text-xs text-muted-foreground mb-1 block">Invoice Type</Label>
              <Select value={form.invoice_type} onValueChange={v => setForm(f => {
                // Re-resolve auto-fill amount/description if a catalog product is selected.
                if (f.product_id && f.product_id !== CUSTOM_PRODUCT_ID) {
                  const p = getProductById(f.product_id);
                  if (p) {
                    return {
                      ...f,
                      invoice_type: v,
                      amount: String(priceForType(p, v)),
                      description: `${p.name} — ${prettyInvoiceType(v)}`,
                    };
                  }
                }
                return { ...f, invoice_type: v };
              })}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
                <SelectContent>{INVOICE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Select Product</Label>
              <Select value={form.product_id || ""} onValueChange={v => setForm(f => {
                if (v === CUSTOM_PRODUCT_ID) {
                  return { ...f, product_id: CUSTOM_PRODUCT_ID };
                }
                const p = getProductById(v);
                if (!p) return { ...f, product_id: v };
                return {
                  ...f,
                  product_id: v,
                  amount: String(priceForType(p, f.invoice_type)),
                  description: `${p.name} — ${prettyInvoiceType(f.invoice_type)}`,
                };
              })}>
                <SelectTrigger className="bg-secondary/50 border-border/50"><SelectValue placeholder="Pick from catalog…" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Packages</SelectLabel>
                    {PRODUCT_CATALOG.filter(p => p.type === "package" || p.type === "physical").map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — Setup R{Number(p.setup_price || 0).toLocaleString()} / Monthly R{Number(p.monthly_price || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Add-ons</SelectLabel>
                    {PRODUCT_CATALOG.filter(p => p.type === "addon").map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — Setup R{Number(p.setup_price || 0).toLocaleString()} / Monthly R{Number(p.monthly_price || 0).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Other</SelectLabel>
                    <SelectItem value={CUSTOM_PRODUCT_ID}>Custom item (enter manually)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <IField label="Amount (R)" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} type="number" />
            <IField label="Due Date" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} type="date" />
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary/50 border-border/50 h-16" placeholder="Auto-filled from product. Edit if you need." />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gradient-bg text-white hover:opacity-90">{saving ? "Saving…" : "Create Invoice"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function SumCard({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <p className={`text-xl font-bold ${color}`}>R{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function IField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <Input type={type} value={value || ""} onChange={e => onChange(e.target.value)} className="bg-secondary/50 border-border/50" />
    </div>
  );
}