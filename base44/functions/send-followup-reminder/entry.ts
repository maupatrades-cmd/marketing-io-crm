import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto;" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">${bodyHtml}</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="140" style="width:140px;height:auto;display:block;margin:0 auto 12px auto;" />
  <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Marketing iO (Pty) Ltd · CIPC 2026303502</div>
  <div style="font-size:12px;color:#94a3b8;line-height:1.8;">75 Marshall Street, Polokwane 0699<br>☎ 010 102 0534 &bull; <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { contract_id, client_id, days_since_signing = 3 } = await req.json();

  if (!contract_id || !client_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const contract = await base44.asServiceRole.entities.Contract.filter({ id: contract_id });
    const client = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const onboarding = await base44.asServiceRole.entities.ClientOnboarding.filter({ client_id });

    if (!contract?.[0] || !client?.[0]) {
      return Response.json({ success: true });
    }

    const c = client[0];
    const cont = contract[0];
    const onb = Array.isArray(onboarding) ? onboarding[0] : onboarding;

    let adminName = 'Marketing iO Team';
    if (cont.assigned_account_admin_id) {
      const admin = await base44.asServiceRole.entities.User.filter({ id: cont.assigned_account_admin_id });
      if (admin?.[0]) {
        adminName = admin[0].full_name || admin[0].email;
      }
    }

    // Determine message based on days since signing
    let subject, bodyHtml;

    if (days_since_signing === 3) {
      subject = `Quick Check-In: Let's Get You Started 🚀`;
      bodyHtml = `
        <p style="margin:0 0 16px 0;">Hi ${c.contact_person || 'there'},</p>
        <p style="margin:0 0 16px 0;">It's been a few days since we started working together! We want to make sure you're all set.</p>
        <p style="margin:0 0 16px 0;"><strong>Have you:</strong></p>
        <ul style="margin:0 0 16px 0;padding:0 0 0 20px;">
          <li style="margin:0 0 8px 0;">Logged into your portal?</li>
          <li style="margin:0 0 8px 0;">Completed your onboarding form?</li>
          <li style="margin:0 0 8px 0;">Shared your brand assets?</li>
        </ul>
        <p style="margin:0 0 16px 0;">If not, no worries! <a href="https://app.marketingio.co.za/client-portal" style="color:#a764e6;text-decoration:underline;">Visit your portal now</a> or reply to this email if you need help.</p>`;
    } else if (days_since_signing === 7) {
      subject = `Your First Week With Marketing iO 📊`;
      bodyHtml = `
        <p style="margin:0 0 16px 0;">Hi ${c.contact_person || 'there'},</p>
        <p style="margin:0 0 16px 0;">Happy to have worked with you for a week! Here's what we've been preparing:</p>
        <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0 0 8px 0;"><strong style="color:#a764e6;">✓ Setup Phase Progress</strong></p>
          <p style="margin:0 0 12px 0;font-size:14px;color:#475569;">${onb ? `Phase: ${onb.current_phase || 'In Progress'}` : 'Onboarding started'}</p>
          <p style="margin:0;"><a href="https://app.marketingio.co.za/client-portal" style="color:#a764e6;text-decoration:underline;">View your progress →</a></p>
        </div>
        <p style="margin:0 0 16px 0;">Your dedicated admin ${adminName} is standing by if you have any questions or need anything.</p>`;
    } else {
      subject = `We're Here to Help! 💬`;
      bodyHtml = `
        <p style="margin:0 0 16px 0;">Hi ${c.contact_person || 'there'},</p>
        <p style="margin:0 0 16px 0;">Just a friendly reminder that your ${c.business_name} account is active and ready to grow.</p>
        <p style="margin:0 0 16px 0;">Need anything? Reach out directly:</p>
        <ul style="margin:0 0 16px 0;padding:0;">
          <li style="margin:0 0 8px 0;">📧 <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">Email us</a></li>
          <li style="margin:0 0 8px 0;">💬 <a href="https://app.marketingio.co.za/client-portal" style="color:#a764e6;">Message in your portal</a></li>
          <li style="margin:0;">📞 Call 010 102 0534</li>
        </ul>`;
    }

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey && c.email) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: 'Marketing iO Team <hello@marketingio.co.za>',
        to: c.email,
        subject,
        html: wrapEmail(bodyHtml)
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[send-followup-reminder]', err);
    return Response.json({ success: true });
  }
});