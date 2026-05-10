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
  // Email-safe synthwave V3 shell. No position:absolute / flex — Outlook
  // strips both. White logo badge centred via table align="center" + cell
  // valign="middle". Inline SVG decoration renders in modern clients;
  // Outlook falls back to the gradient + bgcolor + white badge cleanly.
  const __MIO_LOGO_URL  = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';
  const __MIO_ACCENT    = 'linear-gradient(90deg,#dc2626 0%,#ec4899 50%,#fbbf24 100%)';
  const __MIO_HEADER_BG = 'linear-gradient(180deg,#1a0533 0%,#0a0a2e 50%,#000010 100%)';
  const __MIO_FOOTER_BG = 'linear-gradient(180deg,#000010 0%,#0a0a2e 50%,#1a0533 100%)';
  const __MIO_YEAR      = new Date().getFullYear();

  const __MIO_HEADER_SVG = '<svg width="600" height="240" viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display:block;width:600px;height:240px;">'
    + '<defs>'
    + '<linearGradient id="__mioH_bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a0533"/><stop offset="50%" stop-color="#0a0a2e"/><stop offset="100%" stop-color="#000010"/></linearGradient>'
    + '<radialGradient id="__mioH_sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="55%" stop-color="#ec4899"/><stop offset="100%" stop-color="#7c3aed"/></radialGradient>'
    + '<linearGradient id="__mioH_glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.5"/><stop offset="100%" stop-color="#ec4899" stop-opacity="0"/></linearGradient>'
    + '<filter id="__mioH_grid" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.6"/></filter>'
    + '<mask id="__mioH_slices"><circle cx="300" cy="156" r="85" fill="white"/><rect x="232" y="170" width="136" height="3" fill="black"/><rect x="245" y="184" width="110" height="4" fill="black"/><rect x="262" y="200" width="76" height="4" fill="black"/><rect x="278" y="216" width="44" height="5" fill="black"/></mask>'
    + '</defs>'
    + '<rect width="600" height="240" fill="url(#__mioH_bg)"/>'
    + '<g fill="#ffffff"><circle cx="50" cy="22" r="1.2" opacity="0.85"/><circle cx="120" cy="48" r="1.0" opacity="0.6"/><circle cx="200" cy="18" r="1.5" opacity="0.9"/><circle cx="290" cy="55" r="1.0" opacity="0.7"/><circle cx="380" cy="28" r="1.2" opacity="0.8"/><circle cx="470" cy="48" r="1.0" opacity="0.65"/><circle cx="540" cy="20" r="1.3" opacity="0.85"/></g>'
    + '<circle cx="300" cy="156" r="85" fill="url(#__mioH_sun)" mask="url(#__mioH_slices)"/>'
    + '<rect x="0" y="156" width="600" height="50" fill="url(#__mioH_glow)"/>'
    + '<line x1="0" y1="156" x2="600" y2="156" stroke="#ec4899" stroke-width="1.5"/>'
    + '<g opacity="0.6"><polygon points="40,156 100,118 160,156" fill="#7c3aed"/><polygon points="120,156 175,108 230,156" fill="#a855f7"/><polygon points="370,156 430,118 490,156" fill="#06b6d4"/><polygon points="450,156 510,108 570,156" fill="#7c3aed"/></g>'
    + '<g filter="url(#__mioH_grid)"><g stroke="#ec4899" stroke-width="0.8" fill="none" opacity="0.85"><line x1="0" y1="170" x2="600" y2="170"/><line x1="0" y1="186" x2="600" y2="186"/><line x1="0" y1="208" x2="600" y2="208"/><line x1="0" y1="234" x2="600" y2="234"/></g>'
    + '<g stroke="#06b6d4" stroke-width="0.7" fill="none" opacity="0.8"><line x1="300" y1="156" x2="0" y2="240"/><line x1="300" y1="156" x2="100" y2="240"/><line x1="300" y1="156" x2="200" y2="240"/><line x1="300" y1="156" x2="300" y2="240"/><line x1="300" y1="156" x2="400" y2="240"/><line x1="300" y1="156" x2="500" y2="240"/><line x1="300" y1="156" x2="600" y2="240"/></g></g>'
    + '</svg>';

  const __MIO_WAVES_SVG = '<svg width="552" height="100" viewBox="0 0 552 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block;width:100%;max-width:552px;height:auto;">'
    + '<defs><linearGradient id="__mioF_w" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7c3aed"/><stop offset="20%" stop-color="#ec4899"/><stop offset="40%" stop-color="#f59e0b"/><stop offset="60%" stop-color="#10b981"/><stop offset="80%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>'
    + '<g stroke="url(#__mioF_w)" fill="none" stroke-width="1">'
    + '<path d="M0 22 Q 69 8 138 22 T 276 22 T 414 22 T 552 22" opacity="0.55"/>'
    + '<path d="M0 32 Q 69 18 138 32 T 276 32 T 414 32 T 552 32" opacity="0.7"/>'
    + '<path d="M0 42 Q 69 28 138 42 T 276 42 T 414 42 T 552 42" opacity="0.85"/>'
    + '<path d="M0 50 Q 69 36 138 50 T 276 50 T 414 50 T 552 50" opacity="0.9"/>'
    + '<path d="M0 58 Q 69 44 138 58 T 276 58 T 414 58 T 552 58" opacity="0.85"/>'
    + '<path d="M0 68 Q 69 54 138 68 T 276 68 T 414 68 T 552 68" opacity="0.7"/>'
    + '<path d="M0 78 Q 69 64 138 78 T 276 78 T 414 78 T 552 78" opacity="0.6"/>'
    + '<path d="M0 88 Q 69 74 138 88 T 276 88 T 414 88 T 552 88" opacity="0.5"/>'
    + '</g></svg>';

  const __MIO_LI_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43A2.06 2.06 0 1 1 5.34 3.3a2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z"/></svg>';
  const __MIO_IG_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="17" cy="7" r="1.2" fill="#ffffff" fill-opacity="0.85"/></svg>';
  const __MIO_FB_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M24 12.07C24 5.45 18.63.07 12 .07S0 5.45 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.39H7.08v-3.47h3.05V9.43c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95H15.83c-1.5 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.02 24 18.07 24 12.07z"/></svg>';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse;background-color:#ffffff;">

<!-- HEADER -->
<tr><td style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;background-color:#0a0a2e;">
<tr><td width="600" height="240" align="center" valign="middle" bgcolor="#0a0a2e" style="width:600px;height:240px;background-color:#0a0a2e;background-image:${__MIO_HEADER_BG};padding:0;text-align:center;vertical-align:middle;">
<!--[if !mso]><!--><div style="font-size:0;line-height:0;height:0;overflow:visible;">${__MIO_HEADER_SVG}</div><!--<![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;"><tr>
<td width="420" height="130" align="center" valign="middle" bgcolor="#ffffff" style="width:420px;height:130px;background-color:#ffffff;border-radius:20px;padding:15px 30px;text-align:center;vertical-align:middle;box-shadow:0 0 40px rgba(255,255,255,0.4),0 0 80px rgba(236,72,153,0.3);">
<img src="${__MIO_LOGO_URL}" width="360" height="100" alt="Marketing iO" style="display:block;width:360px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
</td></tr></table>
</td></tr>
<tr><td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${__MIO_ACCENT};">&nbsp;</td></tr>
</table>
</td></tr>

<!-- BODY -->
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
<tr><td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${__MIO_ACCENT};">&nbsp;</td></tr>
<tr><td width="600" align="center" valign="top" bgcolor="#0a0a2e" style="width:600px;background-color:#0a0a2e;background-image:${__MIO_FOOTER_BG};padding:32px 24px;text-align:center;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<!--[if !mso]><!--><table role="presentation" width="552" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;"><tr><td align="center" style="font-size:0;line-height:0;">${__MIO_WAVES_SVG}</td></tr></table><!--<![endif]-->

<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;border-collapse:collapse;"><tr>
<td width="280" height="90" align="center" valign="middle" bgcolor="#ffffff" style="width:280px;height:90px;background-color:#ffffff;border-radius:16px;padding:10px 20px;text-align:center;vertical-align:middle;box-shadow:0 0 30px rgba(255,255,255,0.4),0 0 60px rgba(236,72,153,0.3);">
<img src="${__MIO_LOGO_URL}" width="240" height="70" alt="Marketing iO" style="display:block;width:240px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
</td></tr></table>

<p style="margin:0 0 18px;color:#ffffff;font-size:14px;font-style:italic;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;">Too good to stay hidden.</p>

<p style="margin:0 0 6px;color:#ffffff;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
<a href="mailto:hello@marketingio.africa" style="color:#ffffff;text-decoration:none;">hello@marketingio.africa</a>&nbsp;&bull;&nbsp;<a href="tel:0101020534" style="color:#ffffff;text-decoration:none;">010 102 0534</a>&nbsp;&bull;&nbsp;<a href="https://marketingio.africa" style="color:#ffffff;text-decoration:none;">marketingio.africa</a>
</p>
<p style="margin:0 0 22px;color:#ffffff;font-size:11px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">75 Marshall Street, Polokwane, 0699, South Africa</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px;border-collapse:collapse;"><tr>
<td style="padding:0 8px;"><a href="https://linkedin.com/company/marketingio" aria-label="Marketing iO on LinkedIn" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_LI_SVG}</a></td>
<td style="padding:0 8px;"><a href="https://instagram.com/marketingio" aria-label="Marketing iO on Instagram" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_IG_SVG}</a></td>
<td style="padding:0 8px;"><a href="https://facebook.com/marketingio" aria-label="Marketing iO on Facebook" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_FB_SVG}</a></td>
</tr></table>

<p style="margin:0 0 6px;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.6;">© ${__MIO_YEAR} Marketing iO. All rights reserved.</p>
<p style="margin:0;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">
<a href="https://app.marketingio.africa/unsubscribe" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a>&nbsp;&bull;&nbsp;<a href="https://marketingio.africa/privacy" style="color:#ffffff;text-decoration:underline;">Privacy Policy</a>&nbsp;&bull;&nbsp;<a href="https://app.marketingio.africa/preferences" style="color:#ffffff;text-decoration:underline;">Manage Preferences</a>
</p>
</td></tr>
</table>
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
