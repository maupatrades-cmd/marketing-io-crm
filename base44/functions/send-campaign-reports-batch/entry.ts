import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Fetch all active clients
    const clients = await base44.asServiceRole.entities.Client.filter(
      { status: 'active' },
      '-created_date',
      500
    );

    if (!clients || clients.length === 0) {
      return Response.json({ success: true, message: 'No active clients' });
    }

    // Generate reports for all clients
    const results = await Promise.allSettled(
      clients.map(client =>
        base44.functions.invoke('generate-campaign-report', {
          client_id: client.id
        })
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[send-campaign-reports-batch] Sent to ${successful} clients, ${failed} failed`);

    return Response.json({
      success: true,
      sent: successful,
      failed
    });
  } catch (err) {
    console.error('[send-campaign-reports-batch]', err);
    return Response.json({ success: true });
  }
});