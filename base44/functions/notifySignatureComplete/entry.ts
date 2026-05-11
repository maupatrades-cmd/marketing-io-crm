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

async function sendEmail(to, subject, bodyHtml) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) { console.error('[notifySignatureComplete] RESEND_API_KEY missing'); return; }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to, subject, html: wrapEmail(bodyHtml)
  });
  if (result.error) console.error('[notifySignatureComplete] Email failed:', result.error);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: accept session token from header or body
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) {
      // Try session token fallback for service-role calls
      const body = await req.json().catch(() => ({}));
      const { contract_id } = body;

      if (!contract_id) {
        return Response.json({ error: 'contract_id required' }, { status: 400 });
      }

      const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contract_id });
      if (!contracts || contracts.length === 0) {
        return Response.json({ error: 'Contract not found' }, { status: 404 });
      }
      const contract = contracts[0];
      const clients = await base44.asServiceRole.entities.Client.filter({ id: contract.client_id });
      const client = clients[0];
      if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

      const signatures = await base44.asServiceRole.entities.ContractSignature.filter({ contract_id, signer_role: 'client' });
      const clientSignature = signatures[0];

      // Notify client
      const clientBodyHtml = `
        <p style="margin:0 0 16px 0;">Dear ${client.contact_person || client.business_name},</p>
        <p style="margin:0 0 16px 0;">We are pleased to confirm that your Master Service Agreement has been successfully signed.</p>
        <p style="margin:0 0 8px 0;"><strong>Package:</strong> ${contract.package}</p>
        <p style="margin:0 0 8px 0;"><strong>Setup Fee:</strong> R${(contract.setup_fee || 0).toLocaleString()}</p>
        <p style="margin:0 0 8px 0;"><strong>Monthly Retainer:</strong> R${(contract.monthly_retainer || 0).toLocaleString()}</p>
        <p style="margin:0 0 16px 0;"><strong>Start Date:</strong> ${contract.contract_start_date || 'To be confirmed'}</p>
        ${clientSignature ? `<p style="margin:0 0 16px 0;">Signed on: ${new Date(clientSignature.signed_date).toLocaleDateString('en-ZA')}</p>` : ''}
        <p style="margin:0 0 16px 0;">The next step in your onboarding journey will be initiated shortly.</p>
        <p style="margin:0;">Questions? <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a></p>`;

      await sendEmail(client.email, `Your Contract Has Been Signed - ${contract.package}`, clientBodyHtml);

      // Notify admins
      const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      for (const admin of adminUsers) {
        const adminBodyHtml = `
          <p style="margin:0 0 16px 0;">Hi ${admin.full_name},</p>
          <p style="margin:0 0 16px 0;">A contract has been successfully signed.</p>
          <p style="margin:0 0 8px 0;"><strong>Business:</strong> ${client.business_name}</p>
          <p style="margin:0 0 8px 0;"><strong>Contact:</strong> ${client.contact_person}</p>
          <p style="margin:0 0 8px 0;"><strong>Package:</strong> ${contract.package}</p>
          <p style="margin:0 0 8px 0;"><strong>Setup Fee:</strong> R${(contract.setup_fee || 0).toLocaleString()}</p>
          <p style="margin:0 0 16px 0;"><strong>Monthly Retainer:</strong> R${(contract.monthly_retainer || 0).toLocaleString()}</p>
          ${clientSignature ? `<p style="margin:0 0 16px 0;">Signed by: ${clientSignature.signer_full_name} on ${new Date(clientSignature.signed_date).toLocaleDateString('en-ZA')}</p>` : ''}`;
        await sendEmail(admin.email, `Contract Signed: ${client.business_name} - ${contract.package}`, adminBodyHtml).catch(() => {});
      }

      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id: contract.client_id,
        client_name: contract.client_name,
        event_type: 'milestone',
        event_label: `Contract Signed - ${contract.package}`,
        logged_by: 'system',
        logged_by_name: 'System'
      });

      return Response.json({ success: true, message: 'Signature notification emails sent', contract_id, client_email: client.email, admins_notified: adminUsers.length });
    }

    // Authenticated path
    const body2 = await req.clone().json().catch(() => ({}));
    const { contract_id } = body2;

    if (!contract_id) {
      return Response.json({ error: 'contract_id required' }, { status: 400 });
    }

    const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contract_id });
    if (!contracts || contracts.length === 0) {
      return Response.json({ error: 'Contract not found' }, { status: 404 });
    }
    const contract = contracts[0];
    const clients = await base44.asServiceRole.entities.Client.filter({ id: contract.client_id });
    const client = clients[0];
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const signatures = await base44.asServiceRole.entities.ContractSignature.filter({ contract_id, signer_role: 'client' });
    const clientSignature = signatures[0];

    const clientBodyHtml = `
      <p style="margin:0 0 16px 0;">Dear ${client.contact_person || client.business_name},</p>
      <p style="margin:0 0 16px 0;">We are pleased to confirm that your Master Service Agreement has been successfully signed.</p>
      <p style="margin:0 0 8px 0;"><strong>Package:</strong> ${contract.package}</p>
      <p style="margin:0 0 8px 0;"><strong>Setup Fee:</strong> R${(contract.setup_fee || 0).toLocaleString()}</p>
      <p style="margin:0 0 8px 0;"><strong>Monthly Retainer:</strong> R${(contract.monthly_retainer || 0).toLocaleString()}</p>
      <p style="margin:0 0 16px 0;"><strong>Start Date:</strong> ${contract.contract_start_date || 'To be confirmed'}</p>
      ${clientSignature ? `<p style="margin:0 0 16px 0;">Signed on: ${new Date(clientSignature.signed_date).toLocaleDateString('en-ZA')}</p>` : ''}
      <p style="margin:0;">Questions? <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a></p>`;

    await sendEmail(client.email, `Your Contract Has Been Signed - ${contract.package}`, clientBodyHtml);

    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of adminUsers) {
      const adminBodyHtml = `
        <p style="margin:0 0 16px 0;">Hi ${admin.full_name},</p>
        <p style="margin:0 0 16px 0;">A contract has been successfully signed.</p>
        <p style="margin:0 0 8px 0;"><strong>Business:</strong> ${client.business_name}</p>
        <p style="margin:0 0 8px 0;"><strong>Package:</strong> ${contract.package}</p>
        <p style="margin:0 0 8px 0;"><strong>Setup Fee:</strong> R${(contract.setup_fee || 0).toLocaleString()}</p>
        <p style="margin:0 0 8px 0;"><strong>Monthly Retainer:</strong> R${(contract.monthly_retainer || 0).toLocaleString()}</p>
        ${clientSignature ? `<p style="margin:0 0 16px 0;">Signed by: ${clientSignature.signer_full_name} on ${new Date(clientSignature.signed_date).toLocaleDateString('en-ZA')}</p>` : ''}`;
      await sendEmail(admin.email, `Contract Signed: ${client.business_name} - ${contract.package}`, adminBodyHtml).catch(() => {});
    }

    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id: contract.client_id,
      client_name: contract.client_name,
      event_type: 'milestone',
      event_label: `Contract Signed - ${contract.package}`,
      logged_by: user.id,
      logged_by_name: user.full_name
    });

    return Response.json({ success: true, message: 'Signature notification emails sent', contract_id, client_email: client.email, admins_notified: adminUsers.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});