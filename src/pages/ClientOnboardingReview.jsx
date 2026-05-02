import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS = {
  not_started: "bg-muted/40 text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  submitted: "bg-success/15 text-success",
  reviewed: "bg-secondary/40 text-secondary-foreground",
};

export default function ClientOnboardingReview() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [marking, setMarking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      const subs = await base44.entities.ClientOnboardingSubmission.list("-submitted_at", 100);
      setSubmissions(subs);
      setLoading(false);
    } catch (err) {
      toast({ title: "Error loading submissions", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const filtered = submissions.filter(s => {
    const client = s.client_name || "";
    return !search || client.toLowerCase().includes(search.toLowerCase());
  });

  const markAsReviewed = async (submission) => {
    setMarking(true);
    try {
      await base44.entities.ClientOnboardingSubmission.update(submission.id, {
        submission_status: "reviewed",
        reviewed_at: new Date().toISOString(),
      });
      loadSubmissions();
      setSelected(null);
      toast({ title: "Marked as reviewed", description: `${submission.client_name}'s form has been marked as reviewed` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setMarking(false);
  };

  return (
    <AppLayout title="Onboarding Forms" subtitle="Client submissions">
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No submissions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} onClick={() => setSelected(s)} className="glass rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all">
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{s.client_name}</p>
                <p className="text-xs text-muted-foreground">{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "Not submitted yet"}</p>
              </div>
              <Badge className={`text-xs border ${STATUS_COLORS[s.submission_status]} capitalize`}>{s.submission_status.replace(/_/g, " ")}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-card border-border/50 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="gradient-text">{selected.client_name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Business Section */}
              <div>
                <h3 className="font-bold text-foreground mb-3">Business Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoField label="Legal Name" value={selected.business_legal_name} />
                  <InfoField label="Trading Name" value={selected.trading_name} />
                  <InfoField label="CIPC Number" value={selected.cipc_registration_number} />
                  <InfoField label="VAT Number" value={selected.vat_number} />
                  <InfoField label="Employees" value={selected.number_of_employees} />
                  <InfoField label="Year Started" value={selected.year_business_started} />
                </div>
              </div>

              {/* Contact Section */}
              <div>
                <h3 className="font-bold text-foreground mb-3">Primary Contact</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <InfoField label="Name" value={selected.primary_contact_name} />
                  <InfoField label="Role" value={selected.primary_contact_role} />
                  <InfoField label="Phone" value={selected.primary_contact_phone} />
                  <InfoField label="Email" value={selected.primary_contact_email} />
                  <InfoField label="WhatsApp" value={selected.primary_contact_whatsapp} />
                </div>
              </div>

              {/* Brand Section */}
              {selected.brand_colours_primary && (
                <div>
                  <h3 className="font-bold text-foreground mb-3">Brand</h3>
                  <div className="space-y-2 text-sm">
                    <InfoField label="Primary Colour" value={selected.brand_colours_primary} />
                    <InfoField label="Secondary Colour" value={selected.brand_colours_secondary} />
                    <InfoField label="Voice Tone" value={selected.brand_voice_tone} />
                  </div>
                </div>
              )}

              {/* Description Section */}
              {selected.business_description && (
                <div>
                  <h3 className="font-bold text-foreground mb-3">Details</h3>
                  <p className="text-sm text-muted-foreground mb-2">{selected.business_description}</p>
                </div>
              )}

              {/* Submission Status */}
              <div className="border-t border-border/30 pt-4">
                <p className="text-xs text-muted-foreground mb-2">Status: <Badge className={`text-xs border ${STATUS_COLORS[selected.submission_status]} capitalize`}>{selected.submission_status.replace(/_/g, " ")}</Badge></p>
                {selected.submitted_at && <p className="text-xs text-muted-foreground">Submitted: {new Date(selected.submitted_at).toLocaleString()}</p>}
                {selected.reviewed_at && <p className="text-xs text-muted-foreground">Reviewed: {new Date(selected.reviewed_at).toLocaleString()}</p>}
              </div>
            </div>

            {/* Actions */}
            {selected.submission_status === "submitted" && (
              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                <Button onClick={() => markAsReviewed(selected)} disabled={marking} className="gradient-bg text-white hover:opacity-90">
                  {marking ? "Marking..." : "Mark as Reviewed"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}