import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Clock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function TimeLogModal({ deliverable, onLogged, onClose }) {
  const { user } = useAuth();
  const [hours, setHours] = useState('');
  const [dateWorked, setDateWorked] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const h = parseFloat(hours);
    if (!h || h <= 0 || h > 24) {
      setError('Enter a valid number of hours (0.1 – 24).');
      return;
    }
    if (!dateWorked) {
      setError('Please select a date.');
      return;
    }
    setSaving(true);
    await base44.entities.TimeLog.create({
      deliverable_id: deliverable.id,
      deliverable_title: deliverable.title,
      client_id: deliverable.client_id,
      client_name: deliverable.client_name,
      staff_id: user?.id,
      staff_name: user?.full_name || user?.email,
      phase: deliverable.phase,
      hours: h,
      date_worked: dateWorked,
      description: description.trim() || null,
    });
    setSaving(false);
    onLogged();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Log Time
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{deliverable.client_name} — {deliverable.title}</p>
        </DialogHeader>

        <div className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Hours</Label>
              <Input
                type="number"
                min="0.1"
                max="24"
                step="0.25"
                placeholder="e.g. 1.5"
                value={hours}
                onChange={e => { setHours(e.target.value); setError(''); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date Worked</Label>
              <Input
                type="date"
                value={dateWorked}
                onChange={e => setDateWorked(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea
              placeholder="Brief description of what was done…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Log Time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}