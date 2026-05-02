import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, AlertCircle } from "lucide-react";

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [client, setClient] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const invs = await base44.entities.Invoice.filter({ client_id: c.id }, "-created_date", 100);
        setInvoices(invs);
      }
      setLoading(false);
    });
  }, []);

  const filtered = invoices.filter(i => filter === "all" || i.status === filter);
  const outstanding = invoices.filter(i => ["sent", "overdue", "failed"].includes(i.status)).reduce((s, i) => s + (i.total_amount || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Invoices</h1>
        <p className="text-muted-foreground mb-6">All your invoices and payments</p>

        {outstanding > 0 && (
          <div className="glass rounded-xl p-4 border border-destructive/30 flex items-center gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div><p className="font-semibold text-foreground">R{outstanding.toLocaleString()} outstanding</p></div>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {["all", "paid", "sent", "overdue"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm transition-all ${filter === f ? "gradient-bg text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground">No invoices found</p></div>
          ) : (
            filtered.map(inv => (
              <div key={inv.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(inv.created_date).toLocaleDateString("en-ZA")} • Due {new Date(inv.due_date).toLocaleDateString("en-ZA")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">R{(inv.total_amount || 0).toLocaleString()}</span>
                  <Badge className={inv.status === "paid" ? "bg-success/15 text-success" : inv.status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}>{inv.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}