import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { calculateMetricValue, getKPIStatus, getProgressPercentage } from '@/lib/kpiCalculator';

export default function TeamKPIs() {
  const [user, setUser] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [staffMetrics, setStaffMetrics] = useState({});
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Check access
        if (!['owner', 'admin', 'founder'].includes(currentUser.role)) {
          return;
        }

        // Get all staff
        const staff = await base44.entities.User.list();
        setStaffMembers(staff || []);

        // Get all KPI targets
        const allTargets = await base44.entities.KPITarget.filter({ is_active: true });
        setTargets(allTargets || []);

        // Calculate metrics for each staff member
        const metricsMap = {};
        for (const person of staff || []) {
          const personTargets = (allTargets || []).filter(t => t.role === person.role);
          const personMetrics = await Promise.all(
            personTargets.map(async (target) => ({
              ...target,
              actual: await calculateMetricValue(target.metric_code, person.id, target.target_period)
            }))
          );
          metricsMap[person.id] = personMetrics;
        }
        setStaffMetrics(metricsMap);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load team KPIs:', error);
        setLoading(false);
      }
    })();
  }, []);

  const formatValue = (value, unit) => {
    if (unit === 'ZAR') return `R${(value / 1000).toFixed(0)}k`;
    if (unit === '%') return `${value}%`;
    return value;
  };

  const getTeamAlerts = () => {
    const alerts = [];
    for (const staff of staffMembers) {
      const metrics = staffMetrics[staff.id] || [];
      for (const metric of metrics) {
        const status = getKPIStatus(metric.actual, metric.target_value, metric.direction);
        if (status.status === 'below_target') {
          alerts.push({
            staff: staff.full_name,
            metric: metric.metric_name,
            actual: metric.actual,
            target: metric.target_value
          });
        }
      }
    }
    return alerts.slice(0, 5); // Top 5 alerts
  };

  if (loading) {
    return (
      <AppLayout title="Team Performance">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const alerts = getTeamAlerts();

  return (
    <AppLayout title="Team Performance Overview" subtitle={`${staffMembers.length} team members`}>
      <div className="space-y-6">
        {/* Alerts */}
        {alerts.length > 0 && (
          <Card className="glass border-destructive/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                KPI Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((alert, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-destructive/5 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{alert.staff}</p>
                    <p className="text-xs text-muted-foreground">{alert.metric}</p>
                  </div>
                  <Badge className="bg-destructive/20 text-destructive">
                    {alert.actual} / {alert.target}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Period selector */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Period</p>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Staff grid */}
        <div className="space-y-3">
          {staffMembers.map((staff) => {
            const metrics = (staffMetrics[staff.id] || []).filter(
              m => period === 'all' || m.target_period === period
            );
            const onTrack = metrics.filter(m => {
              const status = getKPIStatus(m.actual, m.target_value, m.direction);
              return status.status === 'on_track';
            }).length;

            return (
              <Card
                key={staff.id}
                className="glass hover:shadow-card-hover transition-all cursor-pointer"
                onClick={() => setSelectedStaff(staff)}
              >
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div>
                      <p className="font-semibold text-foreground">{staff.full_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="w-full bg-secondary/50 rounded-full h-2">
                          <div
                            className="h-2 rounded-full gradient-bg"
                            style={{ width: `${metrics.length ? (onTrack / metrics.length) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {onTrack} / {metrics.length}
                      </Badge>
                    </div>

                    <div className="hidden md:block">
                      {metrics.slice(0, 3).map((m, idx) => {
                        const status = getKPIStatus(m.actual, m.target_value, m.direction);
                        return (
                          <Badge
                            key={idx}
                            className={`mr-1 ${
                              status.status === 'on_track'
                                ? 'bg-success/15 text-success'
                                : 'bg-warning/15 text-warning'
                            }`}
                          >
                            {m.metric_name.split(' ')[0]}
                          </Badge>
                        );
                      })}
                    </div>

                    <div className="flex justify-end">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detail modal */}
        {selectedStaff && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="glass w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedStaff.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize mt-1">{selectedStaff.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStaff(null)}
                >
                  ✕
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {(staffMetrics[selectedStaff.id] || [])
                  .filter(m => period === 'all' || m.target_period === period)
                  .map((metric) => {
                    const progress = getProgressPercentage(metric.actual, metric.target_value, metric.direction);
                    const statusInfo = getKPIStatus(metric.actual, metric.target_value, metric.direction);

                    return (
                      <div key={metric.id} className={`p-3 rounded-lg ${statusInfo.bg}`}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-foreground">{metric.metric_name}</p>
                          <Badge
                            className={
                              statusInfo.status === 'on_track'
                                ? 'bg-success/20 text-success'
                                : statusInfo.status === 'at_risk'
                                ? 'bg-warning/20 text-warning'
                                : 'bg-destructive/20 text-destructive'
                            }
                          >
                            {statusInfo.status === 'on_track' ? '✓ On Track' : '⚠ At Risk'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Actual</p>
                            <p className="font-semibold text-foreground">{formatValue(metric.actual, metric.unit)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Target</p>
                            <p className="font-semibold text-primary">{formatValue(metric.target_value, metric.unit)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Progress</p>
                            <p className="font-semibold text-foreground">{Math.min(100, progress)}%</p>
                          </div>
                        </div>
                        <div className="w-full bg-secondary/50 rounded-full h-2">
                          <div
                            className="h-2 rounded-full gradient-bg"
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}