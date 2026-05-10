import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/AuthContext";

function fmtMoney(n) {
  return `R${Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s) {
  if (!s) return "—";
  try { return format(new Date(s), "d MMM yyyy"); } catch { return s; }
}

export default function CancelledContracts() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    base44.entities.Invoice.filter({ status: "cancelled" }, "-cancelled_at", 300)
      .then(rows => {
        let list = Array.isArray(rows) ? rows : [];
        // field_agent / cpc only see their own client invoices
        if (user?.role === "field_agent" || user?.role === "cpc") {
          list = list.filter(inv =>
            inv.assigned_field_agent_id === user.id ||
            inv.assigned_cpc_id === user.id
          );
        }
        setInvoices(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id, user?.role]);

  const filtered = invoices.filter(inv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (inv.invoice_number || "").toLowerCase().includes(q) ||
      (inv.client_name || "").toLowerCase().includes(q) ||
      (inv.cancellation_reason || "").toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout title="Cancelled Invoices" subtitle="All invoices cancelled by admin or client">
      <div className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search client, invoice # or reason…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted/20 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <XCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{search ? "No matches found." : "No cancelled invoices yet."}</p>
          </div>
        ) : (
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b border-border/40">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Invoice #</th>
                  <th className="px-4 py-3 text-left font-semibold">Client</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Cancelled On</th>
                  <th className="px-4 py-3 text-left font-semibold">Cancelled By</th>
                  <th className="px-4 py-3 text-left font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-border/20 hover:bg-muted/10">
                    <td className="px-4 py-3 font-mono text-xs">
                      {inv.invoice_number || inv.id?.slice(0, 8) || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium">{inv.client_name || "—"}</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(inv.total_amount || inv.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize text-xs">
                      {(inv.invoice_type || "—").replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.cancelled_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{inv.cancelled_by_name || "—"}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {inv.cancellation_reason || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-right">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
      </div>
    </AppLayout>
  );
}