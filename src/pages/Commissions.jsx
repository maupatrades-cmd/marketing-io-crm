import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, DollarSign, CheckCircle2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/lib/AuthContext";

const STATUS_COLORS = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-primary/15 text-primary border-primary/30",
  paid: "bg-success/15 text-success border-success/30",
  withheld: "bg-muted/40 text-muted-foreground border-border/40",
  clawback: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function Commissions() {
  const { user } = useAuth();
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [updating, setUpdating] = useState(null);

  const load = () => base44.entities.Commission.list("-created_date", 300).then(d => { setCommissions(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const filtered = commissions.filter(c => {
    // Staff can only see their own commissions
    if (user?.role === "field_agent" || user?.role === "cpc" || user?.role === "driver" || user?.role === "head_of_tech") {
      if (c.staff_id !== user.id) return false;
    }
    const matchSearch = !search || c.staff_name?.toLowerCase().includes(search.toLowerCase()) || c.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchType = typeFilter === "all" || c.commission_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const updateStatus = async (id, status) => {
    setUpdating(id);
    await base44.entities.Commission.update(id, { status, ...(status === "paid" ? { paid_date: new Date().toISOString().split("T")[0] } : {}) });
    setUpdating(null);
    load();
  };

  const totalPending = commissions.filter(c => c.status === "pending").reduce((s, c) => s + (c.commission_amount || 0), 0);
  const totalApproved = commissions.filter(c => c.status === "approved").reduce((s, c) => s + (c.commission_amount || 0), 0);
  const totalPaid = commissions.filter(c => c.status === "paid").reduce((s, c) => s + (c.commission_amount || 0), 0);

  const types = [...new Set(commissions.map(c => c.commission_type).filter(Boolean))];

  return (
    <AppLayout title="Commissions" subtitle="Staff earnings tracker">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SumCard label="Pending" value={totalPending} color="text-warning" />
        <SumCard label="Approved" value={totalApproved} color="text-primary" />
        <SumCard label="Paid (All Time)" value={totalPaid} color="text-success" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by staff or client…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 bg-secondary/50 border-border/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_COLORS).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 bg-secondary/50 border-border/50"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map(t => <SelectItem key={t} value={t} className="capitalize">{t?.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No commissions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="glass rounded-xl p-4 flex items-center gap-4 hover:shadow-card-hover transition-all">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{c.staff_name || "Unknown Staff"}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {c.commission_type?.replace(/_/g, " ")} · {c.client_name} {c.payroll_month ? `· ${c.payroll_month}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-base font-bold text-foreground">R{(c.commission_amount || 0).toLocaleString()}</span>
                <Badge className={`border text-xs capitalize ${STATUS_COLORS[c.status] || ""}`}>{c.status}</Badge>
                {c.status === "pending" && (
                  <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 text-xs h-7"
                    disabled={updating === c.id} onClick={() => updateStatus(c.id, "approved")}>
                    Approve
                  </Button>
                )}
                {c.status === "approved" && (
                  <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10 text-xs h-7"
                    disabled={updating === c.id} onClick={() => updateStatus(c.id, "paid")}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function SumCard({ label, value, color }) {
  return (
    <div className="glass rounded-xl p-4 text-center">
      <p className={`text-xl font-bold ${color}`}>R{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}