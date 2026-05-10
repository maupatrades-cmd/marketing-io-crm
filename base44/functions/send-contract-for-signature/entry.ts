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
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:Inter,Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
    .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:32px 40px;text-align:center}
    .header img{height:36px}
    .body{padding:36px 40px;color:#333}
    .footer{background:#f8f8f8;padding:20px 40px;text-align:center;font-size:12px;color:#999}
    .btn{display:inline-block;background:linear-gradient(135deg,#a764e6,#ec4899);color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin:20px 0}
    .summary-box{background:#f9f6ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px 20px;margin:20px 0;font-size:14px}
    .summary-box p{margin:4px 0;color:#444}
    h2{color:#1a1a1a}
  </style></head><body>
  <div class="wrap">
    <div class="header">
      <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" alt="Marketing iO" />
    </div>
    <div class="body">${body}</div>
    <div class="footer">Marketing iO (Pty) Ltd · info@marketingio.co.za · 087 000 0000</div>
  </div></body></html>`;
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