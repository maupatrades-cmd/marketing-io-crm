import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard, CheckCircle2, XCircle, Clock, AlertCircle,
  Search, RefreshCw, Loader2, TrendingUp, FileText, Edit2
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtMoney(n) {
  return `R${Number(n||0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getRunStatus(client, invoices) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const thisMonthInvoices = invoices.filter(i =>
    i.client_id === client.id &&
    i.invoice_type === "monthly_retainer" &&
    (i.issue_date || "").startsWith(monthKey)
  );
  if (thisMonthInvoices.some(i => i.status === "paid")) return "collected";
  if (thisMonthInvoices.some(i => i.status === "failed")) return "failed";
  if (thisMonthInvoices.some(i => ["sent","overdue"].includes(i.status))) return "pending";
  return "not_invoiced";
}

const RUN_STATUS_STYLE = {
  collected:    "bg-success/15 text-success border-success/30",
  failed:       "bg-destructive/15 text-destructive border-destructive/30",
  pending:      "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  not_invoiced: "bg-muted/30 text-muted-foreground border-border/40",
};
const RUN_STATUS_LABEL = {
  collected: "Collected",
  failed: "Failed",
  pending: "Invoice Sent",
  not_invoiced: "Not Invoiced",
};

export default function DebitOrderTracking() {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [runFilter, setRunFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Edit mandate modal
  const [editClient, setEditClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Record failed debit modal
  const [failClient, setFailClient] = useState(null);
  const [failNote, setFailNote] = useState("");
  const [failSaving, setFailSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [cls, invs] = await Promise.all([
      base44.entities.Client.list("-created_date", 500),
      base44.entities.Invoice.list("-issue_date", 500),
    ]);
    setClients(Array.isArray(cls) ? cls.filter(c => ["active","onboarding","suspended"].includes(c.status)) : []);
    setInvoices(Array.isArray(invs) ? invs : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter(c => {
      if (runFilter !== "all" && c.debit_order_date !== runFilter) return false;
      if (statusFilter === "no_mandate" && c.debit_mandate_signed) return false;
      if (statusFilter === "failed" && (c.failed_debits_count || 0) === 0) return false;
      if (statusFilter === "acceleration" && !c.acceleration_triggered) return false;
      if (q && !c.business_name?.toLowerCase().includes(q) && !c.contact_person?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clients, search, runFilter, statusFilter]);

  // Summary stats
  const activeClients = clients.filter(c => c.status === "active");
  const total1st = clients.filter(c => c.debit_order_date === "1st" && c.status === "active").reduce((s,c)=>s+(c.monthly_retainer||0),0);
  const total15th = clients.filter(c => c.debit_order_date === "15th" && c.status === "active").reduce((s,c)=>s+(c.monthly_retainer||0),0);
  const noMandate = clients.filter(c => !c.debit_mandate_signed).length;
  const failedCount = clients.filter(c => (c.failed_debits_count||0)>0).length;
  const accelerationCount = clients.filter(c => c.acceleration_triggered).length;

  const openEdit = (c) => {
    setEditClient(c);
    setEditForm({
      debit_mandate_signed: c.debit_mandate_signed || false,
      debit_order_date: c.debit_order_date || "1st",
      monthly_retainer: c.monthly_retainer || "",
      failed_debits_count: c.failed_debits_count || 0,
      acceleration_triggered: c.acceleration_triggered || false,
      notes: c.notes || "",
    });
  };

  const saveEdit = async () => {
    setEditSaving(true);
    await base44.entities.Client.update(editClient.id, {
      debit_mandate_signed: editForm.debit_mandate_signed,
      debit_order_date: editForm.debit_order_date,
      monthly_retainer: Number(editForm.monthly_retainer) || 0,
      failed_debits_count: Number(editForm.failed_debits_count) || 0,
      acceleration_triggered: editForm.acceleration_triggered,
      notes: editForm.notes,
    });
    toast({ title: "Client updated", description: `${editClient.business_name} debit order details saved.` });
    setEditClient(null);
    setEditSaving(false);
    await load();
  };

  const openFail = (c) => { setFailClient(c); setFailNote(""); };

  const recordFail = async () => {
    setFailSaving(true);
    const newCount = (failClient.failed_debits_count || 0) + 1;
    const acceleration = newCount >= 3;
    await base44.entities.Client.update(failClient.id, {
      failed_debits_count: newCount,
      acceleration_triggered: acceleration,
      notes: failClient.notes
        ? `${failClient.notes}\n[${new Date().toLocaleDateString("en-ZA")}] Failed debit #${newCount}${failNote ? `: ${failNote}` : ""}`
        : `[${new Date().toLocaleDateString("en-ZA")}] Failed debit #${newCount}${failNote ? `: ${failNote}` : ""}`,
    });
    toast({
      title: acceleration ? "⚠️ Acceleration triggered!" : `Failed debit #${newCount} recorded`,
      description: acceleration
        ? `${failClient.business_name} has 3 failed debits — full outstanding amount now due.`
        : `${failClient.business_name} — ${newCount} failed debit(s) on record.`,
      variant: acceleration ? "destructive" : "default",
    });
    setFailClient(null);
    setFailSaving(false);
    await load();
  };

  const clearFail = async (c) => {
    await base44.entities.Client.update(c.id, { failed_debits_count: 0, acceleration_triggered: false });
    toast({ title: "Cleared", description: `${c.business_name} failed debit count reset.` });
    await load();
  };

  return (
    <AppLayout title="Debit Order & Mandate Tracking" subtitle="Monitor all client debit mandates and collection status">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="glass">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> 1st Run MRR</p>
              <p className="text-lg font-bold">{fmtMoney(total1st)}</p>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> 15th Run MRR</p>
              <p className="text-lg font-bold">{fmtMoney(total15th)}</p>
            </CardContent>
          </Card>
          <Card className={`glass ${noMandate > 0 ? "border-warning/40" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-warning" /> No Mandate</p>
              <p className="text-lg font-bold text-warning">{noMandate}</p>
            </CardContent>
          </Card>
          <Card className={`glass ${failedCount > 0 ? "border-destructive/40" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> Failed Debits</p>
              <p className="text-lg font-bold text-destructive">{failedCount}</p>
            </CardContent>
          </Card>
          <Card className={`glass ${accelerationCount > 0 ? "border-destructive/60" : ""}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-destructive" /> Acceleration</p>
              <p className="text-lg font-bold text-destructive">{accelerationCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client..." className="pl-9" />
          </div>
          <Select value={runFilter} onValueChange={setRunFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Run date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All run dates</SelectItem>
              <SelectItem value="1st">1st of month</SelectItem>
              <SelectItem value="15th">15th of month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              <SelectItem value="no_mandate">No mandate</SelectItem>
              <SelectItem value="failed">Has failed debits</SelectItem>
              <SelectItem value="acceleration">Acceleration triggered</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Table */}
        <div className="glass rounded-xl overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-muted/20 border-b border-border/40">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Client</th>
                <th className="px-4 py-3 text-left font-semibold">Package</th>
                <th className="px-4 py-3 text-right font-semibold">Monthly</th>
                <th className="px-4 py-3 text-center font-semibold">Run Date</th>
                <th className="px-4 py-3 text-center font-semibold">Mandate</th>
                <th className="px-4 py-3 text-center font-semibold">This Month</th>
                <th className="px-4 py-3 text-center font-semibold">Failed Debits</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No clients match filters.</td></tr>
              )}
              {!loading && filtered.map(c => {
                const runStatus = getRunStatus(c, invoices);
                return (
                  <tr key={c.id} className={`border-b border-border/20 hover:bg-muted/10 ${c.acceleration_triggered ? "bg-destructive/5" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.business_name}</p>
                      <p className="text-xs text-muted-foreground">{c.contact_person}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{c.package || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmtMoney(c.monthly_retainer)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-primary/15 text-primary border border-primary/30 text-xs">
                        {c.debit_order_date || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.debit_mandate_signed
                        ? <span className="inline-flex items-center gap-1 text-success text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Signed</span>
                        : <span className="inline-flex items-center gap-1 text-warning text-xs font-medium"><Clock className="w-3.5 h-3.5" /> Pending</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={`text-xs border ${RUN_STATUS_STYLE[runStatus]}`}>
                        {RUN_STATUS_LABEL[runStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(c.failed_debits_count || 0) === 0
                        ? <span className="text-xs text-muted-foreground">—</span>
                        : (
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge className={`text-xs ${c.acceleration_triggered ? "bg-destructive/20 text-destructive border-destructive/40" : "bg-warning/15 text-warning border-warning/30"}`}>
                              {c.failed_debits_count} {c.acceleration_triggered ? "· ⚡ ACCEL" : ""}
                            </Badge>
                            <button onClick={() => clearFail(c)} title="Clear" className="text-muted-foreground hover:text-foreground transition-colors">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Edit mandate details" onClick={() => openEdit(c)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Record failed debit" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openFail(c)}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {clients.length} clients · {MONTHS[new Date().getMonth()]} {new Date().getFullYear()}
        </p>
      </div>

      {/* Edit Mandate Modal */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> {editClient?.business_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Run Date</Label>
                <Select value={editForm.debit_order_date || "1st"} onValueChange={v => setEditForm(f => ({ ...f, debit_order_date: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st">1st of month</SelectItem>
                    <SelectItem value="15th">15th of month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly Retainer (R)</Label>
                <Input type="number" value={editForm.monthly_retainer} onChange={e => setEditForm(f => ({ ...f, monthly_retainer: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="mandate_signed"
                checked={editForm.debit_mandate_signed || false}
                onChange={e => setEditForm(f => ({ ...f, debit_mandate_signed: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <Label htmlFor="mandate_signed">Debit mandate signed</Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="acceleration"
                checked={editForm.acceleration_triggered || false}
                onChange={e => setEditForm(f => ({ ...f, acceleration_triggered: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <Label htmlFor="acceleration" className="text-destructive">Acceleration clause triggered</Label>
            </div>
            <div>
              <Label>Failed Debit Count</Label>
              <Input type="number" min="0" max="10" value={editForm.failed_debits_count} onChange={e => setEditForm(f => ({ ...f, failed_debits_count: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)} disabled={editSaving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Failed Debit Modal */}
      <Dialog open={!!failClient} onOpenChange={() => setFailClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><XCircle className="w-4 h-4" /> Record Failed Debit</DialogTitle>
          </DialogHeader>
          {failClient && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs space-y-1">
                <div className="font-semibold">{failClient.business_name}</div>
                <div className="text-muted-foreground">{fmtMoney(failClient.monthly_retainer)}/month · {failClient.debit_order_date} run</div>
                <div className="text-destructive">Current failures: {failClient.failed_debits_count || 0} → will become {(failClient.failed_debits_count||0)+1}</div>
                {(failClient.failed_debits_count||0) >= 2 && (
                  <div className="font-semibold text-destructive">⚡ This will trigger the ACCELERATION CLAUSE (3 failures)</div>
                )}
              </div>
              <div>
                <Label>Reason / Notes (optional)</Label>
                <Textarea rows={2} value={failNote} onChange={e => setFailNote(e.target.value)} placeholder="e.g. Insufficient funds, account closed…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailClient(null)} disabled={failSaving}>Cancel</Button>
            <Button variant="destructive" onClick={recordFail} disabled={failSaving}>
              {failSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Record Failed Debit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}