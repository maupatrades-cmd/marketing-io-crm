import { useState, useEffect } from "react"; // FA Add-on Catalog
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Search, ShoppingBag, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";

const CATEGORY_LABELS = {
  setup_recurring: "Phase 3 — Setup + Recurring",
  pure_recurring: "Phase 4 — Pure Recurring",
  once_off: "Phase 5 — Once-Off",
  special: "Phase 6 — Special Items",
};

const BUCKET_COMMISSION = {
  A: "7% to closer on clearance",
  B: "7% setup + 7% retainer at milestone",
  C: "7% of annual retainer at 5-deal milestone",
  D: "10% trickle of monthly management fee",
  E: "NO COMMISSION",
};

function PriceTag({ item }) {
  if (item.once_off_fee) return <span className="text-primary font-bold">R{item.once_off_fee.toLocaleString()} once-off</span>;
  if (item.setup_fee && item.monthly_fee) return <span className="text-primary font-bold">R{item.setup_fee.toLocaleString()} setup + R{item.monthly_fee.toLocaleString()}/mo</span>;
  if (item.monthly_fee) return <span className="text-primary font-bold">R{item.monthly_fee.toLocaleString()}/mo</span>;
  if (item.pricing_note) return <span className="text-primary font-bold">{item.pricing_note}</span>;
  return <span className="text-muted-foreground">Contact for pricing</span>;
}

function CatalogCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const isNoCommission = item.bucket === "E";

  return (
    <div className="glass rounded-xl overflow-hidden transition-all">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-foreground">{item.name}</span>
              <Badge className={`text-[10px] px-1.5 ${isNoCommission ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-primary/15 text-primary border-primary/30"} border`}>
                Bucket {item.bucket}
              </Badge>
              {isNoCommission && (
                <Badge className="text-[10px] px-1.5 bg-destructive/20 text-destructive border-destructive/40 border font-bold">
                  <AlertTriangle className="w-3 h-3 mr-1" />NO COMMISSION
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{item.short_description}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm"><PriceTag item={item} /></div>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground mt-1 ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground mt-1 ml-auto" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-border/30 pt-4 space-y-4 animate-fade-in">
          <div className={`rounded-lg p-3 text-sm ${isNoCommission ? "bg-destructive/10 border border-destructive/30" : "bg-success/10 border border-success/30"}`}>
            <p className="font-semibold text-xs mb-1 uppercase tracking-wide text-muted-foreground">Your Commission</p>
            <p className={isNoCommission ? "text-destructive font-semibold" : "text-success font-semibold"}>
              {BUCKET_COMMISSION[item.bucket]}
            </p>
            {item.commission_note && <p className="text-xs text-muted-foreground mt-1">{item.commission_note}</p>}
          </div>

          {item.full_deliverables && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Deliverables</p>
              <ul className="text-sm text-foreground space-y-1">
                {item.full_deliverables.split("\n").map((d, i) => <li key={i} className="flex gap-2"><span className="text-primary">•</span>{d}</li>)}
              </ul>
            </div>
          )}

          {item.client_obligations && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Client Must Provide</p>
              <ul className="text-sm text-foreground space-y-1">
                {item.client_obligations.split("\n").map((d, i) => <li key={i} className="flex gap-2"><span className="text-warning">•</span>{d}</li>)}
              </ul>
            </div>
          )}

          {item.scope_exclusions && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Not Included</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {item.scope_exclusions.split("\n").map((d, i) => <li key={i} className="flex gap-2"><span className="text-destructive/60">✗</span>{d}</li>)}
              </ul>
            </div>
          )}

          {item.tools_used && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tools Used</p>
              <p className="text-sm text-muted-foreground">{item.tools_used}</p>
            </div>
          )}

          {(item.soft_sla_days || item.hard_sla_days) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Delivery SLA</p>
              <p className="text-sm text-foreground">Soft: {item.soft_sla_days} days / Hard: {item.hard_sla_days} days</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffAddOnCatalog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    base44.entities.AddOnCatalogItem.list("display_order", 30)
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await base44.functions.invoke("seedAddOnCatalog", {});
      toast({ title: res.data?.message || "Catalog seeded" });
      const d = await base44.entities.AddOnCatalogItem.list("display_order", 30);
      setItems(Array.isArray(d) ? d : []);
    } catch (err) {
      toast({ title: "Seed failed", description: err.message, variant: "destructive" });
    }
    setSeeding(false);
  };

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name?.toLowerCase().includes(search.toLowerCase()) || item.short_description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || item.category === categoryFilter;
    return matchSearch && matchCat && item.is_active !== false;
  });

  const grouped = Object.entries(CATEGORY_LABELS).reduce((acc, [cat, label]) => {
    const catItems = filtered.filter(i => i.category === cat);
    if (catItems.length > 0) acc.push({ cat, label, items: catItems });
    return acc;
  }, []);

  return (
    <AppLayout title="Add-on Catalog" subtitle="20 add-ons — pricing, deliverables & your commission at a glance">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search add-ons…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[["all", "All"], ["setup_recurring", "Setup+Recurring"], ["pure_recurring", "Pure Recurring"], ["once_off", "Once-Off"], ["special", "Special"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setCategoryFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${categoryFilter === val ? "gradient-bg text-white shadow-glow-purple" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {user?.role === "owner" && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding} className="shrink-0 border-primary/40 text-primary">
              {seeding ? "Seeding…" : "Seed Catalog"}
            </Button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-muted/20 rounded-xl animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">Catalog is empty</p>
            {user?.role === "owner" && (
              <Button onClick={handleSeed} disabled={seeding} className="gradient-bg text-white">
                {seeding ? "Seeding…" : "Seed 20 Add-ons"}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(({ cat, label, items: catItems }) => (
              <div key={cat}>
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">{label}</h3>
                <div className="space-y-3">
                  {catItems.map(item => <CatalogCard key={item.id} item={item} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Commission Reference */}
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Commission Reference</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {Object.entries(BUCKET_COMMISSION).map(([bucket, note]) => (
              <div key={bucket} className={`flex gap-3 p-3 rounded-lg ${bucket === "E" ? "bg-destructive/10" : "bg-secondary/30"}`}>
                <span className={`font-bold text-xs w-8 h-6 flex items-center justify-center rounded ${bucket === "E" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                  {bucket}
                </span>
                <span className={bucket === "E" ? "text-destructive" : "text-foreground"}>{note}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">⚠️ Bucket E (Print & Hosting) is NOT commissioned. Focus on Buckets A-D.</p>
        </div>
      </div>
    </AppLayout>
  );
}