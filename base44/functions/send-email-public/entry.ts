import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

const WHITELIST = [
  'forgot_password',
  'password_changed',
  'contract_signed',
  'contract_ready_to_sign',
  'invoice_issued',
  'invoice_paid',
  'monthly_report_ready',
  'onboarding_form_submitted',
  'onboarding_reminder',
  'welcome_pack',
  'staff_assigned',
  'deliverable_uploaded',
  'signature_complete',
  'admin_notification'
];

// Simple in-memory rate limit
const rateLimitMap = new Map();
function checkRateLimit(to, purpose) {
  const key = `${to}|${purpose}`;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxSends = 5;
  const timestamps = (rateLimitMap.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxSends) return false;
  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return true;
}

function buildCtaButton(cta) {
  if (!cta) return '';
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
    <a href="${cta.url}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">${cta.text}</a>
  </td></tr></table>`;
}

function wrapEmail(bodyHtml, preheader, cta) {
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
${bodyHtml}${buildCtaButton(cta)}
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

async function sendViaResend(to, subject, bodyHtml, preheader, cta, base44) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    if (base44) await base44.asServiceRole.entities.SecurityEvent.create({ event_type: 'email_send_failed', email: to, details: 'RESEND_API_KEY missing' }).catch(() => {});
    return { success: false, error: 'Email service not configured' };
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({ from: 'Marketing iO Team <hello@marketingio.co.za>', to, subject, html: wrapEmail(bodyHtml, preheader, cta) });
  if (result.error) {
    const msg = result.error.message || JSON.stringify(result.error);
    if (base44) await base44.asServiceRole.entities.SecurityEvent.create({ event_type: 'email_send_failed', email: to, details: msg }).catch(() => {});
    return { success: false, error: msg };
  }
  return { success: true, message_id: result.data?.id };
}

function renderEmail(purpose, payload) {
  const p = payload || {};
  const name = p.full_name || p.name || 'there';

  switch (purpose) {
    case 'forgot_password':
      return {
        subject: 'Reset your Marketing iO password',
        preheader: 'Reset your password — link expires in 30 minutes.',
        cta: { text: 'Reset Password →', url: p.reset_url || '#' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">We received a request to reset your Marketing iO password.</p>
          <p style="margin:0 0 16px 0;">Click the button below to set a new password. The link expires in <strong>30 minutes</strong>.</p>
          <p style="margin:0 0 8px 0;color:#64748b;font-size:14px;">Or copy this link:<br><a href="${p.reset_url || '#'}" style="color:#a764e6;word-break:break-all;">${p.reset_url || '#'}</a></p>
          <p style="margin:16px 0 0 0;color:#94a3b8;font-size:14px;">If you didn't request this, ignore this email — your account is safe.</p>`
      };

    case 'password_changed':
      return {
        subject: 'Your Marketing iO password was changed',
        preheader: 'Your password was recently changed.',
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">Your Marketing iO password was changed at <strong>${p.timestamp || new Date().toLocaleString('en-ZA')}</strong>.</p>
          <p style="margin:0;color:#ef4444;">If this wasn't you, contact <a href="mailto:hello@marketingio.co.za" style="color:#a764e6;">hello@marketingio.co.za</a> immediately.</p>`
      };

    case 'contract_signed':
      return {
        subject: `Your Marketing iO contract for ${p.package || 'your package'} has been signed`,
        preheader: 'Welcome to Marketing iO!',
        cta: { text: 'Open Client Portal →', url: p.portal_url || 'https://app.marketingio.co.za/client-portal' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">Your contract for <strong>${p.package || 'your package'}</strong> has been signed. Welcome to Marketing iO!</p>
          <p style="margin:0 0 16px 0;">Our team will contact you within 1 business day to begin onboarding.</p>`
      };

    case 'contract_ready_to_sign':
      return {
        subject: 'Your Marketing iO contract is ready for signature',
        preheader: 'Please review and sign your contract.',
        cta: { text: 'Review & Sign →', url: p.url || '#' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">Your contract is ready for signature. Click the button below to review and sign.</p>`
      };

    case 'invoice_issued':
      return {
        subject: `Invoice ${p.invoice_number || ''} issued — R${p.amount || '0'}`,
        preheader: `Invoice ${p.invoice_number || ''} is ready for payment.`,
        cta: { text: 'View Invoice →', url: p.invoice_url || 'https://app.base44.com/client/invoices' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">Invoice <strong>${p.invoice_number || ''}</strong> for <strong>R${p.amount || '0'}</strong> has been issued.</p>
          ${p.due_date ? `<p style="margin:0 0 16px 0;">Due date: <strong>${p.due_date}</strong></p>` : ''}`
      };

    case 'invoice_paid':
      return {
        subject: `Payment received — Invoice ${p.invoice_number || ''}`,
        preheader: 'Thank you for your payment.',
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0;">Payment received for invoice <strong>${p.invoice_number || ''}</strong>. Thank you!</p>`
      };

    case 'monthly_report_ready':
      return {
        subject: `Your ${p.month || ''} Marketing iO report is ready`,
        preheader: 'Your monthly report is available.',
        cta: { text: 'View Report →', url: p.report_url || 'https://app.base44.com/client/reports' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">Your <strong>${p.month || 'monthly'}</strong> report is ready. Click below to view it.</p>`
      };

    case 'onboarding_form_submitted':
      return {
        subject: 'Onboarding form received — Marketing iO',
        preheader: 'We\'ve received your onboarding form.',
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0;">We've received your onboarding form. Our team will review and reach out within 24 hours.</p>`
      };

    case 'onboarding_reminder':
      return {
        subject: 'Reminder: Complete your Marketing iO onboarding form',
        preheader: 'Please complete your onboarding form.',
        cta: { text: 'Complete Form →', url: p.form_url || '#' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">Please complete your onboarding form to start delivery. This only takes 15–20 minutes.</p>`
      };

    case 'welcome_pack':
      return {
        subject: `Welcome to Marketing iO, ${p.business_name || name}!`,
        preheader: `Your ${p.package || ''} package is now active.`,
        cta: { text: 'Open Client Portal →', url: p.portal_url || 'https://app.marketingio.co.za/client-portal' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">Welcome to Marketing iO! Your <strong>${p.package || ''}</strong> package is now active.</p>
          <p style="margin:0 0 16px 0;">Here's what happens next:</p>
          <ol style="margin:0 0 16px 0;padding-left:20px;"><li>Review your Welcome Pack</li><li>Pay the setup invoice (within 5 days)</li><li>Complete the onboarding form</li><li>Sign the debit mandate</li><li>Share your brand assets with us</li></ol>
          <p style="margin:0;">Questions? Email <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a></p>`
      };

    case 'staff_assigned':
      return {
        subject: 'Your Marketing iO account manager has been assigned',
        preheader: `Meet your account manager, ${p.staff_name || 'your team lead'}.`,
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;"><strong>${p.staff_name || 'Your account manager'}</strong> has been assigned as your account manager.</p>
          ${p.staff_email ? `<p style="margin:0;">Reach them at <a href="mailto:${p.staff_email}" style="color:#a764e6;">${p.staff_email}</a></p>` : ''}`
      };

    case 'deliverable_uploaded':
      return {
        subject: 'New deliverable available in your portal',
        preheader: 'A new deliverable has been uploaded.',
        cta: { text: 'View Deliverable →', url: p.url || 'https://app.base44.com/client/deliverables' },
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0 0 16px 0;">A new deliverable has been uploaded to your portal${p.deliverable_title ? `: <strong>${p.deliverable_title}</strong>` : ''}.</p>`
      };

    case 'signature_complete':
      return {
        subject: `Signature recorded — ${p.document || 'your document'}`,
        preheader: 'Your signature has been recorded.',
        bodyHtml: `<p style="margin:0 0 16px 0;">Hi ${name},</p>
          <p style="margin:0;">Your signature has been recorded for <strong>${p.document || 'your document'}</strong>. Thank you.</p>`
      };

    case 'admin_notification':
      return {
        subject: p.subject || 'Marketing iO — Internal Notification',
        preheader: 'Internal notification',
        bodyHtml: `<p style="margin:0 0 16px 0;">${p.message || 'No message body provided.'}</p>`
      };

    default:
      return null;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { purpose, to, payload = {} } = await req.json();

  if (!WHITELIST.includes(purpose)) {
    return Response.json({ error: 'Unknown email purpose' }, { status: 400 });
  }
  const recipient = purpose === 'admin_notification' ? (to || 'info@marketingio.co.za') : to;
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return Response.json({ error: 'Valid recipient email required' }, { status: 400 });
  }
  if (!checkRateLimit(recipient, purpose)) {
    return Response.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
  }

  const emailData = renderEmail(purpose, payload);
  if (!emailData) {
    return Response.json({ error: 'Could not render email' }, { status: 500 });
  }

  const result = await sendViaResend(recipient, emailData.subject, emailData.bodyHtml, emailData.preheader, emailData.cta, base44);
  return Response.json(result, { status: result.success ? 200 : 500 });
});