import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td align="center" valign="middle" background="https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg" bgcolor="#0f172a" style="background-color:#0f172a;background-image:url('https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg');background-position:center center;background-size:cover;background-repeat:no-repeat;padding:60px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="280" style="width:280px;max-width:80%;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 0 24px rgba(167,100,230,0.85)) drop-shadow(0 0 48px rgba(236,72,153,0.55));" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">${bodyHtml}</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="140" style="width:140px;height:auto;display:block;margin:0 auto 12px auto;" />
  <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Marketing iO (Pty) Ltd</div>
  <div style="font-size:12px;color:#94a3b8;"><a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
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