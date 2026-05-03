import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentUser } from '@/lib/customAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AlertCircle, Users, ArrowRight } from 'lucide-react';
import { calculateMetricValue, getKPIStatus } from '@/lib/kpiCalculator';

export default function TeamKPIsWidget() {
  const [user, setUser] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) { window.location.href = '/login'; return; }
        setUser(currentUser);

        if (!['owner', 'admin', 'founder'].includes(currentUser.role)) {
          setLoading(false);
          return;
        }

        // Get all staff
        const staff = await base44.entities.User.list();
        
        // Get all KPI targets
        const allTargets = await base44.entities.KPITarget.filter({ is_active: true, target_period: 'monthly' });

        // Find alerts
        const alertsList = [];
        for (const person of staff || []) {
          const personTargets = (allTargets || []).filter(t => t.role === person.role);
          for (const target of personTargets) {
            const actual = await calculateMetricValue(target.metric_code, person.id, target.target_period);
            const status = getKPIStatus(actual, target.target_value, target.direction);
            if (status.status === 'below_target') {
              alertsList.push({
                staff: person.full_name,
                metric: target.metric_name,
                actual,
                target: target.target_value
              });
            }
          }
        }
        setAlerts(alertsList.slice(0, 3));
        setLoading(false);
      } catch (error) {
        console.error('Failed to load team KPI widget:', error);
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !['owner', 'admin', 'founder'].includes(user?.role)) return null;

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-primary" />
          Team Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">All team members on track ✓</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">{alert.staff}</p>
                    <p className="text-xs text-muted-foreground">{alert.metric}</p>
                  </div>
                  <Badge className="bg-destructive/20 text-destructive text-xs">
                    {alert.actual} / {alert.target}
                  </Badge>
                </div>
              ))}
            </div>
            {alerts.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-warning">
                <AlertCircle className="w-3 h-3" />
                {alerts.length} team members below target
              </div>
            )}
          </>
        )}
        <Link to="/team-kpis">
          <Button variant="outline" className="w-full text-xs mt-2">
            View Team KPIs
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}