import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // Get all active onboarding progress records
    const allProgress = await base44.asServiceRole.entities.ClientOnboardingProgress.filter({
      status: "in_progress"
    });

    const progressArray = Array.isArray(allProgress) ? allProgress : [];
    console.log('[send-onboarding-progress-email-batch] Found', progressArray.length, 'active onboardings');

    let sent = 0;
    let skipped = 0;

    // Send progress email to each client
    for (const progressRecord of progressArray) {
      try {
        const result = await base44.functions.invoke('send-onboarding-progress-email', {
          client_id: progressRecord.client_id
        });

        if (result.data?.success) {
          sent++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Error sending progress email for client ${progressRecord.client_id}:`, err);
        skipped++;
      }
    }

    console.log('[send-onboarding-progress-email-batch] Complete:', { sent, skipped });
    return Response.json({ sent, skipped, total: progressArray.length }, { status: 200 });
  } catch (err) {
    console.error('[send-onboarding-progress-email-batch] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});