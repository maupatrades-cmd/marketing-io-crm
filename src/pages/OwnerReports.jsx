import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Search } from "lucide-react";

const REPORTS = [
  { id: "inactive_clients", name: "Inactive Clients", desc: "No contact in 30 days" },
  { id: "deals_closing_soon", name: "Deals Closing Soon", desc: "Expected to close this month" },
  { id: "failed_debits", name: "Failed Debits", desc: "This quarter" },
  { id: "top_agents", name: "Top Agents", desc: "This month by deals closed" },
  { id: "addon_attach_rate", name: "Add-on Attach Rate", desc: "By package" },
  { id: "deal_to_paid_days", name: "Days: Deal to Setup Paid", desc: "Average" },
  { id: "renewal_approaching", name: "Renewals Approaching", desc: "30/60/90 days" },
  { id: "onboarding_bottlenecks", name: "Onboarding Bottlenecks", desc: "Longest per phase" },
  { id: "deliverable_lag", name: "Deliverable Approval Lag", desc: "Average days to approval" },
  { id: "playbook_usage", name: "Playbook Usage & KPI Hit Rate", desc: "Most used resources" },
];

export default function OwnerReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [data, setData] = useState({ clients: [], deals: [], invoices: [], users: [], deliverables: [], tasks: [] });

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      if (user?.role !== "owner") {
        navigate("/");
        return;
      }
      const [c, d, inv, u, deliv, t] = await Promise.all([
        base44.entities.Client.list(),
        base44.entities.Deal.list(),
        base44.entities.Invoice.list(),
        base44.entities.User.list(),
        base44.entities.Deliverable.list(),
        base44.entities.Task.list(),
      ]);
      setData({
        clients: Array.isArray(c) ? c : [c],
        deals: Array.isArray(d) ? d : [d],
        invoices: Array.isArray(inv) ? inv : [inv],
        users: Array.isArray(u) ? u : [u],
        deliverables: Array.isArray(deliv) ? deliv : [deliv],
        tasks: Array.isArray(t) ? t : [t],
      });
      setLoading(false);
    };
    load();
  }, [navigate]);

  const generateReport = (reportId) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

    switch (reportId) {
      case "inactive_clients":
        return data.clients.filter(c => {
          const lastActivity = c.portal_last_active_at ? new Date(c.portal_last_active_at) : null;
          return !lastActivity || lastActivity < thirtyDaysAgo;
        }).map(c => ({ client: c.business_name, lastActive: c.portal_last_active_at || "Never", status: c.status }));

      case "deals_closing_soon":
        return data.deals.filter(d => d.stage !== "closed_won" && d.stage !== "closed_lost").map(d => ({
          client: d.client_name,
          stage: d.stage,
          probability: `${d.probability || 0}%`,
          amount: `R${(d.monthly_retainer || 0).toLocaleString()}`,
        }));

      case "failed_debits":
        return data.clients.filter(c => c.failed_debits_count > 0).map(c => ({
          client: c.business_name,
          failedCount: c.failed_debits_count,
          accelerationTriggered: c.acceleration_triggered ? "Yes" : "No",
        }));

      case "top_agents":
        const agentDeals = {};
        data.deals.filter(d => d.stage === "closed_won").forEach(d => {
          const agent = d.closer_name || "Unknown";
          if (!agentDeals[agent]) agentDeals[agent] = 0;
          agentDeals[agent]++;
        });
        return Object.entries(agentDeals).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([agent, count]) => ({
          agent,
          dealsWon: count,
        }));

      case "addon_attach_rate":
        const packageAddOns = {};
        data.deals.forEach(d => {
          if (d.package) {
            if (!packageAddOns[d.package]) packageAddOns[d.package] = { total: 0, addOns: 0 };
            packageAddOns[d.package].total++;
            if (d.deal_type === "add_on") packageAddOns[d.package].addOns++;
          }
        });
        return Object.entries(packageAddOns).map(([pkg, counts]) => ({
          package: pkg,
          rate: `${Math.round((counts.addOns / counts.total) * 100)}%`,
          totalDeals: counts.total,
        }));

      case "deal_to_paid_days":
        const daysDiff = data.deals.filter(d => d.stage === "closed_won" && d.client_onboarded_date).map(d => {
          const dealDate = new Date(d.created_date);
          const paidDate = new Date(d.client_onboarded_date);
          return Math.floor((paidDate - dealDate) / (1000 * 60 * 60 * 24));
        });
        const avgDays = daysDiff.length ? Math.round(daysDiff.reduce((a, b) => a + b, 0) / daysDiff.length) : 0;
        return [{ metric: "Average Days", value: avgDays, dealCount: daysDiff.length }];

      case "renewal_approaching":
        const renewal30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
        const renewal60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
        const renewal90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
        return [
          { bucket: "30 days", count: data.clients.filter(c => c.contract_end_date && new Date(c.contract_end_date) <= renewal30).length },
          { bucket: "60 days", count: data.clients.filter(c => c.contract_end_date && new Date(c.contract_end_date) <= renewal60).length },
          { bucket: "90 days", count: data.clients.filter(c => c.contract_end_date && new Date(c.contract_end_date) <= renewal90).length },
        ];

      case "onboarding_bottlenecks":
        // Placeholder: would need ClientOnboarding entity phase tracking
        return [{ phase: "Phase 1", avgDays: "2 days", clientsStuck: 3 }];

      case "deliverable_lag":
        const approvalLags = data.deliverables.filter(d => d.approval_status === "approved").map(d => {
          const delivDate = new Date(d.scheduled_date);
          const approvalDate = new Date(d.approved_date);
          return Math.floor((approvalDate - delivDate) / (1000 * 60 * 60 * 24));
        });
        const avgLag = approvalLags.length ? Math.round(approvalLags.reduce((a, b) => a + b, 0) / approvalLags.length) : 0;
        return [{ metric: "Average Approval Lag", value: `${avgLag} days`, count: approvalLags.length }];

      case "playbook_usage":
        return [{ insight: "Playbook usage tracking coming soon" }];

      default:
        return [];
    }
  };

  const handleSelectReport = (reportId) => {
    setSelectedReport(reportId);
    setReportData(generateReport(reportId));
  };

  if (loading) return <AppLayout title="Reports"><div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div></AppLayout>;

  return (
    <AppLayout title="Reports" subtitle="Business intelligence & analysis">
      <div className="grid grid-cols-3 gap-6">
        {/* Report Library */}
        <div className="col-span-1">
          <Card className="glass border-white/10 p-4 h-fit">
            <h3 className="font-semibold mb-4">Report Library</h3>
            <div className="space-y-2">
              {REPORTS.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleSelectReport(r.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedReport === r.id
                      ? "bg-primary/20 border-primary/40"
                      : "border-white/10 hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Report Results */}
        <div className="col-span-2">
          {!selectedReport ? (
            <Card className="glass border-white/10 p-12 text-center">
              <p className="text-muted-foreground">Select a report to view results</p>
            </Card>
          ) : (
            <Card className="glass border-white/10 p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold">{REPORTS.find(r => r.id === selectedReport)?.name}</h3>
                <Button size="sm" variant="outline" className="gap-2">
                  <Download className="w-4 h-4" /> Export CSV
                </Button>
              </div>

              {reportData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data available for this report</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        {Object.keys(reportData[0] || {}).map(col => (
                          <th key={col} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">
                            {col.replace(/_/g, " ").toUpperCase()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row, idx) => (
                        <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                          {Object.values(row).map((val, i) => (
                            <td key={i} className="py-3 px-3">{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}