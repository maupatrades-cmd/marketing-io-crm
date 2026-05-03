import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentUser } from "@/lib/customAuth";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, Package, ArrowRight } from "lucide-react";

const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  awaiting_client: "Awaiting Review",
  client_reviewing: "Under Review",
  approved: "Approved",
  deemed_approved: "Approved",
  completed: "Completed",
};

const STATUS_COLORS = {
  not_started: "bg-muted/40 text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  awaiting_client: "bg-warning/15 text-warning",
  client_reviewing: "bg-[#00CCFF]/15 text-[#00CCFF]",
  approved: "bg-success/15 text-success",
  deemed_approved: "bg-success/15 text-success",
  completed: "bg-success/15 text-success",
};

export default function ClientProjectStatus() {
  const [client, setClient] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const me = await getCurrentUser();
      if (!me) {
        setLoading(false);
        window.location.href = "/login";
        return;
      }

      const clients = await base44.entities.Client.filter({ email: me.email });
      const c = Array.isArray(clients) ? clients[0] : clients;

      if (c) {
        setClient(c);
        const dels = await base44.entities.Deliverable.filter({ client_id: c.id }, "-created_date", 100);
        // Only show approved deliverables
        const approved = (Array.isArray(dels) ? dels : []).filter(d =>
          ["approved", "deemed_approved", "completed"].includes(d.status)
        );
        setDeliverables(approved);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Group deliverables by product/service
  const grouped = {};
  deliverables.forEach(d => {
    const service = d.product || "General Service";
    if (!grouped[service]) grouped[service] = [];
    grouped[service].push(d);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">No Account Found</h2>
          <p className="text-sm text-muted-foreground">Contact support for access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Project Status</h1>
          <p className="text-muted-foreground">Approved deliverables and active services</p>
        </div>

        {/* Client Overview Card */}
        <div className="glass rounded-2xl p-6 mb-8 gradient-bg-subtle">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Business</p>
              <h2 className="text-2xl font-bold text-foreground mb-3">{client.business_name}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-primary/15 text-primary border border-primary/30 capitalize">
                  {client.status?.replace(/_/g, " ") || "Active"}
                </Badge>
                {client.go_live_date && (
                  <span className="text-xs text-muted-foreground">
                    Live since {new Date(client.go_live_date).toLocaleDateString("en-ZA")}
                  </span>
                )}
              </div>
            </div>
            {deliverables.length > 0 && (
              <div className="glass rounded-xl p-4 text-center shrink-0 bg-success/10 border border-success/20">
                <div className="text-2xl font-bold text-success">{deliverables.length}</div>
                <div className="text-xs text-muted-foreground">Approved Deliverables</div>
              </div>
            )}
          </div>
        </div>

        {/* Empty State */}
        {deliverables.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground">No approved deliverables yet</p>
            <p className="text-xs text-muted-foreground mt-2">Check back soon as we complete your services</p>
          </div>
        ) : (
          /* Services grouped by product */
          <div className="space-y-6">
            {Object.entries(grouped).map(([service, items]) => (
              <div key={service} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">{service}</h3>
                  <Badge className="bg-muted/40 text-muted-foreground text-xs ml-auto">
                    {items.length} item{items.length > 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Deliverables for this service */}
                <div className="space-y-2">
                  {items.map(d => (
                    <div key={d.id} className="glass rounded-xl p-4 hover:border-primary/40 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{d.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(d.created_date).toLocaleDateString("en-ZA")}
                          </p>
                        </div>
                        <Badge className={`border text-xs shrink-0 ${STATUS_COLORS[d.status] || STATUS_COLORS.completed}`}>
                          {STATUS_LABELS[d.status] || "Complete"}
                        </Badge>
                      </div>

                      {/* Preview */}
                      {(d.preview_image || d.preview_url) && (
                        <div className="mt-3">
                          {d.preview_image && (
                            <img src={d.preview_image} alt={d.title} className="rounded-lg max-h-48 object-cover w-full" />
                          )}
                          {d.preview_url && !d.preview_image && (
                            <a
                              href={d.preview_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                            >
                              View Deliverable <ArrowRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* File downloads if available */}
                      {d.file_urls && Array.isArray(d.file_urls) && d.file_urls.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/40">
                          <p className="text-xs text-muted-foreground mb-2">Files:</p>
                          <div className="space-y-1">
                            {d.file_urls.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-primary hover:underline"
                              >
                                <Package className="w-3 h-3" />
                                Download File {idx + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 glass rounded-xl p-4 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Questions about your deliverables? Contact{" "}
            <a href="mailto:info@marketingio.co.za" className="text-primary hover:underline">
              info@marketingio.co.za
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}