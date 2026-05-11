import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// provision-staff-user — Round 5 of recovery plan.
//
// Inputs (POST JSON):
//   { token, email, full_name, role, phone? }
//
// Output (success):
//   { success: true, user_id, app_user_id?, setup_url }
//
// Owner-only flow that creates a new staff/admin user record and emails
// the recipient a one-time setup link to set their own password. Mirrors
// auth-register's core (bcrypt password hash, AppUser create) but skips
// the OTP path because the owner is doing the verification, not the
// recipient.
//
// Steps:
//   1. Validate session token, require role=owner.
//   2. Validate inputs (email format, role enum, etc.).
//   3. Check for duplicate AppUser/User by email — refuse if exists.
//   4. Generate a random temp password (the recipient never uses it
//      directly), hash it via bcrypt.
//   5. Generate a password_reset_token + 24h expiry.
//   6. Create AppUser row with email_verified=true, pending_verification=
//      false, the temp password hash, the reset token. The recipient sets
//      their real password via the existing reset-password flow.
//   7. Also create a parallel User row (legacy compat — 66 callers in
//      the codebase still use the User entity).
//   8. Send a "welcome staff" email via Resend with the reset link.
//
// Auth model: token required, role must be 'owner'. Admin cannot
// provision other staff (per role permission matrix § Section 2 — staff
// records and provisioning are owner-only).
// =============================================================================

const VALID_ROLES = new Set([
  'admin', 'field_agent', 'cpc', 'head_of_tech', 'driver',
]);

const APP_URL  = 'https://app.marketingio.co.za';
const FROM     = 'Marketing iO Team <hello@marketingio.co.za>';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

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

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function wrapEmail(bodyHtml: string) {
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tokenRaw = String(body?.token ?? '').trim();
  const email    = String(body?.email ?? '').trim().toLowerCase();
  const fullName = String(body?.full_name ?? '').trim();
  const role     = String(body?.role ?? '').trim().toLowerCase();
  const phone    = String(body?.phone ?? '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (!fullName) return Response.json({ error: 'full_name required' }, { status: 400 });
  if (!VALID_ROLES.has(role)) return Response.json({ error: 'invalid_role' }, { status: 400 });

  const base44 = createClientFromRequest(req);

  const actor = await deriveActor(base44, tokenRaw);
  if (!actor) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (actor.role !== 'owner') {
    return Response.json({ error: 'forbidden', message: 'Only owner can provision staff' }, { status: 403 });
  }

  // Duplicate check (both AppUser and legacy User)
  try {
    const dupApp = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ email }));
    if (dupApp.length > 0) {
      return Response.json({ error: 'email_exists', message: 'AppUser with this email already exists' }, { status: 409 });
    }
  } catch { /* non-fatal */ }
  try {
    const dupLegacy = unwrapList(await base44.asServiceRole.entities.User.filter({ email }));
    if (dupLegacy.length > 0) {
      return Response.json({ error: 'email_exists', message: 'Legacy User with this email already exists' }, { status: 409 });
    }
  } catch { /* non-fatal */ }

  // Generate temp password + reset token
  const tempPassword = crypto.randomUUID().slice(0, 16);
  let passwordHash = '';
  try {
    passwordHash = await bcrypt.hash(tempPassword, 10);
  } catch (err) {
    console.error('[provision-staff-user] password_hash failed:', err);
    return Response.json({ error: 'password_hash_failed' }, { status: 500 });
  }
  const resetToken = crypto.randomUUID().replace(/-/g, '');
  const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Create AppUser row.
  let appUser: any = null;
  try {
    appUser = await base44.asServiceRole.entities.AppUser.create({
      email,
      full_name:                fullName,
      first_name:               fullName.split(' ')[0] || '',
      last_name:                fullName.split(' ').slice(1).join(' ') || '',
      role,
      password_hash:            passwordHash,
      pending_verification:     false,
      email_verified:           true,
      mobile_number:            phone,
      password_reset_token:     resetToken,
      password_reset_expires_at: resetExpires,
    });
  } catch (err) {
    console.error('[provision-staff-user] AppUser.create failed:', err);
    return Response.json({ error: 'app_user_create_failed', detail: String(err?.message || err) }, { status: 500 });
  }

  // Create legacy User row in parallel (66 callers still depend on it).
  let legacyUser: any = null;
  try {
    legacyUser = await base44.asServiceRole.entities.User.create({
      email,
      full_name:        fullName,
      role,
      phone,
      password_hash:    passwordHash,
      email_verified:   true,
      pending_verification: false,
    });
  } catch (err) {
    console.error('[provision-staff-user] legacy User.create failed (non-fatal):', err);
    // Non-fatal — AppUser is the canonical record post-AUTH_SYSTEM_FIX.md.
  }

  const setupUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  // Send the welcome email.
  let emailSent = false;
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey) {
      const resend = new Resend(apiKey);
      const html = wrapEmail(`
        <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Welcome to Marketing iO, ${escapeHtml(fullName.split(' ')[0] || fullName)}</h1>
        <p>You've been added to the Marketing iO CRM with the role of <strong>${escapeHtml(role.replace(/_/g, ' '))}</strong>.</p>
        <p>To get started, set your password using the secure one-time link below. The link expires in 24 hours.</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${setupUrl}" style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Set my password</a>
        </div>
        <p style="font-size:14px;color:#64748b;">If the button doesn't work, paste this link into your browser:<br><code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${setupUrl}</code></p>
        <p style="font-size:14px;color:#64748b;margin-top:24px;">Once you've set your password, sign in at <a href="${APP_URL}" style="color:#a764e6;">${APP_URL}</a>.</p>
      `);
      await resend.emails.send({
        from:    FROM,
        to:      [email],
        subject: 'Welcome to Marketing iO — set your password',
        html,
      });
      emailSent = true;
    } else {
      console.error('[provision-staff-user] RESEND_API_KEY missing');
    }
  } catch (err) {
    console.error('[provision-staff-user] Resend send failed (non-fatal):', err);
  }

  return Response.json({
    success:     true,
    user_id:     legacyUser?.id || null,
    app_user_id: appUser?.id || null,
    email_sent:  emailSent,
    setup_url:   setupUrl,
  });
});
