import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";

export default function OwnerFinancials() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [invs, cls, coms] = await Promise.all([
        base44.entities.Invoice.list(),
        base44.entities.Client.list(),
        base44.entities.Commission.list(),
      ]);
      setInvoices(Array.isArray(invs) ? invs : invs ? [invs] : []);
      setClients(Array.isArray(cls) ? cls : cls ? [cls] : []);
      setCommissions(Array.isArray(coms) ? coms : coms ? [coms] : []);
      setLoading(false);
    })();
  }, []);

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const paidThisMonth = invoices
    .filter(i => i.status === "paid" && new Date(i.paid_date || i.created_date).getMonth() === thisMonth)
    .reduce((s, i) => s + (i.total || 0), 0);

  const activeClients = clients.filter(c => c.status === "active");
  const expectedNextMonth = activeClients.reduce((s, c) => s + (c.monthly_retainer || 0), 0);

  const outstanding = invoices
    .filter(i => ["issued", "overdue"].includes(i.status))
    .reduce((s, i) => s + (i.total || 0), 0);
  const outstandingCount = invoices.filter(i => ["issued", "overdue"].includes(i.status)).length;

  const pendingComm = commissions
    .filter(c => ["pending", "approved"].includes(c.status))
    .reduce((s, c) => s + (c.total || 0), 0);

  const overdueInvoices = invoices
    .filter(i => ["issued", "overdue"].includes(i.status))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold gradient-text mb-8">Financials</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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

        {/* Outstanding Invoices */}
        {overdueInvoices.length > 0 && (
          <div className="glass rounded-xl p-6 mb-8">
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
                      <p className="font-bold">R{(inv.total || 0).toLocaleString()}</p>
                      {daysOverdue > 0 && <Badge className="bg-destructive/15 text-destructive text-xs mt-1">{daysOverdue}d overdue</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center pt-4">Dashboard initialized. Charts and detailed reports will render once data populated.</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}