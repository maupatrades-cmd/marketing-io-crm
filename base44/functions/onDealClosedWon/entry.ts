import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Triggers when a Deal is marked as 'closed_won'
 * Orchestrates: onboarding tasks, welcome pack, portal notifications
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { deal_id, client_id, client_name, package: pkg } = await req.json();

    if (!deal_id || !client_id) {
      return Response.json({ error: 'Missing deal_id or client_id' }, { status: 400 });
    }

    // 1. Create initial onboarding tasks
    const taskTemplates = [
      { title: 'File signed contract in drive', priority: 'high', due_offset: 1 },
      { title: 'Send welcome pack email', priority: 'high', due_offset: 0 },
      { title: 'Schedule onboarding call', priority: 'high', due_offset: 3 },
      { title: 'Follow up on form completion', priority: 'medium', due_offset: 7 },
      { title: 'Collect brand assets', priority: 'medium', due_offset: 10 },
      { title: 'Setup deliverables timeline', priority: 'medium', due_offset: 14 },
    ];

    const tasks = await Promise.all(
      taskTemplates.map(t => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + t.due_offset);
        return base44.entities.Task.create({
          title: t.title,
          client_id,
          client_name,
          deal_id,
          status: 'open',
          priority: t.priority,
          due_date: dueDate.toISOString().split('T')[0],
          auto_generated: true,
        });
      })
    );

    // 2. Create ClientOnboarding record to track phases
    const clientOnboarding = await base44.entities.ClientOnboarding.create({
      deal_id,
      client_id,
      client_name,
      current_phase: 'phase1_contract_signed',
      overall_status: 'in_progress',
      deal_won_date: new Date().toISOString().split('T')[0],
    });

    // 3. Create portal notifications for client
    const notifications = await Promise.all([
      base44.entities.ClientNotification.create({
        client_id,
        notification_type: 'onboarding_step_complete',
        title: 'Welcome to Marketing iO!',
        body: 'Your agreement is signed. Check your email for next steps and your client portal access.',
        related_entity_type: 'ClientOnboarding',
        related_entity_id: clientOnboarding.id,
      }),
      base44.entities.ClientNotification.create({
        client_id,
        notification_type: 'system_update',
        title: 'Onboarding Form Ready',
        body: 'Please complete your onboarding form to help us understand your business better.',
        action_url: '/client/onboarding-form',
        related_entity_type: 'ClientOnboardingSubmission',
      }),
    ]);

    // 4. Trigger welcome pack email (reuse existing function)
    try {
      await base44.asServiceRole.functions.invoke('sendWelcomePack', { client_id, deal_id });
    } catch (emailErr) {
      console.warn('Welcome pack send failed (non-blocking):', emailErr.message);
    }

    // 5. Log activity
    await base44.entities.ClientActivityLog.create({
      client_id,
      event_type: 'onboarding_started',
      event_label: `Onboarding initiated for ${pkg || 'standard'} package`,
      logged_by: 'system',
      logged_by_name: 'Marketing iO System',
    });

    return Response.json({
      success: true,
      tasks: tasks.map(t => ({ id: t.id, title: t.title })),
      onboarding_id: clientOnboarding.id,
      notifications: notifications.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});