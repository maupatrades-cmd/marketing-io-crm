import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/AppLayout";
import { Search, Users } from "lucide-react";

const PACKAGE_LABELS = {
  ignite: "Ignite",
  accelerate: "Accelerate",
  dominate: "Dominate",
  street_pulse: "Street Pulse",
  township_pulse: "Township Pulse",
  none: "—",
};

export default function StaffMyClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const allClients = await base44.entities.Client.list();
        const allDeals = await base44.entities.Deal.list();

        let myClients = [];

        if (user?.role === "field_agent") {
          // Field agents see clients from their deals
          const myDealClientIds = allDeals
            .filter((d) => d.closer_id === user?.id)
            .map((d) => d.client_id);
          myClients = allClients.filter((c) => myDealClientIds.includes(c.id));
        } else if (user?.role === "cpc") {
          // CPCs see clients from their leads and deals
          const allLeads = await base44.entities.Lead.list();
          const myLeadClientIds = allLeads
            .filter((l) => l.submitted_by === user?.id || l.created_by === user?.id)
            .map((l) => l.client_id)
            .filter(Boolean);
          const myDealClientIds = allDeals
            .filter((d) => d.cpc_id === user?.id)
            .map((d) => d.client_id);
          const allMyClientIds = [...new Set([...myLeadClientIds, ...myDealClientIds])];
          myClients = allClients.filter((c) => allMyClientIds.includes(c.id));
        } else if (user?.role === "head_of_tech") {
          // Tech sees all active/onboarding clients
          myClients = allClients.filter((c) => ["active", "onboarding"].includes(c.status));
        } else {
          myClients = allClients;
        }

        setClients(myClients);
        setFiltered(myClients);
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchClients();
  }, [user]);

  const handleSearch = (term) => {
    setSearch(term);
    const result = clients.filter(
      (c) =>
        c.business_name?.toLowerCase().includes(term.toLowerCase()) ||
        c.contact_person?.toLowerCase().includes(term.toLowerCase())
    );
    setFiltered(result);
  };

  return (
    <AppLayout title="My Clients" subtitle={`${filtered.length} total`}>
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-secondary/50 border-border/50"
          />
        </div>

        {/* Clients List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No clients found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((client) => (
              <div
                key={client.id}
                onClick={() => setSelected(selected?.id === client.id ? null : client)}
                className="glass rounded-xl p-4 cursor-pointer hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{client.business_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{client.contact_person} · {client.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Badge className="text-xs capitalize bg-primary/20 text-primary border-0">
                      {client.status?.replace(/_/g, " ")}
                    </Badge>
                    {client.package && (
                      <span className="text-xs text-muted-foreground">{PACKAGE_LABELS[client.package]}</span>
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {selected?.id === client.id && (
                  <div className="mt-4 pt-4 border-t border-border/30 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-foreground">{client.phone || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Industry</p>
                        <p className="text-foreground">{client.industry || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                        <p className="text-foreground">R{(client.monthly_retainer || 0)?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Go-Live</p>
                        <p className="text-foreground">{client.go_live_date || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}