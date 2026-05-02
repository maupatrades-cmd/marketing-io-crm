import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { calculateMetricValue, getKPIStatus, getProgressPercentage } from '@/lib/kpiCalculator';

export default function MyKPIs() {
  const [user, setUser] = useState(null);
  const [targets, setTargets] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Fetch targets for this user's role
        const roleTargets = await base44.entities.KPITarget.filter({
          role: currentUser.role || 'field_agent',
          is_active: true
        });
        setTargets(roleTargets || []);

        // Calculate all metrics
        const metricsData = await Promise.all(
          (roleTargets || []).map(async (target) => ({
            ...target,
            actual: await calculateMetricValue(target.metric_code, currentUser.id, target.target_period),
            calculated_at: new Date().toISOString()
          }))
        );
        setMetrics(metricsData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load KPIs:', error);
        setLoading(false);
      }
    })();
  }, []);

  const filteredMetrics = metrics.filter(m => m.target_period === period || period === 'all');

  const formatValue = (value, unit) => {
    if (unit === 'ZAR') return `R${value.toLocaleString()}`;
    if (unit === '%') return `${value}%`;
    return `${value} ${unit}`;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <AppLayout title="My Performance">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="My Performance" subtitle={user?.full_name || 'Staff Member'}>
      <div className="space-y-6">
        {/* Header with period selector */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Period</p>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-48 mt-2 bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="all">All Periods</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">On Track</p>
            <p className="text-3xl font-bold text-success">
              {metrics.filter(m => {
                const status = getKPIStatus(m.actual, m.target_value, m.direction);
                return status.status === 'on_track';
              }).length} / {metrics.length}
            </p>
          </div>
        </div>

        {/* Metrics grid */}
        {filteredMetrics.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No KPI targets assigned for this period.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMetrics.map((metric) => {
              const progress = getProgressPercentage(metric.actual, metric.target_value, metric.direction);
              const statusInfo = getKPIStatus(metric.actual, metric.target_value, metric.direction);
              const Icon = metric.direction === 'minimum' ? TrendingUp : TrendingDown;
              const StatusIcon = statusInfo.status === 'on_track' ? CheckCircle2 : AlertCircle;

              return (
                <Card key={metric.id} className={`glass transition-all ${statusInfo.bg}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-semibold text-foreground">
                          {metric.metric_name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Target: {metric.target_period}
                        </p>
                      </div>
                      <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Actual vs Target */}
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">Actual</p>
                        <p className="text-lg font-bold text-foreground">
                          {formatValue(metric.actual, metric.unit)}
                        </p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">Target</p>
                        <p className="text-lg font-bold text-primary">
                          {formatValue(metric.target_value, metric.unit)}
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-full bg-secondary/50 rounded-full h-2 mr-2">
                          <div
                            className="h-2 rounded-full gradient-bg transition-all"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                        <p className="text-xs font-semibold text-foreground w-10 text-right">
                          {Math.min(100, progress)}%
                        </p>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <Badge
                        className={
                          statusInfo.status === 'on_track'
                            ? 'bg-success/20 text-success'
                            : statusInfo.status === 'at_risk'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-destructive/20 text-destructive'
                        }
                      >
                        {statusInfo.status === 'on_track'
                          ? '✓ On Track'
                          : statusInfo.status === 'at_risk'
                          ? '⚠ At Risk'
                          : '✗ Below Target'}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(metric.calculated_at)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}