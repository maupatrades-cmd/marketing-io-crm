import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEADER_IMG = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/9ca95056f_header.jpg';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396498/marketing_io_email_header_zmlvtg.jpg" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396673/marketing_io_email_footer_b9dkwm.jpg" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
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