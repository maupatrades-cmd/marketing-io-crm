import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Clock, FileText, AlertCircle, Download,
  BarChart2, Star, Package, ChevronRight, CalendarDays, Zap
} from "lucide-react";

const PACKAGE_LABELS = {
  ignite: "Ignite",
  accelerate: "Accelerate",
  dominate: "Dominate",
  street_pulse: "Street Pulse",
  township_pulse: "Township Pulse",
  none: "No Package",
};

const STATUS_CONFIG = {
  not_started: { label: "Not Started", color: "bg-muted/40 text-muted-foreground border-border/40" },
  in_progress: { label: "In Progress", color: "bg-primary/15 text-primary border-primary/30" },
  awaiting_client: { label: "Awaiting You", color: "bg-warning/15 text-warning border-warning/30" },
  client_reviewing: { label: "Under Review", color: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30" },
  approved: { label: "Approved", color: "bg-success/15 text-success border-success/30" },
  deemed_approved: { label: "Auto-Approved", color: "bg-success/10 text-success border-success/20" },
  completed: { label: "Completed", color: "bg-success/15 text-success border-success/30" },
  blocked: { label: "Blocked", color: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function ClientPortal() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reports, setReports] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const [d, inv, rep, ao] = await Promise.all([
          base44.entities.Deliverable.filter({ client_id: c.id }),
          base44.entities.Invoice.filter({ client_id: c.id }),
          base44.entities.MonthlyReport.filter({ client_id: c.id }),
          base44.entities.ClientAddOn.filter({ client_id: c.id }),
        ]);
        setDeliverables(d);
        setInvoices(inv);
        setReports(rep);
        setAddOns(ao);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">No Client Account Found</h2>
          <p className="text-sm text-muted-foreground">Your email address is not linked to a client account. Please contact Marketing iO.</p>
        </div>
      </div>
    );
  }

  const onboardingSteps = [
    { key: "setup_fee_paid", label: "Setup fee paid" },
    { key: "onboarding_form_returned", label: "Onboarding form returned" },
    { key: "debit_mandate_signed", label: "Debit order mandate signed" },
    { key: "brand_assets_received", label: "Brand assets received" },
    { key: "go_live_acknowledged", label: "Go-live acknowledged" },
  ];
  const onboardingDone = onboardingSteps.filter(s => client[s.key]).length;
  const isOnboarding = client.status === "onboarding";

  const awaitingDeliverables = deliverables.filter(d => d.status === "awaiting_client" || d.status === "client_reviewing");
  const completedDeliverables = deliverables.filter(d => d.status === "completed" || d.status === "approved" || d.status === "deemed_approved");
  const overdueInvoices = invoices.filter(i => i.status === "overdue" || i.status === "failed");
  const recentReports = reports.filter(r => r.status === "delivered" || r.status === "acknowledged").slice(0, 3);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "deliverables", label: "Deliverables", count: awaitingDeliverables.length },
    { id: "invoices", label: "Invoices", count: overdueInvoices.length, alert: true },
    { id: "reports", label: "Reports" },
  ];

  return (
    <div className="min-h-screen bg-background font-inter">
      {/* Header */}
      <div className="border-b border-border/40 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold gradient-text">Marketing iO</h1>
            <p className="text-xs text-muted-foreground">Client Portal</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">{client.business_name}</p>
            <p className="text-xs text-muted-foreground">{client.contact_person}</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="glass rounded-2xl p-6 gradient-bg-subtle">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Welcome back</p>
              <h2 className="text-2xl font-bold text-foreground">{client.business_name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-primary/15 text-primary border border-primary/30">
                  <Package className="w-3 h-3 mr-1" />
                  {PACKAGE_LABELS[client.package] || client.package}
                </Badge>
                <StatusBadge status={client.status} />
              </div>
            </div>
            {client.go_live_date && (
              <div className="glass rounded-xl p-4 text-center">
                <CalendarDays className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Go-Live Date</p>
                <p className="text-sm font-semibold text-foreground">{new Date(client.go_live_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        {overdueInvoices.length > 0 && (
          <div className="glass rounded-xl p-4 border border-destructive/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">You have {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground">Please arrange payment to avoid service interruption</p>
            </div>
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs" onClick={() => setActiveTab("invoices")}>
              View
            </Button>
          </div>
        )}

        {awaitingDeliverables.length > 0 && (
          <div className="glass rounded-xl p-4 border border-warning/30 flex items-center gap-3">
            <Clock className="w-5 h-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{awaitingDeliverables.length} deliverable{awaitingDeliverables.length > 1 ? "s" : ""} awaiting your review</p>
              <p className="text-xs text-muted-foreground">Please review and approve within 5 business days</p>
            </div>
            <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 text-xs" onClick={() => setActiveTab("deliverables")}>
              Review
            </Button>
          </div>
        )}

        {/* Onboarding Progress */}
        {isOnboarding && (
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Onboarding Progress</h3>
              <span className="text-xs text-muted-foreground">{onboardingDone}/{onboardingSteps.length} complete</span>
            </div>
            <div className="w-full bg-muted/40 rounded-full h-2 mb-4">
              <div
                className="gradient-bg h-2 rounded-full transition-all"
                style={{ width: `${(onboardingDone / onboardingSteps.length) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {onboardingSteps.map(step => (
                <div key={step.key} className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${client[step.key] ? "text-success" : "text-muted-foreground/30"}`} />
                  <span className={`text-xs ${client[step.key] ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-full overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
                activeTab === tab.id
                  ? "bg-secondary text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab.alert ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatMini icon={CheckCircle2} label="Completed Deliverables" value={completedDeliverables.length} color="text-success" />
            <StatMini icon={BarChart2} label="Reports Delivered" value={recentReports.length} color="text-primary" />
            <StatMini icon={Zap} label="Active Add-Ons" value={addOns.filter(a => a.status === "active").length} color="text-accent" />
            {addOns.filter(a => a.status === "active").length > 0 && (
              <div className="sm:col-span-3 glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Your Active Add-Ons</h3>
                <div className="flex flex-wrap gap-2">
                  {addOns.filter(a => a.status === "active").map(a => (
                    <Badge key={a.id} className="bg-primary/15 text-primary border border-primary/30 capitalize">
                      {a.add_on?.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "deliverables" && (
          <div className="space-y-3">
            {deliverables.length === 0 ? (
              <EmptyState icon={CheckCircle2} message="No deliverables yet" />
            ) : (
              deliverables.map(d => (
                <DeliverableRow key={d.id} item={d} />
              ))
            )}
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <EmptyState icon={FileText} message="No invoices yet" />
            ) : (
              invoices.map(inv => (
                <InvoiceRow key={inv.id} item={inv} />
              ))
            )}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-3">
            {reports.length === 0 ? (
              <EmptyState icon={BarChart2} message="No reports delivered yet" />
            ) : (
              reports.map(r => (
                <ReportRow key={r.id} item={r} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    active: "bg-success/15 text-success border-success/30",
    onboarding: "bg-primary/15 text-primary border-primary/30",
    suspended: "bg-destructive/15 text-destructive border-destructive/30",
    cancelled: "bg-muted/40 text-muted-foreground border-border/40",
    lead: "bg-warning/15 text-warning border-warning/30",
    prospect: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  };
  return <Badge className={`border capitalize ${map[status] || "bg-muted/40 text-muted-foreground border-border/40"}`}>{status?.replace(/_/g, " ")}</Badge>;
}

function StatMini({ icon: Icon, label, value, color }) {
  return (
    <Card className="glass">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`w-8 h-8 ${color} shrink-0`} />
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DeliverableRow({ item }) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.not_started;
  return (
    <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground capitalize">{item.phase?.replace(/_/g, " ")} • {item.product}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.due_date && <span className="text-xs text-muted-foreground">{new Date(item.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}</span>}
        <Badge className={`border text-xs ${cfg.color}`}>{cfg.label}</Badge>
      </div>
    </div>
  );
}

function InvoiceRow({ item }) {
  const statusMap = {
    paid: "bg-success/15 text-success border-success/30",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
    sent: "bg-warning/15 text-warning border-warning/30",
    draft: "bg-muted/40 text-muted-foreground border-border/40",
  };
  return (
    <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{item.invoice_number || "Invoice"}</p>
        <p className="text-xs text-muted-foreground capitalize">{item.invoice_type?.replace(/_/g, " ")} {item.due_date && `· Due ${new Date(item.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-foreground">R{(item.total_amount || item.amount || 0).toLocaleString()}</span>
        <Badge className={`border text-xs ${statusMap[item.status] || "bg-muted/40 text-muted-foreground border-border/40"}`}>{item.status}</Badge>
      </div>
    </div>
  );
}

function ReportRow({ item }) {
  return (
    <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground capitalize">{item.report_type?.replace(/_/g, " ")} — {item.report_month}</p>
        <p className="text-xs text-muted-foreground capitalize">Delivered via {item.delivered_via?.replace(/_/g, " ")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge className="bg-success/15 text-success border border-success/30 text-xs">{item.status}</Badge>
        {item.report_url && (
          <a href={item.report_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <Download className="w-4 h-4" />
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="glass rounded-xl p-8 text-center">
      <Icon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}