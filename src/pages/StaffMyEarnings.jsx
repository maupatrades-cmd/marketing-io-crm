import { useState, useEffect } from "react"; // FA Earnings Page
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, Lock, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const COMMISSION_RATES = {
  ignite: { setup: 0.07, retainer: 0.07 },
  accelerate: { setup: 0.055, retainer: 0.045 },
  dominate: { setup: 0.055, retainer: 0.045 },
  street_pulse: { setup: 0, retainer: 0, flat: 444 },
  township_pulse: { setup: 0, retainer: 0, flat: 130 },
};

function StatCard({ icon: IconComp, label, amount, color, sublabel }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <IconComp className="w-5 h-5" />
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">R{amount.toLocaleString()}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}

export default function StaffMyEarnings() {
  const { user } = useAuth();
  const [commissions, setCommissions] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [comms, dealsData] = await Promise.all([
          base44.entities.Commission.list("-created_date", 200).catch(() => []),
          base44.entities.Deal.list("-created_date", 200).catch(() => []),
        ]);
        const myEmail = user?.email || "";
        const myId = user?.id || "";
        const myComms = (Array.isArray(comms) ? comms : []).filter(c =>
          c.staff_email === myEmail || c.staff_id === myId || c.created_by === myEmail
        );
        const myDeals = (Array.isArray(dealsData) ? dealsData : []).filter(d =>
          d.closer_id === myId || d.cpc_id === myId
        );
        setCommissions(myComms);
        setDeals(myDeals);
      } catch (err) {
        console.error("StaffMyEarnings load error:", err);
      } finally {
        setLoading(false);
      }
    }
    if (user?.id) load();
  }, [user]);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Cleared this month
  const cleared = commissions
    .filter(c => c.status === "paid" && c.paid_at && new Date(c.paid_at) >= monthStart && new Date(c.paid_at) <= monthEnd)
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Pending
  const pending = commissions
    .filter(c => ["pending", "approved"].includes(c.status))
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Milestone-locked (deals 1-4 of current batch — approximated as retainer commissions not yet paid)
  const locked = commissions
    .filter(c => c.status === "pending" && c.commission_type === "retainer")
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);

  // Forecast — open deals × probability × commission rate
  const forecast = deals
    .filter(d => !["closed_won", "closed_lost"].includes(d.stage))
    .reduce((s, d) => {
      const prob = (Number(d.probability) || 50) / 100;
      const rates = COMMISSION_RATES[d.package] || { setup: 0.07, retainer: 0.07 };
      const setupComm = (Number(d.setup_fee) || 0) * rates.setup;
      const retainerComm = (Number(d.monthly_retainer) || 0) * rates.retainer;
      return s + Math.round((setupComm + retainerComm) * prob);
    }, 0);

  // 6-month chart
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(now, 5 - i);
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);
    const amount = commissions
      .filter(c => c.status === "paid" && c.paid_at && new Date(c.paid_at) >= mStart && new Date(c.paid_at) <= mEnd)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { month: format(month, "MMM"), amount };
  });

  // Milestone progress
  const closedWonThisMonth = deals.filter(d =>
    d.stage === "closed_won" && d.updated_date &&
    new Date(d.updated_date) >= monthStart
  ).length;
  const milestoneProgress = Math.min(closedWonThisMonth, 5);

  if (loading) {
    return (
      <AppLayout title="My Earnings" subtitle="Forward-looking commission forecast">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted/20 rounded-xl animate-pulse" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Earnings" subtitle="Forward-looking commission forecast">
      <div className="space-y-6">
        {/* Milestone progress */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-foreground">Milestone Progress</p>
              <p className="text-sm text-muted-foreground">You are at <strong>{milestoneProgress} of 5</strong> deals towards retainer commission unlock</p>
            </div>
            <Badge className={milestoneProgress >= 4 ? "bg-warning/20 text-warning border-warning/40 border animate-pulse" : "bg-secondary text-muted-foreground"}>
              {milestoneProgress}/5
            </Badge>
          </div>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex-1 h-3 rounded-full transition-all ${i < milestoneProgress ? "gradient-bg shadow-glow-purple" : "bg-muted/30"}`} />
            ))}
          </div>
          {locked > 0 && (
            <p className="text-xs text-warning mt-2">⚠️ R{locked.toLocaleString()} retainer commission currently locked — unlocks at deal #5</p>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Cleared This Month" amount={cleared} color="bg-success/20 text-success" sublabel="Paid to you" />
          <StatCard icon={Clock} label="Pending" amount={pending} color="bg-warning/20 text-warning" sublabel="Signed, awaiting clearance" />
          <StatCard icon={Lock} label="Milestone-Locked" amount={locked} color="bg-destructive/20 text-destructive" sublabel="Unlocks at 5 deals" />
          <StatCard icon={TrendingUp} label="Forecast (30d)" amount={forecast} color="bg-primary/20 text-primary" sublabel="Open deals × probability" />
        </div>

        {/* 6-month chart */}
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Earnings — Last 6 Months</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No commission history yet — your first deal will appear here.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#a8a8c0" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#a8a8c0" }} tickFormatter={v => `R${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(val) => [`R${Number(val).toLocaleString()}`, "Earnings"]} contentStyle={{ background: "#1c1c30", border: "1px solid rgba(255,255,255,0.1)" }} />
                  <Bar dataKey="amount" fill="url(#purpleGrad)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a764e6" />
                      <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Commission Rules */}
        <div className="glass rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left"
            onClick={() => setShowRules(!showRules)}
          >
            <span className="font-semibold text-foreground">How My Commission Works</span>
            {showRules ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showRules && (
            <div className="px-5 pb-5 border-t border-border/30 pt-4 space-y-2 text-sm animate-fade-in">
              {[
                ["Ignite", "7% setup + 7% retainer (unlocks at 5 deals)"],
                ["Accelerate / Dominate", "5.5% setup + 4.5% retainer (unlocks at 5 deals)"],
                ["Street Pulse", "12% of R3,700 = R444 once-off"],
                ["Township Pulse", "10% of R1,300 = R130 once-off"],
                ["Pay date", "25th of the month following clearance"],
                ["Cut-off", "6th of each month"],
                ["Clawback", "Cancellation within 30 days reverses commission"],
                ["First payday", "25 June 2026 — covers training period 25 May–6 June"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-primary font-medium w-40 shrink-0">{label}</span>
                  <span className="text-muted-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}