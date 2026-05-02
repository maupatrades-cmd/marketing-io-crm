import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, Users, DollarSign, CheckCircle2, Minus } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { calcPackage } from "@/lib/compensationPackages";

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    options.push({ val, label });
  }
  return options;
}

function groupByStaff(commissions, users) {
  const map = {};
  users.forEach(u => {
    if (!calcPackage(u.role)) return;
    map[u.id] = {
      staff_id: u.id,
      staff_name: u.full_name || u.email,
      staff_role: u.role,
      items: [],
      commission_total: 0,
      salary_pkg: calcPackage(u.role),
    };
  });
  commissions.forEach(c => {
    const key = c.staff_id || c.staff_name || "unknown";
    if (!map[key]) {
      map[key] = {
        staff_id: c.staff_id,
        staff_name: c.staff_name || "Unknown",
        staff_role: c.staff_role || "—",
        items: [],
        commission_total: 0,
        salary_pkg: calcPackage(c.staff_role),
      };
    }
    map[key].items.push(c);
    map[key].commission_total += c.commission_amount || 0;
  });
  return Object.values(map).sort((a, b) => (b.commission_total + (b.salary_pkg?.nett || 0)) - (a.commission_total + (a.salary_pkg?.nett || 0)));
}

function exportCSV(groups, month) {
  const rows = [["Staff Name", "Role", "Commission Type", "Client", "Base Amount", "Rate %", "Commission (R)", "Qualifying Event", "Status"]];
  groups.forEach(g => {
    g.items.forEach(c => {
      rows.push([
        g.staff_name,
        g.staff_role,
        c.commission_type?.replace(/_/g, " ") || "",
        c.client_name || "",
        c.base_amount || "",
        c.rate_percent || "",
        c.commission_amount || 0,
        c.qualifying_event || "",
        c.status,
      ]);
    });
    rows.push([`TOTAL: ${g.staff_name}`, "", "", "", "", "", g.total, "", ""]);
    rows.push([]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-report-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(groups, month, grandTotal) {
  const lines = [];
  lines.push(`MARKETING iO — PAYROLL REPORT`);
  lines.push(`Month: ${month}`);
  lines.push(`Generated: ${new Date().toLocaleDateString("en-ZA")}`);
  lines.push(`${"─".repeat(60)}`);
  groups.forEach(g => {
    lines.push(`\nCONSULTANT: ${g.staff_name.toUpperCase()} (${g.staff_role.replace(/_/g, " ")})`);
    lines.push(`${"─".repeat(40)}`);
    g.items.forEach(c => {
      lines.push(
        `  ${(c.commission_type || "").replace(/_/g, " ").padEnd(28)} ${(c.client_name || "").padEnd(20)} R${(c.commission_amount || 0).toLocaleString()}`
      );
    });
    lines.push(`  ${"SUBTOTAL".padEnd(50)} R${g.total.toLocaleString()}`);
  });
  lines.push(`\n${"═".repeat(60)}`);
  lines.push(`  ${"GRAND TOTAL".padEnd(50)} R${grandTotal.toLocaleString()}`);
  lines.push(`${"═".repeat(60)}`);

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-report-${month}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

const ROLE_COLORS = {
  field_agent: "bg-primary/15 text-primary border-primary/30",
  cpc: "bg-[#00ccff]/15 text-[#00ccff] border-[#00ccff]/30",
  admin: "bg-warning/15 text-warning border-warning/30",
  founder: "bg-accent/15 text-accent border-accent/30",
  other: "bg-muted/40 text-muted-foreground border-border/40",
};

export default function PayrollReport() {
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].val);
  const [commissions, setCommissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    base44.entities.User.list().then(setUsers);
  }, []);

  useEffect(() => {
    setLoading(true);
    base44.entities.Commission.filter({ status: "approved", payroll_month: selectedMonth }, "-created_date", 300)
      .then(d => { setCommissions(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedMonth]);

  const groups = groupByStaff(commissions, users);
  const grandTotal = groups.reduce((s, g) => s + g.commission_total + (g.salary_pkg?.nett || 0), 0);
  const toggleExpand = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  return (
    <AppLayout title="Payroll Report" subtitle="Monthly commission payout summary">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-52 bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Approved commissions only</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-border/50 text-muted-foreground hover:text-foreground gap-2"
            onClick={() => exportCSV(groups, selectedMonth)} disabled={groups.length === 0}>
            <FileSpreadsheet className="w-4 h-4" /> Export CSV
          </Button>
          <Button size="sm" className="gradient-bg text-white hover:opacity-90 gap-2"
            onClick={() => exportPDF(groups, selectedMonth, grandTotal)} disabled={groups.length === 0}>
            <FileText className="w-4 h-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-success">R{grandTotal.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Payroll (Salary + Comm)</p>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-primary">{groups.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Staff Members</p>
        </div>
        <div className="glass rounded-xl p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-xl font-bold text-foreground">{commissions.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Commission Lines</p>
        </div>
      </div>

      {/* Report body */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-muted/20 rounded-xl animate-pulse" />)}</div>
      ) : groups.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No approved commissions for {selectedMonth}</p>
          <p className="text-xs text-muted-foreground mt-1">Approve commissions on the Commissions page first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const key = g.staff_id || g.staff_name;
            const open = expanded[key];
            const pkg = g.salary_pkg;
            const grandPay = (pkg?.nett || 0) + g.commission_total;
            return (
              <div key={key} className="glass rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all text-left"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="w-9 h-9 rounded-lg gradient-bg flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">{g.staff_name?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{g.staff_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`border text-xs capitalize ${ROLE_COLORS[g.staff_role] || ROLE_COLORS.other}`}>
                        {g.staff_role?.replace(/_/g, " ")}
                      </Badge>
                      {pkg && <span className="text-xs text-muted-foreground">Salary R{pkg.nett.toLocaleString()}</span>}
                      {g.items.length > 0 && <span className="text-xs text-muted-foreground">+ {g.items.length} comm line{g.items.length !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-success">R{grandPay.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{open ? "▲ hide" : "▼ show"}</p>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border/30 divide-y divide-border/20">
                    {/* Salary breakdown */}
                    {pkg && (
                      <div className="px-4 py-3 bg-white/3">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Guaranteed Package</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gross CTC</span>
                          <span className="text-foreground">R{pkg.gross.toLocaleString()}</span>
                        </div>
                        {pkg.deductionItems?.map(d => (
                          <div key={d.name} className="flex justify-between text-sm mt-1">
                            <span className="text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3 text-destructive" />{d.name}</span>
                            <span className="text-destructive">-R{d.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-semibold mt-2 pt-1 border-t border-white/10">
                          <span className="text-foreground">Nett Salary</span>
                          <span className="text-success">R{pkg.nett.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {/* Commission lines */}
                    {g.items.length > 0 && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Commission</p>
                      </div>
                    )}
                    {g.items.map(c => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground capitalize">{c.commission_type?.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">{c.client_name || "—"} {c.qualifying_event ? `· ${c.qualifying_event}` : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {c.rate_percent ? <p className="text-xs text-muted-foreground">{c.rate_percent}% of R{(c.base_amount || 0).toLocaleString()}</p> : null}
                          <p className="text-sm font-semibold text-foreground">R{(c.commission_amount || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-3 bg-success/5">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        Salary R{(pkg?.nett || 0).toLocaleString()} + Comm R{g.commission_total.toLocaleString()}
                      </div>
                      <p className="text-success font-bold text-sm">R{grandPay.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total footer */}
          <div className="glass rounded-xl p-4 flex items-center justify-between border border-success/20">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Users className="w-4 h-4 text-success" /> Total Payroll — {selectedMonth}
            </div>
            <p className="text-2xl font-black text-success">R{grandTotal.toLocaleString()}</p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}