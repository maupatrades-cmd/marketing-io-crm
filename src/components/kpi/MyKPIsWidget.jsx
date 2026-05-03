import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentUser } from '@/lib/customAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { calculateMetricValue, getKPIStatus, getProgressPercentage } from '@/lib/kpiCalculator';

export default function MyKPIsWidget() {
  const [user, setUser] = useState(null);
  const [topMetrics, setTopMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) { window.location.href = '/login'; return; }
        setUser(currentUser);

        // Fetch this month's targets
        const targets = await base44.entities.KPITarget.filter({
          role: currentUser.role || 'field_agent',
          target_period: 'monthly',
          is_active: true
        });

        // Calculate top 3 metrics
        const metrics = await Promise.all(
          (targets || []).slice(0, 3).map(async (target) => ({
            ...target,
            actual: await calculateMetricValue(target.metric_code, currentUser.id, target.target_period)
          }))
        );
        setTopMetrics(metrics);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load KPI widget:', error);
        setLoading(false);
      }
    })();
  }, []);

  if (loading || topMetrics.length === 0) return null;

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" />
          Your KPIs This Month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topMetrics.map((metric) => {
          const progress = getProgressPercentage(metric.actual, metric.target_value, metric.direction);
          const statusInfo = getKPIStatus(metric.actual, metric.target_value, metric.direction);
          
          return (
            <div key={metric.id} className={`p-2 rounded-lg ${statusInfo.bg}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-foreground">{metric.metric_name}</p>
                <p className="text-xs font-bold text-primary">{Math.min(100, progress)}%</p>
              </div>
              <div className="w-full bg-secondary/50 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full gradient-bg"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          );
        })}
        <Link to="/my-kpis">
          <Button variant="outline" className="w-full text-xs mt-2">
            View All KPIs
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}