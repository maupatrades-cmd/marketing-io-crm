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

    // Log to activity log if task has a client
    if (task.client_id && checked) {
      base44.entities.ClientActivityLog.create({
        client_id: task.client_id,
        client_name: task.client_name,
        event_type: "task_completed",
        event_label: `Task completed: ${task.title}`,
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