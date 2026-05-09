import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/lib/customAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileText, AlertCircle, Banknote, XCircle } from "lucide-react";
import EftModal from "@/components/clientportal/EftModal";
import CancelInvoiceModal from "@/components/clientportal/CancelInvoiceModal";

const BANK_DETAILS = {
  bank: "Absa",
  accountHolder: "Marketing iO (Pty) Ltd",
  accountType: "Cheque Account",
  accountNumber: "4125761781",
  branchCode: "632005"
};

const PAYABLE_STATUSES = ['issued', 'pending_payment', 'sent', 'overdue'];

// PR #56 — invoice tab filter fix.
//
// The Invoice.status enum (base44/entities/Invoice.jsonc) is:
//   draft | sent | paid | overdue | failed | cancelled | partial
//
// The previous tab row hard-coded ['all', 'paid', 'issued', 'overdue']
// where 'issued' isn't in the enum at all — so that tab was always empty.
// The Outstanding total had the same bug. Tabs are now config-driven so
// one client-facing label can fan out to multiple data statuses (e.g.
// 'Unpaid' covers draft + sent + partial — the three states where the
// buyer still owes money).
//
// 'failed' rows aren't given their own tab — rare and clutters the row;
// they still show under 'All'.
const OUTSTANDING_STATUSES = ['draft', 'sent', 'overdue', 'partial'];

const TAB_CONFIG = [
  {
    id: 'all',
    label: 'All',
    match: () => true,
    emptyText: 'No invoices yet.',
  },
  {
    id: 'unpaid',
    label: 'Unpaid',
    match: (i) => ['draft', 'sent', 'partial'].includes(i.status),
    emptyText: "No unpaid invoices — you're all caught up.",
  },
  {
    id: 'overdue',
    label: 'Overdue',
    match: (i) => i.status === 'overdue',
    emptyText: 'Nothing overdue — well done.',
  },
  {
    id: 'paid',
    label: 'Paid',
    match: (i) => i.status === 'paid',
    // Note for reviewer: this tab will look empty until PR #57 wires
    // payfast-itn → Invoice.status. That's intentional sequencing — fix
    // the UI logic first (this PR), the data flow next (PR #57).
    emptyText: 'No paid invoices yet.',
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    match: (i) => i.status === 'cancelled',
    emptyText: 'No cancelled invoices.',
  },
];

export default function ClientInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [client, setClient] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedInv, setSelectedInv] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [eftInvoice, setEftInvoice] = useState(null);
  const [cancelInvoice, setCancelInvoice] = useState(null);

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

  // Resolve the active tab; fall back to 'all' if the URL/state is stale.
  const activeTab = TAB_CONFIG.find((t) => t.id === filter) || TAB_CONFIG[0];
  const filtered  = invoices.filter(activeTab.match);

  // Outstanding banner uses a single source of truth — same statuses for
  // total amount and count.
  const outstandingInvoices = invoices.filter((i) => OUTSTANDING_STATUSES.includes(i.status));
  const outstanding         = outstandingInvoices.reduce((s, i) => s + Number(i.total_amount || i.total || i.amount || 0), 0);
  const outstandingCount    = outstandingInvoices.length;

  // Per-tab counts for the small badges next to each label. Computed once
  // per render — invoice list is small and the predicates are O(1).
  const tabCounts = TAB_CONFIG.reduce((acc, t) => {
    acc[t.id] = invoices.filter(t.match).length;
    return acc;
  }, {});

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
              <p className="text-xs text-muted-foreground">{outstandingCount} unpaid invoice{outstandingCount === 1 ? '' : 's'}</p>
            </div>
          </div>
        )}

        {/* Payment Instructions */}
        <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5 mb-6">
          <p className="text-sm font-semibold mb-2">Payment Instructions</p>
          <div className="space-y-1 text-xs text-foreground">
            <p><strong>Bank:</strong> {BANK_DETAILS.bank}</p>
            <p><strong>Account Holder:</strong> {BANK_DETAILS.accountHolder}</p>
            <p><strong>Account Type:</strong> {BANK_DETAILS.accountType}</p>
            <p><strong>Account Number:</strong> {BANK_DETAILS.accountNumber}</p>
            <p><strong>Branch Code:</strong> {BANK_DETAILS.branchCode}</p>
            <p className="text-muted-foreground mt-2">Please use your invoice number as the reference when paying.</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {TAB_CONFIG.map((t) => {
            const isActive = filter === t.id;
            const count    = tabCounts[t.id] || 0;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
                  isActive
                    ? 'gradient-bg text-white'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <span className={`ml-1.5 ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground">{activeTab.emptyText}</p>
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
                  <span className="font-bold text-foreground">R{Number(inv.total_amount || inv.total || inv.amount || 0).toLocaleString()}</span>
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
                  <span className="text-2xl font-bold text-primary">R{Number(selectedInv.total_amount || selectedInv.total || selectedInv.amount || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                {PAYABLE_STATUSES.includes(selectedInv.status) && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setEftInvoice(selectedInv)}
                  >
                    <Banknote className="w-4 h-4" /> Pay via EFT
                  </Button>
                )}

                {/* Cancel invoice — only for unpaid invoices. */}
                {PAYABLE_STATUSES.includes(selectedInv.status) && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-rose-500/40 text-rose-300 hover:bg-rose-950/30 hover:text-rose-200"
                    onClick={() => setCancelInvoice(selectedInv)}
                  >
                    <XCircle className="w-4 h-4" /> Cancel invoice
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

      {/* EFT alternative — bank details + invoice number reference. */}
      <EftModal
        invoice={eftInvoice}
        bankDetails={BANK_DETAILS}
        isOpen={!!eftInvoice}
        onClose={() => setEftInvoice(null)}
      />

      {/* Self-service invoice cancellation. */}
      <CancelInvoiceModal
        invoice={cancelInvoice}
        isOpen={!!cancelInvoice}
        onClose={() => setCancelInvoice(null)}
        onCancelled={() => {
          if (client?.id) fetchInvoices(client.id);
          setSelectedInv(null);
        }}
      />
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}