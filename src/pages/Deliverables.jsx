import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Clock, AlertCircle, Search } from 'lucide-react';

export default function Deliverables() {
  const [deliverables, setDeliverables] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterPhase, setFilterPhase] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    Promise.all([
      base44.entities.Deliverable.list('-created_date', 500),
      base44.entities.Client.list('-created_date', 200),
      base44.entities.User.list()
    ]).then(([d, c, u]) => {
      setDeliverables(d);
      setClients(c);
      setUsers(u);
      setLoading(false);
    });
  }, []);

  const statusConfig = {
    not_started: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/20', label: 'Not Started' },
    in_progress: { icon: Clock, color: 'text-primary', bg: 'bg-primary/10', label: 'In Progress' },
    awaiting_client: { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', label: 'Awaiting Client' },
    client_reviewing: { icon: Clock, color: 'text-info', bg: 'bg-info/10', label: 'Client Reviewing' },
    approved: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Approved' },
    deemed_approved: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Deemed Approved' },
    completed: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Completed' },
    blocked: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Blocked' }
  };

  const phaseColors = {
    setup: 'bg-primary/15 text-primary',
    monthly_recurring: 'bg-info/15 text-info',
    once_off: 'bg-accent/15 text-accent'
  };

  const filteredDeliverables = deliverables.filter(d => {
    const matchesSearch = !searchText || 
      d.title.toLowerCase().includes(searchText.toLowerCase()) ||
      d.client_name.toLowerCase().includes(searchText.toLowerCase());
    const matchesPhase = filterPhase === 'all' || d.phase === filterPhase;
    const matchesClient = filterClient === 'all' || d.client_id === filterClient;
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchesSearch && matchesPhase && matchesClient && matchesStatus;
  });

  const handleStatusChange = async (deliverable, newStatus) => {
    try {
      await base44.entities.Deliverable.update(deliverable.id, {
        status: newStatus,
        approved_date: newStatus.includes('approved') || newStatus === 'completed' ? new Date().toISOString().split('T')[0] : deliverable.approved_date
      });
      setDeliverables(prev => prev.map(d => d.id === deliverable.id ? { ...d, status: newStatus } : d));
    } catch (err) {
      console.error('Failed to update deliverable:', err);
    }
  };

  const getProgressStats = () => {
    const setup = filteredDeliverables.filter(d => d.phase === 'setup');
    const completed = setup.filter(d => d.status === 'completed' || d.status === 'approved' || d.status === 'deemed_approved');
    return { completed: completed.length, total: setup.length };
  };

  const progress = getProgressStats();

  if (loading) return (
    <AppLayout title="Deliverables">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title="Deliverables" subtitle="Track setup and recurring deliverables">
      <div className="space-y-6">
        {/* Summary */}
        {progress.total > 0 && (
          <Card className="glass">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">Setup Completion</p>
                  <div className="w-full bg-secondary/50 rounded-full h-2">
                    <div
                      className="h-2 rounded-full gradient-bg transition-all"
                      style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{progress.completed}</p>
                  <p className="text-xs text-muted-foreground">of {progress.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative col-span-full sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search deliverables…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
            <Select value={filterPhase} onValueChange={setFilterPhase}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Phase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                <SelectItem value="setup">Setup</SelectItem>
                <SelectItem value="monthly_recurring">Monthly Recurring</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="awaiting_client">Awaiting Client</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Deliverables list */}
        <div className="space-y-3">
          {filteredDeliverables.length === 0 ? (
            <Card className="glass">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No deliverables found.</p>
              </CardContent>
            </Card>
          ) : (
            filteredDeliverables.map(d => {
              const config = statusConfig[d.status] || statusConfig.not_started;
              const Icon = config.icon;
              const assignedUser = users.find(u => u.id === d.assigned_to);

              return (
                <Card key={d.id} className="glass hover:shadow-card-hover transition-all">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                      <div className="col-span-1 lg:col-span-2">
                        <h3 className="font-semibold text-foreground mb-2">{d.title}</h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge className={phaseColors[d.phase] || 'bg-secondary/50'} variant="outline">
                            {d.phase === 'setup' ? 'Setup' : d.phase === 'monthly_recurring' ? 'Monthly' : 'Once-off'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {d.client_name}
                          </Badge>
                          {d.product && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {d.product}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="col-span-1">
                        <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                        <p className="text-sm font-medium text-foreground">
                          {assignedUser?.full_name || assignedUser?.email || d.owner_role || 'Unassigned'}
                        </p>
                      </div>

                      <div className="col-span-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <Select value={d.status} onValueChange={newStatus => handleStatusChange(d, newStatus)}>
                            <SelectTrigger className={`bg-transparent border-0 text-sm font-medium ${config.color} p-0 h-auto`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_started">Not Started</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="awaiting_client">Awaiting Client</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}