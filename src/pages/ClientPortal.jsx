import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Clock, FileText, AlertCircle, Download,
  BarChart2, Star, Package, ChevronRight, CalendarDays, Zap,
  Bell, LogOut, Settings, MessageSquare, Link as LinkIcon
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
   const [notifications, setNotifications] = useState([]);
   const [activityLog, setActivityLog] = useState([]);
   const [loading, setLoading] = useState(true);
   const [activeTab, setActiveTab] = useState("overview");
   const [showNotifications, setShowNotifications] = useState(false);
   const [lastUpdated, setLastUpdated] = useState(new Date());
   const [templates, setTemplates] = useState([]);

  const fetchData = async (me, clientId) => {
    const [d, inv, rep, ao, notif, activity] = await Promise.all([
      base44.entities.Deliverable.filter({ client_id: clientId }),
      base44.entities.Invoice.filter({ client_id: clientId }),
      base44.entities.MonthlyReport.filter({ client_id: clientId }),
      base44.entities.ClientAddOn.filter({ client_id: clientId }),
      base44.entities.ClientNotification.filter({ client_id: clientId }, "-created_date", 20),
      base44.entities.ClientActivityLog.filter({ client_id: clientId }, "-created_date", 20),
    ]);
    setDeliverables(d);
    setInvoices(inv);
    setReports(rep);
    setAddOns(ao);
    setNotifications(notif);
    setActivityLog(activity);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = Array.isArray(clients) ? clients[0] : clients;
        setClient(c);
        await fetchData(me, c.id);
        // Fetch templates for cross-sell suggestions
        const temps = await base44.entities.FulfilmentTemplate.list();
        setTemplates(Array.isArray(temps) ? temps : temps ? [temps] : []);
        // Update last login
        base44.entities.Client.update(c.id, { portal_last_active_at: new Date().toISOString() });
      }
      setLoading(false);
    });
  }, []);

  // Real-time polling every 30 seconds
   useEffect(() => {
     if (!client) return;
     const interval = setInterval(() => {
       fetchData(user, client.id);
     }, 30000);
     return () => clearInterval(interval);
   }, [client, user]);

   // Get cross-sell suggestions
   const getSuggestions = () => {
     const suggestions = [];
     const activeAddOns = addOns.filter(a => a.status === "active").map(a => a.add_on);

     // Package-based suggestions
     if (client.package === "ignite") {
       ["reputation_management", "ai_chatbot", "email_newsletter"].forEach(code => {
         if (!activeAddOns.includes(code)) {
           const template = templates.find(t => t.code === code);
           if (template) suggestions.push({ template, value: "Answer customer questions on your website 24/7" });
         }
       });
     } else if (client.package === "accelerate") {
       ["whatsapp_automation", "short_form_video", "google_business_profile"].forEach(code => {
         if (!activeAddOns.includes(code)) {
           const template = templates.find(t => t.code === code);
           if (template) suggestions.push({ template, value: "Reach customers where they actually message" });
         }
       });
     } else if (client.package === "dominate") {
       ["ecommerce_setup", "paid_ads_management"].forEach(code => {
         if (!activeAddOns.includes(code)) {
           const template = templates.find(t => t.code === code);
           if (template) suggestions.push({ template, value: "Automate your sales and boost revenue" });
         }
       });
     }

     return suggestions.slice(0, 3);
   };

   const suggestions = getSuggestions();

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

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const quickLinks = [
    { label: "Invoices", path: "/client/invoices", icon: FileText },
    { label: "Deliverables", path: "/client/deliverables", icon: CheckCircle2 },
    { label: "Reports", path: "/client/reports", icon: BarChart2 },
    { label: "Contracts", path: "/client/contracts", icon: LinkIcon },
    { label: "Files", path: "/client/uploads", icon: Package },
    { label: "Messages", path: "/client/messages", icon: MessageSquare },
    { label: "Profile", path: "/client/profile", icon: Settings },
  ];

  return (
     <div className="min-h-screen bg-background font-inter">
       {/* Header */}
       <div className="border-b border-border/40 px-6 py-4">
         <div className="max-w-6xl mx-auto flex items-center justify-between">
           <div>
             <h1 className="text-xl font-bold gradient-text">Marketing iO</h1>
             <p className="text-xs text-muted-foreground">Client Portal</p>
           </div>
           <div className="flex items-center gap-4">
             <div className="text-right">
               <p className="text-sm font-semibold text-foreground">{client.business_name}</p>
               <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-ZA")}</p>
             </div>
             {/* Notification Bell */}
             <div className="relative">
               <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2 hover:bg-secondary/40 rounded-lg transition-colors">
                 <Bell className="w-5 h-5 text-foreground" />
                 {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />}
               </button>
               {showNotifications && (
                 <div className="absolute right-0 mt-2 w-80 bg-secondary border border-border/40 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                   {notifications.length === 0 ? (
                     <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
                   ) : (
                     <div className="divide-y divide-border/40">
                       {notifications.slice(0, 10).map(n => (
                         <div key={n.id} className={`p-3 border-l-4 cursor-pointer transition-colors ${!n.is_read ? "border-l-primary bg-primary/5" : "border-l-transparent"}`}>
                           <p className="text-sm font-semibold text-foreground">{n.title}</p>
                           <p className="text-xs text-muted-foreground">{n.body}</p>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               )}
             </div>
             <Button size="sm" variant="ghost" onClick={() => base44.auth.logout()} className="text-muted-foreground hover:text-foreground">
               <LogOut className="w-4 h-4" />
             </Button>
           </div>
         </div>
       </div>

      <div className="max-w-7xl mx-auto p-6 flex gap-6">
        {/* Main content */}
        <div className="flex-1 space-y-6">
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

        {/* Cross-Sell Suggestions */}
        {suggestions.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3">Suggested for {client.business_name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map(s => (
                <div key={s.template.code} className="glass rounded-xl p-4 border border-accent/30 bg-accent/5">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-foreground">{s.template.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{s.value}</p>
                  <div className="mb-3">
                    <p className="text-sm font-bold text-accent">
                      R{(s.template.pricing_setup_zar || 0).toLocaleString()}
                      {s.template.pricing_recurring_zar > 0 && <span className="text-xs font-normal text-muted-foreground ml-1">+ R{s.template.pricing_recurring_zar.toLocaleString()}/mo</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/client/order-addons`} className="flex-1">
                      <Button size="sm" className="w-full gradient-bg text-white text-xs">
                        Order Now
                      </Button>
                    </a>
                  </div>
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

        {/* Sidebar */}
         <div className="w-72 hidden lg:block space-y-4">
           {/* Order More */}
           <div className="glass rounded-xl p-4">
             <h3 className="text-sm font-semibold text-foreground mb-3">Order More</h3>
             <div className="space-y-2">
               <a href="/client/order-addons" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground group">
                 <span className="w-4 h-4 group-hover:text-primary transition-colors">➕</span>
                 Add-ons
                 <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
               </a>
               <a href="/client/order-domain" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground group">
                 <span className="w-4 h-4 group-hover:text-primary transition-colors">🌐</span>
                 Domain
                 <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
               </a>
               <a href="/client/order-email" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground group">
                 <span className="w-4 h-4 group-hover:text-primary transition-colors">📧</span>
                 Business Email
                 <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
               </a>
               <a href="/client/orders" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground group">
                 <span className="w-4 h-4 group-hover:text-primary transition-colors">📦</span>
                 My Orders
                 <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
               </a>
             </div>
           </div>

           {/* Quick Links */}
           <div className="glass rounded-xl p-4">
             <h3 className="text-sm font-semibold text-foreground mb-3">Quick Access</h3>
             <div className="space-y-2">
               {quickLinks.map(link => (
                 <a key={link.label} href={link.path} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground group">
                   <link.icon className="w-4 h-4 group-hover:text-primary transition-colors" />
                   {link.label}
                   <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                 </a>
               ))}
             </div>
           </div>

          {/* Recent Activity */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Recent Activity</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activityLog.length === 0 ? (
                <p className="text-xs text-muted-foreground">No recent activity</p>
              ) : (
                activityLog.slice(0, 8).map(a => (
                  <div key={a.id} className="text-xs pb-2 border-b border-border/20 last:border-0">
                    <p className="text-muted-foreground">{new Date(a.created_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="text-foreground font-medium">{a.event_label}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
        </div>
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