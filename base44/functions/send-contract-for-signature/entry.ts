/**
 * send-contract-for-signature
 * Fires when admin flips a Contract to status='sent'.
 * Emails the client a signing link and records the action.
 * Idempotent: won't re-send if last email was within 24 hours.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'https://app.marketingio.co.za';

function wrapEmail(body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${body}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['owner', 'admin'].includes(user.role)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { contract_id } = body;
    if (!contract_id) return Response.json({ error: 'contract_id required' }, { status: 400 });

    // Load contract
    const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contract_id });
    const contract = Array.isArray(contracts) ? contracts[0] : contracts;
    if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 });

    if (contract.status !== 'sent') {
      return Response.json({ error: 'Contract must be status=sent before emailing' }, { status: 400 });
    }

    // Idempotency: skip if sent within last 24h
    if (contract.last_signature_email_sent_at) {
      const sentAt = new Date(contract.last_signature_email_sent_at).getTime();
      if (Date.now() - sentAt < 24 * 60 * 60 * 1000) {
        return Response.json({ skipped: true, reason: 'Email already sent within 24 hours' });
      }
    }

    // Load client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: contract.client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;
    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const signingUrl = `${APP_URL}/sign-contract?token=${contract.signing_token}`;
    const packageLabel = (contract.package || 'service').replace(/_/g, ' ');
    const subject = `Sign your Marketing iO contract: ${packageLabel} — ${client.business_name}`;

    const setupFee = contract.setup_fee ? `R${Number(contract.setup_fee).toLocaleString('en-ZA')}` : '—';
    const retainer = contract.monthly_retainer ? `R${Number(contract.monthly_retainer).toLocaleString('en-ZA')}/month` : '—';
    const endDate = contract.contract_end_date ? new Date(contract.contract_end_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

    const htmlBody = wrapEmail(`
      <h2>Your contract is ready to sign</h2>
      <p>Hi ${client.contact_person || client.business_name},</p>
      <p>Your Marketing iO service agreement is ready for your signature. Please review the contract summary below and click the button to sign digitally.</p>
      <div class="summary-box">
        <p><strong>Package:</strong> ${packageLabel}</p>
        <p><strong>Setup Fee:</strong> ${setupFee}</p>
        <p><strong>Monthly Retainer:</strong> ${retainer}</p>
        <p><strong>Contract End Date:</strong> ${endDate}</p>
      </div>
      <div style="text-align:center">
        <a href="${signingUrl}" class="btn">Review &amp; Sign Contract →</a>
      </div>
      <p style="font-size:13px;color:#888">If the button doesn't work, copy this link into your browser:<br/><a href="${signingUrl}">${signingUrl}</a></p>
      <p>Questions? Reply to this email or WhatsApp us.</p>
      <p>Warm regards,<br/><strong>Marketing iO Team</strong></p>
    `);

    // Send email
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Marketing iO <contracts@marketingio.co.za>',
        to: [client.email],
        subject,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('[send-contract-for-signature] Resend error:', err);
      return Response.json({ error: 'Email failed', detail: err }, { status: 500 });
    }

    // Update contract with last sent timestamp and signing status
     await base44.asServiceRole.entities.Contract.update(contract_id, {
       last_signature_email_sent_at: new Date().toISOString(),
       signing_status: 'sent',
     });

    // Activity log
    try {
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id: contract.client_id,
        client_name: client.business_name,
        event_type: 'contract_sent_for_signature',
        event_category: 'document',
        event_label: `Contract sent for signature: ${packageLabel}`,
        performed_by_id: user.id,
        performed_by_name: user.full_name,
        metadata: JSON.stringify({ contract_id, subject }),
      });
    } catch (e) { console.warn('[send-contract-for-signature] activity log failed:', e.message); }

    return Response.json({ success: true, email_sent_to: client.email });
  } catch (error) {
    console.error('[send-contract-for-signature] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});