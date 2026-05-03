import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Clock, FileText, AlertCircle, Download,
  BarChart2, Package, ChevronRight, CalendarDays, Zap,
  Bell, LogOut, MessageSquare, Phone, Mail, Users,
  ArrowRight, Star, ShieldCheck, Activity
} from "lucide-react";
import { destroySession } from "@/lib/customAuth";

const PACKAGE_LABELS = {
  ignite: "Ignite",
  accelerate: "Accelerate",
  dominate: "Dominate",
  street_pulse: "Street Pulse",
  township_pulse: "Township Pulse",
  none: "No Package",
};

const STATUS_CONFIG = {
  not_started:    { label: "Not Started",   color: "bg-muted/40 text-muted-foreground border-border/40" },
  in_progress:    { label: "In Progress",   color: "bg-primary/15 text-primary border-primary/30" },
  awaiting_client:{ label: "Awaiting You",  color: "bg-warning/15 text-warning border-warning/30" },
  client_reviewing:{ label: "Under Review", color: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30" },
  approved:       { label: "Approved",      color: "bg-success/15 text-success border-success/30" },
  deemed_approved:{ label: "Auto-Approved", color: "bg-success/10 text-success border-success/20" },
  completed:      { label: "Completed",     color: "bg-success/15 text-success border-success/30" },
  blocked:        { label: "Blocked",       color: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function ClientPortal() {
  const { user, logout } = useAuth();

  const [client, setClient]               = useState(null);
  const [deliverables, setDeliverables]   = useState([]);
  const [invoices, setInvoices]           = useState([]);
  const [reports, setReports]             = useState([]);
  const [addOns, setAddOns]               = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [onboardingSub, setOnboardingSub] = useState(null);
  const [teamMembers, setTeamMembers]     = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState("overview");
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchData = async (clientId) => {
    const [d, inv, rep, ao, notif, subs] = await Promise.all([
      base44.entities.Deliverable.filter({ client_id: clientId }),
      base44.entities.Invoice.filter({ client_id: clientId }),
      base44.entities.MonthlyReport.filter({ client_id: clientId }),
      base44.entities.ClientAddOn.filter({ client_id: clientId }),
      base44.entities.ClientNotification.filter({ client_id: clientId }, "-created_date", 20),
      base44.entities.ClientOnboardingSubmission.filter({ client_id: clientId }),
    ]);
    setDeliverables(Array.isArray(d) ? d : []);
    setInvoices(Array.isArray(inv) ? inv : []);
    setReports(Array.isArray(rep) ? rep : []);
    setAddOns(Array.isArray(ao) ? ao : []);
    setNotifications(Array.isArray(notif) ? notif : []);
    setOnboardingSub(Array.isArray(subs) ? subs[0] : subs || null);
  };

  // Load assigned team members based on deliverable assignees
  const fetchTeam = async (delivs) => {
    const userIds = [...new Set(delivs.map(d => d.assigned_to).filter(Boolean))];
    if (userIds.length === 0) return;
    const allUsers = await base44.entities.User.list();
    const relevant = Array.isArray(allUsers)
      ? allUsers.filter(u => userIds.includes(u.id))
      : [];
    setTeamMembers(relevant);
  };

  useEffect(() => {
    const load = async () => {
      const me = user || await base44.auth.me();
      if (!me) { setLoading(false); return; }
      const clients = await base44.entities.Client.filter({ email: me.email });
      const c = Array.isArray(clients) ? clients[0] : clients;
      if (c) {
        setClient(c);
        await fetchData(c.id);
        base44.entities.Client.update(c.id, { portal_last_active_at: new Date().toISOString() });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Fetch team once deliverables are loaded
  useEffect(() => {
    if (deliverables.length > 0) fetchTeam(deliverables);
  }, [deliverables]);

  // Poll every 30s
  useEffect(() => {
    if (!client) return;
    const interval = setInterval(() => fetchData(client.id), 30000);
    return () => clearInterval(interval);
  }, [client]);

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
          <p className="text-sm text-muted-foreground">Your email is not linked to a client account. Please contact Marketing iO.</p>
          <a href="mailto:info@marketingio.co.za" className="mt-4 block text-primary text-sm">info@marketingio.co.za</a>
        </div>
      </div>
    );
  }

  // ── Derived data ──────────────────────────────────────────────
  const awaitingDeliverables = deliverables.filter(d => d.status === "awaiting_client" || d.status === "client_reviewing");
  const completedDeliverables = deliverables.filter(d => ["completed", "approved", "deemed_approved"].includes(d.status));
  const overdueInvoices = invoices.filter(i => i.status === "overdue" || i.status === "failed");
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const activeAddOns = addOns.filter(a => a.status === "active");

  // Onboarding steps from both Client entity and ClientOnboardingSubmission
  const onboardingSteps = [
    { key: "setup_fee_paid",           label: "Setup fee paid",               done: !!client.setup_fee_paid },
    { key: "onboarding_form_returned", label: "Onboarding form submitted",     done: onboardingSub?.submission_status === "submitted" || onboardingSub?.submission_status === "reviewed" },
    { key: "debit_mandate_signed",     label: "Debit order mandate signed",    done: !!client.debit_mandate_signed },
    { key: "brand_assets_received",    label: "Brand assets received",         done: !!client.brand_assets_received },
    { key: "go_live_acknowledged",     label: "Go-live acknowledged",          done: !!client.go_live_acknowledged },
  ];
  const onboardingDone = onboardingSteps.filter(s => s.done).length;
  const onboardingPct = Math.round((onboardingDone / onboardingSteps.length) * 100);
  const showOnboarding = client.status === "onboarding" || onboardingDone < onboardingSteps.length;

  // Active services grouped by product
  const activeServices = Object.entries(
    deliverables
      .filter(d => !["completed", "approved", "deemed_approved"].includes(d.status))
      .reduce((acc, d) => {
        const key = d.product || "General";
        acc[key] = acc[key] || [];
        acc[key].push(d);
        return acc;
      }, {})
  );

  const tabs = [
    { id: "overview",      label: "Overview" },
    { id: "services",      label: "Services", count: awaitingDeliverables.length },
    { id: "invoices",      label: "Invoices", count: overdueInvoices.length, alert: true },
    { id: "reports",       label: "Reports" },
    { id: "team",          label: "My Team" },
  ];

  return (
    <div className="min-h-screen bg-background font-inter">
      {/* ── Header ── */}
      <div className="border-b border-border/40 px-6 py-4 sticky top-0 z-20"
        style={{ background: "rgba(10,10,20,0.85)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
              alt="Marketing iO" className="h-8 object-contain"
              style={{ filter: "invert(1) brightness(2)" }}
            />
            <span className="text-xs text-muted-foreground border-l border-border/40 pl-3">Client Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-foreground">{client.business_name}</p>
              <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-ZA")}</p>
            </div>
            {/* Notification Bell */}
            <div className="relative">
              <button onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-secondary/40 rounded-lg transition-colors">
                <Bell className="w-5 h-5 text-foreground" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-card border border-border/40 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-border/40">
                    <p className="text-sm font-semibold">Notifications</p>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {notifications.slice(0, 10).map(n => (
                        <div key={n.id} className={`p-3 border-l-4 ${!n.is_read ? "border-l-primary bg-primary/5" : "border-l-transparent"}`}>
                          <p className="text-sm font-semibold text-foreground">{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={logout}
              className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 lg:p-6 flex gap-6">
        {/* ── Main ── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Welcome Banner */}
          <div className="glass rounded-2xl p-6 gradient-bg-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Welcome back</p>
                <h2 className="text-2xl font-bold text-foreground">{client.business_name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge className="bg-primary/15 text-primary border border-primary/30">
                    <Package className="w-3 h-3 mr-1" />{PACKAGE_LABELS[client.package] || client.package}
                  </Badge>
                  <StatusBadge status={client.status} />
                  {activeAddOns.length > 0 && (
                    <Badge className="bg-accent/15 text-accent border border-accent/30">
                      <Zap className="w-3 h-3 mr-1" />{activeAddOns.length} Add-on{activeAddOns.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
              {client.go_live_date && (
                <div className="glass rounded-xl p-4 text-center shrink-0">
                  <CalendarDays className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Go-Live</p>
                  <p className="text-sm font-semibold text-foreground">
                    {new Date(client.go_live_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Alerts ── */}
          {overdueInvoices.length > 0 && (
            <div className="glass rounded-xl p-4 border border-destructive/30 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">Please arrange payment to avoid service interruption</p>
              </div>
              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs shrink-0"
                onClick={() => setActiveTab("invoices")}>View</Button>
            </div>
          )}
          {awaitingDeliverables.length > 0 && (
            <div className="glass rounded-xl p-4 border border-warning/30 flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {awaitingDeliverables.length} deliverable{awaitingDeliverables.length > 1 ? "s" : ""} awaiting your review
                </p>
                <p className="text-xs text-muted-foreground">Please review within 5 business days to avoid auto-approval</p>
              </div>
              <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 text-xs shrink-0"
                onClick={() => setActiveTab("services")}>Review</Button>
            </div>
          )}

          {/* ── Onboarding Progress ── */}
          {showOnboarding && (
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Onboarding Progress</h3>
                </div>
                <span className="text-xs font-medium text-primary">{onboardingPct}% complete</span>
              </div>
              <div className="w-full bg-muted/40 rounded-full h-2 mb-4">
                <div className="gradient-bg h-2 rounded-full transition-all duration-500"
                  style={{ width: `${onboardingPct}%` }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onboardingSteps.map(step => (
                  <div key={step.key} className="flex items-center gap-2">
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${step.done ? "text-success" : "text-muted-foreground/30"}`} />
                    <span className={`text-xs ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                  </div>
                ))}
              </div>
              {onboardingSub?.submission_status !== "submitted" && (
                <Link to="/client/onboarding-form"
                  className="mt-4 flex items-center gap-2 text-xs text-primary hover:underline">
                  Complete your onboarding form <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}

          {/* ── Tabs ── */}
          <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-full overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 justify-center ${
                  activeTab === tab.id ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}>
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab.alert ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatMini icon={CheckCircle2} label="Completed Deliverables" value={completedDeliverables.length} color="text-success" />
                <StatMini icon={BarChart2}    label="Reports Delivered"       value={reports.filter(r => ["delivered","acknowledged"].includes(r.status)).length} color="text-primary" />
                <StatMini icon={Zap}          label="Active Add-Ons"          value={activeAddOns.length} color="text-accent" />
              </div>
              {activeAddOns.length > 0 && (
                <div className="glass rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Your Active Services</h3>
                  <div className="flex flex-wrap gap-2">
                    {activeAddOns.map(a => (
                      <Badge key={a.id} className="bg-primary/15 text-primary border border-primary/30 capitalize">
                        {a.add_on?.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Services ── */}
          {activeTab === "services" && (
            <div className="space-y-5">
              {activeServices.length === 0 ? (
                <EmptyState icon={Package} message="No active deliverables at this time" />
              ) : (
                activeServices.map(([product, items]) => (
                  <div key={product} className="glass rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">{product}</h3>
                      <Badge className="bg-muted/40 text-muted-foreground border-border/40 text-xs ml-auto">
                        {items.length} item{items.length > 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {items.map(d => <DeliverableRow key={d.id} item={d} />)}
                    </div>
                  </div>
                ))
              )}
              {/* Also show completed section */}
              {completedDeliverables.length > 0 && (
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <h3 className="text-sm font-semibold text-foreground">Completed</h3>
                  </div>
                  <div className="space-y-2">
                    {completedDeliverables.slice(0, 5).map(d => <DeliverableRow key={d.id} item={d} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Invoices ── */}
          {activeTab === "invoices" && (
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <EmptyState icon={FileText} message="No invoices yet" />
              ) : (
                invoices.map(inv => <InvoiceRow key={inv.id} item={inv} />)
              )}
            </div>
          )}

          {/* ── Tab: Reports ── */}
          {activeTab === "reports" && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <EmptyState icon={BarChart2} message="No reports delivered yet" />
              ) : (
                reports.map(r => <ReportRow key={r.id} item={r} />)
              )}
            </div>
          )}

          {/* ── Tab: My Team ── */}
          {activeTab === "team" && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Your Assigned Team</h3>
                </div>
                {teamMembers.length === 0 ? (
                  <EmptyState icon={Users} message="No team members assigned yet" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teamMembers.map(member => (
                      <TeamMemberCard key={member.id} member={member} />
                    ))}
                  </div>
                )}
              </div>

              {/* Static direct support channels */}
              <div className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">Direct Support Channels</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a href="mailto:info@marketingio.co.za"
                    className="flex items-center gap-3 glass rounded-xl p-4 hover:border-primary/40 border border-border/40 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Email Support</p>
                      <p className="text-xs text-muted-foreground truncate">info@marketingio.co.za</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary ml-auto transition-colors" />
                  </a>
                  <a href="https://wa.me/27XXXXXXXXX" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 glass rounded-xl p-4 hover:border-success/40 border border-border/40 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-success/15 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-success" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">WhatsApp Support</p>
                      <p className="text-xs text-muted-foreground">Chat with us on WhatsApp</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-success ml-auto transition-colors" />
                  </a>
                  <Link to="/client/messages"
                    className="flex items-center gap-3 glass rounded-xl p-4 hover:border-accent/40 border border-border/40 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">In-App Messages</p>
                      <p className="text-xs text-muted-foreground">Send a message to your team</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent ml-auto transition-colors" />
                  </Link>
                  <a href="tel:+27XXXXXXXXX"
                    className="flex items-center gap-3 glass rounded-xl p-4 hover:border-[#00CCFF]/40 border border-border/40 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-[#00CCFF]/15 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-[#00CCFF]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">Call Us</p>
                      <p className="text-xs text-muted-foreground">Business hours: Mon–Fri 8–17</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-[#00CCFF] ml-auto transition-colors" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar ── */}
        <div className="w-64 hidden lg:block space-y-4 shrink-0">
          {/* Quick Links */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Access</h3>
            <div className="space-y-1">
              {[
                { label: "Invoices",      path: "/client/invoices",      icon: FileText },
                { label: "Deliverables",  path: "/client/deliverables",  icon: CheckCircle2 },
                { label: "Reports",       path: "/client/reports",       icon: BarChart2 },
                { label: "Contracts",     path: "/client/contracts",     icon: ShieldCheck },
                { label: "Files",         path: "/client/uploads",       icon: Package },
                { label: "Messages",      path: "/client/messages",      icon: MessageSquare },
                { label: "My Profile",    path: "/client/profile",       icon: Activity },
              ].map(link => (
                <Link key={link.label} to={link.path}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground group">
                  <link.icon className="w-4 h-4 group-hover:text-primary transition-colors" />
                  {link.label}
                  <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                </Link>
              ))}
            </div>
          </div>

          {/* Order More */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Order More</h3>
            <div className="space-y-1">
              {[
                { label: "Add-ons",        path: "/client/order-addons",  emoji: "➕" },
                { label: "Domain",         path: "/client/order-domain",  emoji: "🌐" },
                { label: "Business Email", path: "/client/order-email",   emoji: "📧" },
                { label: "My Orders",      path: "/client/orders",        emoji: "📦" },
              ].map(link => (
                <Link key={link.label} to={link.path}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-secondary/40 transition-colors text-muted-foreground hover:text-foreground group">
                  <span className="text-sm">{link.emoji}</span>
                  {link.label}
                  <ChevronRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                </Link>
              ))}
            </div>
          </div>

          {/* Support */}
          <div className="glass rounded-xl p-4 text-center">
            <MessageSquare className="w-6 h-6 text-accent mx-auto mb-2" />
            <p className="text-xs font-semibold text-foreground mb-1">Need help?</p>
            <p className="text-xs text-muted-foreground mb-3">Our team is ready to assist you</p>
            <a href="mailto:info@marketingio.co.za"
              className="block text-xs text-primary hover:underline">info@marketingio.co.za</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    active:     "bg-success/15 text-success border-success/30",
    onboarding: "bg-primary/15 text-primary border-primary/30",
    suspended:  "bg-destructive/15 text-destructive border-destructive/30",
    cancelled:  "bg-muted/40 text-muted-foreground border-border/40",
    lead:       "bg-warning/15 text-warning border-warning/30",
    prospect:   "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  };
  return (
    <Badge className={`border capitalize ${map[status] || "bg-muted/40 text-muted-foreground border-border/40"}`}>
      {status?.replace(/_/g, " ")}
    </Badge>
  );
}

function StatMini({ icon: Icon, label, value, color }) {
  return (
    <div className="glass rounded-xl p-4 flex items-center gap-3">
      <Icon className={`w-8 h-8 ${color} shrink-0`} />
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DeliverableRow({ item }) {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.not_started;
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-secondary/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {item.phase?.replace(/_/g, " ")}
          {item.assigned_to_name && ` · ${item.assigned_to_name}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.due_date && (
          <span className="text-xs text-muted-foreground hidden sm:block">
            {new Date(item.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
          </span>
        )}
        <Badge className={`border text-xs ${cfg.color}`}>{cfg.label}</Badge>
      </div>
    </div>
  );
}

function InvoiceRow({ item }) {
  const statusMap = {
    paid:    "bg-success/15 text-success border-success/30",
    overdue: "bg-destructive/15 text-destructive border-destructive/30",
    failed:  "bg-destructive/15 text-destructive border-destructive/30",
    sent:    "bg-warning/15 text-warning border-warning/30",
    draft:   "bg-muted/40 text-muted-foreground border-border/40",
  };
  return (
    <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{item.invoice_number || "Invoice"}</p>
        <p className="text-xs text-muted-foreground capitalize">
          {item.invoice_type?.replace(/_/g, " ")}
          {item.due_date && ` · Due ${new Date(item.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}
        </p>
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
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Download className="w-4 h-4" /></Button>
          </a>
        )}
      </div>
    </div>
  );
}

function TeamMemberCard({ member }) {
  return (
    <div className="glass rounded-xl p-4 flex items-start gap-3 border border-border/40">
      <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-white font-bold text-sm shrink-0">
        {(member.full_name || "?")[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{member.full_name}</p>
        <p className="text-xs text-muted-foreground capitalize mb-2">{member.role?.replace(/_/g, " ")}</p>
        <div className="flex flex-col gap-1">
          {member.email && (
            <a href={`mailto:${member.email}`}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate">
              <Mail className="w-3 h-3 shrink-0" />{member.email}
            </a>
          )}
          {member.phone && (
            <a href={`https://wa.me/${member.phone?.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-success hover:underline">
              <Phone className="w-3 h-3 shrink-0" />WhatsApp
            </a>
          )}
        </div>
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