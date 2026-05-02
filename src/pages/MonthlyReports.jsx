import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Download, Send, RefreshCw, Eye } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";

const STATUS_COLORS = {
  draft: "bg-warning/15 text-warning border-warning/30",
  reviewed: "bg-primary/15 text-primary border-primary/30",
  sent: "bg-success/15 text-success border-success/30"
};

export default function MonthlyReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const reps = await base44.entities.MonthlyReport.list("-created_date", 200);
      setReports(reps);
      setLoading(false);
    } catch (err) {
      toast({ title: "Error loading reports", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const filtered = reports.filter(r => {
    const matchSearch = !search || r.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchMonth = monthFilter === "all" || r.report_month === monthFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchMonth && matchStatus;
  });

  const sendReport = async (report) => {
    setSending(true);
    try {
      // Fetch client
      const clients = await base44.entities.Client.filter({ id: report.client_id });
      const client = Array.isArray(clients) ? clients[0] : clients;

      if (!client || !client.email) {
        toast({ title: "Client email not found", variant: "destructive" });
        setSending(false);
        return;
      }

      const monthName = new Date(report.report_month + "-01").toLocaleString("default", { month: "long", year: "numeric" });

      // Send email
      await base44.integrations.Core.SendEmail({
        to: client.email,
        subject: `Your Marketing iO Report for ${monthName} is Ready`,
        body: `Hi ${client.contact_person?.split(" ")[0] || "there"},

Your monthly performance report for ${monthName} is ready! This month we made excellent progress on your marketing initiatives.

📊 Key Highlights:
• Delivered all scheduled content on time
• Maintained consistent platform engagement
• Continued building your brand visibility

Your full detailed report is attached. Please review it and let us know if you have any questions.

Best regards,
Marketing iO Team`,
        from_name: "Marketing iO"
      });

      // Update report status
      await base44.entities.MonthlyReport.update(report.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        delivered_date: new Date().toISOString().split("T")[0]
      });

      // Log activity
      await base44.entities.ClientActivityLog.create({
        client_id: report.client_id,
        client_name: report.client_name,
        event_type: "communication_sent",
        event_label: `Monthly report sent for ${monthName}`,
        logged_by: "system",
        logged_by_name: "Admin"
      });

      loadReports();
      setSelected(null);
      toast({ title: "Report sent", description: `Email sent to ${client.email}` });
    } catch (err) {
      toast({ title: "Error sending report", description: err.message, variant: "destructive" });
    }
    setSending(false);
  };

  const months = Array.from(new Set(reports.map(r => r.report_month))).sort().reverse();

  return (
    <AppLayout title="Monthly Reports" subtitle={`${reports.filter(r => r.status === "draft").length} drafts pending`}>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-40 bg-secondary/50 border-border/50">
            <SelectValue placeholder="All months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-secondary/50 border-border/50">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Download className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No reports found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} onClick={() => setSelected(r)} className="glass rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all">
              <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{r.client_name?.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{r.client_name}</p>
                <p className="text-xs text-muted-foreground">{r.report_month} • {new Date(r.created_date).toLocaleDateString()}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <Badge className={`border text-xs ${STATUS_COLORS[r.status] || "bg-muted/40"} capitalize`}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="bg-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle className="gradient-text">{selected.client_name} — {selected.report_month}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge className={`border capitalize ${STATUS_COLORS[selected.status] || "bg-muted/40"}`}>{selected.status}</Badge>
              </div>

              {selected.due_date && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                  <p className="text-sm text-foreground">{new Date(selected.due_date).toLocaleDateString()}</p>
                </div>
              )}

              {selected.report_type && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Report Type</p>
                  <p className="text-sm text-foreground capitalize">{selected.report_type.replace(/_/g, " ")}</p>
                </div>
              )}

              {selected.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{selected.notes}</p>
                </div>
              )}

              {selected.submitted_at && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Generated</p>
                  <p className="text-sm text-foreground">{new Date(selected.submitted_at).toLocaleString()}</p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6 flex-wrap">
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              {selected.status === "draft" && (
                <>
                  <Button onClick={() => sendReport(selected)} disabled={sending} className="gap-1 gradient-bg text-white hover:opacity-90">
                    <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send"}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}