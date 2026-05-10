import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BarChart3, XCircle, ArrowLeft, Download } from "lucide-react";
import BackButton from "@/components/BackButton";

const REPORTS = [
  { id: 1, name: "Clients with no contact in 30 days", description: "Inactive accounts needing outreach" },
  { id: 2, name: "Deals expected to close this month", description: "Pipeline forecast" },
  { id: 3, name: "Failed debit orders this quarter", description: "Payment issues to follow up" },
  { id: 4, name: "Top performing staff this month", description: "By deals closed + revenue" },
  { id: 5, name: "Add-on attach rate by package", description: "% of clients with add-ons" },
  { id: 6, name: "Average days from deal won to setup paid", description: "Payment speed" },
  { id: 7, name: "Clients approaching renewal (30/60/90 days)", description: "Upcoming renewal notices needed" },
  { id: 8, name: "Onboarding bottlenecks (longest in each phase)", description: "Identify slow phases" },
  { id: 9, name: "Deliverable approval lag", description: "Avg days from delivery to approval" },
  { id: 10, name: "Lead captures by month", description: "New leads grouped by creation date" },
  { id: 11, name: "Clients by month", description: "New clients grouped by creation date" },
  { id: 12, name: "Cancelled Invoices", description: "All cancelled invoices with reasons" },
];

export default function OwnerReports() {
  const [selected, setSelected] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dealsForm, setDealsForm] = useState({ title: "", description: "", recipients: "all" });

  const handleSelectReport = async (report) => {
    setSelected(report);
    setLoading(true);
    setReportData(null);

    try {
      const data = await generateReport(report);
      setReportData(data);
    } catch (err) {
      console.error("Error loading report:", err);
    }
    setLoading(false);
  };

  const generateReport = async (report) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (report.id) {
      case 1: { // Clients with no contact in 30 days
        const activities = await base44.entities.ClientActivityLog.list("-created_date", 500);
        const clients = await base44.entities.Client.list();
        const activeClientIds = new Set(activities.filter(a => new Date(a.created_date) > thirtyDaysAgo).map(a => a.client_id));
        const inactive = clients.filter(c => !activeClientIds.has(c.id) && c.status === "active");
        return { type: "clients", data: inactive };
      }

      case 2: { // Deals expected to close this month
        const deals = await base44.entities.Deal.filter({ stage: "proposal_sent" });
        return { type: "deals", data: deals };
      }

      case 3: { // Failed debit orders this quarter
        const invoices = await base44.entities.Invoice.filter({ status: "failed" });
        const filtered = invoices.filter(i => new Date(i.updated_date || i.created_date) > quarterStart);
        const byStaff = {};
        filtered.forEach(inv => {
          const key = inv.assigned_cpc_name || inv.assigned_field_agent_name || "Unassigned";
          byStaff[key] = (byStaff[key] || 0) + 1;
        });
        return { type: "failedDebits", data: filtered, byStaff };
      }

      case 4: { // Top performing staff
        const deals = await base44.entities.Deal.filter({ stage: "closed_won" });
        const thisMonth = deals.filter(d => new Date(d.client_onboarded_date || d.created_date) > monthStart);
        const byStaff = {};
        thisMonth.forEach(d => {
          const key = d.closer_name || "Unknown";
          byStaff[key] = (byStaff[key] || { count: 0, revenue: 0 });
          byStaff[key].count += 1;
          byStaff[key].revenue += (d.setup_fee || 0) + (d.monthly_retainer || 0) * 3;
        });
        const sorted = Object.entries(byStaff).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
        return { type: "topStaff", data: sorted };
      }

      case 5: { // Add-on attach rate
        const clients = await base44.entities.Client.list();
        const addOns = await base44.entities.ClientAddOn.list();
        const byPackage = {};
        clients.forEach(c => {
          const pkg = c.package || "none";
          byPackage[pkg] = (byPackage[pkg] || { total: 0, withAddOn: 0 });
          byPackage[pkg].total += 1;
          if (addOns.find(a => a.client_id === c.id)) byPackage[pkg].withAddOn += 1;
        });
        return { type: "attachRate", data: byPackage };
      }

      case 6: { // Average days from deal won to setup paid
        const deals = await base44.entities.Deal.filter({ stage: "closed_won" });
        const invoices = await base44.entities.Invoice.filter({ status: "paid" });
        const times = [];
        deals.forEach(d => {
          const inv = invoices.find(i => i.deal_id === d.id);
          if (inv && d.client_onboarded_date && inv.payment_date) {
            const days = Math.floor((new Date(inv.payment_date) - new Date(d.client_onboarded_date)) / (1000 * 60 * 60 * 24));
            if (days >= 0) times.push(days);
          }
        });
        const avg = times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length) : 0;
        return { type: "avgDays", data: { average: avg, samples: times.length } };
      }

      case 7: { // Clients approaching renewal
        const clients = await base44.entities.Client.list();
        const renewalRanges = { "30": [], "60": [], "90": [] };
        clients.forEach(c => {
          if (c.contract_end_date) {
            const daysUntilRenewal = Math.floor((new Date(c.contract_end_date) - now) / (1000 * 60 * 60 * 24));
            if (daysUntilRenewal > 0 && daysUntilRenewal <= 30) renewalRanges["30"].push(c);
            else if (daysUntilRenewal > 30 && daysUntilRenewal <= 60) renewalRanges["60"].push(c);
            else if (daysUntilRenewal > 60 && daysUntilRenewal <= 90) renewalRanges["90"].push(c);
          }
        });
        return { type: "renewals", data: renewalRanges };
      }

      case 8: { // Onboarding bottlenecks
        const steps = await base44.entities.OnboardingStep.list();
        const byPhase = {};
        steps.forEach(s => {
          const cat = s.category || "unknown";
          byPhase[cat] = (byPhase[cat] || []);
          if (s.completed_at && s.created_date) {
            const days = Math.floor((new Date(s.completed_at) - new Date(s.created_date)) / (1000 * 60 * 60 * 24));
            byPhase[cat].push(days);
          }
        });
        const bottlenecks = {};
        Object.entries(byPhase).forEach(([phase, times]) => {
          bottlenecks[phase] = times.length > 0 ? Math.round(times.reduce((a, b) => a + b) / times.length) : 0;
        });
        return { type: "bottlenecks", data: bottlenecks };
      }

      case 9: { // Deliverable approval lag
        const deliverables = await base44.entities.Deliverable.list();
        const lags = [];
        deliverables.forEach(d => {
          if (d.submitted_date && d.approved_date) {
            const days = Math.floor((new Date(d.approved_date) - new Date(d.submitted_date)) / (1000 * 60 * 60 * 24));
            lags.push({ title: d.title, client: d.client_name, days, status: d.status });
          }
        });
        const avgLag = lags.length > 0 ? Math.round(lags.reduce((s, d) => s + d.days, 0) / lags.length) : 0;
        return { type: "approvalLag", data: { average: avgLag, details: lags.slice(0, 20) } };
      }

      case 10: { // Lead captures by month
        const leads = await base44.entities.Lead.list();
        const byMonth = {};
        leads.forEach(l => {
          const date = new Date(l.created_date);
          const key = date.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
          byMonth[key] = (byMonth[key] || []);
          byMonth[key].push(l);
        });
        return { type: "leadsByMonth", data: byMonth };
      }

      case 11: { // Clients by month
        const clients = await base44.entities.Client.list();
        const byMonth = {};
        clients.forEach(c => {
          const date = new Date(c.created_date);
          const key = date.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
          byMonth[key] = (byMonth[key] || []);
          byMonth[key].push(c);
        });
        return { type: "clientsByMonth", data: byMonth };
      }

      case 12: { // Cancelled invoices
        const invs = await base44.entities.Invoice.filter({ status: "cancelled" }, "-cancelled_at", 200);
        return { type: "cancelled", data: invs };
      }

      default:
        return { type: "empty", data: [] };
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page-level back to the previous screen */}
        <BackButton to="/" />
        {/* In-page back: clear the current report selection if one is open */}
        {selected && (
          <button
            onClick={() => {
              setSelected(null);
              setReportData(null);
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to library</span>
          </button>
        )}

        <h1 className="text-3xl font-bold gradient-text mb-2">Report Library</h1>
        <p className="text-muted-foreground mb-8">Pre-built queries to answer common business questions</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Report Library */}
          <div className="glass rounded-xl p-4 h-fit">
            <h3 className="font-semibold mb-4">Reports</h3>
            <div className="space-y-2">
              {REPORTS.map(report => (
                <button
                  key={report.id}
                  onClick={() => handleSelectReport(report)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    selected?.id === report.id
                      ? "bg-primary/15 text-primary border-l-4 border-primary"
                      : "hover:bg-secondary/40 text-muted-foreground"
                  }`}
                >
                  {report.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main: Report Results */}
          <div className="lg:col-span-2 glass rounded-xl p-6">
            {!selected ? (
              <div className="text-center py-12">
                <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground">Select a report to view results</p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{selected.name}</h3>
                    <p className="text-sm text-muted-foreground">{selected.description}</p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : reportData ? (
                  <ReportRenderer report={selected} data={reportData} />
                ) : (
                  <p className="text-center text-muted-foreground py-8">No data for this report</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportRenderer({ report, data }) {
  const [expandedMonth, setExpandedMonth] = useState(null);

  if (data.type === "clients" && data.data.length > 0) {
    return (
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {data.data.map(client => (
          <div key={client.id} className="glass rounded-lg p-3 border border-border/30">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{client.business_name}</p>
                <p className="text-xs text-muted-foreground">{client.contact_person} · {client.phone}</p>
              </div>
              <Badge variant="outline" className="text-xs">{client.package || "none"}</Badge>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.type === "deals" && data.data.length > 0) {
    return (
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {data.data.map(deal => (
          <div key={deal.id} className="glass rounded-lg p-3 border border-border/30">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{deal.client_name}</p>
                <p className="text-xs text-muted-foreground">{deal.package} · {deal.stage?.replace(/_/g, " ")}</p>
              </div>
              <span className="text-sm font-bold">R{(deal.setup_fee || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.type === "failedDebits") {
    return (
      <div className="space-y-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
          <p className="text-sm text-destructive font-medium">{data.data.length} failed debits this quarter</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">By Staff Member:</p>
          {Object.entries(data.byStaff).map(([staff, count]) => (
            <div key={staff} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
              <span className="text-sm">{staff}</span>
              <span className="text-sm font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === "topStaff") {
    return (
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {data.data.map(([staff, metrics], idx) => (
          <div key={idx} className="glass rounded-lg p-3 border border-border/30">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{staff}</p>
                <p className="text-xs text-muted-foreground">{metrics.count} deals closed</p>
              </div>
              <span className="text-sm font-bold">R{metrics.revenue.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.type === "attachRate") {
    return (
      <div className="space-y-3">
        {Object.entries(data.data).map(([pkg, metrics]) => {
          const rate = metrics.total > 0 ? Math.round((metrics.withAddOn / metrics.total) * 100) : 0;
          return (
            <div key={pkg} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
              <span className="text-sm capitalize">{pkg}</span>
              <span className="text-sm font-bold">{rate}% ({metrics.withAddOn}/{metrics.total})</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (data.type === "avgDays") {
    return (
      <div className="space-y-4">
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
          <p className="text-lg font-bold text-primary">{data.data.average} days</p>
          <p className="text-xs text-muted-foreground">Average from deal won to setup paid ({data.data.samples} samples)</p>
        </div>
      </div>
    );
  }

  if (data.type === "renewals") {
    return (
      <div className="space-y-4">
        {["30", "60", "90"].map(range => (
          <div key={range}>
            <p className="text-sm font-semibold mb-2">{range} days ({data.data[range].length})</p>
            <div className="space-y-2">
              {data.data[range].slice(0, 5).map(c => (
                <div key={c.id} className="glass rounded-lg p-2 text-sm flex justify-between items-center">
                  <span>{c.business_name}</span>
                  <span className="text-xs text-muted-foreground">{new Date(c.contract_end_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (data.type === "bottlenecks") {
    return (
      <div className="space-y-3">
        {Object.entries(data.data).sort((a, b) => b[1] - a[1]).map(([phase, days]) => (
          <div key={phase} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
            <span className="text-sm capitalize">{phase}</span>
            <span className="text-sm font-bold">{days} days</span>
          </div>
        ))}
      </div>
    );
  }

  if (data.type === "approvalLag") {
    return (
      <div className="space-y-4">
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3">
          <p className="text-lg font-bold text-primary">{data.data.average} days</p>
          <p className="text-xs text-muted-foreground">Average approval lag</p>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {data.data.details.map((d, idx) => (
            <div key={idx} className="glass rounded-lg p-2 text-xs flex justify-between items-center">
              <div>
                <p className="font-semibold">{d.title}</p>
                <p className="text-muted-foreground">{d.client}</p>
              </div>
              <span>{d.days} days</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === "leadsByMonth" || data.type === "clientsByMonth") {
    const label = data.type === "leadsByMonth" ? "Lead" : "Client";
    return (
      <div className="space-y-3">
        {Object.entries(data.data).map(([month, items]) => (
          <div key={month} className="glass rounded-lg p-3 border border-border/30">
            <button
              onClick={() => setExpandedMonth(expandedMonth === month ? null : month)}
              className="w-full text-left flex justify-between items-center hover:opacity-80 transition-opacity"
            >
              <span className="font-semibold text-sm">{month}</span>
              <span className="text-xs text-muted-foreground">{items.length} {label}s</span>
            </button>
            {expandedMonth === month && (
              <div className="mt-3 space-y-2 border-t border-border/30 pt-2">
                {items.map(item => (
                  <div key={item.id} className="text-xs py-1 pl-2 border-l border-primary/30">
                    <p className="font-medium">{item.business_name}</p>
                    <p className="text-muted-foreground">{item.contact_person}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (data.type === "cancelled") {
    const total = data.data.reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
          <span className="text-sm text-destructive font-medium">{data.data.length} cancelled</span>
          <span className="text-sm font-bold text-destructive">R{total.toLocaleString()}</span>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {data.data.map(inv => (
            <div key={inv.id} className="glass rounded-lg p-3 border border-border/30 space-y-1">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-sm">{inv.client_name}</p>
                <span className="text-sm font-bold">R{(inv.total_amount || inv.amount || 0).toLocaleString()}</span>
              </div>
              {inv.cancellation_reason && <p className="text-xs text-muted-foreground italic">"{inv.cancellation_reason}"</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <p className="text-center text-muted-foreground py-8">No data</p>;
}