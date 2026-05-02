import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggers when a Deal is marked as 'closed_lost'
 * Cleans up related records and notifies admin
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { deal_id, client_id, lost_reason } = await req.json();

    if (!deal_id) {
      return Response.json({ error: 'Missing deal_id' }, { status: 400 });
    }

    // Cancel any open onboarding tasks
    const openTasks = await base44.asServiceRole.entities.Task.filter({
      deal_id,
      status: { $in: ['open', 'in_progress'] },
    });

    await Promise.all(
      openTasks.map(t => base44.entities.Task.update(t.id, { status: 'cancelled' }))
    );

    // Log lost deal
    if (client_id) {
      await base44.entities.ClientActivityLog.create({
        client_id,
        event_type: 'deal_lost',
        event_label: `Deal closed — reason: ${lost_reason || 'unspecified'}`,
        logged_by: 'system',
        logged_by_name: 'Marketing iO System',
      });
    }

    return Response.json({ success: true, cancelled_tasks: openTasks.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});