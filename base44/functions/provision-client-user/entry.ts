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
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Welcome to Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto;" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">${bodyHtml}</td></tr>
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
