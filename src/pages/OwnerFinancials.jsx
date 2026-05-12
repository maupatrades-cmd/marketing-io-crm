import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, AlertCircle, CreditCard, CheckCircle2, XCircle, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";

export default function OwnerFinancials() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    (async () => {
      const [invs, cls, coms] = await Promise.all([
        base44.entities.Invoice.list(),
        base44.entities.Client.list("-created_date", 500),
        base44.entities.Commission.list(),
      ]);
      setInvoices(Array.isArray(invs) ? invs : invs ? [invs] : []);
      setClients(Array.isArray(cls) ? cls : cls ? [cls] : []);
      setCommissions(Array.isArray(coms) ? coms : coms ? [coms] : []);
      setLoading(false);
    })();
  }, []);

  const thisMonth = new Date().getMonth();
  const paidThisMonth = invoices
    .filter(i => i.status === "paid" && new Date(i.payment_date || i.paid_date || i.created_date).getMonth() === thisMonth)
    .reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);

  const activeClients = clients.filter(c => c.status === "active");
  const expectedNextMonth = activeClients.reduce((s, c) => s + (c.monthly_retainer || 0), 0);

  const outstanding = invoices
    .filter(i => ["sent", "overdue"].includes(i.status))
    .reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);
  const outstandingCount = invoices.filter(i => ["sent", "overdue"].includes(i.status)).length;

  const pendingComm = commissions
    .filter(c => ["pending", "approved"].includes(c.status))
    .reduce((s, c) => s + (c.commission_amount || 0), 0);

  const overdueInvoices = invoices
    .filter(i => ["sent", "overdue"].includes(i.status))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  // Debit order data
  const debitClients1st = clients.filter(c => c.status === "active" && c.debit_order_date === "1st");
  const debitClients15th = clients.filter(c => c.status === "active" && c.debit_order_date === "15th");
  const debitTotal1st = debitClients1st.reduce((s, c) => s + (c.monthly_retainer || 0), 0);
  const debitTotal15th = debitClients15th.reduce((s, c) => s + (c.monthly_retainer || 0), 0);
  const mandateNotSigned = clients.filter(c => c.status === "active" && !c.debit_mandate_signed);
  const failedDebits = clients.filter(c => (c.failed_debits_count || 0) > 0);

  if (loading) return <LoadingSpinner />;

  return (
    <AppLayout title="Financials" subtitle="Revenue & billing overview">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass">
            <CardContent className="p-6 flex items-start gap-4">
              <DollarSign className="w-10 h-10 text-success shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Revenue This Month</p>
                <p className="text-2xl font-bold text-foreground">R{paidThisMonth.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6 flex items-start gap-4">
              <TrendingUp className="w-10 h-10 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Expected Next Month</p>
                <p className="text-2xl font-bold text-foreground">R{expectedNextMonth.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-destructive/30">
            <CardContent className="p-6 flex items-start gap-4">
              <AlertCircle className="w-10 h-10 text-destructive shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                <p className="text-2xl font-bold text-destructive">R{outstanding.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{outstandingCount} invoices</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardContent className="p-6 flex items-start gap-4">
              <DollarSign className="w-10 h-10 text-accent shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Commission Liability</p>
                <p className="text-2xl font-bold text-foreground">R{pendingComm.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/40 -mb-2">
          {[
            { value: "overview", label: "Overview" },
            { value: "debit_orders", label: `Debit Orders (${debitClients1st.length + debitClients15th.length})` },
          ].map(t => (
            <button key={t.value} onClick={() => setActiveTab(t.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.value ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {overdueInvoices.length > 0 && (
              <div className="glass rounded-xl p-6">
                <h3 className="font-semibold mb-4">Outstanding Invoices ({overdueInvoices.length})</h3>
                <div className="space-y-3">
                  {overdueInvoices.map(inv => {
                    const daysOverdue = Math.floor((new Date() - new Date(inv.due_date || inv.created_date)) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={inv.id} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{inv.invoice_number}</p>
                          <p className="text-xs text-muted-foreground">Due {new Date(inv.due_date || inv.created_date).toLocaleDateString("en-ZA")}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">R{(inv.total_amount || inv.amount || 0).toLocaleString()}</p>
                          {daysOverdue > 0 && <Badge className="bg-destructive/15 text-destructive text-xs mt-1">{daysOverdue}d overdue</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center pt-4">Switch to Debit Orders tab to see the full debit order schedule.</p>
          </>
        )}

        {/* Debit Orders Tab */}
        {activeTab === "debit_orders" && (
          <div className="space-y-6">

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> 1st Run</p>
                  <p className="text-xl font-bold">R{debitTotal1st.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{debitClients1st.length} clients</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><CreditCard className="w-3 h-3" /> 15th Run</p>
                  <p className="text-xl font-bold">R{debitTotal15th.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{debitClients15th.length} clients</p>
                </CardContent>
              </Card>
              <Card className={`glass ${mandateNotSigned.length > 0 ? "border-warning/40" : ""}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-warning" /> Mandate Missing</p>
                  <p className="text-xl font-bold text-warning">{mandateNotSigned.length}</p>
                  <p className="text-xs text-muted-foreground">Active clients</p>
                </CardContent>
              </Card>
              <Card className={`glass ${failedDebits.length > 0 ? "border-destructive/40" : ""}`}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><XCircle className="w-3 h-3 text-destructive" /> Failed Debits</p>
                  <p className="text-xl font-bold text-destructive">{failedDebits.length}</p>
                  <p className="text-xs text-muted-foreground">Clients with failures</p>
                </CardContent>
              </Card>
            </div>

            {/* 1st Run */}
            <DebitRunTable title="1st of the Month Run" clients={debitClients1st} total={debitTotal1st} />

            {/* 15th Run */}
            <DebitRunTable title="15th of the Month Run" clients={debitClients15th} total={debitTotal15th} />

            {/* Mandate issues */}
            {mandateNotSigned.length > 0 && (
              <div className="glass rounded-xl p-5 border border-warning/30">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-warning">
                  <AlertCircle className="w-4 h-4" /> Mandate Not Signed ({mandateNotSigned.length})
                </h3>
                <div className="space-y-2">
                  {mandateNotSigned.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 text-sm">
                      <span className="font-medium">{c.business_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">{c.debit_order_date || "—"}</span>
                        <Badge className="bg-warning/15 text-warning border-warning/30 text-xs">No mandate</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed debits */}
            {failedDebits.length > 0 && (
              <div className="glass rounded-xl p-5 border border-destructive/30">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
                  <XCircle className="w-4 h-4" /> Failed Debit History
                </h3>
                <div className="space-y-2">
                  {failedDebits.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0 text-sm">
                      <span className="font-medium">{c.business_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">R{(c.monthly_retainer || 0).toLocaleString()}/mo</span>
                        <Badge className={`text-xs ${c.acceleration_triggered ? "bg-destructive/20 text-destructive border-destructive/40" : "bg-warning/15 text-warning border-warning/30"}`}>
                          {c.failed_debits_count} failed{c.acceleration_triggered ? " · ACCELERATION" : ""}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  );
}

function DebitRunTable({ title, clients, total }) {
  if (clients.length === 0) return (
    <div className="glass rounded-xl p-5">
      <h3 className="font-semibold mb-2 flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />{title}</h3>
      <p className="text-sm text-muted-foreground">No active clients on this run date.</p>
    </div>
  );
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" />{title}</h3>
        <Badge className="bg-primary/15 text-primary border border-primary/30">Total: R{total.toLocaleString()}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-xs text-muted-foreground">
              <th className="text-left py-2 pr-4">Client</th>
              <th className="text-left py-2 pr-4">Package</th>
              <th className="text-right py-2 pr-4">Monthly</th>
              <th className="text-left py-2 pr-4">Mandate</th>
              <th className="text-left py-2">Failed Debits</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} className="border-b border-border/20 last:border-0 hover:bg-muted/10">
                <td className="py-2.5 pr-4 font-medium">{c.business_name}</td>
                <td className="py-2.5 pr-4 text-muted-foreground capitalize">{c.package || "—"}</td>
                <td className="py-2.5 pr-4 text-right font-semibold">R{(c.monthly_retainer || 0).toLocaleString()}</td>
                <td className="py-2.5 pr-4">
                  {c.debit_mandate_signed
                    ? <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 className="w-3 h-3" /> Signed</span>
                    : <span className="flex items-center gap-1 text-warning text-xs"><Clock className="w-3 h-3" /> Pending</span>}
                </td>
                <td className="py-2.5">
                  {(c.failed_debits_count || 0) === 0
                    ? <span className="text-xs text-muted-foreground">None</span>
                    : <Badge className={`text-xs ${c.acceleration_triggered ? "bg-destructive/20 text-destructive" : "bg-warning/15 text-warning"}`}>{c.failed_debits_count}</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}