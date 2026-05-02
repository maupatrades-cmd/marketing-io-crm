import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";

export default function ClientDeliverables() {
  const [deliverables, setDeliverables] = useState([]);
  const [client, setClient] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const dels = await base44.entities.Deliverable.filter({ client_id: c.id }, "-created_date", 100);
        setDeliverables(dels);
      }
      setLoading(false);
    });
  }, []);

  const filtered = deliverables.filter(d => filter === "all" || (filter === "review" ? ["pending_client_review", "client_reviewing"].includes(d.approval_status) : d.status === filter));
  const forReview = deliverables.filter(d => ["pending_client_review", "client_reviewing"].includes(d.approval_status));

  const handleApprove = async (id) => {
    await base44.entities.Deliverable.update(id, { approval_status: "approved", approval_date: new Date().toISOString() });
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, approval_status: "approved" } : d));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Deliverables</h1>
        {forReview.length > 0 && <p className="text-warning font-semibold mb-6">{forReview.length} awaiting your review</p>}

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {["all", "in_progress", "review", "approved"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${filter === f ? "gradient-bg text-white" : "bg-secondary text-muted-foreground"}`}>
              {f === "review" ? "For Review" : f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground">No deliverables</p></div>
          ) : (
            filtered.map(d => (
              <div key={d.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-foreground">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.product} • {new Date(d.created_date).toLocaleDateString("en-ZA")}</p>
                  </div>
                  <Badge className={["pending_client_review", "client_reviewing"].includes(d.approval_status) ? "bg-warning/15 text-warning" : d.approval_status === "approved" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}>
                    {d.approval_status?.replace(/_/g, " ")}
                  </Badge>
                </div>
                {["pending_client_review", "client_reviewing"].includes(d.approval_status) && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(d.id)} className="gradient-bg text-white text-xs">Approve</Button>
                    <Button size="sm" variant="outline" className="text-xs">Request Changes</Button>
                  </div>
                )}
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