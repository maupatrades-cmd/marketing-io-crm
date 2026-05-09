import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, FileText, Mail, CheckCircle2, ExternalLink, Repeat, Loader2, AlertTriangle, RefreshCw, Clock, Plus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";

// =============================================================================
// /admin/invoices — chase queue (Round 4 of recovery plan)
//
// Admin's most-used daily page. Strictly per-row visibility — NO aggregate
// revenue, profit, runway, or MRR widgets. The brief role permission matrix
// puts those on owner-only pages.
//
// Row actions wired:
//   - View detail (opens modal with line items + payment history)
//   - Send chase email (opens stage modal — Day 1 / 3 / 7 / 14 templates)
//   - Mark paid (EFT) (opens reference + date modal)
//   - Open client (navigate)
//
// Bulk actions: select multiple, send chase to all at one stage.
// Header action: "Generate this month's recurring batch" with dry-run preview.
//
// Tabs: All / Unpaid / Overdue / Paid / Cancelled.
// Overdue is computed: status='overdue' OR (status='sent' AND due_date<today).
// =============================================================================

const STATUS_COLOURS = {
  draft:     "bg-muted/40 text-muted-foreground border-border/40",
  sent:      "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  paid:      "bg-success/15 text-success border-success/30",
  overdue:   "bg-destructive/15 text-destructive border-destructive/30",
  failed:    "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted/40 text-muted-foreground border-border/40",
  partial:   "bg-warning/15 text-warning border-warning/30",
};

const CHASE_STAGES = [
  { value: "reminder",   label: "Day 1 — Friendly reminder",   help: "Light touch. They probably haven't seen the invoice yet." },
  { value: "firm",       label: "Day 3 — Firm reminder",       help: "Now overdue. Direct ask, polite tone." },
  { value: "final",      label: "Day 7 — Final notice",        help: "Last chance before service interruption messaging." },
  { value: "escalation", label: "Day 14 — Escalation",         help: "Account on hold. Heavy. Use sparingly." },
];

function getSessionToken() {
  try { return localStorage.getItem("mio_session_token") || ""; } catch { return ""; }
}

function daysOutstanding(invoice) {
  const due = invoice.due_date ? new Date(invoice.due_date).getTime() : null;
  if (!due || invoice.status === "paid" || invoice.status === "cancelled") return 0;
  return Math.max(0, Math.floor((Date.now() - due) / (24 * 60 * 60 * 1000)));
}

function isEffectivelyOverdue(invoice) {
  if (invoice.status === "overdue") return true;
  if (invoice.status === "sent" && invoice.due_date) {
    return new Date(invoice.due_date).getTime() < Date.now();
  }
  return false;
}

function fmtMoney(n) {
  const v = Number(n || 0);
  return `R${v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return s; }
}

export default function AdminInvoices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("unpaid");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modals
  const [detailOpen, setDetailOpen] = useState(false);
  const [chaseOpen, setChaseOpen] = useState(false);
  const [eftOpen, setEftOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  // Modal state
  const [activeInvoice, setActiveInvoice] = useState(null);
  const [chaseStage, setChaseStage] = useState("reminder");
  const [chaseCustomMessage, setChaseCustomMessage] = useState("");
  const [chaseSubmitting, setChaseSubmitting] = useState(false);
  const [eftReference, setEftReference] = useState("");
  const [eftDate, setEftDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eftNote, setEftNote] = useState("");
  const [eftSubmitting, setEftSubmitting] = useState(false);
  const [batchPreview, setBatchPreview] = useState(null);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [sweepSubmitting, setSweepSubmitting] = useState(false);
  const [renewalSubmitting, setRenewalSubmitting] = useState(false);

  // Create invoice modal
  const [createOpen, setCreateOpen] = useState(false);
  const [allClients, setAllClients] = useState([]);
  const [createForm, setCreateForm] = useState({ client_id: "", client_name: "", invoice_type: "once_off", amount: "", due_date: "", description: "", send_email: true });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    loadAll();
    base44.entities.Client.list("-created_date", 500).then(rows => setAllClients(Array.isArray(rows) ? rows : [])).catch(() => {});
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [invs, pays] = await Promise.all([
        base44.entities.Invoice.list("-issue_date", 500).catch(() => []),
        base44.entities.Payment.list("-created_date", 500).catch(() => []),
      ]);
      setInvoices(Array.isArray(invs) ? invs : []);
      setPayments(Array.isArray(pays) ? pays : []);
    } catch (err) {
      toast({ title: "Could not load invoices", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      // Tab filter
      switch (activeTab) {
        case "unpaid":
          if (inv.status !== "sent") return false;
          break;
        case "overdue":
          if (!isEffectivelyOverdue(inv)) return false;
          break;
        case "paid":
          if (inv.status !== "paid") return false;
          break;
        case "cancelled":
          if (inv.status !== "cancelled") return false;
          break;
        case "all":
        default:
          break;
      }
      // Search
      if (!q) return true;
      const haystack = [
        inv.invoice_number,
        inv.client_name,
        inv.invoice_type,
        inv.description,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, activeTab, search]);

  const counts = useMemo(() => ({
    all:       invoices.length,
    unpaid:    invoices.filter((i) => i.status === "sent").length,
    overdue:   invoices.filter(isEffectivelyOverdue).length,
    paid:      invoices.filter((i) => i.status === "paid").length,
    cancelled: invoices.filter((i) => i.status === "cancelled").length,
  }), [invoices]);

  const allOnPageSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0 && !allOnPageSelected;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const inv of filtered) next.delete(inv.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const inv of filtered) next.add(inv.id);
        return next;
      });
    }
  };

  // ---- Action handlers ---------------------------------------------------
  const openDetail = (inv) => {
    setActiveInvoice(inv);
    setDetailOpen(true);
  };

  const openChase = (inv) => {
    setActiveInvoice(inv);
    // Suggest a stage based on days outstanding
    const days = daysOutstanding(inv);
    const suggested = days >= 14 ? "escalation" : days >= 7 ? "final" : days >= 3 ? "firm" : "reminder";
    setChaseStage(suggested);
    setChaseCustomMessage("");
    setChaseOpen(true);
  };

  const openBulkChase = () => {
    if (selectedIds.size === 0) return;
    setActiveInvoice(null);  // signals bulk mode
    setChaseStage("reminder");
    setChaseCustomMessage("");
    setChaseOpen(true);
  };

  const openEft = (inv) => {
    setActiveInvoice(inv);
    setEftReference("");
    setEftDate(new Date().toISOString().slice(0, 10));
    setEftNote("");
    setEftOpen(true);
  };

  const submitChase = async () => {
    setChaseSubmitting(true);
    try {
      const targets = activeInvoice ? [activeInvoice.id] : Array.from(selectedIds);
      let okCount = 0;
      for (const id of targets) {
        try {
          await base44.functions.invoke("send-invoice-chase", {
            invoice_id: id,
            stage: chaseStage,
            token: getSessionToken(),
            custom_message: chaseCustomMessage || undefined,
          });
          okCount += 1;
        } catch (err) {
          console.error("[AdminInvoices] chase send failed for", id, err);
        }
      }
      toast({
        title: targets.length > 1 ? `Chase emails sent (${okCount}/${targets.length})` : "Chase email sent",
        description: chaseStage === "escalation" ? "Recipients placed on hold messaging." : undefined,
      });
      if (!activeInvoice) setSelectedIds(new Set());
      setChaseOpen(false);
    } finally {
      setChaseSubmitting(false);
    }
  };

  const submitEft = async () => {
    if (!activeInvoice || !eftReference.trim()) return;
    setEftSubmitting(true);
    try {
      const res = await base44.functions.invoke("mark-invoice-paid-eft", {
        invoice_id:        activeInvoice.id,
        gateway_reference: eftReference.trim(),
        paid_at:           eftDate,
        token:             getSessionToken(),
        note:              eftNote || undefined,
      });
      const payload = res?.data ?? res;
      if (payload?.success) {
        toast({ title: "Invoice marked paid", description: `${activeInvoice.invoice_number} — R${Number(activeInvoice.total_amount || 0).toFixed(2)}` });
        setEftOpen(false);
        await loadAll();
      } else {
        toast({ title: "Mark paid failed", description: payload?.error || "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Mark paid failed", description: err.message, variant: "destructive" });
    } finally {
      setEftSubmitting(false);
    }
  };

  const previewBatch = async () => {
    setBatchSubmitting(true);
    try {
      const res = await base44.functions.invoke("generate-monthly-retainer-invoices", {
        token: getSessionToken(),
        dry_run: true,
      });
      const payload = res?.data ?? res;
      setBatchPreview(payload);
      setBatchOpen(true);
    } catch (err) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    } finally {
      setBatchSubmitting(false);
    }
  };

  const confirmBatch = async () => {
    setBatchSubmitting(true);
    try {
      const res = await base44.functions.invoke("generate-monthly-retainer-invoices", {
        token: getSessionToken(),
        period: batchPreview?.period,
        dry_run: false,
      });
      const payload = res?.data ?? res;
      const created = payload?.created?.length || 0;
      toast({
        title: `Recurring batch generated`,
        description: `${created} invoices created · ${fmtMoney(payload?.total_amount || 0)} total`,
      });
      setBatchOpen(false);
      setBatchPreview(null);
      await loadAll();
    } catch (err) {
      toast({ title: "Batch generation failed", description: err.message, variant: "destructive" });
    } finally {
      setBatchSubmitting(false);
    }
  };

  const paymentsForInvoice = (invId) => payments.filter((p) => p.invoice_id === invId);

  const openCreate = () => {
    const defaultDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setCreateForm({ client_id: "", client_name: "", invoice_type: "once_off", amount: "", due_date: defaultDue, description: "", send_email: true });
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!createForm.client_id || !createForm.amount) return;
    setCreateSubmitting(true);
    try {
      const amount = Number(createForm.amount);
      const res = await base44.functions.invoke("create-invoice", {
        client_id: createForm.client_id,
        type: createForm.invoice_type,
        due_date: createForm.due_date || null,
        send_email: createForm.send_email,
        line_items: [{
          product_name: createForm.invoice_type.replace(/_/g, " "),
          description: createForm.description || createForm.invoice_type.replace(/_/g, " "),
          amount,
          quantity: 1,
        }],
      });
      const payload = res?.data ?? res;
      toast({ title: `Invoice created`, description: `${payload?.invoice_number || ""} — ${fmtMoney(amount)}` });
      setCreateOpen(false);
      await loadAll();
    } catch (err) {
      toast({ title: "Create failed", description: err.message, variant: "destructive" });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const runOverdueSweep = async () => {
    setSweepSubmitting(true);
    try {
      const res = await base44.functions.invoke("sweep-overdue-invoices", { token: getSessionToken() });
      const payload = res?.data ?? res;
      toast({
        title: `Overdue sweep complete`,
        description: `${payload.updated_count ?? 0} invoice(s) flipped to overdue. ${payload.admin_notifications_sent ?? 0} admin notification(s) sent.`,
      });
      await loadAll();
    } catch (err) {
      toast({ title: "Sweep failed", description: err.message, variant: "destructive" });
    } finally {
      setSweepSubmitting(false);
    }
  };

  const runRenewalSweep = async () => {
    setRenewalSubmitting(true);
    try {
      const res = await base44.functions.invoke("sweep-contract-renewals", { token: getSessionToken() });
      const payload = res?.data ?? res;
      toast({
        title: `Renewal reminders sent`,
        description: `${payload.sent_count ?? 0} sent, ${payload.skipped_count ?? 0} skipped.`,
      });
    } catch (err) {
      toast({ title: "Renewal sweep failed", description: err.message, variant: "destructive" });
    } finally {
      setRenewalSubmitting(false);
    }
  };

  return (
    <AppLayout
      title="Invoice chase queue"
      subtitle="Per-row visibility — no aggregate revenue or profit on this page."
    >
      <div className="space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice # or client"
                className="pl-9 w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button variant="outline" onClick={openBulkChase}>
                <Mail className="w-4 h-4 mr-2" /> Send chase to {selectedIds.size}
              </Button>
            )}
            <Button variant="outline" onClick={runOverdueSweep} disabled={sweepSubmitting}>
              <RefreshCw className={`w-4 h-4 mr-2 ${sweepSubmitting ? "animate-spin" : ""}`} />
              {sweepSubmitting ? "Sweeping…" : "Sweep overdue"}
            </Button>
            <Button variant="outline" onClick={runRenewalSweep} disabled={renewalSubmitting}>
              <Clock className={`w-4 h-4 mr-2 ${renewalSubmitting ? "animate-spin" : ""}`} />
              {renewalSubmitting ? "Sending…" : "Send renewal reminders"}
            </Button>
            <Button onClick={previewBatch} disabled={batchSubmitting}>
              <Repeat className="w-4 h-4 mr-2" />
              {batchSubmitting ? "Loading…" : "Generate this month's batch"}
            </Button>
            <Button onClick={openCreate} className="gradient-bg text-white">
              <Plus className="w-4 h-4 mr-2" /> Create invoice
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/40 -mb-px">
          {[
            { value: "all",       label: "All",       count: counts.all },
            { value: "unpaid",    label: "Unpaid",    count: counts.unpaid },
            { value: "overdue",   label: "Overdue",   count: counts.overdue },
            { value: "paid",      label: "Paid",      count: counts.paid },
            { value: "cancelled", label: "Cancelled", count: counts.cancelled },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setActiveTab(t.value); setSelectedIds(new Set()); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className="ml-2 text-xs text-muted-foreground">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b border-border/40">
              <tr>
                <th className="w-12 px-4 py-3 text-left">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={toggleSelectAll}
                    className={someSelected ? "data-[state=checked]:bg-warning" : ""}
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold">Invoice #</th>
                <th className="px-4 py-3 text-left font-semibold">Client</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Issued</th>
                <th className="px-4 py-3 text-left font-semibold">Due</th>
                <th className="px-4 py-3 text-right font-semibold">Days out</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  {search ? "No matches." : `Nothing in ${activeTab}.`}
                </td></tr>
              )}
              {!loading && filtered.map((inv) => {
                const days = daysOutstanding(inv);
                const overdueRow = isEffectivelyOverdue(inv);
                return (
                  <tr key={inv.id} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={() => toggleSelect(inv.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number || inv.id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{inv.client_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(inv.total_amount || inv.total || inv.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.due_date)}</td>
                    <td className={`px-4 py-3 text-right ${overdueRow && days >= 7 ? "text-destructive font-semibold" : days >= 3 ? "text-warning" : ""}`}>{days || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLOURS[inv.status] || STATUS_COLOURS.draft}>{inv.status || "draft"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" title="View" onClick={() => openDetail(inv)}>
                          <FileText className="w-4 h-4" />
                        </Button>
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <>
                            <Button size="sm" variant="ghost" title="Send chase email" onClick={() => openChase(inv)}>
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Mark paid (EFT)" onClick={() => openEft(inv)}>
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" title="Open client" onClick={() => navigate(`/clients/${inv.client_id}`)}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice {activeInvoice?.invoice_number || activeInvoice?.id?.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {activeInvoice && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-muted-foreground text-xs">Client</div><div>{activeInvoice.client_name || "—"}</div></div>
                <div><div className="text-muted-foreground text-xs">Type</div><div>{activeInvoice.invoice_type || "—"}</div></div>
                <div><div className="text-muted-foreground text-xs">Amount</div><div>{fmtMoney(activeInvoice.total_amount || activeInvoice.total || activeInvoice.amount)}</div></div>
                <div><div className="text-muted-foreground text-xs">Status</div><Badge className={STATUS_COLOURS[activeInvoice.status]}>{activeInvoice.status}</Badge></div>
                <div><div className="text-muted-foreground text-xs">Issued</div><div>{fmtDate(activeInvoice.issue_date)}</div></div>
                <div><div className="text-muted-foreground text-xs">Due</div><div>{fmtDate(activeInvoice.due_date)}</div></div>
                <div><div className="text-muted-foreground text-xs">Paid at</div><div>{fmtDate(activeInvoice.paid_at)}</div></div>
                <div><div className="text-muted-foreground text-xs">Method</div><div>{activeInvoice.payment_method || "—"}</div></div>
              </div>

              {Array.isArray(activeInvoice.line_items) && activeInvoice.line_items.length > 0 && (
                <div>
                  <div className="text-muted-foreground text-xs mb-2">Line items</div>
                  <div className="rounded-md border border-border/40">
                    {activeInvoice.line_items.map((li, i) => (
                      <div key={i} className="flex justify-between px-3 py-2 border-b border-border/20 last:border-b-0">
                        <span>{li.product_name || li.description || "—"}</span>
                        <span>{fmtMoney(Number(li.amount || 0) * Number(li.quantity || 1))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-muted-foreground text-xs mb-2">Payment history</div>
                {paymentsForInvoice(activeInvoice.id).length === 0 ? (
                  <div className="text-muted-foreground text-xs">No payments recorded.</div>
                ) : (
                  <div className="rounded-md border border-border/40">
                    {paymentsForInvoice(activeInvoice.id).map((p) => (
                      <div key={p.id} className="flex justify-between px-3 py-2 border-b border-border/20 last:border-b-0">
                        <div>
                          <div>{p.type || "—"} · {p.gateway_reference || p.gateway_pf_payment_id || p.id?.slice(0, 8)}</div>
                          <div className="text-xs text-muted-foreground">{fmtDate(p.completed_at || p.created_date)}</div>
                        </div>
                        <div className="text-right">
                          <div>{fmtMoney(p.amount)}</div>
                          <div className="text-xs text-muted-foreground">{p.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Chase modal */}
      <Dialog open={chaseOpen} onOpenChange={setChaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {activeInvoice
                ? `Send chase: ${activeInvoice.invoice_number || activeInvoice.client_name}`
                : `Send chase to ${selectedIds.size} invoices`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>Stage</Label>
              <Select value={chaseStage} onValueChange={setChaseStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHASE_STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{CHASE_STAGES.find((s) => s.value === chaseStage)?.help}</p>
            </div>
            <div>
              <Label>Custom note (optional)</Label>
              <Textarea
                value={chaseCustomMessage}
                onChange={(e) => setChaseCustomMessage(e.target.value)}
                rows={3}
                placeholder="A specific reason or context to add to the templated email."
              />
            </div>
            {chaseStage === "escalation" && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                <span>Escalation messaging puts the account on hold. Use only if you've already sent at least one earlier stage.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChaseOpen(false)} disabled={chaseSubmitting}>Cancel</Button>
            <Button onClick={submitChase} disabled={chaseSubmitting}>
              {chaseSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EFT modal */}
      <Dialog open={eftOpen} onOpenChange={setEftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark paid (EFT) — {activeInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {activeInvoice && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md bg-muted/20 p-3 text-xs">
                <div><strong>{activeInvoice.client_name}</strong></div>
                <div>{fmtMoney(activeInvoice.total_amount || activeInvoice.total || activeInvoice.amount)} · {activeInvoice.invoice_type}</div>
                <div className="text-muted-foreground">Issued {fmtDate(activeInvoice.issue_date)}, due {fmtDate(activeInvoice.due_date)}</div>
              </div>
              <div>
                <Label>Bank reference *</Label>
                <Input value={eftReference} onChange={(e) => setEftReference(e.target.value)} placeholder="e.g. INV-2026-0042 or transaction ref" />
              </div>
              <div>
                <Label>Date received *</Label>
                <Input type="date" value={eftDate} onChange={(e) => setEftDate(e.target.value)} />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Textarea value={eftNote} onChange={(e) => setEftNote(e.target.value)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEftOpen(false)} disabled={eftSubmitting}>Cancel</Button>
            <Button onClick={submitEft} disabled={eftSubmitting || !eftReference.trim()}>
              {eftSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Mark paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>Client *</Label>
              <Select value={createForm.client_id} onValueChange={(v) => {
                const c = allClients.find(cl => cl.id === v);
                setCreateForm(f => ({ ...f, client_id: v, client_name: c?.business_name || "" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {allClients.map(c => <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice Type *</Label>
              <Select value={createForm.invoice_type} onValueChange={(v) => setCreateForm(f => ({ ...f, invoice_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["setup_fee","monthly_retainer","add_on_setup","add_on_monthly","once_off","per_sms","cancellation_fee","acceleration_amount"].map(t => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (R) *</Label>
                <Input type="number" value={createForm.amount} onChange={e => setCreateForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={createForm.due_date} onChange={e => setCreateForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Optional note on this invoice" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="send_email" checked={createForm.send_email} onCheckedChange={(v) => setCreateForm(f => ({ ...f, send_email: !!v }))} />
              <Label htmlFor="send_email">Send invoice email to client</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createSubmitting}>Cancel</Button>
            <Button onClick={submitCreate} disabled={createSubmitting || !createForm.client_id || !createForm.amount}>
              {createSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch modal */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recurring batch — preview</DialogTitle>
          </DialogHeader>
          {batchPreview && (
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">Period: <strong className="text-foreground">{batchPreview.period}</strong></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md bg-success/10 p-3"><div className="text-xs text-muted-foreground">Will create</div><div className="text-2xl font-semibold">{batchPreview.created?.length || 0}</div></div>
                <div className="rounded-md bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Will skip</div><div className="text-2xl font-semibold">{batchPreview.skipped?.length || 0}</div></div>
                <div className="rounded-md bg-primary/10 p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-semibold">{fmtMoney(batchPreview.total_amount || 0)}</div></div>
              </div>

              {batchPreview.created?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Will invoice</div>
                  <div className="rounded-md border border-border/40 max-h-48 overflow-y-auto">
                    {batchPreview.created.map((c, i) => (
                      <div key={i} className="flex justify-between px-3 py-2 border-b border-border/20 last:border-b-0">
                        <span>{c.client_name}</span>
                        <span>{fmtMoney(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {batchPreview.skipped?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Will skip</div>
                  <div className="rounded-md border border-border/40 max-h-32 overflow-y-auto text-xs">
                    {batchPreview.skipped.map((s, i) => (
                      <div key={i} className="flex justify-between px-3 py-2 border-b border-border/20 last:border-b-0">
                        <span>{s.client_name || s.client_id}</span>
                        <span className="text-muted-foreground">{s.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)} disabled={batchSubmitting}>Cancel</Button>
            <Button onClick={confirmBatch} disabled={batchSubmitting || !batchPreview?.created?.length}>
              {batchSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : `Create ${batchPreview?.created?.length || 0} invoices`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}