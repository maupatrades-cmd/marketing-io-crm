import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, BarChart2 } from "lucide-react";

export default function ClientReports() {
  const [reports, setReports] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = Array.isArray(clients) ? clients[0] : clients;
        setClient(c);
        const reps = await base44.entities.MonthlyReport.filter({ client_id: c.id }, "-month_year", 50);
        setReports(Array.isArray(reps) ? reps : [reps]);
      }
      setLoading(false);
    });
  }, []);

  const handleDownload = (pdfUrl) => {
    if (pdfUrl) {
      const link = document.createElement("a");
      link.href = pdfUrl;
      link.download = `report-${Date.now()}.pdf`;
      link.click();
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Your Reports</h1>
        <p className="text-muted-foreground mb-6">Monthly performance summaries & insights</p>

        {reports.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">Your first monthly report will be ready at the end of your first full month.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(r => {
              const highlights = r.report_highlights ? JSON.parse(r.report_highlights) : [];
              return (
                <div key={r.id} className="glass rounded-xl p-6 border border-white/10 hover:border-primary/30 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold text-lg text-foreground capitalize">
                        {r.report_type?.replace(/_/g, " ")} — {r.month_year}
                      </p>
                      <p className="text-xs text-muted-foreground">Generated {new Date(r.created_date).toLocaleDateString("en-ZA")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-success/15 text-success text-xs">{r.status || "Ready"}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(r.report_pdf_url)} className="h-8 w-8 p-0" title="Download PDF">
                        <Download className="w-4 h-4" />
                      </Button>
                      {r.report_pdf_url && (
                        <Button size="sm" variant="ghost" asChild className="h-8 w-8 p-0" title="Open PDF">
                          <a href={r.report_pdf_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Key Highlights */}
                  {highlights && highlights.length > 0 && (
                    <div className="space-y-2 mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-xs font-semibold text-primary mb-2">Key Highlights</p>
                      {highlights.map((h, idx) => (
                        <div key={idx} className="text-sm text-foreground">
                          • {h}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {r.report_summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{r.report_summary}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}