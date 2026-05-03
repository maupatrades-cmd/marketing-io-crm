import { useState } from 'react';
import { format, differenceInDays, isPast } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DeliverableTimeline({ deliverables, onRequestUpdate }) {
  const activeDeliverables = deliverables.filter(d => 
    ['in_progress', 'awaiting_client'].includes(d.status)
  );

  if (activeDeliverables.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold text-foreground">Active Deliverables Timeline</h2>
        <p className="text-muted-foreground">Track your upcoming milestones and deadlines</p>
      </div>
      <div className="h-1 w-20 gradient-bg rounded-full" />
      
      <div className="space-y-4 mt-6">
        {activeDeliverables.map(d => {
          const daysUntilDue = differenceInDays(new Date(d.due_date), Date.now());
          const isOverdue = isPast(new Date(d.due_date));
          const isUrgent = daysUntilDue < 3 && daysUntilDue >= 0;
          const progress = d.status === 'in_progress' ? 65 : d.status === 'awaiting_client' ? 85 : 50;

          return (
            <div key={d.id} className="glass rounded-lg p-5 border border-border/50 hover:border-primary/30 transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{d.title}</h3>
                    <Badge 
                      className={`text-xs ${
                        d.status === 'in_progress' 
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-accent/15 text-accent border-accent/30'
                      }`}
                    >
                      {d.status === 'in_progress' ? '🔨 In Production' : '👁️ Your Review'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.phase ? `${d.phase.replace(/_/g, ' ')} • ` : ''}
                    Phase: {d.phase?.replace(/_/g, ' ') || 'One-off'}
                  </p>
                </div>
                <button
                  onClick={() => onRequestUpdate(d)}
                  className="p-1.5 hover:bg-primary/10 rounded-lg transition text-muted-foreground hover:text-primary"
                  title="Request update from team"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">Progress</span>
                  <span className="text-xs font-semibold text-foreground">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full gradient-bg transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Timeline Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 ${isOverdue ? 'text-destructive' : isUrgent ? 'text-warning' : 'text-info'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className={`text-sm font-medium ${isOverdue ? 'text-destructive' : isUrgent ? 'text-warning' : 'text-foreground'}`}>
                      {format(new Date(d.due_date), 'd MMM yyyy')}
                      {!isOverdue && daysUntilDue !== null && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({daysUntilDue === 0 ? 'Today' : daysUntilDue === 1 ? 'Tomorrow' : `${daysUntilDue} days`})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {d.submitted_date && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">Submitted</p>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(d.submitted_date), 'd MMM')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Message */}
              {isOverdue && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-destructive/10 rounded border border-destructive/20">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-xs text-destructive">This deliverable is overdue. Request an update.</p>
                </div>
              )}
              {isUrgent && !isOverdue && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-warning/10 rounded border border-warning/20">
                  <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />
                  <p className="text-xs text-warning">Due soon. Check in with your team.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}