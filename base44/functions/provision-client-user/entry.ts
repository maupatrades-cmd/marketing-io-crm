import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// provision-client-user — PR-ADMIN-A.
//
// Inputs (POST JSON):
//   { token, client_id }
//
// Output (success):
//   { success: true, user_id?, app_user_id?, setup_url, already_exists? }
//
// Caller may be owner / admin / cpc / field_agent. Resolves the Client by id,
// creates an AppUser (+ legacy User) keyed off client.email, generates a
// 7-day password-reset token, and emails a portal-activation link to the
// client. If a user with that email already exists, returns
// { success: true, already_exists: true } so the caller can show a soft
// "already provisioned" toast instead of treating it as an error.
//
// If the client has any unpaid invoice (draft / sent / overdue) at the time
// of provisioning, the welcome email surfaces the most recent one so the
// client knows there is something waiting in the portal once they activate.
//
// Side effects:
//   - AppUser row (role='client', email_verified=true, pending_verification
//     =false, password_reset_token populated, link to client_id via the
//     parallel User row).
//   - Legacy User row (role='client', client_id linked).
//   - ClientActivityLog row event_type='portal_invite_sent',
//     event_category='account', actor_role from caller session.
// =============================================================================

const APP_URL  = 'https://app.marketingio.co.za';
const FROM     = 'Marketing iO Team <hello@marketingio.co.za>';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

const ALLOWED_CALLER_ROLES = new Set(['owner', 'admin', 'cpc', 'field_agent']);

const PACKAGE_LABELS: Record<string, string> = {
  ignite: 'Ignite',
  accelerate: 'Accelerate',
  dominate: 'Dominate',
  street_pulse: 'Street Pulse',
  township_pulse: 'Township Pulse',
  none: 'your package',
};

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
  return {
    userId: String(user.id || ''),
    role:   String(user.role || 'client'),
    email:  String(user.email || ''),
    name:   String(user.full_name || ''),
  };
}

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

function pickInvoiceAmount(inv: any): string {
  const n = Number(inv?.total_amount ?? inv?.amount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tokenRaw = String(body?.token ?? '').trim();
  const clientId = String(body?.client_id ?? '').trim();

  if (!clientId) return Response.json({ error: 'client_id required' }, { status: 400 });

  const base44 = createClientFromRequest(req);

  const actor = await deriveActor(base44, tokenRaw);
  if (!actor) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (!ALLOWED_CALLER_ROLES.has(actor.role)) {
    return Response.json({ error: 'forbidden', message: 'Not allowed to provision client portal access' }, { status: 403 });
  }

  // Resolve the client.
  let client: any = null;
  try {
    const list = unwrapList(await base44.asServiceRole.entities.Client.filter({ id: clientId }));
    client = list[0] || null;
  } catch (err) {
    console.error('[provision-client-user] Client.filter failed:', err);
  }
  if (!client) return Response.json({ error: 'client_not_found' }, { status: 404 });

  const email = String(client.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'client_missing_email' }, { status: 400 });
  }

  const businessName     = String(client.business_name || 'your business');
  const contactPerson    = String(client.contact_person || '').trim();
  const contactFirstName = contactPerson.split(' ')[0] || 'there';
  const packageLabel     = PACKAGE_LABELS[String(client.package || 'none')] || 'your package';

  // Duplicate check — soft-success so the form can show a friendly toast.
  let alreadyExists = false;
  try {
    const dupApp = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ email }));
    if (dupApp.length > 0) alreadyExists = true;
  } catch { /* non-fatal */ }
  if (!alreadyExists) {
    try {
      const dupLegacy = unwrapList(await base44.asServiceRole.entities.User.filter({ email }));
      if (dupLegacy.length > 0) alreadyExists = true;
    } catch { /* non-fatal */ }
  }
  if (alreadyExists) {
    return Response.json({ success: true, already_exists: true });
  }

  // Generate temp password + 7-day reset token (clients move slower than staff).
  const tempPassword = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  let passwordHash = '';
  try {
    passwordHash = await bcrypt.hash(tempPassword, 10);
  } catch (err) {
    console.error('[provision-client-user] password_hash failed:', err);
    return Response.json({ error: 'password_hash_failed' }, { status: 500 });
  }
  const resetToken   = crypto.randomUUID().replace(/-/g, '');
  const resetExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Create AppUser (canonical post-AUTH_SYSTEM_FIX).
  let appUser: any = null;
  try {
    appUser = await base44.asServiceRole.entities.AppUser.create({
      email,
      full_name:                contactPerson || businessName,
      first_name:               contactFirstName,
      last_name:                contactPerson.split(' ').slice(1).join(' ') || '',
      role:                     'client',
      password_hash:            passwordHash,
      pending_verification:     false,
      email_verified:           true,
      mobile_number:            String(client.phone || ''),
      password_reset_token:     resetToken,
      password_reset_expires_at: resetExpires,
    });
  } catch (err) {
    console.error('[provision-client-user] AppUser.create failed:', err);
    return Response.json({ error: 'app_user_create_failed', detail: String(err?.message || err) }, { status: 500 });
  }

  // Create legacy User row in parallel (dual-write — many readers still hit User).
  let legacyUser: any = null;
  try {
    legacyUser = await base44.asServiceRole.entities.User.create({
      email,
      full_name:            contactPerson || businessName,
      role:                 'client',
      phone:                String(client.phone || ''),
      password_hash:        passwordHash,
      email_verified:       true,
      pending_verification: false,
      client_id:            clientId,
    });
  } catch (err) {
    console.error('[provision-client-user] legacy User.create failed (non-fatal):', err);
  }

  const setupUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  // Look up the most recent unpaid invoice for this client (if any).
  let openInvoice: any = null;
  try {
    const all: any[] = [];
    for (const status of ['draft', 'sent', 'overdue']) {
      try {
        const list = unwrapList(await base44.asServiceRole.entities.Invoice.filter({ client_id: clientId, status }));
        all.push(...list);
      } catch { /* non-fatal */ }
    }
    if (all.length) {
      all.sort((a, b) => {
        const ta = new Date(a?.created_date || a?.created_at || 0).getTime();
        const tb = new Date(b?.created_date || b?.created_at || 0).getTime();
        return tb - ta;
      });
      openInvoice = all[0];
    }
  } catch (err) {
    console.error('[provision-client-user] Invoice lookup failed (non-fatal):', err);
  }

  const invoiceBlock = openInvoice ? `
        <div style="margin:20px 0;padding:16px 18px;background:#f8fafc;border-left:4px solid #a764e6;border-radius:6px;">
          <p style="margin:0 0 6px 0;font-size:14px;color:#64748b;">Your first invoice is waiting</p>
          <p style="margin:0;font-size:16px;color:#0f172a;">We've also issued <strong>INV-${escapeHtml(String(openInvoice.invoice_number || ''))}</strong> for <strong>R${pickInvoiceAmount(openInvoice)}</strong>. The moment you activate your portal, this invoice will be waiting for you to pay or download.</p>
        </div>` : '';

  // Send the welcome email.
  let emailSent = false;
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey) {
      const resend = new Resend(apiKey);
      const html = wrapEmail(`
        <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Welcome to Marketing iO</h1>
        <p style="margin:0 0 16px 0;">Dear ${escapeHtml(contactFirstName)},</p>
        <p style="margin:0 0 16px 0;">Welcome to Marketing iO. <strong>${escapeHtml(businessName)}</strong> has been set up on our client portal and you're ready to take control of your marketing.</p>
        <p style="margin:0 0 16px 0;">Your portal is more than a login. It's your working system for running the marketing side of your business: invoices, contracts, campaign progress, brand assets, conversations with our team — all in one place. Most of our clients tell us this is the part they didn't know they needed until they had it.</p>
        <p style="margin:0 0 8px 0;font-weight:600;color:#0f172a;">Why activate your account today:</p>
        <ul style="margin:0 0 16px 0;padding-left:20px;line-height:1.8;">
          <li>Track every invoice, payment, and receipt from one screen</li>
          <li>See exactly what we're working on for you, in real time</li>
          <li>Send and receive messages directly with your account manager</li>
          <li>Upload bank confirmations, sign contracts, share brand assets — no more email back-and-forth</li>
          <li>Watch your business grow with reports tailored to ${escapeHtml(packageLabel)}</li>
        </ul>
        ${invoiceBlock}
        <table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;"><tr><td>
          <a href="${setupUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Activate My Portal</a>
        </td></tr></table>
        <p style="margin:0 0 16px 0;font-size:14px;color:#64748b;">This activation link expires in 7 days. If you have any questions, reply to this email or call us on 010 102 0534.</p>
        <p style="margin:0 0 4px 0;">Welcome aboard.</p>
        <p style="margin:0 0 4px 0;">The Marketing iO Team</p>
        <p style="margin:0;font-style:italic;color:#a764e6;">Too good to stay hidden.</p>
      `);
      await resend.emails.send({
        from:    FROM,
        to:      [email],
        subject: 'Welcome to Marketing iO — Activate your client portal',
        html,
      });
      emailSent = true;
    } else {
      console.error('[provision-client-user] RESEND_API_KEY missing');
    }
  } catch (err) {
    console.error('[provision-client-user] Resend send failed (non-fatal):', err);
  }

  // Activity log.
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      clientId,
      client_name:    businessName,
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'portal_invite_sent',
      event_category: 'account',
      event_summary:  `Portal invitation sent to ${email}`,
      event_label:    'Portal invitation sent',
      logged_by:      actor.userId,
      logged_by_name: actor.name || actor.email || actor.role,
    });
  } catch (err) {
    console.error('[provision-client-user] ClientActivityLog.create failed (non-fatal):', err);
  }

  return Response.json({
    success:     true,
    user_id:     legacyUser?.id || null,
    app_user_id: appUser?.id || null,
    email_sent:  emailSent,
    setup_url:   setupUrl,
  });
});
