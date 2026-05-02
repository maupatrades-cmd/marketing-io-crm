import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import { BarChart3, TrendingUp } from "lucide-react";

const STAGES = [
  { id: "new_lead", label: "New Lead" },
  { id: "discovery_visit", label: "Discovery" },
  { id: "proposal_sent", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Won" },
  { id: "closed_lost", label: "Lost" },
  { id: "onboarding", label: "Onboarding" },
];

export default function StaffMyPipeline() {
  const { user } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true);
        const allDeals = await base44.entities.Deal.list();
        const myDeals = allDeals.filter(
          (d) => d.closer_id === user?.id || d.cpc_id === user?.id
        );
        setDeals(myDeals);
      } catch (error) {
        console.error("Error fetching deals:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) fetchDeals();
  }, [user]);

  const stageGroups = STAGES.map((stage) => ({
    ...stage,
    deals: deals.filter((d) => d.stage === stage.id),
  }));

  const forecast = deals
    .filter((d) => !["closed_won", "closed_lost"].includes(d.stage))
    .reduce((sum, d) => {
      const prob = d.probability || 0;
      return sum + (d.monthly_retainer || 0) * (prob / 100);
    }, 0);

  return (
    <AppLayout title="My Pipeline" subtitle={`Forecast: R${forecast?.toLocaleString()}/mo`}>
      <div className="space-y-6">
        {/* Forecast Card */}
        <Card className="bg-gradient-bg/10 border-primary/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Forecast (Monthly)</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  R{forecast?.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading pipeline...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 overflow-x-auto">
            {stageGroups.map((stage) => (
              <div key={stage.id} className="min-w-[300px]">
                <div className="bg-secondary/30 rounded-lg p-3 mb-3 border border-border/30">
                  <p className="font-semibold text-foreground text-sm">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.deals.length} deals</p>
                </div>
                <div className="space-y-3">
                  {stage.deals.map((deal) => (
                    <DealCard key={deal.id} deal={deal} userRole={user?.role} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function DealCard({ deal, userRole }) {
  return (
    <div className="bg-card border border-border/50 rounded-lg p-3 hover:border-primary/50 transition-colors cursor-pointer">
      <p className="font-medium text-foreground text-sm">{deal.client_name}</p>
      <p className="text-xs text-muted-foreground">{deal.package}</p>
      {userRole === "field_agent" && deal.monthly_retainer && (
        <p className="text-sm font-semibold text-primary mt-2">R{deal.monthly_retainer?.toLocaleString()}</p>
      )}
      {deal.probability && (
        <p className="text-xs text-muted-foreground mt-1">{deal.probability}% probability</p>
      )}
    </div>
  );
}