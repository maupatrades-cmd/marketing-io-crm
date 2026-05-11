import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEAD_EMAIL = 'head@marketingio.co.za';
const FROM = 'Marketing iO Team <hello@marketingio.co.za>';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const APP_URL = 'https://app.marketingio.co.za';

const CANCELLABLE_STATUSES = ['issued', 'pending_payment', 'sent', 'overdue', 'draft', 'failed', 'partial'];

function escapeHtml(s) {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtMoney(n) {
  return `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function wrapEmail(bodyHtml) {
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

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { invoice_id, reason, session_token, admin_cancel } = body || {};
  if (!invoice_id) return Response.json({ error: 'invoice_id required' }, { status: 400 });

  // Auth: admin_cancel uses session_token, client self-cancel uses same
  let appUser = null;
  if (session_token) {
    try {
      const users = await base44.asServiceRole.entities.AppUser.filter({ session_token });
      appUser = Array.isArray(users) ? users[0] : users;
    } catch (err) {
      console.error('[cancel-invoice] session lookup failed:', err);
    }
  }
  if (!appUser?.id && !admin_cancel) {
    return Response.json({ error: 'invalid_session' }, { status: 401 });
  }

  // For admin_cancel without session_token, use service role validation
  if (!appUser?.id && admin_cancel) {
    try {
      const me = await base44.auth.me();
      if (!me) return Response.json({ error: 'unauthorized' }, { status: 401 });
      appUser = me;
    } catch {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  // Load invoice
  let invoice = null;
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
      detail: `Invoice status is ${invoice.status}; already paid or cancelled.`
    }, { status: 400 });
  }

  // Load client
  let client = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (err) {
    console.error('[cancel-invoice] client lookup failed:', err);
  }

  const nowIso = new Date().toISOString();
  const reasonText = (reason && String(reason).trim()) || 'No reason provided';
  const cancellerName = appUser?.full_name || appUser?.email || 'Admin';

  // Update invoice
  try {
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      status: 'cancelled',
      cancellation_reason: reasonText,
      cancelled_at: nowIso,
      cancelled_by_id: appUser?.id || '',
      cancelled_by_name: cancellerName,
    });
  } catch (err) {
    console.error('[cancel-invoice] update failed:', err?.message);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const invNumber = invoice.invoice_number || invoice.id;
  const amount = Number(invoice.total ?? invoice.total_amount ?? invoice.amount ?? 0);

  if (apiKey) {
    const resend = new Resend(apiKey);

    // 1. Generate AI cancel-recovery image
    let imageUrl = null;
    try {
      const imageRes = await base44.asServiceRole.integrations.Core.GenerateImage({
        prompt: `Bold and motivating marketing recovery email hero image for a South African SME business called "${client?.business_name || 'your business'}". Show a dynamic upward trajectory, vibrant purple-to-pink gradient background (#a764e6 to #ec4899), bold typography overlay with the text "We're Here When You're Ready", a smartphone displaying a thriving social media dashboard, and confetti-style particles. Clean, modern, professional. Aspect ratio 600x300.`,
      });
      imageUrl = imageRes?.url || null;
    } catch (imgErr) {
      console.error('[cancel-invoice] image generation failed (non-fatal):', imgErr?.message);
    }

    // 2. Send email to CLIENT
    if (client?.email) {
      const imageBlock = imageUrl
        ? `<img src="${imageUrl}" alt="Marketing iO" width="552" style="width:100%;max-width:552px;border-radius:10px;display:block;margin:0 auto 24px auto;" />`
        : '';
      try {
        await resend.emails.send({
          from: FROM,
          to: client.email,
          subject: `Your invoice ${invNumber} has been cancelled — Marketing iO`,
          html: wrapEmail(`
            ${imageBlock}
            <h1 style="margin:0 0 8px 0;font-size:22px;color:#0f172a;">Invoice Cancelled</h1>
            <p style="margin:0 0 16px 0;color:#475569;">Hi ${escapeHtml(client.contact_person || client.business_name)},</p>
            <p style="margin:0 0 16px 0;color:#475569;">
              We've cancelled the following invoice at the request of our team. No payment is required for this invoice.
            </p>
            <table cellpadding="8" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 24px 0;background:#f8fafc;border-radius:8px;width:100%;">
              <tr><td style="color:#64748b;width:160px;padding:8px 12px;">Invoice</td><td style="padding:8px 12px;"><strong>${escapeHtml(invNumber)}</strong></td></tr>
              <tr style="background:#f1f5f9;"><td style="color:#64748b;padding:8px 12px;">Amount</td><td style="padding:8px 12px;">${fmtMoney(amount)}</td></tr>
              <tr><td style="color:#64748b;padding:8px 12px;">Reason</td><td style="padding:8px 12px;">${escapeHtml(reasonText)}</td></tr>
              <tr style="background:#f1f5f9;"><td style="color:#64748b;padding:8px 12px;">Cancelled by</td><td style="padding:8px 12px;">${escapeHtml(cancellerName)}</td></tr>
            </table>
            <p style="margin:0 0 24px 0;color:#475569;">
              If you have any questions about this cancellation or would like to restart your journey with us, 
              we'd love to help. Marketing iO — because I owe my business to be there.
            </p>
            <a href="mailto:info@marketingio.co.za" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Contact Us →</a>
          `)
        });
      } catch (err) {
        console.error('[cancel-invoice] client email failed (non-fatal):', err?.message);
      }
    }

    // 3. Notify head@
    if (client) {
      try {
        await resend.emails.send({
          from: FROM,
          to: HEAD_EMAIL,
          subject: `[INVOICE CANCELLED] ${invNumber} — ${client.business_name || ''} — ${fmtMoney(amount)}`,
          html: wrapEmail(`
            <h1 style="margin:0 0 8px 0;font-size:22px;color:#0f172a;">Invoice Cancelled by Admin</h1>
            <p style="margin:0 0 16px 0;color:#475569;">An invoice was cancelled${admin_cancel ? ' by an admin' : ' from the client portal'}.</p>
            <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 20px 0;">
              <tr><td style="color:#64748b;width:160px;">Business</td><td><strong>${escapeHtml(client.business_name || '—')}</strong></td></tr>
              <tr><td style="color:#64748b;">Contact</td><td>${escapeHtml(client.contact_person || '—')}</td></tr>
              <tr><td style="color:#64748b;">Email</td><td>${escapeHtml(client.email || '—')}</td></tr>
              <tr><td style="color:#64748b;">Invoice</td><td>${escapeHtml(invNumber)}</td></tr>
              <tr><td style="color:#64748b;">Amount</td><td>${fmtMoney(amount)}</td></tr>
              <tr><td style="color:#64748b;">Cancelled by</td><td>${escapeHtml(cancellerName)}</td></tr>
              <tr><td style="color:#64748b;vertical-align:top;">Reason</td><td>${escapeHtml(reasonText)}</td></tr>
            </table>
            <a href="${APP_URL}/clients/${escapeHtml(client.id)}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Review client →</a>
          `)
        });
      } catch (err) {
        console.error('[cancel-invoice] head notification failed (non-fatal):', err?.message);
      }
    }
  }

  // Activity log
  base44.functions.invoke('log-client-activity', {
    client_id: invoice.client_id,
    user_id: appUser?.id || '',
    client_name: client?.business_name || '',
    title: `Invoice ${invNumber} cancelled`,
    body: `Cancelled by ${cancellerName}. Reason: ${reasonText}`,
    icon: 'XCircle',
    category: 'warning',
    source: 'cancellation',
    link: '/client/invoices'
  }).catch((err) => {
    console.error('[cancel-invoice] log-client-activity failed (non-fatal):', err?.message);
  });

  return Response.json({ success: true, invoice_id: invoice.id, invoice_number: invNumber });
});