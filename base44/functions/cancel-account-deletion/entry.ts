import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// LB-024: Cancel a pending account deletion.
//
// Two auth paths:
//   (a) Authenticated banner click — body: { token } (session_token).
//       Looks up caller's Client, verifies deletion_pending=true, clears
//       the deletion fields.
//   (b) Email-link cancel — body: { cancel_token } (the one-time
//       deletion_cancel_token from Email 1). Looks up Client by that
//       token, verifies not expired (scheduled_at still in future),
//       clears the deletion fields, AND issues a fresh session_token
//       for the linked AppUser so the user is auto-logged-in.
//
// Sends Email 2 (deletion cancelled). Writes ClientActivityLog audit row.

const FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Marketing iO Team <hello@marketingio.co.za>';

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function wrapEmail(bodyHtml: string) {
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

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { token, cancel_token } = body || {};
  if (!token && !cancel_token) {
    return Response.json({ error: 'token or cancel_token required' }, { status: 400 });
  }

  let client: any = null;
  let appUser: any = null;
  let path: 'session' | 'cancel_token' = 'session';
  let issuedSessionToken: string | null = null;
  let issuedSessionExpiresAt: string | null = null;

  if (cancel_token) {
    // Path (b): email-link cancel. Look up Client by one-time token.
    path = 'cancel_token';
    try {
      const list = unwrapList(await base44.asServiceRole.entities.Client.filter({ deletion_cancel_token: cancel_token }));
      client = list[0] || null;
    } catch (err) {
      console.error('[cancel-account-deletion] Client lookup by cancel_token failed:', err);
    }
    if (!client) return Response.json({ error: 'invalid_or_used_token' }, { status: 401 });
    if (!client.deletion_pending) return Response.json({ error: 'no_pending_deletion' }, { status: 410 });

    // Check the deletion hasn't already passed.
    if (client.deletion_scheduled_at && new Date(client.deletion_scheduled_at) < new Date()) {
      return Response.json({ error: 'deletion_already_processed' }, { status: 410 });
    }

    // Resolve linked AppUser for auto-login.
    try {
      const list = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ id: client.client_user_id }));
      appUser = list[0] || null;
    } catch (err) {
      console.error('[cancel-account-deletion] AppUser lookup failed:', err);
    }
    // appUser missing is non-fatal — we can still cancel the deletion, just
    // can't auto-login. Client may have been provisioned without an AppUser.

    // Issue a fresh session_token for auto-login. 8-hour lifetime (matches
    // auth-verify-otp).
    if (appUser) {
      issuedSessionToken = crypto.randomUUID();
      issuedSessionExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
      try {
        await base44.asServiceRole.entities.AppUser.update(appUser.id, {
          session_token: issuedSessionToken,
          session_expires_at: issuedSessionExpiresAt,
          last_login_at: new Date().toISOString(),
        });
        // Mirror to built-in User if it exists (LB-281 dual-write pattern).
        try {
          const userList = unwrapList(await base44.asServiceRole.entities.User.filter({ email: appUser.email }));
          const builtIn = userList[0];
          if (builtIn?.id) {
            await base44.asServiceRole.entities.User.update(builtIn.id, {
              session_token: issuedSessionToken,
              session_expires_at: issuedSessionExpiresAt,
              last_login_at: new Date().toISOString(),
            });
          }
        } catch (_) { /* non-fatal */ }
      } catch (err) {
        console.error('[cancel-account-deletion] session issue failed (non-fatal):', err);
        issuedSessionToken = null;
        issuedSessionExpiresAt = null;
      }
    }
  } else {
    // Path (a): authenticated banner click. Look up caller via session_token.
    try {
      const list = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ session_token: token }));
      appUser = list[0] || null;
    } catch (err) {
      console.error('[cancel-account-deletion] AppUser lookup by session failed:', err);
    }
    if (!appUser) return Response.json({ error: 'invalid_session' }, { status: 401 });
    if (!appUser.session_expires_at || new Date(appUser.session_expires_at) < new Date()) {
      return Response.json({ error: 'session_expired' }, { status: 401 });
    }

    try {
      const list = unwrapList(await base44.asServiceRole.entities.Client.filter({ client_user_id: appUser.id }));
      client = list[0] || null;
    } catch (err) {
      console.error('[cancel-account-deletion] Client lookup by user failed:', err);
    }
    if (!client) return Response.json({ error: 'no_client_record' }, { status: 404 });
    if (!client.deletion_pending) return Response.json({ error: 'no_pending_deletion' }, { status: 410 });
  }

  // Clear the deletion fields.
  try {
    await base44.asServiceRole.entities.Client.update(client.id, {
      deletion_pending: false,
      deletion_scheduled_at: null,
      deletion_cancel_token: null,
    });
  } catch (err: any) {
    console.error('[cancel-account-deletion] Client.update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Audit log (non-fatal).
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id: client.id,
      client_name: String(client.business_name || ''),
      actor_id: appUser?.id || client.client_user_id || 'unknown',
      actor_role: String(appUser?.role || 'client'),
      event_type: 'account_deletion_cancelled',
      event_category: 'account',
      event_label: 'Account deletion cancelled',
      event_summary: path === 'cancel_token'
        ? 'Pending account deletion cancelled via email link.'
        : 'Pending account deletion cancelled from in-app banner.',
      event_metadata: {
        cancel_path: path,
      },
      logged_by: appUser?.id || 'system',
      logged_by_name: String(appUser?.full_name || appUser?.email || 'system'),
    });
  } catch (err) {
    console.error('[cancel-account-deletion] activity log failed (non-fatal):', err);
  }

  // Email 2 — Deletion cancelled.
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey && appUser?.email) {
      const resend = new Resend(apiKey);
      const clientName = String(appUser.full_name || client.contact_person || 'there');

      const html = wrapEmail(`
        <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Your Marketing iO account is safe — deletion cancelled</h1>
        <p style="margin:0 0 16px 0;">Hi ${escapeHtml(clientName)},</p>
        <p style="margin:0 0 16px 0;">Good news — we've cancelled the deletion of your Marketing iO account.</p>
        <p style="margin:0 0 16px 0;">Your account is fully active again and your data is safe.</p>
        <p style="margin:0 0 16px 0;color:#b91c1c;font-size:14px;"><strong>If you didn't cancel this yourself</strong>, please contact us immediately at <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a> — someone may be accessing your account without permission.</p>
        <p style="margin:24px 0 4px 0;">Welcome back.</p>
        <p style="margin:0 0 4px 0;">— The Marketing iO Team</p>
        <p style="margin:24px 0 0 0;color:#94a3b8;font-size:12px;">Marketing iO (Pty) Ltd · marketingio.co.za · info@marketingio.co.za</p>
      `);

      await resend.emails.send({
        from: FROM,
        to: appUser.email,
        subject: 'Your Marketing iO account is safe — deletion cancelled',
        html,
      });
    }
  } catch (err) {
    console.error('[cancel-account-deletion] Email 2 send failed (non-fatal):', err);
  }

  return Response.json({
    success: true,
    cancel_path: path,
    // For email-link cancel, return the fresh session_token so the frontend
    // can call base44.auth.setToken() and auto-log-in the user.
    session_token: issuedSessionToken,
    session_expires_at: issuedSessionExpiresAt,
    user: appUser ? {
      id: appUser.id,
      email: appUser.email,
      role: appUser.role,
      full_name: appUser.full_name,
    } : null,
  });
});
