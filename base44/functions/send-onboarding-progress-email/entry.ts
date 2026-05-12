import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { client_id } = await req.json();

  if (!client_id) {
    return Response.json({ error: 'client_id required' }, { status: 400 });
  }

  try {
    // Get client
    const client = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    if (!client?.[0]) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientRecord = Array.isArray(client) ? client[0] : client;

    // Get active onboarding progress
    const progress = await base44.asServiceRole.entities.ClientOnboardingProgress.filter({
      client_id: client_id,
      status: "in_progress"
    });

    if (!progress?.[0]) {
      console.log('[send-onboarding-progress] No active onboarding for client:', client_id);
      return Response.json({ skipped: true }, { status: 200 });
    }

    const progressRecord = Array.isArray(progress) ? progress[0] : progress;

    // Get steps
    const steps = await base44.asServiceRole.entities.OnboardingStep.filter({
      client_id: client_id,
      deal_id: progressRecord.deal_id
    });

    const stepsArray = Array.isArray(steps) ? steps : [];
    const completed = stepsArray.filter(s => s.is_completed).length;

    // Build progress bar HTML
    let progressBar = '';
    for (let i = 0; i < 10; i++) {
      const pct = ((i + 1) * 10);
      const filled = progressRecord.progress_percentage >= pct;
      progressBar += `<div style="display:inline-block;width:8%;height:8px;margin-right:2%;background:${filled ? '#a764e6' : '#e0e0e0'};border-radius:2px;"></div>`;
    }

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Hi ${clientRecord.contact_person},</p>
      <p style="margin:0 0 16px 0;">Great progress on your setup! Here's where you stand:</p>
      
      <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;">
        <p style="margin:0 0 8px 0;"><strong>Progress: ${progressRecord.progress_percentage}% Complete</strong></p>
        <div style="margin:8px 0;">
          ${progressBar}
        </div>
        <p style="margin:8px 0 0 0;font-size:12px;color:#64748b;">${completed} of ${stepsArray.length} steps done</p>
      </div>

      <p style="margin:16px 0 8px 0;"><strong>Completed:</strong></p>
      <ul style="margin:0 0 16px 0;padding-left:20px;">
        ${stepsArray.filter(s => s.is_completed).map(s => 
          `<li style="margin:4px 0;"><strong>${s.title}</strong></li>`
        ).join('')}
      </ul>

      <p style="margin:16px 0 8px 0;"><strong>Next Steps:</strong></p>
      <ul style="margin:0 0 16px 0;padding-left:20px;">
        ${stepsArray.filter(s => !s.is_completed).slice(0, 3).map(s => 
          `<li style="margin:4px 0;">${s.title} ${s.required ? '<strong style="color:red;">*</strong>' : ''}</li>`
        ).join('')}
      </ul>

      <p style="margin:16px 0;"><a href="https://app.marketingio.co.za/client-onboarding" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:white;text-decoration:none;border-radius:6px;font-weight:600;">Continue Your Setup</a></p>
      
      <p style="margin:16px 0 0 0;font-size:12px;color:#94a3b8;">Any questions? Reply to this email anytime.</p>`;

    // Get user email
    const user = await base44.asServiceRole.entities.User.filter({ email: clientRecord.email });
    const userRecord = Array.isArray(user) ? user[0] : user;

    if (!userRecord?.email) {
      console.log('[send-onboarding-progress] No user email found for client:', client_id);
      return Response.json({ skipped: true }, { status: 200 });
    }

    // Send email
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[send-onboarding-progress] RESEND_API_KEY not set');
      return Response.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: userRecord.email,
      subject: `Your Setup Progress: ${progressRecord.progress_percentage}% Complete`,
      html: wrapEmail(bodyHtml)
    });

    if (result.error) {
      console.error('[send-onboarding-progress] Send failed:', result.error);
      return Response.json({ error: 'Email send failed' }, { status: 500 });
    }

    console.log('[send-onboarding-progress] Email sent:', result.id);
    return Response.json({ success: true, email_sent_to: userRecord.email }, { status: 200 });
  } catch (err) {
    console.error('[send-onboarding-progress] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});