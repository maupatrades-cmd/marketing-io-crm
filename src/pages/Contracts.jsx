import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Download, Send, CheckCircle, FileText, Clock, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";

const STATUS_COLORS = {
  draft: "bg-muted/40 text-muted-foreground border-border/40",
  sent: "bg-primary/15 text-primary border-primary/30",
  signed: "bg-success/15 text-success border-success/30",
  active: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

const SIGNING_STATUS_COLORS = {
  not_sent: "bg-slate-100 text-slate-800",
  sent: "bg-blue-100 text-blue-800",
  viewed: "bg-amber-100 text-amber-800",
  partially_signed: "bg-orange-100 text-orange-800",
  fully_signed: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800"
};

const STATUS_ICONS = {
  draft: Clock,
  sent: Send,
  signed: CheckCircle,
  active: CheckCircle,
  terminated: FileText,
};

export default function Contracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  // Data loads via list-contracts (LB-281 pattern). The function returns
  // contracts enriched with Client.business_name / contact_person / phone,
  // so the page no longer needs separate clients/deals state arrays —
  // c.client_name and c.package come straight off each enriched row.
  const load = () =>
    base44.functions
      .invoke("list-contracts", { token: localStorage.getItem("mio_session_token") })
      .then((res) => {
        const data = res?.data ?? res;
        setContracts(Array.isArray(data?.contracts) ? data.contracts : []);
      })
      .catch((err) => {
        console.error("[Contracts] list-contracts failed:", err);
        setContracts([]);
        toast({
          title: "Could not load contracts",
          description: err?.message || "Please refresh.",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const filtered = contracts.filter((c) => {
    if (!search) return true;
    return c.client_name?.toLowerCase().includes(search.toLowerCase());
  });

  const handleMarkSigned = async (contract) => {
    setUpdating(true);
    try {
      const res = await base44.functions.invoke("contract-mark-signed", {
        token: localStorage.getItem("mio_session_token"),
        contract_id: contract.id,
      });
      const data = res?.data ?? res;
      if (!data?.success) throw new Error(data?.error || "mark_signed_failed");
      toast({
        title: data.skipped ? "Already signed" : "Contract marked as signed",
        description: data.skipped ? "No change applied." : "Status updated.",
      });
      setShowDetail(false);
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setUpdating(false);
  };

  const handleSendForSignature = async (contract) => {
    setUpdating(true);
    try {
      const res = await base44.functions.invoke("contract-send-for-signature-wrapped", {
        token: localStorage.getItem("mio_session_token"),
        contract_id: contract.id,
      });
      const data = res?.data ?? res;
      if (data?.success && data?.skipped) {
        toast({
          title: "Skipped",
          description:
            data.reason === "no_client_email"
              ? "Client has no email on file — fix the Client record first."
              : "Already sent within the last 24h.",
        });
      } else if (data?.success) {
        toast({
          title: "Contract sent",
          description: `Signing email dispatched to ${data.email_sent_to}.`,
        });
      } else {
        throw new Error(data?.detail || data?.error || "send_failed");
      }
      setShowDetail(false);
      load();
    } catch (err) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    }
    setUpdating(false);
  };

  return (
    <AppLayout title="Contracts" subtitle={`${contracts.length} total`}>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by client…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No contracts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const StatusIcon = STATUS_ICONS[c.status] || FileText;
            return (
              <div
                key={c.id}
                className="glass rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-all cursor-pointer"
                onClick={() => {
                  setSelectedContract(c);
                  setShowDetail(true);
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.client_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {c.package} · {c.id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                   <Badge className={`border text-xs capitalize ${STATUS_COLORS[c.status] || "bg-muted/40 border-border/40"}`}>
                     {c.status}
                   </Badge>
                   {c.signing_status && c.signing_status !== "not_sent" && (
                     <Badge className={`border text-xs capitalize ${SIGNING_STATUS_COLORS[c.signing_status] || "bg-muted/40"}`}>
                       {c.signing_status}
                     </Badge>
                   )}
                   {c.document_url && (
                     <a href={c.document_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                       <Download className="w-4 h-4" />
                     </a>
                   )}
                   <Button
                     variant="ghost"
                     size="icon"
                     onClick={(e) => {
                       e.stopPropagation();
                       navigate(`/contracts/${c.id}`);
                     }}
                     className="text-muted-foreground hover:text-foreground h-6 w-6"
                   >
                     <Eye className="w-4 h-4" />
                   </Button>
                 </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="gradient-text">Contract Details</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Contract ID</Label>
                <p className="text-sm text-foreground font-mono">{selectedContract.id}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Client</Label>
                <p className="text-sm text-foreground">{selectedContract.client_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Badge className={`border text-xs capitalize w-fit ${STATUS_COLORS[selectedContract.status]}`}>
                  {selectedContract.status}
                </Badge>
              </div>
              {selectedContract.signed_date && (
                <div>
                  <Label className="text-xs text-muted-foreground">Signed Date</Label>
                  <p className="text-sm text-foreground">{format(parseISO(selectedContract.signed_date), "dd MMMM yyyy")}</p>
                </div>
              )}
              {selectedContract.document_url && (
                <div>
                  <Label className="text-xs text-muted-foreground">Contract PDF</Label>
                  <a href={selectedContract.document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
                    View PDF →
                  </a>
                </div>
              )}
              {selectedContract.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm text-foreground">{selectedContract.notes}</p>
                </div>
              )}
              {/* Signing link preview */}
              {selectedContract.signing_token && (
                <div>
                  <Label className="text-xs text-muted-foreground">Signing Link</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted/30 rounded px-2 py-1 flex-1 truncate">
                      {`${window.location.origin}/sign-contract?token=${selectedContract.signing_token}`}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/sign-contract?token=${selectedContract.signing_token}`);
                      toast({ title: "Link copied!" });
                    }}>Copy</Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-4 flex-wrap">
                {selectedContract.status === "draft" && (
                  <Button 
                    onClick={() => handleSendForSignature(selectedContract)} 
                    disabled={updating}
                    className="gradient-bg text-white hover:opacity-90"
                  >
                    Send for Signature
                  </Button>
                )}
                {selectedContract.status === "sent" && (
                  <>
                    <Button 
                      onClick={() => handleSendForSignature(selectedContract)} 
                      disabled={updating}
                      variant="outline"
                    >
                      Resend Signature Email
                    </Button>
                    <Button 
                      onClick={() => handleMarkSigned(selectedContract)} 
                      disabled={updating}
                      className="gradient-bg text-white hover:opacity-90"
                    >
                      Mark as Signed
                    </Button>
                  </>
                )}
                <Button variant="ghost" onClick={() => setShowDetail(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}