import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Star, Award, MessageSquare, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';

function StarDisplay({ rating, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${sz} ${s <= Math.round(rating) ? 'fill-warning text-warning' : 'text-muted-foreground/25'}`} />
      ))}
    </div>
  );
}

function RatingBar({ value, max = 5 }) {
  const pct = (value / max) * 100;
  const color = value >= 4.5 ? 'bg-success' : value >= 3.5 ? 'bg-primary' : value >= 2.5 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-secondary/50 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold w-6 text-right" style={{ color: pct >= 80 ? '#10b981' : pct >= 60 ? '#a764e6' : '#f59e0b' }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

const PHASE_LABEL = { setup: 'Setup', monthly_recurring: 'Monthly', once_off: 'Once-off' };
const PHASE_COLOR = {
  setup: 'bg-primary/15 text-primary',
  monthly_recurring: 'bg-info/15 text-info',
  once_off: 'bg-accent/15 text-accent',
};

export default function DeliverableQuality() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('all');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    base44.entities.DeliverableFeedback.list('-submitted_at', 2000).then(data => {
      setFeedback(data);
      setLoading(false);
    });
  }, []);

  const filterByPeriod = (item) => {
    if (periodFilter === 'all') return true;
    const d = new Date(item.submitted_at || item.created_date);
    const now = new Date();
    if (periodFilter === 'this_month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (periodFilter === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth();
    }
    if (periodFilter === 'this_year') return d.getFullYear() === now.getFullYear();
    return true;
  };

  const filtered = feedback.filter(filterByPeriod);

  // Aggregate by staff
  const byStaff = {};
  filtered.forEach(fb => {
    const sid = fb.staff_id || '__unassigned__';
    if (!byStaff[sid]) byStaff[sid] = { name: fb.staff_name || 'Unassigned', totalRating: 0, count: 0, phases: {}, deliverables: {} };
    byStaff[sid].totalRating += fb.rating;
    byStaff[sid].count += 1;

    const phase = fb.phase || 'setup';
    if (!byStaff[sid].phases[phase]) byStaff[sid].phases[phase] = { totalRating: 0, count: 0 };
    byStaff[sid].phases[phase].totalRating += fb.rating;
    byStaff[sid].phases[phase].count += 1;

    const did = fb.deliverable_id;
    if (!byStaff[sid].deliverables[did]) byStaff[sid].deliverables[did] = { title: fb.deliverable_title || 'Deliverable', client: fb.client_name || '', entries: [] };
    byStaff[sid].deliverables[did].entries.push(fb);
  });

  const staffRows = Object.entries(byStaff)
    .map(([sid, s]) => ({ sid, ...s, avg: s.count ? s.totalRating / s.count : 0 }))
    .sort((a, b) => b.avg - a.avg);

  const overallAvg = filtered.length ? filtered.reduce((s, f) => s + f.rating, 0) / filtered.length : 0;
  const toggle = k => setExpanded(p => ({ ...p, [k]: !p[k] }));

  if (loading) return (
    <AppLayout title="Deliverable Quality">
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title="Deliverable Quality" subtitle="Client satisfaction ratings aggregated by staff member">
      <div className="space-y-6">

        {/* Stats row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex flex-wrap gap-3">
            <Card className="glass px-4 py-3 flex items-center gap-3">
              <Star className="w-5 h-5 fill-warning text-warning" />
              <div>
                <p className="text-xl font-bold text-warning">{overallAvg ? overallAvg.toFixed(1) : '—'}</p>
                <p className="text-xs text-muted-foreground">Overall Avg</p>
              </div>
            </Card>
            <Card className="glass px-4 py-3 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xl font-bold text-primary">{filtered.length}</p>
                <p className="text-xs text-muted-foreground">Ratings</p>
              </div>
            </Card>
            <Card className="glass px-4 py-3 flex items-center gap-3">
              <Award className="w-5 h-5 text-success" />
              <div>
                <p className="text-xl font-bold text-success">{staffRows.length}</p>
                <p className="text-xs text-muted-foreground">Staff Rated</p>
              </div>
            </Card>
            <Card className="glass px-4 py-3 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-info" />
              <div>
                <p className="text-xl font-bold text-info">{filtered.filter(f => f.rating >= 4).length}</p>
                <p className="text-xs text-muted-foreground">4–5 ★ Ratings</p>
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
              No feedback ratings found for the selected period.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {staffRows.map(({ sid, name, avg, count, phases, deliverables }) => {
              const isOpen = expanded[sid];
              const medal = avg >= 4.5 ? '🥇' : avg >= 4 ? '🥈' : avg >= 3 ? '🥉' : '';
              return (
                <Card key={sid} className="glass">
                  <CardHeader className="cursor-pointer select-none py-4" onClick={() => toggle(sid)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold">
                          {(name[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-base">{medal} {name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{count} rating{count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:block w-36">
                          <RatingBar value={avg} />
                        </div>
                        <div className="text-right">
                          <StarDisplay rating={avg} />
                          <p className="text-xs text-muted-foreground mt-0.5">{avg.toFixed(1)} / 5.0</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {isOpen && (
                    <CardContent className="pt-0 pb-4">
                      <div className="space-y-4 ml-7">
                        {/* Phase breakdown */}
                        <div className="flex flex-wrap gap-3">
                          {Object.entries(phases).map(([phase, pd]) => (
                            <div key={phase} className="glass rounded-lg px-3 py-2 flex items-center gap-3">
                              <Badge className={`text-xs ${PHASE_COLOR[phase] || 'bg-secondary/50'}`}>
                                {PHASE_LABEL[phase] || phase}
                              </Badge>
                              <StarDisplay rating={pd.totalRating / pd.count} />
                              <span className="text-xs text-muted-foreground">{(pd.totalRating / pd.count).toFixed(1)} ({pd.count})</span>
                            </div>
                          ))}
                        </div>

                        {/* Individual deliverable ratings */}
                        <div className="border border-border/40 rounded-lg overflow-hidden">
                          <div className="bg-secondary/20 px-4 py-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deliverable Ratings</p>
                          </div>
                          <div className="divide-y divide-border/20">
                            {Object.entries(deliverables).map(([did, del]) => {
                              const delAvg = del.entries.reduce((s, e) => s + e.rating, 0) / del.entries.length;
                              return (
                                <div key={did} className="px-4 py-3">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">{del.title}</p>
                                      <p className="text-xs text-muted-foreground">{del.client}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <StarDisplay rating={delAvg} />
                                      <span className="text-xs font-bold text-foreground">{delAvg.toFixed(1)}</span>
                                    </div>
                                  </div>
                                  {del.entries.filter(e => e.comment).map((e, i) => (
                                    <p key={i} className="text-xs text-muted-foreground italic mt-1 pl-2 border-l-2 border-border/40">
                                      "{e.comment}"
                                    </p>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
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