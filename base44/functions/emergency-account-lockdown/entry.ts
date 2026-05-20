import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// LB-031c (redeploy): logic identical to PR #106. Base44's builder got
// stuck on a stale artifact after #106 merged — frontend + change-password
// updates deployed but this function kept serving the old filter-by-token
// path, returning phantom "invalid or has already been used" on fresh
// tokens. This single-file PR has no semantic changes vs main; the new
// content hash forces Base44 to rebuild and redeploy.
//
// LB-031c: emergency account lockdown — the destructive side of the
// "this wasn't me" confirmation flow.
//
// IMPORTANT design decision: this endpoint is POST-only.
// The email link points at the SPA route /account-locked-down?token=XYZ
// (a passive page that just displays a "Confirm lockdown" button), NOT at
// this function. Outlook/Gmail/iOS Mail link previewers fetch with GET, so
// requiring POST + an explicit user click eliminates the silent-lockdown
// footgun. GET requests to this endpoint return 405 Method Not Allowed.
//
// Body: { token: string, user_id: string }
// Lookup strategy: by user_id (always indexed / reliable), then verify the
// supplied token matches the stored lockdown_token in constant time. We
// switched away from AppUser.filter({ lockdown_token: ... }) because that
// filter proved unreliable for newly-added schema fields on Base44 — the
// token was being persisted, but the filter would return zero matches,
// producing a phantom "invalid or has already been used" message.
//
// On success:
//   - bumps force_logout_at to invalidate every existing session (LB-025)
//   - sets password_reset_required = true (consumed by auth-login)
//   - clears lockdown_token / lockdown_token_expires_at (single-use)
//   - triggers a password reset email via send-forgot-password-email
//   - emails the owner alert address (OWNER_ALERT_EMAIL env, fallback info@)

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

// Constant-time string compare to avoid leaking the stored lockdown_token
// via timing differences when an attacker iterates candidate values.
function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  }

  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const token = String(body?.token || '');
  const userId = String(body?.user_id || '');
  if (!token || !userId) {
    return Response.json({ error: 'token_and_user_id_required' }, { status: 400 });
  }

  // Look up the user by id (reliable) then verify the token matches.
  let user = null;
  try {
    const matches = await base44.asServiceRole.entities.AppUser.filter({ id: userId });
    user = (Array.isArray(matches) ? matches[0] : null) || null;
  } catch (err) {
    console.error('[emergency-account-lockdown] lookup failed:', err);
    return Response.json({ error: 'lookup_failed' }, { status: 500 });
  }

  // Single invalid_token response covers all three rejection paths (no user,
  // no stored token, token mismatch) so callers can't probe which case hit.
  if (!user || !user.lockdown_token || !tokensMatch(user.lockdown_token, token)) {
    return Response.json({
      error: 'invalid_token',
      message: 'This lockdown link is invalid or has already been used.',
    }, { status: 400 });
  }

  if (!user.lockdown_token_expires_at || new Date(user.lockdown_token_expires_at) < new Date()) {
    return Response.json({
      error: 'expired_token',
      message: 'This lockdown link has expired. Contact info@marketingio.co.za immediately.',
    }, { status: 400 });
  }

  const now = new Date();
  const ipAddress = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || req.headers.get('x-real-ip') || 'unknown';

  // Apply the lockdown
  try {
    await base44.asServiceRole.entities.AppUser.update(user.id, {
      force_logout_at: now.toISOString(),
      password_reset_required: true,
      lockdown_token: null,
      lockdown_token_expires_at: null,
      session_token: null,
      session_expires_at: null,
    });
  } catch (err) {
    console.error('[emergency-account-lockdown] update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Trigger a password-reset email so the user has a working reset link
  // waiting when they next try to log in.
  try {
    await base44.functions.invoke('send-forgot-password-email', { email: user.email });
  } catch (err) {
    console.error('[emergency-account-lockdown] reset-email trigger failed (non-fatal):', err?.message);
  }

  // Owner alert
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const ownerEmail = Deno.env.get('OWNER_ALERT_EMAIL') || 'info@marketingio.co.za';
    if (apiKey) {
      const resend = new Resend(apiKey);
      const whenSast = formatSastDateTime(now);
      const passwordChangedSast = user.password_changed_at
        ? formatSastDateTime(new Date(user.password_changed_at))
        : 'unknown';
      const bodyHtml = `
        <p style="margin:0 0 16px 0;"><strong>⚠️ Emergency lockdown triggered</strong></p>
        <p style="margin:0 0 8px 0;">A user clicked the "this wasn't me" link after a recent password change.</p>
        <table role="presentation" cellpadding="6" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse;font-size:14px;">
          <tr><td style="color:#64748b;">User email:</td><td><strong>${user.email}</strong></td></tr>
          <tr><td style="color:#64748b;">User full name:</td><td>${user.full_name || '(none)'}</td></tr>
          <tr><td style="color:#64748b;">User role:</td><td>${user.role || 'client'}</td></tr>
          <tr><td style="color:#64748b;">Password changed at:</td><td>${passwordChangedSast} (SAST)</td></tr>
          <tr><td style="color:#64748b;">Lockdown confirmed at:</td><td>${whenSast} (SAST)</td></tr>
          <tr><td style="color:#64748b;">IP of lockdown click:</td><td>${ipAddress}</td></tr>
        </table>
        <p style="margin:0 0 8px 0;">Actions already taken automatically:</p>
        <ul style="margin:0 0 16px 24px;padding:0;">
          <li>All active sessions invalidated</li>
          <li>password_reset_required flag set — user must reset before next login</li>
          <li>Password reset email triggered to the user</li>
        </ul>
        <p style="color:#94a3b8;font-size:13px;margin:0;">This is an automated alert from Marketing iO security tooling.</p>
      `;
      await resend.emails.send({
        from: 'Marketing iO Security <hello@marketingio.co.za>',
        to: ownerEmail,
        subject: `[Security] Emergency lockdown: ${user.email}`,
        html: wrapEmail(bodyHtml),
      });
    } else {
      console.error('[emergency-account-lockdown] RESEND_API_KEY missing; owner alert not sent');
    }
  } catch (err) {
    console.error('[emergency-account-lockdown] owner alert failed (non-fatal):', err?.message);
  }

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
        event_type: 'account_lockdown_triggered',
        event_category: 'auth',
        event_summary: '"This wasn\'t me" lockdown triggered',
        event_metadata: {},
        event_label: 'Account lockdown',
        logged_by: user.id,
        logged_by_name: String(user.full_name || user.email || ''),
        ip_address: ipAddress.slice(0, 64),
        user_agent: (req.headers.get('user-agent') || '').slice(0, 500),
      });
    }
  } catch (logErr) {
    console.error('[emergency-account-lockdown] activity log failed (non-fatal):', logErr?.message);
  }

  return Response.json({ success: true });
});
