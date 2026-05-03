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
  const pre = preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#0f172a;">${preheader}</div>` : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
${pre}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto;" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">
  ${bodyHtml}${buildCtaButton(cta)}
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="140" style="width:140px;height:auto;display:block;margin:0 auto 12px auto;" />
  <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Marketing iO (Pty) Ltd &middot; CIPC 2026303502</div>
  <div style="font-size:12px;color:#94a3b8;line-height:1.8;">75 Marshall Street, Polokwane 0699<br>☎ 010 102 0534 &bull; <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
  <div style="height:1px;background:linear-gradient(90deg,transparent,#a764e6,#ec4899,transparent);margin:16px 0;"></div>
  <div style="font-size:12px;font-style:italic;color:#a764e6;">Too good to stay hidden.</div>
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
        cta: { text: 'Open Client Portal →', url: p.portal_url || 'https://app.base44.com/client-portal' },
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
        cta: { text: 'Open Client Portal →', url: p.portal_url || 'https://app.base44.com/client-portal' },
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