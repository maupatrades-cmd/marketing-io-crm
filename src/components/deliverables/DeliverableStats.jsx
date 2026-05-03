import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle2, Clock, AlertCircle, MessageSquare } from "lucide-react";

export default function DeliverableStats({ deliverables }) {
  const stats = {
    total: deliverables.length,
    approved: deliverables.filter(d => d.approval_status === "approved").length,
    forReview: deliverables.filter(d => ["pending_client_review", "client_reviewing"].includes(d.approval_status)).length,
    changesRequested: deliverables.filter(d => d.approval_status === "changes_requested").length,
  };

  const chartData = [
    { name: "Approved", value: stats.approved },
    { name: "Pending Review", value: stats.forReview },
    { name: "Changes Requested", value: stats.changesRequested },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-4 border border-slate-700/40">
          <div className="text-xs text-muted-foreground mb-1">Total Deliverables</div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </div>
        <div className="glass rounded-xl p-4 border border-slate-700/40">
          <div className="flex items-center gap-2 text-xs text-success mb-1">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </div>
          <div className="text-2xl font-bold text-success">{stats.approved}</div>
        </div>
        <div className="glass rounded-xl p-4 border border-slate-700/40">
          <div className="flex items-center gap-2 text-xs text-warning mb-1">
            <Clock className="w-3 h-3" /> Pending
          </div>
          <div className="text-2xl font-bold text-warning">{stats.forReview}</div>
        </div>
        <div className="glass rounded-xl p-4 border border-slate-700/40">
          <div className="flex items-center gap-2 text-xs text-orange-500 mb-1">
            <MessageSquare className="w-3 h-3" /> Revisions
          </div>
          <div className="text-2xl font-bold text-orange-500">{stats.changesRequested}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass rounded-xl p-6 border border-slate-700/40">
        <h3 className="text-sm font-semibold text-foreground mb-4">Status Overview</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
            <YAxis stroke="rgba(255,255,255,0.5)" />
            <Tooltip
              contentStyle={{ backgroundColor: "#1c1c30", border: "1px solid rgba(255,255,255,0.1)" }}
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
            />
            <Bar dataKey="value" fill="#a764e6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}