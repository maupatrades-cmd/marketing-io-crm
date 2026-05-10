import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEADER_IMG = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/9ca95056f_header.jpg';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:0;margin:0;background:#080c1a;position:relative;">
  <img src="${HEADER_IMG}" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;" />
  <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(8,12,26,0.45);display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:16px;">
    <img src="${LOGO_URL}" alt="Marketing iO" height="40" style="height:40px;width:auto;display:block;margin:0 auto;filter:brightness(0) invert(1) drop-shadow(0 0 8px rgba(255,255,255,0.7));" />
    <div style="margin-top:8px;font-size:12px;font-style:italic;letter-spacing:1.5px;color:rgba(255,255,255,0.95);">Too good to stay hidden.</div>
  </div>
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:4px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">${bodyHtml}</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" height="28" style="height:28px;width:auto;display:block;margin:0 auto 12px auto;filter:brightness(0) invert(1);" />
  <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Marketing iO (Pty) Ltd · CIPC 2026303502</div>
  <div style="font-size:12px;color:#94a3b8;line-height:1.8;">75 Marshall Street, Polokwane 0699<br>☎ 010 102 0534 &bull; <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { contract_id, client_id } = await req.json();

  if (!contract_id || !client_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const contract = await base44.asServiceRole.entities.Contract.filter({ id: contract_id });
    const client = await base44.asServiceRole.entities.Client.filter({ id: client_id });

    if (!contract?.[0] || !client?.[0]) {
      return Response.json({ success: true, message: 'Contract or client not found' }, { status: 200 });
    }

    const c = client[0];
    const cont = contract[0];

    let adminName = 'Marketing iO Team';
    if (cont.assigned_account_admin_id) {
      const admin = await base44.asServiceRole.entities.User.filter({ id: cont.assigned_account_admin_id });
      if (admin?.[0]) {
        adminName = admin[0].full_name || admin[0].email;
      }
    }

    const packageLabel = {
      ignite: 'Ignite',
      accelerate: 'Accelerate',
      dominate: 'Dominate',
      street_pulse: 'Street Pulse',
      township_pulse: 'Township Pulse'
    }[cont.package] || cont.package;

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Hi ${c.contact_person || 'there'},</p>
      
      <p style="margin:0 0 16px 0;">Welcome to <strong>Marketing iO</strong>! We're thrilled to have <strong>${c.business_name}</strong> on board.</p>
      
      <p style="margin:0 0 16px 0;">Your contract for the <strong>${packageLabel}</strong> package has been signed and is now active. Here's what happens next:</p>
      
      <div style="background:#f1f5f9;padding:20px;border-radius:8px;margin:16px 0;">
        <p style="margin:0 0 12px 0;"><strong style="color:#a764e6;">📋 Next Steps</strong></p>
        <ol style="margin:0;padding:0 0 0 20px;color:#475569;">
          <li style="margin:0 0 8px 0;">Your account admin <strong>${adminName}</strong> will reach out within 24 hours</li>
          <li style="margin:0 0 8px 0;">Complete your onboarding form to get started</li>
          <li style="margin:0 0 8px 0;">We'll generate your first set of deliverables</li>
          <li style="margin:0;">You'll receive updates on your portal as work progresses</li>
        </ol>
      </div>
      
      <p style="margin:0 0 16px 0;"><strong>Your Dashboard:</strong></p>
      <p style="margin:0 0 16px 0;"><a href="https://app.marketingio.co.za/client-portal" style="background:#a764e6;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Access Your Portal →</a></p>
      
      <p style="margin:0 0 16px 0;">Questions? Reply to this email or contact your admin directly.</p>
      
      <p style="margin:0;">Let's grow your business together! 🚀</p>`;

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey && c.email) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: 'Marketing iO Team <hello@marketingio.co.za>',
        to: c.email,
        subject: `Welcome to Marketing iO, ${c.business_name}! 🚀`,
        html: wrapEmail(bodyHtml)
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[send-welcome-email]', err);
    return Response.json({ success: true });
  }
});