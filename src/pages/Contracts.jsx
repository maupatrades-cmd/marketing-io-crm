import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Download, Send, CheckCircle, FileText, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, parseISO } from "date-fns";

const STATUS_COLORS = {
  draft: "bg-muted/40 text-muted-foreground border-border/40",
  sent: "bg-primary/15 text-primary border-primary/30",
  signed: "bg-success/15 text-success border-success/30",
  active: "bg-[#00CCFF]/15 text-[#00CCFF] border-[#00CCFF]/30",
  terminated: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_ICONS = {
  draft: Clock,
  sent: Send,
  signed: CheckCircle,
  active: CheckCircle,
  terminated: FileText,
};

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [clients, setClients] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContract, setSelectedContract] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const load = () => Promise.all([
    base44.entities.Contract.list("-created_date", 100),
    base44.entities.Client.list(),
    base44.entities.Deal.list(),
  ]).then(([c, cl, d]) => {
    setContracts(c);
    setClients(cl);
    setDeals(d);
    setLoading(false);
  });

  useEffect(() => {
    load();
  }, []);

  const filtered = contracts.filter(c => {
    const client = clients.find(cl => cl.id === c.client_id);
    const matchSearch = !search || 
      c.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      client?.business_name?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const handleMarkSigned = async (contract) => {
    setUpdating(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await base44.entities.Contract.update(contract.id, {
        status: "signed",
        signed_date: today,
        signed_by_client: true,
      });
      toast({ title: "Contract marked as signed", description: "Status updated successfully." });
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
      await base44.entities.Contract.update(contract.id, {
        status: "sent",
      });
      toast({ title: "Contract sent", description: "Email sent to client with download link." });
      setShowDetail(false);
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
            const client = clients.find(cl => cl.id === c.client_id);
            const deal = deals.find(d => d.id === c.deal_id);
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
                  <p className="font-semibold text-foreground truncate">{client?.business_name || c.client_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {deal?.package || c.package} · {c.id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`border text-xs capitalize ${STATUS_COLORS[c.status] || "bg-muted/40 border-border/40"}`}>
                    {c.status}
                  </Badge>
                  {c.document_url && (
                    <a href={c.document_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                      <Download className="w-4 h-4" />
                    </a>
                  )}
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
              <div className="flex gap-2 pt-4">
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
                  <Button 
                    onClick={() => handleMarkSigned(selectedContract)} 
                    disabled={updating}
                    className="gradient-bg text-white hover:opacity-90"
                  >
                    Mark as Signed
                  </Button>
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