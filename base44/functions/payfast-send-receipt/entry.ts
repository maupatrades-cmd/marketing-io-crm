import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// PayFast buyer receipt email — Step 8 PR D.
//
// Invoked by payfast-itn from the success path. Sends a branded receipt to
// the buyer with package-specific "what happens next" copy.
//
// Inputs (JSON body):
//   { payment_id: "<Base44 Payment.id>" }
//
// All other fields (m_payment_id, pf_payment_id, amount, package_id,
// customer name + email) are looked up from the Payment + Client rows.
// That keeps the caller's surface area tiny and avoids any chance of a
// caller fabricating receipt details that don't match the actual payment.
//
// Idempotency:
//   The ITN handler's own guard (Payment.status === 'successful' short-
//   circuits incoming ITNs) means this function is invoked at most once
//   per real successful payment. We don't add a second guard.
//
// Auth: function is service-internal — invoked only via
// base44.functions.invoke from another function. No external auth needed.
// =============================================================================

// Mirrored from src/config/payfastPackages.js for category-aware copy.
// Keep in sync if the catalogue changes (same constraint as
// payfast-checkout-init).
const PACKAGE_CATEGORY: Record<string, 'core' | 'township' | 'once_off' | 'recurring_addon' | 'test'> = {
  // Core (per brief: Ignite, Accelerate, Dominate, Street Pulse)
  'ignite':                  'core',
  'accelerate':              'core',
  'dominate':                'core',
  'street-pulse':            'core',
  // Township is its own category per brief
  'township-pulse':          'township',
  // Once-off products
  'google-business-profile': 'once_off',
  'marketing-audit':         'once_off',
  'competitor-analysis':     'once_off',
  'crm-training':            'once_off',
  // Recurring add-ons (setup + monthly retainer)
  'ai-chatbot':              'recurring_addon',
  'whatsapp-automation':     'recurring_addon',
  'sms-marketing':           'recurring_addon',
  // Sandbox
  'ignite-test':             'test',
};

function whatHappensNextHtml(packageId: string): string {
  const category = PACKAGE_CATEGORY[packageId] || 'core';
  switch (category) {
    case 'core':
      return `We'll be in touch within <strong>24 hours</strong> to schedule your onboarding call.`;
    case 'township':
      return `Your campaign deployment will be scheduled within <strong>14 days</strong>. Photo report delivered by day 15.`;
    case 'once_off':
      return `Your deliverable will be ready within <strong>5 business days</strong>.`;
    case 'recurring_addon':
      return `We'll start setup within <strong>2 business days</strong>.`;
    case 'test':
      return `This was a sandbox test transaction — no action needed.`;
    default:
      return `We'll be in touch shortly.`;
  }
}

function whatHappensNextText(packageId: string): string {
  // Plain-text equivalent (no HTML tags).
  return whatHappensNextHtml(packageId).replace(/<\/?strong>/g, '');
}

function fmtZAR(amount: number | string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `R${amount}`;
  return `R${n.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Branded HTML wrapper. Dark navy + purple/pink gradient to match the
// app's checkout pages. Inline styles only — email clients drop external
// CSS and most ignore <style> blocks.
function wrapEmail(bodyHtml: string) {
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

function unwrapOne(result: any): any {
  if (result == null) return null;
  if (Array.isArray(result)) return result[0] ?? null;
  if (typeof result === 'object') {
    if (result.id) return result;
    const inner = (result as any).data;
    if (Array.isArray(inner)) return inner[0] ?? null;
    if (inner && typeof inner === 'object' && inner.id) return inner;
  }
  return null;
}

Deno.serve(async (req) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const paymentId = String(body?.payment_id ?? '').trim();
  if (!paymentId) {
    return Response.json({ error: 'payment_id is required' }, { status: 400 });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[payfast-send-receipt] RESEND_API_KEY missing');
    return Response.json({ error: 'email_not_configured' }, { status: 500 });
  }

  // Override the from-address via env if needed; default mirrors the
  // existing convention used in sendOnboardingReminders, auth-register,
  // notifySignatureComplete, etc. so all transactional mail comes from
  // the same address.
  const fromAddress =
    Deno.env.get('RESEND_FROM_EMAIL') || 'Marketing iO Team <hello@marketingio.co.za>';

  const base44 = createClientFromRequest(req);

  // ---- Look up Payment + Client. The caller can't fabricate receipt
  //      details — everything is sourced from the row.
  let payment: any;
  try {
    const found = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
    payment = unwrapOne(found);
  } catch (err) {
    console.error('[payfast-send-receipt] Payment lookup failed:', err);
    return Response.json({ error: 'lookup_failed' }, { status: 500 });
  }
  if (!payment?.id) {
    return Response.json({ error: 'Payment not found' }, { status: 404 });
  }
  if (payment.status !== 'successful') {
    // Belt-and-suspenders — if somehow we're invoked for a non-successful
    // payment, refuse rather than send a "thanks for paying" email for a
    // payment that didn't clear.
    console.error(
      `[payfast-send-receipt] refusing to send receipt for payment.status=${payment.status}, payment_id=${paymentId}`
    );
    return Response.json({ error: 'payment_not_successful' }, { status: 400 });
  }

  let client: any = null;
  try {
    const found = await base44.asServiceRole.entities.Client.filter({ id: payment.client_id });
    client = unwrapOne(found);
  } catch (err) {
    console.error('[payfast-send-receipt] Client lookup failed:', err);
  }

  // Email address: prefer Client.email, fall back to anything stored in
  // Payment.ipn_payload (PayFast echoes email_address on the ITN).
  const emailAddress =
    String(client?.email || '').trim() ||
    String(payment?.ipn_payload?.email_address || '').trim();
  if (!emailAddress) {
    console.error(
      `[payfast-send-receipt] no email address available for payment_id=${paymentId}`
    );
    return Response.json({ error: 'no_email_for_buyer' }, { status: 400 });
  }

  // First-name greeting.
  const fullName  = String(client?.contact_person || '').trim();
  const ipnFirst  = String(payment?.ipn_payload?.name_first || '').trim();
  const firstName = fullName.split(/\s+/)[0] || ipnFirst || 'there';

  const packageId   = String(payment.package_id || payment?.ipn_payload?.custom_str1 || '').trim();
  const packageName = String(payment?.ipn_payload?.item_name || '').trim() || (packageId || 'your package');
  const amountPaid  = Number(payment.amount || payment?.ipn_payload?.amount_gross || 0);
  const mPaymentId  = String(payment.gateway_reference || '').trim();
  const pfPaymentId = String(payment.gateway_pf_payment_id || '').trim();
  const completedAt = payment.completed_at ? new Date(payment.completed_at) : new Date();
  const completedAtFmt = completedAt.toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Johannesburg',
  });

  // ---- Build email content -----------------------------------------------
  const subject = `Payment confirmed — Marketing iO ${packageName}`;

  const bodyHtml = `
    <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:700;color:#fff;">
      Thanks ${escapeHtml(firstName)}, your payment is confirmed 🎉
    </h1>
    <p style="margin:0 0 24px 0;color:#cbd5e1;font-size:15px;line-height:1.6;">
      We've received your payment for <strong style="color:#fff;">${escapeHtml(packageName)}</strong>.
      Here's everything you need to keep on file.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:12px;margin:0 0 24px 0;">
      <tr><td style="padding:20px 24px;">
        <p style="margin:0 0 4px 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Amount paid</p>
        <p style="margin:0 0 20px 0;font-size:32px;font-weight:700;color:#34d399;">${escapeHtml(fmtZAR(amountPaid))}</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#cbd5e1;">
          <tr>
            <td style="padding:6px 0;width:140px;color:#94a3b8;">Package</td>
            <td style="padding:6px 0;color:#fff;font-weight:600;">${escapeHtml(packageName)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Reference</td>
            <td style="padding:6px 0;font-family:monospace;color:#e2e8f0;">${escapeHtml(mPaymentId)}</td>
          </tr>
          ${pfPaymentId ? `
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">PayFast ID</td>
            <td style="padding:6px 0;font-family:monospace;color:#e2e8f0;">${escapeHtml(pfPaymentId)}</td>
          </tr>` : ''}
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Date</td>
            <td style="padding:6px 0;color:#e2e8f0;">${escapeHtml(completedAtFmt)}</td>
          </tr>
          ${client?.business_name ? `
          <tr>
            <td style="padding:6px 0;color:#94a3b8;">Company</td>
            <td style="padding:6px 0;color:#e2e8f0;">${escapeHtml(client.business_name)}</td>
          </tr>` : ''}
        </table>
      </td></tr>
    </table>

    <h2 style="margin:0 0 12px 0;font-size:18px;font-weight:700;color:#fff;">What happens next</h2>
    <p style="margin:0 0 24px 0;color:#cbd5e1;font-size:15px;line-height:1.6;">
      ${whatHappensNextHtml(packageId)}
    </p>

    <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
      Need anything? Just reply to this email and we'll come back within
      one business day.
    </p>
  `;

  const plainText = [
    `Thanks ${firstName}, your payment is confirmed.`,
    ``,
    `Package:    ${packageName}`,
    `Amount:     ${fmtZAR(amountPaid)}`,
    `Reference:  ${mPaymentId}`,
    pfPaymentId ? `PayFast ID: ${pfPaymentId}` : '',
    `Date:       ${completedAtFmt}`,
    client?.business_name ? `Company:    ${client.business_name}` : '',
    ``,
    `What happens next:`,
    whatHappensNextText(packageId),
    ``,
    `Need anything? Reply to this email — we'll be back within one business day.`,
    ``,
    `Marketing iO`,
    `hello@marketingio.co.za | app.marketingio.co.za`,
    `Too good to stay hidden.`,
  ]
    .filter(Boolean)
    .join('\n');

  // ---- Send via Resend ---------------------------------------------------
  const resend = new Resend(apiKey);
  let resendResult: any;
  try {
    resendResult = await resend.emails.send({
      from:    fromAddress,
      to:      emailAddress,
      subject,
      html:    wrapEmail(bodyHtml),
      text:    plainText,
    });
  } catch (err) {
    console.error('[payfast-send-receipt] Resend.emails.send threw:', err);
    return Response.json({ error: 'send_failed' }, { status: 500 });
  }

  if (resendResult?.error) {
    console.error('[payfast-send-receipt] Resend reported error:', resendResult.error);
    return Response.json(
      { error: 'send_rejected', detail: resendResult.error },
      { status: 502 }
    );
  }

  console.log(
    `[payfast-send-receipt] receipt sent — payment_id=${paymentId}, ` +
    `to=${emailAddress}, resend_id=${resendResult?.data?.id || '?'}`
  );

  return Response.json({
    sent:           true,
    payment_id:     paymentId,
    to:             emailAddress,
    resend_id:      resendResult?.data?.id || null,
    package_id:     packageId,
    amount:         amountPaid,
  });
});
