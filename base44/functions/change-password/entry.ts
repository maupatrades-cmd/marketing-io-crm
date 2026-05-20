import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { Resend } from 'npm:resend@3.2.0';

function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 10) errors.push('Password must be at least 10 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least 1 uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least 1 lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least 1 number');
  return { valid: errors.length === 0, errors };
}

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title></head>
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

function formatSastDateTime(date) {
  return date.toLocaleString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { user_id, current_password, new_password, token } = body || {};
  if (!user_id || !current_password || !new_password) {
    return Response.json({ error: 'user_id, current_password, new_password required' }, { status: 400 });
  }
  if (!token) return Response.json({ error: 'token required' }, { status: 401 });

  // LB-030: bind the password change to an authenticated session. Previously
  // only current_password was checked, which meant anyone who knew (or
  // brute-forced over time) a user's password could change it from anywhere
  // with no active login. Now caller must hold a valid session AND know the
  // current password AND target their own user_id. No admin bypass — admins
  // reset passwords via the password_reset flow, not this endpoint.
  let caller = null;
  try {
    const callerList = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    caller = (Array.isArray(callerList) ? callerList[0] : null) || null;
  } catch (err) {
    console.error('[change-password] caller lookup failed:', err);
  }
  if (!caller) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!caller.session_expires_at || new Date(caller.session_expires_at) < new Date()) {
    return Response.json({ error: 'session_expired' }, { status: 401 });
  }
  if (String(caller.id) !== String(user_id)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const validation = validatePassword(new_password);
  if (!validation.valid) {
    return Response.json({ error: 'invalid_new_password', detail: validation.errors }, { status: 400 });
  }

  // Look up user
  let user = null;
  let userEntity = null;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ id: user_id });
    const found = Array.isArray(appUsers) ? appUsers[0] : appUsers;
    if (found) { user = found; userEntity = 'AppUser'; }
  } catch (err) {
    console.error('[change-password] AppUser lookup failed:', err);
  }
  if (!user) {
    try {
      const legacy = await base44.asServiceRole.entities.User.filter({ id: user_id });
      const found = Array.isArray(legacy) ? legacy[0] : legacy;
      if (found) { user = found; userEntity = 'User'; }
    } catch (err) {
      console.error('[change-password] User lookup failed:', err);
    }
  }
  if (!user || !userEntity) {
    return Response.json({ error: 'user_not_found' }, { status: 404 });
  }
  if (!user.password_hash) {
    return Response.json({ error: 'no_password_on_record' }, { status: 400 });
  }

  // Verify current password
  let matches = false;
  try { matches = await bcrypt.compare(current_password, user.password_hash); }
  catch (err) {
    console.error('[change-password] bcrypt compare failed:', err);
    return Response.json({ error: 'compare_failed' }, { status: 500 });
  }
  if (!matches) {
    return Response.json({ error: 'wrong_current_password' }, { status: 401 });
  }

  // Check password history (current hash + up to last 9 stored)
  const history = Array.isArray(user.password_history) ? user.password_history : [];
  const allHashes = [user.password_hash, ...history];

  for (const oldHash of allHashes) {
    let reused = false;
    try { reused = await bcrypt.compare(new_password, oldHash); } catch {}
    if (reused) {
      return Response.json({
        error: 'password_previously_used',
        message: 'This password has been used before. Please choose a different one.'
      }, { status: 400 });
    }
  }

  // Hash new password
  let newHash;
  try { newHash = await bcrypt.hash(new_password, 10); }
  catch (err) {
    console.error('[change-password] hash failed:', err);
    return Response.json({ error: 'hash_failed' }, { status: 500 });
  }

  // Build new history (keep last 9, prepend current hash → max 10 total)
  const newHistory = [user.password_hash, ...history].slice(0, 9);

  // Set expiry: 90 days from now
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // LB-031c: mint a one-time lockdown token for the "this wasn't me" email
  // link. 24h validity. Stored on the user row; consumed by
  // emergency-account-lockdown when the user confirms via the SPA page.
  // Hyphens stripped to match the convention used by send-forgot-password-email
  // and to side-step any quirks in Base44's filter behavior on hyphenated
  // values in newly-added fields.
  const lockdownToken = crypto.randomUUID().replace(/-/g, '');
  const lockdownExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  try {
    await base44.asServiceRole.entities[userEntity].update(user.id, {
      password_hash: newHash,
      password_history: newHistory,
      password_changed_at: now.toISOString(),
      password_expires_at: expiresAt,
      lockdown_token: lockdownToken,
      lockdown_token_expires_at: lockdownExpiresAt,
      failed_login_count: 0,
      lockout_until: null
    });
  } catch (err) {
    console.error('[change-password] update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Capture IP for the audit log + the confirmation email
  const ipAddress = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || '';

  // Activity audit
  try {
    const clientList = await base44.asServiceRole.entities.Client.filter({ client_user_id: user.id });
    const client = (Array.isArray(clientList) ? clientList : [])[0];
    if (client?.id) {
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id: client.id,
        client_name: String(client.business_name || client.contact_person || '').trim(),
        actor_id: user.id,
        actor_role: String(user.role || 'client'),
        event_type: 'password_changed',
        event_category: 'auth',
        event_summary: 'Password changed',
        event_metadata: {},
        event_label: 'Password changed',
        logged_by: user.id,
        logged_by_name: String(user.full_name || user.email || ''),
        ip_address: ipAddress.slice(0, 64),
        user_agent: userAgent.slice(0, 500),
      });
    }
  } catch (logErr) {
    console.error('[change-password] activity log failed (non-fatal):', logErr?.message);
  }

  // LB-031c: send branded "your password was just changed" email with a
  // "this wasn't me" link that opens a SPA confirmation page. The link is
  // intentionally non-destructive on click — Outlook/Gmail link previewers
  // would otherwise auto-fire a one-click lockdown, so the real lockdown
  // requires a POST from the confirmation page.
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[change-password] RESEND_API_KEY missing; confirmation email not sent');
    } else {
      const appOrigin = Deno.env.get('APP_ORIGIN') || 'https://app.marketingio.co.za';
      // LB-031c: link carries both the token AND the user id. The lockdown
      // function looks up the user by id (always reliable) and verifies the
      // token matches in constant time — instead of filtering AppUser by
      // lockdown_token, which proved unreliable for newly-added schema fields.
      const lockdownLink = `${appOrigin}/account-locked-down?token=${encodeURIComponent(lockdownToken)}&uid=${encodeURIComponent(user.id)}`;
      const whenSast = formatSastDateTime(now);
      const fullName = String(user.full_name || 'there');
      const bodyHtml = `
        <p style="margin:0 0 16px 0;">Hi ${fullName},</p>
        <p style="margin:0 0 16px 0;">Your Marketing iO account password was just changed on <strong>${whenSast} (SAST)</strong>.</p>
        <p style="margin:0 0 8px 0;"><strong>Was this you?</strong> Great — no action needed.</p>
        <p style="margin:0 0 24px 0;"><strong>Wasn't you?</strong> Click the button below immediately to lock down your account:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px auto;">
          <tr><td align="center" bgcolor="#dc2626" style="border-radius:8px;">
            <a href="${lockdownLink}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
              🔒 This wasn't me — secure my account now
            </a>
          </td></tr>
        </table>
        <p style="margin:0 0 8px 0;">Clicking the button will:</p>
        <ul style="margin:0 0 16px 24px;padding:0;">
          <li>Sign you out of all devices</li>
          <li>Force a fresh password reset on next login</li>
          <li>Alert the Marketing iO team to investigate</li>
        </ul>
        <p style="color:#64748b;font-size:14px;margin:0 0 16px 0;">The link expires in <strong>24 hours</strong>. If you can't click it in time, email <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a> immediately.</p>
        <p style="color:#94a3b8;font-size:13px;margin:0 0 4px 0;">For your records: this change was made from IP <strong>${ipAddress}</strong> at ${whenSast} (SAST).</p>
        <p style="color:#94a3b8;font-size:13px;margin:24px 0 0 0;">— The Marketing iO Team<br/>Marketing iO (Pty) Ltd · marketingio.co.za · info@marketingio.co.za</p>
      `;
      const resend = new Resend(apiKey);
      const sendResult = await resend.emails.send({
        from: 'Marketing iO Team <hello@marketingio.co.za>',
        to: user.email,
        subject: 'Your Marketing iO password was just changed',
        html: wrapEmail(bodyHtml),
      });
      if (sendResult?.error) {
        console.error('[change-password] confirmation email send error:', sendResult.error);
      }
    }
  } catch (mailErr) {
    console.error('[change-password] confirmation email failed (non-fatal):', mailErr?.message);
  }

  return Response.json({ success: true, password_expires_at: expiresAt });
});
