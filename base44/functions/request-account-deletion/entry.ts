import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEAD_EMAIL = 'head@marketingio.co.za';
const FROM = 'Marketing iO Team <hello@marketingio.co.za>';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const GRACE_DAYS = 30;

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
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { user_id } = body || {};
  if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

  // Find AppUser.
  let appUser: any = null;
  try {
    const found = await base44.asServiceRole.entities.AppUser.filter({ id: user_id });
    appUser = Array.isArray(found) ? found[0] : found;
  } catch (err) {
    console.error('[request-account-deletion] AppUser lookup failed:', err);
  }
  if (!appUser) return Response.json({ error: 'user_not_found' }, { status: 404 });

  if (appUser.deletion_pending) {
    return Response.json({
      success: true,
      already_pending: true,
      deletion_requested_at: appUser.deletion_requested_at
    });
  }

  const nowIso = new Date().toISOString();
  const graceEnd = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  const graceEndIso = graceEnd.toISOString();

  try {
    await base44.asServiceRole.entities.AppUser.update(appUser.id, {
      deletion_pending: true,
      deletion_requested_at: nowIso
    });
  } catch (err: any) {
    console.error('[request-account-deletion] update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Best-effort notifications. Errors here must not fail the deletion request.
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (apiKey) {
    const resend = new Resend(apiKey);
    const userName = appUser.full_name || appUser.first_name || 'there';
    const graceHuman = graceEnd.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });

    try {
      await resend.emails.send({
        from: FROM,
        to: appUser.email,
        subject: 'Account deletion requested — 30-day grace period started',
        html: wrapEmail(`
          <h1 style="margin:0 0 8px 0;font-size:22px;color:#0f172a;">Account deletion requested</h1>
          <p style="margin:0 0 16px 0;color:#475569;">Hi ${escapeHtml(userName)},</p>
          <p style="margin:0 0 12px 0;color:#475569;">We've received your request to delete your Marketing iO account. To comply with POPIA, your account will enter a <strong>30-day grace period</strong> before permanent deletion.</p>
          <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:14px 18px;margin:18px 0;color:#78350f;font-size:14px;">
            Your account will be permanently deleted on <strong>${escapeHtml(graceHuman)}</strong>.
          </div>
          <p style="margin:0 0 12px 0;color:#475569;">If you change your mind, sign in any time before that date and we'll cancel the request — no questions asked.</p>
          <p style="margin:16px 0 0 0;color:#475569;">— The Marketing iO Team</p>
        `)
      });
    } catch (err) {
      console.error('[request-account-deletion] user confirmation email failed:', err);
    }

    try {
      await resend.emails.send({
        from: FROM,
        to: HEAD_EMAIL,
        subject: `[ACCOUNT DELETION] ${appUser.email} requested deletion`,
        html: `
          <h2 style="margin:0 0 8px 0;color:#0f172a;">Account deletion requested</h2>
          <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;margin:8px 0;">
            <tr><td style="color:#64748b;width:160px;">User</td><td><strong>${escapeHtml(appUser.full_name || '—')}</strong></td></tr>
            <tr><td style="color:#64748b;">Email</td><td>${escapeHtml(appUser.email || '—')}</td></tr>
            <tr><td style="color:#64748b;">Mobile</td><td>${escapeHtml(appUser.mobile_number || '—')}</td></tr>
            <tr><td style="color:#64748b;">Requested</td><td>${escapeHtml(nowIso)}</td></tr>
            <tr><td style="color:#64748b;">Grace ends</td><td>${escapeHtml(graceEndIso)}</td></tr>
          </table>
          <p style="margin-top:16px;color:#475569;font-size:13px;">No action required — system will purge after 30 days unless the user signs back in to cancel.</p>
        `
      });
    } catch (err) {
      console.error('[request-account-deletion] head notification failed:', err);
    }
  }

  return Response.json({
    success: true,
    deletion_requested_at: nowIso,
    grace_ends_at: graceEndIso,
    grace_days: GRACE_DAYS
  });
});
