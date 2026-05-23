import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// contract-send-for-signature-wrapped — admin/owner action to send the signing
// email to a client.
//
// This is the working replacement for the legacy send-contract-for-signature
// function, whose base44.auth.me() auth check returns null for every real
// mio_session_token caller (LB-249) and so 401s every "Send for Signature"
// click silently. This wrapper validates the session via auth-me invoke
// instead, then does the entire job standalone — no dependency on the
// broken inner gate. The legacy function is now dead code; flagged for
// deletion in a follow-up.
//
// Idempotent: rows whose last_signature_email_sent_at is within the last 24h
// return { success:true, skipped:true } and do not re-send.
//
// Out of scope (handled in the parallel signing-chain workstream):
//   LB-045 — weak Math.random tokens on legacy contracts
//   LB-046 — non-atomic Contract+Signature writes on the signing page
//   LB-047 — token replay invalidation after use
//   LB-048 — placeholder PDF preview
//   LB-049 — mobile signing canvas
//   LB-050 — SA-ID plaintext storage
//
// This function only restores the intended email/token dispatch flow.
// =============================================================================

const ALLOWED_ROLES = ['owner', 'admin'];

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL       = Deno.env.get('APP_URL') || 'https://app.marketingio.co.za';
const FROM_EMAIL    = 'Marketing iO <contracts@marketingio.co.za>';

const RESEND_24H_WINDOW_MS = 24 * 60 * 60 * 1000;
const SIGNING_LINK_TTL_MS  = 30 * 24 * 60 * 60 * 1000;

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function errMsg(e: unknown): string {
  if (!e) return 'unknown_error';
  if (typeof e === 'string') return e;
  return (e as any)?.message || String(e);
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function fmtZar(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const nowIso = () => new Date().toISOString();

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token       = String(body?.token ?? '').trim();
  const contract_id = String(body?.contract_id ?? '').trim();

  if (!token)       return Response.json({ error: 'token_required' }, { status: 401 });
  if (!contract_id) return Response.json({ error: 'contract_id required' }, { status: 400 });

  // Session validation.
  let actor: { userId: string; role: string; name: string } | null = null;
  try {
    const authRes  = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      actor = {
        userId: String(authData.user.id || ''),
        role:   String(authData.user.role || 'client'),
        name:   String(authData.user.full_name || authData.user.email || 'Staff'),
      };
    }
  } catch (err) {
    console.error('[contract-send-for-signature-wrapped] auth-me failed:', errMsg(err));
  }
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Lookup contract.
  let contract: any = null;
  try {
    contract = unwrap(await base44.asServiceRole.entities.Contract.filter({ id: contract_id }))[0] || null;
  } catch (err) {
    console.error('[contract-send-for-signature-wrapped] Contract lookup failed:', err);
    return Response.json({ error: 'contract_lookup_failed' }, { status: 500 });
  }
  if (!contract) return Response.json({ error: 'contract_not_found' }, { status: 404 });

  // 24h idempotency.
  if (contract.last_signature_email_sent_at) {
    const sentAt = new Date(contract.last_signature_email_sent_at).getTime();
    if (Number.isFinite(sentAt) && Date.now() - sentAt < RESEND_24H_WINDOW_MS) {
      return Response.json({
        success: true,
        skipped: true,
        reason:  'already_sent_within_24h',
        contract_id,
      });
    }
  }

  // Token safety net — generate one if the legacy row never had one. Does NOT
  // fix LB-045 for tokens that were created with Math.random (those stay until
  // the signing-chain workstream rotates them).
  let signingToken: string = String(contract.signing_token || '').trim();
  if (!signingToken) {
    signingToken = crypto.randomUUID();
    try {
      await base44.asServiceRole.entities.Contract.update(contract_id, {
        signing_token:           signingToken,
        signing_link_expires_at: new Date(Date.now() + SIGNING_LINK_TTL_MS).toISOString(),
      });
    } catch (err) {
      console.error('[contract-send-for-signature-wrapped] signing_token seed failed:', errMsg(err));
      return Response.json({ error: 'token_seed_failed', detail: errMsg(err) }, { status: 500 });
    }
  }

  // Lookup client for the email recipient.
  let client: any = null;
  try {
    client = unwrap(await base44.asServiceRole.entities.Client.filter({ id: contract.client_id }))[0] || null;
  } catch {
    /* non-fatal */
  }
  if (!client) return Response.json({ error: 'client_not_found' }, { status: 404 });

  const clientEmail = String(client.email || '').trim().toLowerCase();
  if (!clientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return Response.json({ success: false, reason: 'no_client_email', skipped: true });
  }

  // Build email.
  const packageLabel = String(contract.package || 'service').replace(/_/g, ' ');
  const subject      = `Sign your Marketing iO contract: ${packageLabel} — ${client.business_name || ''}`;
  const signingUrl   = `${APP_URL}/sign-contract?token=${signingToken}`;
  const setupFee     = Number(contract.setup_fee || 0);
  const monthly      = Number(contract.monthly_retainer || 0);
  const endDate      = contract.contract_end_date
    ? new Date(contract.contract_end_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
  const greetingName = client.contact_person || client.business_name || 'there';

  const html = wrapEmail(`
    <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Your contract is ready to sign</h1>
    <p style="margin:0 0 16px 0;">Hi ${escapeHtml(String(greetingName))},</p>
    <p style="margin:0 0 16px 0;">Your Marketing iO service agreement is ready for your signature. Please review the contract summary below and click the button to sign digitally.</p>
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;">Package</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;text-transform:capitalize;">${escapeHtml(packageLabel)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Setup Fee</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">R${fmtZar(setupFee)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Monthly Retainer</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">R${fmtZar(monthly)}/month</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Contract End Date</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(endDate)}</td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;"><tr><td>
      <a href="${signingUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Review &amp; Sign Contract →</a>
    </td></tr></table>
    <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">If the button doesn't work, copy this link into your browser:</p>
    <p style="margin:0 0 16px 0;font-size:13px;color:#64748b;word-break:break-all;"><a href="${signingUrl}" style="color:#a764e6;">${signingUrl}</a></p>
    <p style="margin:0 0 16px 0;">Questions? Reply to this email or WhatsApp us.</p>
    <p style="margin:0 0 4px 0;">— The Marketing iO Team</p>
    <p style="margin:0;font-style:italic;color:#a764e6;">Too good to stay hidden.</p>
  `);

  // Send via Resend.
  if (!RESEND_API_KEY) {
    return Response.json({ error: 'email_not_configured' }, { status: 500 });
  }

  try {
    const resend = new Resend(RESEND_API_KEY);
    const result = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [clientEmail],
      subject,
      html,
    });
    if (result?.error) {
      console.error('[contract-send-for-signature-wrapped] Resend error:', result.error);
      return Response.json({
        error:  'email_failed',
        detail: String(result.error?.message || 'resend_error'),
      }, { status: 500 });
    }
  } catch (err) {
    console.error('[contract-send-for-signature-wrapped] Resend send failed:', errMsg(err));
    return Response.json({ error: 'email_failed', detail: errMsg(err) }, { status: 500 });
  }

  // On success: update Contract status.
  try {
    await base44.asServiceRole.entities.Contract.update(contract_id, {
      status:                       'sent',
      signing_status:               'sent',
      last_signature_email_sent_at: nowIso(),
    });
  } catch (err) {
    console.error('[contract-send-for-signature-wrapped] post-send Contract.update failed:', errMsg(err));
    // Email already went out — surface a warning rather than failing the whole call.
    return Response.json({
      success:       true,
      email_sent_to: clientEmail,
      signing_url:   signingUrl,
      contract_id,
      warning:       'status_update_failed',
      detail:        errMsg(err),
    });
  }

  // Activity log — canonical LB-108-safe field names.
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      contract.client_id || '',
      client_name:    client.business_name || contract.client_name || '',
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'contract_sent_for_signature',
      event_category: 'document',
      event_summary:  `${actor.name} sent contract ${contract_id} to ${clientEmail} for signature`,
      event_label:    'Contract sent for signature',
      event_metadata: {
        contract_id,
        subject,
        signing_token_present: true,
        recipient_email:       clientEmail,
      },
      logged_by:      actor.userId,
      logged_by_name: actor.name,
    });
  } catch (err) {
    console.error('[contract-send-for-signature-wrapped] ClientActivityLog.create failed (non-fatal):', errMsg(err));
  }

  return Response.json({
    success:       true,
    skipped:       false,
    contract_id,
    email_sent_to: clientEmail,
    signing_url:   signingUrl,
  });
});
