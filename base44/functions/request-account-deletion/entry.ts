import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// LB-024: 14-day cooling-off account deletion.
// - Auth: caller must be the user being deleted (self-deletion) OR owner/admin
//   acting on behalf. Token is the AppUser session_token from localStorage.
// - Effect: writes deletion_pending + deletion_scheduled_at (now+14d) +
//   deletion_cancel_token to the caller's CLIENT row (not AppUser).
// - Sends Email 1 with a cancel link (?token=<deletion_cancel_token>).
// - Does NOT delete anything yet. Permanent deletion is handled by
//   process-pending-deletions (daily 03:00 SAST cron).

const APP_URL  = Deno.env.get('APP_URL') || 'https://app.marketingio.co.za';
const FROM     = Deno.env.get('RESEND_FROM_EMAIL') || 'Marketing iO Team <hello@marketingio.co.za>';
const GRACE_DAYS = 14;

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

  const { user_id, token } = body || {};
  if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });
  if (!token) return Response.json({ error: 'token required' }, { status: 401 });

  // Authz: resolve caller, allow self-deletion OR owner/admin on behalf.
  let caller: any = null;
  try {
    const list = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ session_token: token }));
    caller = list[0] || null;
  } catch (err) {
    console.error('[request-account-deletion] caller lookup failed:', err);
  }
  if (!caller) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!caller.session_expires_at || new Date(caller.session_expires_at) < new Date()) {
    return Response.json({ error: 'session_expired' }, { status: 401 });
  }
  const isSelf = String(caller.id) === String(user_id);
  const isAdmin = caller.role === 'owner' || caller.role === 'admin';
  if (!isSelf && !isAdmin) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // Resolve target AppUser (in case admin is acting on behalf of someone else).
  let targetUser: any = caller;
  if (!isSelf) {
    try {
      const list = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ id: user_id }));
      targetUser = list[0] || null;
    } catch (err) {
      console.error('[request-account-deletion] target lookup failed:', err);
    }
    if (!targetUser) return Response.json({ error: 'user_not_found' }, { status: 404 });
  }

  // Find the linked Client row. Deletion state lives on Client.
  let client: any = null;
  try {
    const list = unwrapList(await base44.asServiceRole.entities.Client.filter({ client_user_id: targetUser.id }));
    client = list[0] || null;
  } catch (err) {
    console.error('[request-account-deletion] client lookup failed:', err);
  }
  if (!client) {
    // No Client linked. Staff/admin AppUsers (cpc, field_agent etc.) don't have
    // Client rows; they shouldn't be reaching this flow from the client portal.
    return Response.json({ error: 'no_client_record' }, { status: 404 });
  }

  // Idempotency: already scheduled? Return existing schedule.
  if (client.deletion_pending && client.deletion_scheduled_at) {
    return Response.json({
      success: true,
      already_pending: true,
      deletion_scheduled_at: client.deletion_scheduled_at,
    });
  }

  const cancelToken = crypto.randomUUID().replace(/-/g, '');
  const scheduledAt = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  const scheduledIso = scheduledAt.toISOString();

  try {
    await base44.asServiceRole.entities.Client.update(client.id, {
      deletion_pending: true,
      deletion_scheduled_at: scheduledIso,
      deletion_cancel_token: cancelToken,
    });
  } catch (err: any) {
    console.error('[request-account-deletion] Client.update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Audit log (non-fatal).
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id: client.id,
      client_name: String(client.business_name || ''),
      actor_id: caller.id,
      actor_role: String(caller.role || 'client'),
      event_type: 'account_deletion_requested',
      event_category: 'account',
      event_label: 'Account deletion requested',
      event_summary: `Account scheduled for deletion on ${scheduledIso.split('T')[0]}. 14-day cooling-off period started.`,
      event_metadata: {
        deletion_scheduled_at: scheduledIso,
        grace_days: GRACE_DAYS,
        on_behalf_of: isSelf ? null : targetUser.id,
      },
      logged_by: caller.id,
      logged_by_name: String(caller.full_name || caller.email || ''),
    });
  } catch (err) {
    console.error('[request-account-deletion] activity log failed (non-fatal):', err);
  }

  // Email 1 — Deletion scheduled (POPIA notice).
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey) {
      const resend = new Resend(apiKey);
      const clientName = String(targetUser.full_name || client.contact_person || 'there');
      const dateHuman = scheduledAt.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
      const cancelLink = `${APP_URL}/cancel-deletion?token=${cancelToken}`;

      const html = wrapEmail(`
        <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Your Marketing iO account will be deleted on ${escapeHtml(dateHuman)}</h1>
        <p style="margin:0 0 16px 0;">Hi ${escapeHtml(clientName)},</p>
        <p style="margin:0 0 16px 0;">We've received your request to delete your Marketing iO account.</p>
        <p style="margin:0 0 16px 0;">Your account is scheduled to be permanently deleted on <strong>${escapeHtml(dateHuman)}</strong>.</p>
        <h2 style="margin:24px 0 12px 0;color:#0f172a;font-size:18px;">Changed your mind?</h2>
        <p style="margin:0 0 16px 0;">Log back into your account before <strong>${escapeHtml(dateHuman)}</strong> and click "Cancel Deletion." Your account will be restored immediately and nothing will be lost.</p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;"><tr><td>
          <a href="${cancelLink}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Cancel Deletion</a>
        </td></tr></table>
        <p style="margin:0 0 16px 0;color:#475569;font-size:14px;">If you do nothing, your account and all your data will be permanently deleted on ${escapeHtml(dateHuman)}. This cannot be undone.</p>
        <p style="margin:0 0 16px 0;color:#b91c1c;font-size:14px;"><strong>If you didn't request this deletion</strong>, please log in immediately and cancel it — someone may be trying to access your account.</p>
        <p style="margin:24px 0 4px 0;">Thank you for being part of Marketing iO.</p>
        <p style="margin:0 0 4px 0;">— The Marketing iO Team</p>
        <p style="margin:24px 0 0 0;color:#94a3b8;font-size:12px;">Marketing iO (Pty) Ltd · marketingio.co.za · info@marketingio.co.za</p>
        <p style="margin:8px 0 0 0;color:#94a3b8;font-size:12px;">POPIA compliance: your data will be permanently removed on ${escapeHtml(dateHuman)}.</p>
      `);

      await resend.emails.send({
        from: FROM,
        to: targetUser.email,
        subject: `Your Marketing iO account will be deleted on ${dateHuman}`,
        html,
      });
    } else {
      console.error('[request-account-deletion] RESEND_API_KEY missing');
    }
  } catch (err) {
    console.error('[request-account-deletion] Email 1 send failed (non-fatal):', err);
  }

  return Response.json({
    success: true,
    deletion_scheduled_at: scheduledIso,
    grace_days: GRACE_DAYS,
  });
});
