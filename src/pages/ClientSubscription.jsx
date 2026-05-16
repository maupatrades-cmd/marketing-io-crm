import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentUser } from "@/lib/customAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, AlertTriangle, Edit2, Eye, FileText, CreditCard, MessageSquare, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import InvoiceDownloadButton from "@/components/subscription/InvoiceDownloadButton";
import PackageUpgradeCard from "@/components/subscription/PackageUpgradeCard";

const PACKAGE_INFO = {
  ignite: { name: "Ignite", description: "Entry-level marketing package", color: "bg-blue-500" },
  accelerate: { name: "Accelerate", description: "Growth-focused package", color: "bg-purple-500" },
  dominate: { name: "Dominate", description: "Premium all-in-one package", color: "bg-pink-500" },
  street_pulse: { name: "Street Pulse", description: "Localized street marketing", color: "bg-amber-500" },
  township_pulse: { name: "Township Pulse", description: "Township focused marketing", color: "bg-green-500" },
  none: { name: "No Active Package", description: "Explore our packages", color: "bg-slate-500" },
};

export default function ClientSubscription() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [activeContract, setActiveContract] = useState(null);
  const [loadingContract, setLoadingContract] = useState(false);

  const openContractModal = async () => {
    if (!client) return;
    setLoadingContract(true);
    setContractModalOpen(true);
    const contracts = await base44.entities.Contract.filter({ client_id: client.id });
    const signed = (Array.isArray(contracts) ? contracts : [])
      .filter(c => c.status === "signed" || c.status === "active")
      .sort((a, b) => new Date(b.signed_date || b.created_date) - new Date(a.signed_date || a.created_date));
    setActiveContract(signed[0] || null);
    setLoadingContract(false);
  };

  useEffect(() => {
    const load = async () => {
      const me = authUser || (await getCurrentUser());
      if (!me) {
        setLoading(false);
        return;
      }

      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      const c = Array.isArray(clients) ? clients[0] : clients;

      if (c) {
        setClient(c);
        const invs = await base44.entities.Invoice.filter({ client_id: c.id });
        setInvoices(
          (Array.isArray(invs) ? invs : [])
            .sort((a, b) => new Date(b.issue_date) - new Date(a.issue_date))
        );
      }
      setLoading(false);
    };
    load();
  }, [authUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-md mx-auto glass rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">No Client Account</h2>
          <p className="text-sm text-muted-foreground">Contact support for help.</p>
        </div>
      </div>
    );
  }

  const pkgInfo = PACKAGE_INFO[client.package] || PACKAGE_INFO.none;
  const nextDebitDate = client.debit_order_date
    ? client.debit_order_date === "1st"
      ? new Date().setDate(1)
      : new Date().setDate(15)
    : null;

  const statusColor = {
    active: "text-green-400 bg-green-500/10",
    suspended: "text-amber-400 bg-amber-500/10",
    cancelled: "text-red-400 bg-red-500/10",
    onboarding: "text-purple-400 bg-purple-500/10",
  }[client.status] || "text-slate-400 bg-slate-500/10";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-700/40 backdrop-blur-md bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            💳 Subscription & Billing
            <Badge className={statusColor}>{client.status}</Badge>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your package, payments, and billing details</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Tab Navigation */}
        <div className="flex gap-4 border-b border-slate-700/40 overflow-x-auto pb-0">
          {[
            { id: "overview", label: "📦 Package Overview" },
            { id: "history", label: "📋 Payment History" },
            { id: "billing", label: "⚙️ Billing Details" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Current Package Card */}
            <Card className="glass border-slate-700/40 p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">{pkgInfo.name}</h2>
                  <p className="text-muted-foreground">{pkgInfo.description}</p>
                </div>
                <div className={`${pkgInfo.color} w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold`}>
                  ✓
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-700/40">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Setup Fee</p>
                  <p className="text-2xl font-bold">{formatCurrency(client.setup_fee_amount || 0)}</p>
                  <Badge className={client.setup_fee_paid ? "bg-green-500/20 text-green-400 mt-2" : "bg-amber-500/20 text-amber-400 mt-2"}>
                    {client.setup_fee_paid ? "✓ Paid" : "Pending"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Monthly Retainer</p>
                  <p className="text-2xl font-bold">{formatCurrency(client.monthly_retainer || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Due on {client.debit_order_date || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Contract Period</p>
                  <p className="text-sm font-mono">
                    {client.contract_start_date ? formatDate(client.contract_start_date) : "—"} to{" "}
                    {client.contract_end_date ? formatDate(client.contract_end_date) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Status: {client.status}</p>
                </div>
              </div>

              {/* Alerts */}
              <div className="mt-6 space-y-3">
                {client.failed_debits_count > 0 && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-amber-400">Failed Debits: {client.failed_debits_count}</p>
                      <p className="text-amber-400/80 text-xs mt-1">
                        {client.acceleration_triggered
                          ? "Acceleration clause has been triggered due to failed payments."
                          : "Contact us to resolve payment issues."}
                      </p>
                    </div>
                  </div>
                )}
                {client.status === "active" && (
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-green-400">Subscription is active and in good standing</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <Button onClick={() => setActiveTab("upgrade")} className="gradient-bg text-white">Upgrade Package →</Button>
                <Button variant="outline" onClick={openContractModal}>
                  <FileText className="w-4 h-4 mr-2" />
                  View Contract
                </Button>
              </div>
            </Card>

            {/* Upgrade Options */}
            <div className="mt-8">
              <h3 className="text-lg font-bold mb-4">Ready to grow?</h3>
              <PackageUpgradeCard
                currentPackage={client.package}
                onUpgrade={(pkg) => {
                  alert(`Upgrade to ${pkg} requested. Our team will contact you soon.`);
                }}
              />
            </div>
          </div>
        )}

        {/* Payment History Tab */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold mb-4">Recent Invoices</h3>
              {invoices.length === 0 ? (
                <Card className="glass border-slate-700/40 p-8 text-center">
                  <p className="text-muted-foreground">No invoices yet</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {invoices.map((inv) => (
                    <Card key={inv.id} className="glass border-slate-700/40 p-4 hover:border-slate-600/60 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{inv.description || inv.invoice_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(inv.issue_date)} • Invoice #{inv.invoice_number}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(inv.total_amount || inv.amount)}</p>
                          <Badge
                            className={
                              inv.status === "paid"
                                ? "bg-green-500/20 text-green-400 text-xs"
                                : inv.status === "overdue"
                                ? "bg-red-500/20 text-red-400 text-xs"
                                : "bg-slate-500/20 text-slate-400 text-xs"
                            }
                          >
                            {inv.status}
                          </Badge>
                        </div>
                        <InvoiceDownloadButton invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Billing Details Tab */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            <Card className="glass border-slate-700/40 p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Billing Information</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => window.location.href = '/client/billing-update'}
                >
                  <Edit2 className="w-4 h-4" />
                  Update
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Business Name</p>
                  <p className="font-semibold text-foreground">{client.business_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Contact Person</p>
                  <p className="font-semibold text-foreground">{client.contact_person}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="font-semibold text-foreground">{client.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Phone</p>
                  <p className="font-semibold text-foreground">{client.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Physical Address</p>
                  <p className="font-semibold text-foreground">{client.address}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Debit Order Date</p>
                  <p className="font-semibold text-foreground">{client.debit_order_date}th of each month</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-700/40">
                <h4 className="font-semibold mb-4">Payment Method</h4>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/40">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Debit Order</span> — Automatic monthly deductions from your bank account
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {client.debit_mandate_signed ? "✓ Mandate signed and active" : "Waiting for mandate signature"}
                  </p>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="glass border-slate-700/40 p-8">
              <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/client/invoices">
                  <Button variant="outline" className="justify-start h-12 w-full">
                    <Eye className="w-4 h-4 mr-2" />
                    View All Invoices
                  </Button>
                </Link>
                <Button variant="outline" className="justify-start h-12" onClick={() => navigate("/client/invoices")}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Statement
                </Button>
                <Link to="/client/billing-update">
                  <Button variant="outline" className="justify-start h-12 w-full">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Update Payment Details
                  </Button>
                </Link>
                <Link to="/client/messages?subject=Support+Request">
                  <Button variant="outline" className="justify-start h-12 w-full">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Contract Modal */}
      <Dialog open={contractModalOpen} onOpenChange={setContractModalOpen}>
        <DialogContent className="bg-card border-border/50 max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="gradient-text">Your Active Contract</DialogTitle>
          </DialogHeader>
          {loadingContract ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : activeContract?.document_url ? (
            <iframe
              src={activeContract.document_url}
              className="w-full h-[65vh] rounded-lg border border-border/40"
              title="Contract"
            />
          ) : activeContract?.final_signed_pdf_url ? (
            <div className="text-center py-8 space-y-4">
              <FileText className="w-12 h-12 text-primary/50 mx-auto" />
              <p className="text-sm text-muted-foreground">Contract signed on {formatDate(activeContract.signed_date)}</p>
              <a href={activeContract.final_signed_pdf_url} target="_blank" rel="noopener noreferrer">
                <Button className="gradient-bg text-white"><Download className="w-4 h-4 mr-2" />Download Signed Contract</Button>
              </a>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No signed contract on file yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Contact your account manager if you believe this is an error.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}