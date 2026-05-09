import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, XCircle } from "lucide-react";

const REPORTS = [
  { id: 1, name: "Clients with no contact in 30 days", description: "Inactive accounts needing outreach" },
  { id: 2, name: "Deals expected to close this month", description: "Pipeline forecast" },
  { id: 3, name: "Failed debit orders this quarter", description: "Payment issues to follow up" },
  { id: 4, name: "Top performing Field Agents this month", description: "By deals closed + revenue" },
  { id: 5, name: "Add-on attach rate by package", description: "% of clients with add-ons" },
  { id: 6, name: "Average days from deal_won to setup_paid", description: "Payment speed" },
  { id: 7, name: "Clients approaching renewal (30/60/90 days)", description: "Upcoming renewal notices needed" },
  { id: 8, name: "Onboarding bottlenecks (longest in each phase)", description: "Identify slow phases" },
  { id: 9, name: "Deliverable approval lag", description: "Avg days from delivery to approval" },
  { id: 10, name: "Most-used playbooks and KPI hit rate", description: "Content effectiveness" },
  { id: 11, name: "Cancelled Invoices", description: "All cancelled invoices with reasons, assigned CPC, field agent and owner attribution", icon: "cancel" },
];

export default function OwnerReports() {
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [cancelledInvoices, setCancelledInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSelectReport = async (report) => {
    setSelected(report);
    setLoading(true);
    if (report.id === 11) {
      // Real data: fetch cancelled invoices
      const invs = await base44.entities.Invoice.filter({ status: "cancelled" }, "-cancelled_at", 200);
      setCancelledInvoices(invs);
      setLoading(false);
      return;
    }
    // Simulate data fetch — actual implementation would query entities
    setTimeout(() => {
      setResults([
        { id: 1, name: "Sample Result 1", value: "Data would appear here" },
        { id: 2, name: "Sample Result 2", value: "Based on entity queries" },
      ]);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold gradient-text mb-2">Reports</h1>
        <p className="text-muted-foreground mb-8">Pre-built queries to answer common business questions</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Report Library */}
          <div className="glass rounded-xl p-4 h-fit">
            <h3 className="font-semibold mb-4">Report Library</h3>
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
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{selected.name}</h3>
                  <p className="text-sm text-muted-foreground">{selected.description}</p>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : selected?.id === 11 ? (
                  <CancelledInvoicesReport invoices={cancelledInvoices} />
                ) : results.length > 0 ? (
                  <>
                    <div className="space-y-3 mb-6">
                      {results.map(row => (
                        <div key={row.id} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                          <span className="font-semibold text-sm">{row.name}</span>
                          <span className="text-sm text-muted-foreground">{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="text-xs">
                      Export CSV
                    </Button>
                  </>
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

function CancelledInvoicesReport({ invoices }) {
  const total = invoices.reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);

  if (invoices.length === 0) {
    return (
      <div className="text-center py-10">
        <XCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">No cancelled invoices found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
        <span className="text-sm text-destructive font-medium">{invoices.length} cancelled invoice{invoices.length !== 1 ? "s" : ""}</span>
        <span className="text-sm font-bold text-destructive">Total: R{total.toLocaleString()}</span>
      </div>

      {/* Invoice rows */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {invoices.map(inv => (
          <div key={inv.id} className="glass rounded-lg p-3 border border-border/30 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm text-foreground">{inv.client_name || "Unknown"}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {inv.invoice_number ? `${inv.invoice_number} · ` : ""}
                  {inv.invoice_type?.replace(/_/g, " ")}
                  {inv.cancelled_at ? ` · Cancelled ${new Date(inv.cancelled_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </p>
              </div>
              <span className="text-sm font-bold text-foreground shrink-0">R{(inv.total_amount || inv.amount || 0).toLocaleString()}</span>
            </div>

            {/* Attribution */}
            <div className="flex flex-wrap gap-2 text-[11px]">
              {inv.cancelled_by_name && (
                <span className="px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground">
                  Cancelled by: <strong>{inv.cancelled_by_name}</strong>
                </span>
              )}
              {inv.assigned_cpc_name && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  CPC: <strong>{inv.assigned_cpc_name}</strong>
                </span>
              )}
              {inv.assigned_field_agent_name && (
                <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                  Field Agent: <strong>{inv.assigned_field_agent_name}</strong>
                </span>
              )}
            </div>

            {/* Cancellation reason */}
            {inv.cancellation_reason && (
              <div className="bg-secondary/40 rounded px-2 py-1.5 text-xs text-muted-foreground italic">
                "{inv.cancellation_reason}"
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}