import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/lib/customAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, AlertCircle, CreditCard } from "lucide-react";

const BANK_DETAILS = {
  bank: "Standard Bank",
  accountHolder: "Marketing iO (Pty) Ltd",
  accountNumber: "123456789",
  branchCode: "050001",
};

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [client, setClient] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedInv, setSelectedInv] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchInvoices = async (clientId) => {
    const invs = await base44.entities.Invoice.filter({ client_id: clientId }, "-created_date", 100);
    setInvoices(Array.isArray(invs) ? invs : invs ? [invs] : []);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    getCurrentUser().then(async (me) => {
      if (!me) { setLoading(false); window.location.href = '/login'; return; }
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = Array.isArray(clients) ? clients[0] : clients;
        setClient(c);
        await fetchInvoices(c.id);
      }
      setLoading(false);
    });
  }, []);

  // Real-time polling every 30 seconds
  useEffect(() => {
    if (!client) return;
    const interval = setInterval(() => {
      fetchInvoices(client.id);
    }, 30000);
    return () => clearInterval(interval);
  }, [client]);

  const getAgingStatus = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const daysOverdue = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue < 0) return `Due in ${Math.abs(daysOverdue)} days`;
    if (daysOverdue === 0) return "Due today";
    return `Overdue by ${daysOverdue} days`;
  };

  const filtered = invoices.filter(i => filter === "all" || i.status === filter);
  const outstanding = invoices.filter(i => ["issued", "overdue"].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Invoices</h1>
        <p className="text-muted-foreground mb-6">All your invoices and payments</p>

        {outstanding > 0 && (
          <div className="glass rounded-xl p-4 border border-destructive/30 flex items-center gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-semibold text-foreground">R{outstanding.toLocaleString()} outstanding</p>
              <p className="text-xs text-muted-foreground">{invoices.filter(i => ["issued", "overdue"].includes(i.status)).length} unpaid invoices</p>
            </div>
          </div>
        )}

        {/* Payment Instructions */}
        <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5 mb-6">
          <p className="text-sm font-semibold mb-2">Payment Instructions</p>
          <div className="space-y-1 text-xs text-foreground">
            <p><strong>Bank:</strong> {BANK_DETAILS.bank}</p>
            <p><strong>Account Holder:</strong> {BANK_DETAILS.accountHolder}</p>
            <p><strong>Account Number:</strong> {BANK_DETAILS.accountNumber}</p>
            <p><strong>Branch Code:</strong> {BANK_DETAILS.branchCode}</p>
            <p className="text-muted-foreground mt-2">Please use your invoice number as the reference when paying.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {["all", "paid", "issued", "overdue"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${filter === f ? "gradient-bg text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">No invoices found</p>
            </div>
          ) : (
            filtered.map(inv => (
              <div key={inv.id} onClick={() => setSelectedInv(inv)} className="glass rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all border border-white/10">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">#{inv.invoice_number || inv.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.created_date).toLocaleDateString("en-ZA")} • 
                    <span className={inv.status === "paid" ? " text-success" : " text-orange-500"}>
                      {inv.due_date ? " " + getAgingStatus(inv.due_date) : " No due date"}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">R{(inv.total || 0).toLocaleString()}</span>
                  <Badge className={inv.status === "paid" ? "bg-success/15 text-success" : inv.status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}>
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">Last updated: {lastUpdated.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>

      {/* Invoice Detail Modal */}
      <Dialog open={!!selectedInv} onOpenChange={(open) => { if (!open) setSelectedInv(null); }}>
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice #{selectedInv?.invoice_number || selectedInv?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          
          {selectedInv && (
            <div className="space-y-4 mt-4">
              {/* Summary */}
              <div className="glass rounded-lg p-4 border border-white/10 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issue Date:</span>
                  <span className="font-semibold">{new Date(selectedInv.created_date).toLocaleDateString("en-ZA")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-semibold">{selectedInv.due_date ? new Date(selectedInv.due_date).toLocaleDateString("en-ZA") : "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge className={selectedInv.status === "paid" ? "bg-success/15 text-success" : selectedInv.status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}>
                    {selectedInv.status}
                  </Badge>
                </div>
              </div>

              {/* Line Items (placeholder) */}
              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="font-semibold mb-2">Invoice Details</p>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>Service period and line items will appear here</p>
                </div>
              </div>

              {/* Total */}
              <div className="glass rounded-lg p-4 border border-white/10 bg-primary/10">
                <div className="flex justify-between items-end">
                  <span className="text-foreground font-semibold">Total Amount Due:</span>
                  <span className="text-2xl font-bold text-primary">R{(selectedInv.total || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {selectedInv.status !== "paid" && (
                  <Button className="w-full gradient-bg text-white gap-2" disabled title="Online payment coming soon — please pay via EFT">
                    <CreditCard className="w-4 h-4" /> Pay Now (Coming Soon)
                  </Button>
                )}
                {selectedInv.invoice_pdf_url && (
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <a href={selectedInv.invoice_pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" /> Download PDF
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}