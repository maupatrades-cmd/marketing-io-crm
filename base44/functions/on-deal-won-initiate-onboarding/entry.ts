import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { event, data } = await req.json();

  if (event?.type !== 'update' || !data?.id) {
    return Response.json({ error: 'Invalid event' }, { status: 400 });
  }

  try {
    const dealId = data.id;

    // Get the deal
    const deal = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    if (!deal?.[0]) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    const dealRecord = Array.isArray(deal) ? deal[0] : deal;

    // Only proceed if deal is won
    if (dealRecord.stage !== 'closed_won') {
      console.log('[on-deal-won] Deal not won, skipping onboarding');
      return Response.json({ skipped: true }, { status: 200 });
    }

    console.log('[on-deal-won] Deal won:', dealId);

    // Initiate onboarding
    const result = await base44.functions.invoke('initiate-onboarding', {
      deal_id: dealId
    });

    if (result.data?.success) {
      // Send notification to client
      const clientList = await base44.asServiceRole.entities.Client.filter({ id: dealRecord.client_id });
      const client = Array.isArray(clientList) ? clientList[0] : clientList;

      if (client?.email) {
        const userList = await base44.asServiceRole.entities.User.filter({ email: client.email });
        const user = Array.isArray(userList) ? userList[0] : userList;

        if (user) {
          await base44.asServiceRole.entities.ClientNotification.create({
            client_id: client.id,
            notification_type: 'onboarding_step_complete',
            title: 'Your Setup Journey Begins',
            body: `Welcome to onboarding! Complete the checklist to get your ${dealRecord.package} package live.`,
            action_url: '/client-onboarding',
            is_read: false
          });
        }
      }

      console.log('[on-deal-won] Onboarding initiated successfully');
      return Response.json({ success: true }, { status: 200 });
    } else {
      console.log('[on-deal-won] Onboarding already exists');
      return Response.json({ skipped: true }, { status: 200 });
    }
  } catch (err) {
    console.error('[on-deal-won] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});