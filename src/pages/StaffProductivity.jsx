import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';

function fmt(h) {
  if (!h) return '0h 0m';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

const PHASE_LABEL = { setup: 'Setup', monthly_recurring: 'Monthly', once_off: 'Once-off' };
const PHASE_COLOR = {
  setup: 'bg-primary/15 text-primary',
  monthly_recurring: 'bg-info/15 text-info',
  once_off: 'bg-accent/15 text-accent',
};

export default function StaffProductivity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    base44.entities.TimeLog.list('-date_worked', 2000).then(data => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const filterByPeriod = (log) => {
    if (periodFilter === 'all') return true;
    const d = new Date(log.date_worked);
    const now = new Date();
    if (periodFilter === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (periodFilter === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
    }
    if (periodFilter === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filtered = logs.filter(filterByPeriod);

  // Aggregate: staff → clients → phases → deliverables
  const byStaff = {};
  filtered.forEach(log => {
    const sid = log.staff_id || 'unknown';
    if (!byStaff[sid]) byStaff[sid] = { name: log.staff_name || 'Unknown', totalHours: 0, clients: {} };
    byStaff[sid].totalHours += log.hours || 0;

    const cid = log.client_id || 'unknown';
    if (!byStaff[sid].clients[cid]) byStaff[sid].clients[cid] = { name: log.client_name || 'Unknown', totalHours: 0, phases: {} };
    byStaff[sid].clients[cid].totalHours += log.hours || 0;

    const phase = log.phase || 'setup';
    if (!byStaff[sid].clients[cid].phases[phase]) byStaff[sid].clients[cid].phases[phase] = { totalHours: 0, entries: [] };
    byStaff[sid].clients[cid].phases[phase].totalHours += log.hours || 0;
    byStaff[sid].clients[cid].phases[phase].entries.push(log);
  });

  const staffRows = Object.entries(byStaff).sort((a, b) => b[1].totalHours - a[1].totalHours);
  const totalHours = staffRows.reduce((s, [, v]) => s + v.totalHours, 0);
  const totalEntries = filtered.length;

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  if (loading) return (
    <AppLayout title="Staff Productivity">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title="Staff Productivity" subtitle="Hours logged per staff member, broken down by client and phase">
      <div className="space-y-6">

        {/* Header stats + filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex gap-4">
            <Card className="glass px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xl font-bold text-primary">{fmt(totalHours)}</p>
                <p className="text-xs text-muted-foreground">Total Logged</p>
              </div>
            </Card>
            <Card className="glass px-4 py-3 flex items-center gap-3">
              <Users className="w-5 h-5 text-info" />
              <div>
                <p className="text-xl font-bold text-info">{staffRows.length}</p>
                <p className="text-xs text-muted-foreground">Staff Members</p>
              </div>
            </Card>
            <Card className="glass px-4 py-3 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-success" />
              <div>
                <p className="text-xl font-bold text-success">{totalEntries}</p>
                <p className="text-xs text-muted-foreground">Log Entries</p>
              </div>
            </Card>
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {staffRows.length === 0 ? (
          <Card className="glass">
            <CardContent className="py-16 text-center text-muted-foreground">
              No time logs found for the selected period.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {staffRows.map(([sid, staff]) => {
              const isOpen = expanded[sid];
              const pct = totalHours ? ((staff.totalHours / totalHours) * 100).toFixed(0) : 0;
              return (
                <Card key={sid} className="glass">
                  <CardHeader
                    className="cursor-pointer select-none py-4"
                    onClick={() => toggle(sid)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold">
                          {(staff.name[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-base">{staff.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{Object.keys(staff.clients).length} client(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:block w-32">
                          <div className="w-full bg-secondary/50 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full gradient-bg" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground text-right mt-0.5">{pct}% of total</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">{fmt(staff.totalHours)}</p>
                          <p className="text-xs text-muted-foreground">logged</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {isOpen && (
                    <CardContent className="pt-0 pb-4">
                      <div className="space-y-4 ml-7">
                        {Object.entries(staff.clients)
                          .sort((a, b) => b[1].totalHours - a[1].totalHours)
                          .map(([cid, client]) => (
                          <div key={cid} className="border border-border/40 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between bg-secondary/20 px-4 py-2.5">
                              <p className="text-sm font-semibold text-foreground">{client.name}</p>
                              <p className="text-sm font-bold text-foreground">{fmt(client.totalHours)}</p>
                            </div>
                            {Object.entries(client.phases)
                              .sort((a, b) => b[1].totalHours - a[1].totalHours)
                              .map(([phase, phaseData]) => (
                              <div key={phase} className="px-4 py-3 border-t border-border/20">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge className={`text-xs ${PHASE_COLOR[phase] || 'bg-secondary/50'}`}>
                                    {PHASE_LABEL[phase] || phase}
                                  </Badge>
                                  <span className="text-xs font-semibold text-muted-foreground">{fmt(phaseData.totalHours)}</span>
                                </div>
                                <div className="space-y-1.5">
                                  {phaseData.entries
                                    .sort((a, b) => b.date_worked.localeCompare(a.date_worked))
                                    .map((entry, i) => (
                                    <div key={i} className="flex items-start justify-between text-xs gap-2 pl-2">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-foreground font-medium">{entry.deliverable_title || 'Deliverable'}</span>
                                        {entry.description && (
                                          <span className="text-muted-foreground ml-2">— {entry.description}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-muted-foreground">{entry.date_worked}</span>
                                        <span className="text-primary font-semibold">{fmt(entry.hours)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}