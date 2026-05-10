import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// send-invoice-chase — Round 4 of recovery plan.
//
// Inputs (POST JSON):
//   { invoice_id, stage, token, custom_message? }
//   - stage: 'reminder' | 'firm' | 'final' | 'escalation' (Day 1 / 3 / 7 / 14)
//   - custom_message: optional admin override paragraph
//
// Output:
//   { success: true, email_sent, communication_id?, activity_id? }
//
// Sends a chase email to the buyer at the appropriate severity for the
// stage. Logs ClientCommunication and ClientActivityLog. Designed to be
// called from the /admin/invoices chase queue row action.
//
// Auth: token (session token) required, role owner|admin.
// =============================================================================

const FROM      = 'Marketing iO Accounts <accounts@marketingio.co.za>';
const HEAD_BCC  = 'head@marketingio.co.za';
const LOGO_URL  = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const APP_URL   = 'https://app.marketingio.co.za';

const STAGE_META: Record<string, { subject: (n: string, ref: string) => string; tone: string; severity: 'low'|'medium'|'high' }> = {
  reminder:   { subject: (_, ref) => `Friendly reminder: invoice ${ref}`,                    tone: 'gentle',   severity: 'low' },
  firm:       { subject: (_, ref) => `Invoice ${ref} — please action`,                       tone: 'firm',     severity: 'medium' },
  final:      { subject: (_, ref) => `Final notice: invoice ${ref}`,                          tone: 'final',    severity: 'high' },
  escalation: { subject: (n, ref) => `Account on hold pending payment — invoice ${ref}`,     tone: 'escalate', severity: 'high' },
};

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

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

function buildBody(opts: {
  contactName: string;
  businessName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysOutstanding: number;
  stage: string;
  customMessage?: string;
}) {
  const { contactName, businessName, invoiceNumber, amount, dueDate, daysOutstanding, stage, customMessage } = opts;
  const amt = Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const greeting = contactName ? `Hi ${escapeHtml(contactName)},` : `Hi there,`;
  const intro = (() => {
    switch (stage) {
      case 'reminder':
        return `<p>This is a quick reminder that invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(businessName)}</strong> is currently outstanding.</p>`;
      case 'firm':
        return `<p>Invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(businessName)}</strong> is now <strong>${daysOutstanding} days past due</strong>. Please action this when you have a moment.</p>`;
      case 'final':
        return `<p>This is a final notice for invoice <strong>${escapeHtml(invoiceNumber)}</strong>, currently <strong>${daysOutstanding} days past due</strong>. Please settle within the next 24 hours to avoid service interruption.</p>`;
      case 'escalation':
        return `<p>Per our terms, your account for <strong>${escapeHtml(businessName)}</strong> is being placed on hold pending payment of invoice <strong>${escapeHtml(invoiceNumber)}</strong> (${daysOutstanding} days past due). Active deliverables and integrations will pause until settlement.</p>`;
      default:
        return `<p>Invoice <strong>${escapeHtml(invoiceNumber)}</strong> requires your attention.</p>`;
    }
  })();
  const detailBlock = `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#f8fafc;border-radius:8px;width:100%;">
      <tr><td style="padding:18px 20px;color:#1e293b;font-size:14px;">
        <strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}<br>
        <strong>Amount due:</strong> R${amt}<br>
        <strong>Due date:</strong> ${escapeHtml(dueDate || 'on receipt')}<br>
        <strong>Days outstanding:</strong> ${daysOutstanding}
      </td></tr>
    </table>`;
  const cta = `<div style="text-align:center;margin:24px 0;"><a href="${APP_URL}/client/invoices" style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">View &amp; pay invoice</a></div>`;
  const customBlock = customMessage
    ? `<p style="background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:4px;">${escapeHtml(customMessage).replace(/\n/g, '<br>')}</p>`
    : '';
  const closing = stage === 'escalation'
    ? `<p>If you have already paid in the last 24 hours, please reply with proof of payment so we can release your account immediately.</p>`
    : `<p>If you've already paid, thank you — please ignore this. If you have any questions or need a payment plan, just reply to this email.</p>`;
  return `<h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">${greeting.replace(',', '')}</h1>${intro}${detailBlock}${customBlock}${cta}${closing}<p style="margin-top:24px;color:#64748b;font-size:14px;">— Marketing iO Accounts</p>`;
}

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

async function deriveActor(base44: any, token: string) {
  if (!token) return null;
  let user: any = null;
  try {
    const list = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    user = unwrapList(list)[0] || null;
  } catch { /* try legacy */ }
  if (!user) {
    try {
      const list = await base44.asServiceRole.entities.User.filter({ session_token: token });
      user = unwrapList(list)[0] || null;
    } catch { return null; }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) return null;
  return { userId: String(user.id || ''), role: String(user.role || 'client'), email: String(user.email || '') };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const invoiceId      = String(body?.invoice_id ?? '').trim();
  const stage          = String(body?.stage ?? 'reminder').trim();
  const tokenRaw       = String(body?.token ?? '').trim();
  const customMessage  = body?.custom_message ? String(body.custom_message) : '';

  if (!invoiceId) return Response.json({ error: 'invoice_id required' }, { status: 400 });
  if (!STAGE_META[stage]) return Response.json({ error: 'unknown_stage' }, { status: 400 });

  const base44 = createClientFromRequest(req);

  const actor = await deriveActor(base44, tokenRaw);
  if (!actor) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // Resolve invoice + client.
  const invList = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
  const invoice = unwrapList(invList)[0];
  if (!invoice) return Response.json({ error: 'invoice_not_found' }, { status: 404 });

  const cliList = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
  const client = unwrapList(cliList)[0];
  if (!client?.email) return Response.json({ error: 'client_email_missing' }, { status: 422 });

  const dueDate = String(invoice.due_date || '');
  let daysOutstanding = 0;
  if (dueDate) {
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    daysOutstanding = Math.max(0, Math.floor((now - due) / (24 * 60 * 60 * 1000)));
  }
  const amount = Number(invoice.total_amount || invoice.total || invoice.amount || 0);

  const subject = STAGE_META[stage].subject(client.business_name || '', invoice.invoice_number || invoiceId);
  const html    = wrapEmail(buildBody({
    contactName:   String(client.contact_person || '').trim(),
    businessName:  String(client.business_name || '').trim(),
    invoiceNumber: String(invoice.invoice_number || invoiceId),
    amount,
    dueDate,
    daysOutstanding,
    stage,
    customMessage,
  }));

  let emailSent = false;
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from:    FROM,
        to:      [client.email],
        bcc:     [HEAD_BCC],
        subject,
        html,
        reply_to: 'accounts@marketingio.co.za',
      });
      emailSent = true;
    } else {
      console.error('[send-invoice-chase] RESEND_API_KEY missing');
    }
  } catch (err) {
    console.error('[send-invoice-chase] Resend send failed:', err);
  }

  // ClientCommunication audit
  let communicationId: string | null = null;
  try {
    const comm = await base44.asServiceRole.entities.ClientCommunication.create({
      client_id:   client.id,
      sender_id:   actor.userId,
      sender_role: actor.role,
      direction:   'outbound',
      channel:     'email',
      subject,
      message:     `Chase email (${stage}) sent for invoice ${invoice.invoice_number || invoiceId}.${customMessage ? '\n\nCustom note:\n' + customMessage : ''}`,
      status:      emailSent ? 'resolved' : 'new',
    });
    communicationId = comm?.id || null;
  } catch (err) {
    console.error('[send-invoice-chase] ClientCommunication.create failed (non-fatal):', err);
  }

  // ClientActivityLog audit
  let activityId: string | null = null;
  try {
    const act = await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      client.id,
      client_name:    String(client.business_name || '').trim(),
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'invoice_chase_sent',
      event_category: 'invoice',
      event_summary:  `Chase email (${stage}) for invoice ${invoice.invoice_number || invoiceId}`,
      event_metadata: {
        invoice_id:      invoiceId,
        invoice_number:  invoice.invoice_number,
        stage,
        days_outstanding: daysOutstanding,
        amount,
      },
      event_label:    `Chase ${stage}`,
      logged_by:      actor.userId,
      logged_by_name: actor.email,
    });
    activityId = act?.id || null;
  } catch (err) {
    console.error('[send-invoice-chase] ClientActivityLog.create failed (non-fatal):', err);
  }

  return Response.json({
    success:          true,
    email_sent:       emailSent,
    communication_id: communicationId,
    activity_id:      activityId,
  });
});
