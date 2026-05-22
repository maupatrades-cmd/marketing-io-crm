import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getCurrentUser } from '@/lib/customAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Plus, X, RefreshCw } from 'lucide-react';
import { calculateMetricValue, getKPIStatus, getProgressPercentage } from '@/lib/kpiCalculator';
import { useToast } from '@/components/ui/use-toast';

export default function MyKPIs() {
  const [user, setUser] = useState(null);
  const [targets, setTargets] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [personalKPIs, setPersonalKPIs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');
  const [showDialog, setShowDialog] = useState(false);
  const [newKPI, setNewKPI] = useState({ name: '', target: '', period: 'monthly' });
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const { toast } = useToast();

  const loadData = async (currentUser) => {
    const roleTargets = await base44.entities.KPITarget.filter({
      role: currentUser.role || 'field_agent',
      is_active: true
    });
    setTargets(roleTargets || []);

    const metricsData = await Promise.all(
      (roleTargets || []).map(async (target) => ({
        ...target,
        actual: await calculateMetricValue(target.metric_code, currentUser.id, target.target_period),
        calculated_at: new Date().toISOString()
      }))
    );
    setMetrics(metricsData);
    setLastRefreshed(new Date());

    const personal = await base44.entities.KPITarget.filter({
      created_by: currentUser.email,
      is_personal: true
    });
    setPersonalKPIs(Array.isArray(personal) ? personal : personal ? [personal] : []);
  };

  const handleRefresh = async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await loadData(user);
      toast({ title: "KPIs refreshed", description: "Live data recalculated." });
    } catch (e) {
      toast({ title: "Refresh failed", variant: "destructive" });
    }
    setRefreshing(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await getCurrentUser();
        if (!currentUser) { window.location.href = '/login'; return; }
        setUser(currentUser);
        await loadData(currentUser);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load KPIs:', error);
        setLoading(false);
      }
    })();
  }, []);

  const addPersonalKPI = async () => {
    if (!newKPI.name.trim() || !newKPI.target) {
      toast({ title: "Missing fields", description: "Name and target are required", variant: "destructive" });
      return;
    }

    try {
      const kpi = await base44.entities.KPITarget.create({
        metric_name: newKPI.name,
        target_value: parseFloat(newKPI.target),
        target_period: newKPI.period,
        direction: 'maximum',
        unit: 'units',
        is_personal: true,
        is_active: true,
        role: user.role,
        metric_code: `personal_${Date.now()}`
      });
      setPersonalKPIs([...personalKPIs, kpi]);
      setNewKPI({ name: '', target: '', period: 'monthly' });
      setShowDialog(false);
      toast({ title: "KPI created", description: "Your personal KPI has been added" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const deletePersonalKPI = async (id) => {
    try {
      await base44.entities.KPITarget.delete(id);
      setPersonalKPIs(personalKPIs.filter(k => k.id !== id));
      toast({ title: "KPI deleted" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">On Track</p>
              <p className="text-3xl font-bold text-success">
                {metrics.filter(m => {
                  const status = getKPIStatus(m.actual, m.target_value, m.direction);
                  return status.status === 'on_track';
                }).length} / {metrics.length}
              </p>
              {lastRefreshed && <p className="text-xs text-muted-foreground mt-0.5">Last: {lastRefreshed.toLocaleTimeString('en-ZA')}</p>}
            </div>
            <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm" className="gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Personal KPIs Section */}
        {personalKPIs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">My Personal Goals</h2>
              <Button onClick={() => setShowDialog(true)} size="sm" variant="outline" className="gap-1">
                <Plus className="w-3 h-3" /> Add Goal
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personalKPIs.map((kpi) => (
                <Card key={kpi.id} className="glass border-accent/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm">{kpi.metric_name}</CardTitle>
                      <button onClick={() => deletePersonalKPI(kpi.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{kpi.target_period}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-accent">{kpi.target_value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Add Personal KPI Button */}
        {personalKPIs.length === 0 && (
          <Button onClick={() => setShowDialog(true)} variant="outline" className="w-full gap-2">
            <Plus className="w-4 h-4" /> Create Your First Personal Goal
          </Button>
        )}

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
                      <div className="bg-secondary/30 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">Actual</p>
                        <p className="text-lg font-bold text-foreground">
                          {formatValue(metric.actual, metric.unit)}
                        </p>
                      </div>
                      <div className="bg-secondary/30 rounded-lg p-2">
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

      {/* Add Personal KPI Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Add Personal Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Goal Name</label>
              <Input
                placeholder="e.g., Close 5 deals"
                value={newKPI.name}
                onChange={(e) => setNewKPI({ ...newKPI, name: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Target Value</label>
              <Input
                type="number"
                placeholder="e.g., 5"
                value={newKPI.target}
                onChange={(e) => setNewKPI({ ...newKPI, target: e.target.value })}
                className="bg-secondary/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Period</label>
              <Select value={newKPI.period} onValueChange={(v) => setNewKPI({ ...newKPI, period: v })}>
                <SelectTrigger className="bg-secondary/50 border-border/50">
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={addPersonalKPI} className="flex-1 gradient-bg text-white">
                Create Goal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}