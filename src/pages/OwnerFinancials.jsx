import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { DollarSign, TrendingUp, AlertCircle, Clock } from "lucide-react";

export default function OwnerFinancials() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      if (user?.role !== "owner") {
        navigate("/");
        return;
      }
      const [inv, comm, c, u] = await Promise.all([
        base44.entities.Invoice.list("-created_date", 500),
        base44.entities.Commission.list("-created_date", 500),
        base44.entities.Client.list(),
        base44.entities.User.list(),
      ]);
      setInvoices(Array.isArray(inv) ? inv : [inv]);
      setCommissions(Array.isArray(comm) ? comm : [comm]);
      setClients(Array.isArray(c) ? c : [c]);
      setUsers(Array.isArray(u) ? u : [u]);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();

  // KPI Calculations
  const paidThisMonth = invoices.filter(inv => {
    if (inv.status !== "paid" || !inv.paid_date) return false;
    const d = new Date(inv.paid_date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).reduce((sum, inv) => sum + (inv.total || 0), 0);

  const nextMonthExpected = clients.filter(c => c.status === "active").reduce((sum, c) => sum + (c.monthly_retainer || 0), 0);

  const unpaidInvoices = invoices.filter(inv => inv.status === "issued" || inv.status === "overdue");
  const outstandingValue = unpaidInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  const pendingCommissions = commissions.filter(c => c.status === "pending").reduce((sum, c) => sum + (c.amount || 0), 0);

  // Chart: Monthly paid revenue last 6 months
  const monthData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(thisYear, thisMonth - i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const monthPaid = invoices.filter(inv => {
      if (inv.status !== "paid" || !inv.paid_date) return false;
      const pd = new Date(inv.paid_date);
      return pd.getMonth() === m && pd.getFullYear() === y;
    }).reduce((sum, inv) => sum + (inv.total || 0), 0);
    monthData.push({ month: d.toLocaleDateString("en-US", { month: "short" }), revenue: monthPaid });
  }

  // Outstanding invoices table
  const outstandingByAge = {};
  unpaidInvoices.forEach(inv => {
    const daysOverdue = inv.due_date ? Math.floor((today - new Date(inv.due_date)) / (1000 * 60 * 60 * 24)) : 0;
    let bucket = "current";
    if (daysOverdue > 90) bucket = "90+";
    else if (daysOverdue > 60) bucket = "60";
    else if (daysOverdue > 30) bucket = "30";
    if (!outstandingByAge[bucket]) outstandingByAge[bucket] = { count: 0, value: 0 };
    outstandingByAge[bucket].count++;
    outstandingByAge[bucket].value += inv.total || 0;
  });

  // Recently paid (last 30 days)
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentlyPaid = invoices.filter(inv => inv.status === "paid" && inv.paid_date && new Date(inv.paid_date) > thirtyDaysAgo);

  // Commission by staff
  const commByStaff = {};
  commissions.filter(c => c.status === "pending").forEach(c => {
    const staffId = c.assigned_to || "unassigned";
    if (!commByStaff[staffId]) commByStaff[staffId] = 0;
    commByStaff[staffId] += c.amount || 0;
  });

  if (loading) return <AppLayout title="Financials"><div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div></AppLayout>;

  return (
    <AppLayout title="Financials Dashboard" subtitle="Financial health at a glance">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="glass border-white/10 p-4">
            <p className="text-xs text-muted-foreground mb-1">This Month Revenue</p>
            <p className="text-2xl font-bold">R{paidThisMonth.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{invoices.filter(inv => inv.status === "paid" && new Date(inv.paid_date).getMonth() === thisMonth).length} paid</p>
          </Card>
          <Card className="glass border-white/10 p-4">
            <p className="text-xs text-muted-foreground mb-1">Expected Next Month</p>
            <p className="text-2xl font-bold">R{nextMonthExpected.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{clients.filter(c => c.status === "active").length} active clients</p>
          </Card>
          <Card className="glass border-white/10 p-4">
            <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-orange-500">R{outstandingValue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{unpaidInvoices.length} unpaid invoices</p>
          </Card>
          <Card className="glass border-white/10 p-4">
            <p className="text-xs text-muted-foreground mb-1">Commission Liability</p>
            <p className="text-2xl font-bold text-yellow-500">R{pendingCommissions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{commissions.filter(c => c.status === "pending").length} pending</p>
          </Card>
        </div>

        {/* Cash Flow Chart */}
        <Card className="glass border-white/10 p-6">
          <h3 className="font-semibold mb-4">Cash Flow (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip contentStyle={{ backgroundColor: "#1c1c30", border: "1px solid rgba(255,255,255,0.1)" }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#a764e6" strokeWidth={2} dot={{ fill: "#a764e6", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Outstanding Invoices */}
        <Card className="glass border-white/10 p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Outstanding Invoices ({unpaidInvoices.length})</h3>
          {unpaidInvoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No outstanding invoices</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {unpaidInvoices.sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0)).slice(0, 10).map(inv => (
                <div key={inv.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 hover:border-orange-500/30 transition-all cursor-pointer">
                  <div>
                    <p className="text-sm font-semibold">#{inv.invoice_number || inv.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{inv.client_name} • {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "No due date"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">R{(inv.total || 0).toLocaleString()}</p>
                    <Badge variant="outline" className="text-xs mt-1">{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Aging Summary */}
        <Card className="glass border-white/10 p-6">
          <h3 className="font-semibold mb-4">Aging Summary</h3>
          <div className="grid grid-cols-4 gap-4">
            {["current", "30", "60", "90+"].map(bucket => (
              <div key={bucket} className="glass rounded-lg p-4 border border-white/10">
                <p className="text-xs text-muted-foreground mb-1">{bucket === "current" ? "Current" : `${bucket} days`}</p>
                <p className="text-lg font-bold">{(outstandingByAge[bucket]?.count || 0)}</p>
                <p className="text-sm text-primary">R{(outstandingByAge[bucket]?.value || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Commission Summary */}
        <Card className="glass border-white/10 p-6">
          <h3 className="font-semibold mb-4">Pending Commissions by Staff</h3>
          <div className="space-y-2">
            {Object.entries(commByStaff).map(([staffId, amount]) => {
              const staff = users.find(u => u.id === staffId);
              return (
                <div key={staffId} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 hover:border-primary/30 transition-all cursor-pointer">
                  <p className="text-sm">{staff?.full_name || "Unknown"}</p>
                  <p className="text-sm font-semibold">R{amount.toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}