import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export default function ClientContracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // LB-281 fix on the client read side. Direct Contract.filter() from the
    // anonymous browser session silently returned [] because mio_session_token
    // isn't a valid Base44 JWT for RLS template evaluation. The new function
    // validates the session via auth-me and reads via asServiceRole.
    base44.functions
      .invoke("list-client-contracts", { token: localStorage.getItem("mio_session_token") })
      .then((res) => {
        const data = res?.data ?? res;
        setContracts(Array.isArray(data?.contracts) ? data.contracts : []);
      })
      .catch((err) => {
        console.error("[ClientContracts]", err);
        setContracts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const statusBg = (s) => {
    if (s === "signed" || s === "active") return "bg-success/15 text-success";
    if (s === "sent") return "bg-warning/15 text-warning";
    return "bg-muted/40 text-muted-foreground";
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Your Contracts</h1>

        <div className="space-y-3">
          {contracts.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground">No contracts</p></div>
          ) : (
            contracts.map(c => {
              // Prefer the signed PDF; fall back to the draft document if
              // the contract hasn't been signed yet.
              const downloadUrl = c.final_signed_pdf_url || c.document_url || null;
              return (
                <div key={c.id} className="glass rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{c.package} Contract</p>
                    <p className="text-xs text-muted-foreground">Signed {c.signed_date ? new Date(c.signed_date).toLocaleDateString("en-ZA") : "Pending"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusBg(c.status)}>{c.status}</Badge>
                    {downloadUrl && (
                      <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Download className="w-4 h-4" /></Button>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}