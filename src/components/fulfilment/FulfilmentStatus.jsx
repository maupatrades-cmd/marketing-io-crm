import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock } from 'lucide-react';

export default function FulfilmentStatus({ clientId, dealId }) {
  const [deliverables, setDeliverables] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Deliverable.filter({ client_id: clientId }).then(d => {
      setDeliverables(d || []);
      setLoading(false);
    });
  }, [clientId]);

  const setupDeliverables = deliverables.filter(d => d.phase === 'setup');
  const completedSetup = setupDeliverables.filter(d => 
    d.status === 'completed' || d.status === 'approved' || d.status === 'deemed_approved'
  );

  if (loading) return null;
  if (setupDeliverables.length === 0) return null;

  const allComplete = completedSetup.length === setupDeliverables.length;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Setup Deliverables</span>
          <Badge className={allComplete ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'}>
            {completedSetup.length} / {setupDeliverables.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="w-full bg-secondary/50 rounded-full h-2">
          <div
            className="h-2 rounded-full gradient-bg transition-all"
            style={{ width: `${setupDeliverables.length ? (completedSetup.length / setupDeliverables.length) * 100 : 0}%` }}
          />
        </div>

        {/* Deliverables list */}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {setupDeliverables.map(d => {
            const isComplete = d.status === 'completed' || d.status === 'approved' || d.status === 'deemed_approved';
            return (
              <div key={d.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                <div className="mt-0.5 shrink-0">
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isComplete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {d.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion prompt */}
        {allComplete && (
          <Button
            variant="outline"
            className="w-full mt-4 text-xs"
            onClick={() => {
              // Could trigger Phase 6 completion here
            }}
          >
            ✓ All Setup Complete — Mark Phase 6 Done?
          </Button>
        )}
      </CardContent>
    </Card>
  );
}