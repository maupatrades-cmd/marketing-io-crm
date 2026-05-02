import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, DollarSign, TrendingUp, BarChart2, AlertTriangle,
  CheckCircle2, Clock, ArrowRight, Zap, FileText, Target
} from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const revenueData = [
  { month: "Nov", revenue: 68000, target: 75000 },
  { month: "Dec", revenue: 74000, target: 75000 },
  { month: "Jan", revenue: 81000, target: 85000 },
  { month: "Feb", revenue: 79000, target: 85000 },
  { month: "Mar", revenue: 88000, target: 90000 },
  { month: "Apr", revenue: 94200, target: 90000 },
];

const pipelineData = [
  { stage: "New Lead", count: 12 },
  { stage: "Discovery", count: 8 },
  { stage: "Proposal", count: 5 },
  { stage: "Negotiation", count: 3 },
  { stage: "Won", count: 7 },
];

export default function OwnerDashboard() {
  const [clients, setClients] = useState([]);
  const [deals, setDeals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Client.list("-created_date", 100),
      base44.entities.Deal.list("-created_date", 100),
      base44.entities.Commission.list("-created_date", 100),
      base44.entities.Invoice.list("-created_date", 100),
      base44.entities.Lead.list("-created_date", 100),
    ]).then(([c, d, com, inv, l]) => {
      setClients(c);
      setDeals(d);
      setCommissions(com);
      setInvoices(inv);
      setLeads(l);
      setLoading(false);
    });
  }, []);

  const activeClients = clients.filter(c => c.status === "active").length;
  const onboardingClients = clients.filter(c => c.status === "onboarding").length;
  const openDeals = deals.filter(d => !["closed_won", "closed_lost"].includes(d.stage)).length;
  const pendingCommissions = commissions.filter(c => c.status === "pending").reduce((s, c) => s + (c.commission_amount || 0), 0);
  const monthlyRevenue = clients.filter(c => c.status === "active").reduce((s, c) => s + (c.monthly_retainer || 0), 0);
  const overdueInvoices = invoices.filter(i => i.status === "overdue" || i.status === "failed").length;
  const pendingLeads = leads.filter(l => l.status === "pending_verification").length;
  const accelerationClients = clients.filter(c => c.acceleration_triggered).length;

  const recentActivity = [
    ...deals.filter(d => d.stage === "closed_won").slice(0, 3).map(d => ({
      type: "deal_won", label: `Deal won — ${d.client_name || "Client"}`, time: "Recently", color: "text-success"
    })),
    ...leads.filter(l => l.status === "pending_verification").slice(0, 2).map(l => ({
      type: "lead", label: `New lead — ${l.business_name}`, time: "Pending review", color: "text-warning"
    })),
    ...invoices.filter(i => i.status === "failed").slice(0, 2).map(i => ({
      type: "failed_debit", label: `Failed debit — ${i.client_name}`, time: "Needs attention", color: "text-destructive"
    })),
  ].slice(0, 6);

  return (
    <AppLayout title="Dashboard" subtitle="Owner overview">
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={Users} label="Active Clients" value={loading ? "—" : activeClients} sub={`${onboardingClients} onboarding`} color="bg-primary/20" />
          <KpiCard icon={DollarSign} label="Monthly Retainer MRR" value={loading ? "—" : `R${(monthlyRevenue).toLocaleString()}`} sub="Recurring revenue" color="bg-accent/20" />
          <KpiCard icon={TrendingUp} label="Open Deals" value={loading ? "—" : openDeals} sub="In pipeline" color="bg-[#00CCFF]/20" />
          <KpiCard icon={BarChart2} label="Pending Commissions" value={loading ? "—" : `R${pendingCommissions.toLocaleString()}`} sub="Awaiting payout" color="bg-success/20" />
        </div>

        {/* Alerts */}
        {(accelerationClients > 0 || overdueInvoices > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accelerationClients > 0 && (
              <div className="glass rounded-xl p-4 border-destructive/30 border flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{accelerationClients} Acceleration Clause{accelerationClients > 1 ? "s" : ""} Triggered</p>
                  <p className="text-xs text-muted-foreground">3 failed debits — full outstanding amount due</p>
                </div>
                <Link to="/invoices" className="ml-auto">
                  <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">View</Button>
                </Link>
              </div>
            )}
            {overdueInvoices > 0 && (
              <div className="glass rounded-xl p-4 border-warning/30 border flex items-center gap-3">
                <FileText className="w-5 h-5 text-warning shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{overdueInvoices} Overdue Invoice{overdueInvoices > 1 ? "s" : ""}</p>
                  <p className="text-xs text-muted-foreground">Immediate follow-up required</p>
                </div>
                <Link to="/invoices" className="ml-auto">
                  <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 text-xs">View</Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Chart */}
          <div className="lg:col-span-2 glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Revenue vs Target</h2>
              <Badge className="bg-success/15 text-success border border-success/30 text-xs">
                ↑ 8% MoM
              </Badge>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7729FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7729FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid rgba(119,41,255,0.3)", borderRadius: 8, fontSize: 12 }}
                  formatter={v => [`R${v.toLocaleString()}`, ""]}
                />
                <Area type="monotone" dataKey="target" stroke="#FF2994" strokeWidth={1} strokeDasharray="4 4" fill="none" />
                <Area type="monotone" dataKey="revenue" stroke="#7729FF" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Pipeline */}
          <div className="glass rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Deal Pipeline</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pipelineData} layout="vertical">
                <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stage" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid rgba(119,41,255,0.3)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="url(#barGrad)" radius={[0, 4, 4, 0]} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7729FF" />
                    <stop offset="100%" stopColor="#FF2994" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Activity */}
          <div className="lg:col-span-2 glass rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h2>
            {loading ? (
              <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-muted/40 rounded animate-pulse" />)}</div>
            ) : recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                    <div className={`w-2 h-2 rounded-full ${item.color === "text-success" ? "bg-success" : item.color === "text-warning" ? "bg-warning" : "bg-destructive"}`} />
                    <span className="text-sm text-foreground flex-1">{item.label}</span>
                    <span className={`text-xs ${item.color}`}>{item.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link to="/leads"><QuickAction icon={Zap} label="Review Pending Leads" count={pendingLeads} /></Link>
              <Link to="/deals"><QuickAction icon={Target} label="Update Deal Stages" count={openDeals} /></Link>
              <Link to="/commissions"><QuickAction icon={DollarSign} label="Approve Commissions" count={commissions.filter(c => c.status === "pending").length} /></Link>
              <Link to="/clients"><QuickAction icon={Users} label="View All Clients" /></Link>
              <Link to="/invoices"><QuickAction icon={FileText} label="Manage Invoices" count={overdueInvoices || undefined} alert /></Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <Card className="glass hover:shadow-card-hover transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon: Icon, label, count, alert }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 cursor-pointer transition-colors group">
      <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      <span className="text-sm text-foreground flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <Badge className={`text-xs ${alert ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-primary/15 text-primary border-primary/30"} border`}>
          {count}
        </Badge>
      )}
      <ArrowRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </div>
  );
}