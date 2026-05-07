import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * A single-purpose checkbox that ticks a task done/undone instantly.
 * Usage: <TaskCheckbox task={task} onUpdate={updatedTask => ...} />
 */
export default function TaskCheckbox({ task, onUpdate, disabled }) {
  const [saving, setSaving] = useState(false);

  const toggle = async (checked) => {
    setSaving(true);
    const updates = checked
      ? { status: "done", completed_at: new Date().toISOString() }
      : { status: "open", completed_at: null };

    await base44.entities.Task.update(task.id, updates);

    // Log to activity log if task has a client. Routed via the legacy
    // log-client-activity server function — Client Portal PR A locks
    // ClientActivityLog create RLS to service-role only.
    if (task.client_id && checked) {
      base44.functions.invoke('log-client-activity', {
        client_id: task.client_id,
        client_name: task.client_name,
        title: `Task completed: ${task.title}`,
        source: 'system',
      }).catch(() => {});
    }

    onUpdate?.({ ...task, ...updates });
    setSaving(false);
  };

  return (
    <Checkbox
      checked={task.status === "done"}
      onCheckedChange={toggle}
      disabled={disabled || saving}
      className="shrink-0"
    />
  );
}