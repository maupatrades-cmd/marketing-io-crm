import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, BarChart2 } from "lucide-react";

export default function ClientReports() {
  const [reports, setReports] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const reps = await base44.entities.MonthlyReport.filter({ client_id: c.id }, "-created_date", 50);
        setReports(reps);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Your Reports</h1>
        <p className="text-muted-foreground mb-6">Monthly performance summaries</p>

        <div className="space-y-3">
          {reports.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground">No reports yet</p></div>
          ) : (
            reports.map(r => (
              <div key={r.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-foreground capitalize">{r.report_type?.replace(/_/g, " ")} — {r.report_month}</p>
                  <p className="text-xs text-muted-foreground">Generated {new Date(r.created_date).toLocaleDateString("en-ZA")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-success/15 text-success text-xs">{r.status}</Badge>
                  {r.report_url && (
                    <a href={r.report_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}