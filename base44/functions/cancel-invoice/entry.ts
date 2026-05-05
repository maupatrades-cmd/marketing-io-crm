import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEAD_EMAIL = 'head@marketingio.co.za';
const FROM = 'Marketing iO Team <hello@marketingio.co.za>';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const APP_URL = 'https://app.marketingio.co.za';

// Statuses where self-service cancellation is allowed.
const CANCELLABLE_STATUSES = ['issued', 'pending_payment', 'sent', 'overdue'];

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { invoice_id, reason, session_token } = body || {};
  if (!invoice_id) return Response.json({ error: 'invoice_id required' }, { status: 400 });
  if (!session_token) return Response.json({ error: 'session_token required' }, { status: 401 });

  // Validate session — mirrors submit-enquiry pattern.
  let appUser: any = null;
  try {
    const users = await base44.asServiceRole.entities.AppUser.filter({ session_token });
    appUser = Array.isArray(users) ? users[0] : users;
  } catch (err) {
    console.error('[cancel-invoice] session lookup failed:', err);
  }
  if (!appUser?.id) {
    return Response.json({ error: 'invalid_session' }, { status: 401 });
  }

  // Load invoice.
  let invoice: any = null;
  try {
    const rows = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id });
    invoice = Array.isArray(rows) ? rows[0] : rows;
  } catch (err) {
    console.error('[cancel-invoice] invoice lookup failed:', err);
  }
  if (!invoice) return Response.json({ error: 'invoice_not_found' }, { status: 404 });

  if (!CANCELLABLE_STATUSES.includes(invoice.status)) {
    return Response.json({
      error: 'cannot_cancel',
      detail: `Invoice status is ${invoice.status}; only ${CANCELLABLE_STATUSES.join('/')} can be cancelled.`
    }, { status: 400 });
  }

  // Resolve client for the email and activity entry.
  let client: any = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (err) {
    console.error('[cancel-invoice] client lookup failed:', err);
  }

  const nowIso = new Date().toISOString();
  const reasonText = (reason && String(reason).trim()) || 'No reason provided';

  try {
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      status: 'cancelled',
      cancellation_reason: reasonText,
      cancelled_at: nowIso,
      cancelled_by: appUser.id
    });
  } catch (err: any) {
    console.error('[cancel-invoice] update failed:', err?.message);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Notify head@ — best-effort.
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (apiKey && client) {
    const resend = new Resend(apiKey);
    const invNumber = invoice.invoice_number || invoice.id;
    const amount = Number(invoice.total ?? invoice.total_amount ?? invoice.amount ?? 0);
    const amountLabel = amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    try {
      await resend.emails.send({
        from: FROM,
        to: HEAD_EMAIL,
        subject: `[INVOICE CANCELLED] ${invNumber} — ${client.business_name || ''}`,
        html: wrapEmail(`
          <h1 style="margin:0 0 8px 0;font-size:22px;color:#0f172a;">Invoice cancelled by client</h1>
          <p style="margin:0 0 16px 0;color:#475569;">A client just cancelled an unpaid invoice from the portal.</p>
          <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 20px 0;">
            <tr><td style="color:#64748b;width:160px;">Business</td><td><strong>${escapeHtml(client.business_name || '—')}</strong></td></tr>
            <tr><td style="color:#64748b;">Contact</td><td>${escapeHtml(client.contact_person || '—')}</td></tr>
            <tr><td style="color:#64748b;">Invoice</td><td>${escapeHtml(invNumber)}</td></tr>
            <tr><td style="color:#64748b;">Amount</td><td>R${escapeHtml(amountLabel)}</td></tr>
            <tr><td style="color:#64748b;vertical-align:top;">Reason</td><td>${escapeHtml(reasonText)}</td></tr>
          </table>
          <a href="${APP_URL}/clients/${escapeHtml(client.id)}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Review client →</a>
        `)
      });
    } catch (err: any) {
      console.error('[cancel-invoice] head notification failed (non-fatal):', err?.message);
    }
  }

  // Portal activity feed entry — non-blocking, fire-and-forget.
  base44.functions.invoke('log-client-activity', {
    client_id: invoice.client_id,
    user_id: appUser.id,
    client_name: client?.business_name || '',
    title: `Invoice ${invoice.invoice_number || invoice.id} cancelled`,
    body: 'You cancelled this invoice. Owner has been notified.',
    icon: 'XCircle',
    category: 'warning',
    source: 'cancellation',
    link: '/client/invoices'
  }).catch((err: any) => {
    console.error('[cancel-invoice] log-client-activity failed (non-fatal):', err?.message);
  });

  return Response.json({ success: true });
});
