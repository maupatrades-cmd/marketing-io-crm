import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";

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
];

export default function OwnerReports() {
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSelectReport = async (report) => {
    setSelected(report);
    setLoading(true);
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