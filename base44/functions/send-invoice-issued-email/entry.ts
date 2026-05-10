import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// send-invoice-issued-email — PR-ADMIN-A.1.
//
// Inputs (POST JSON):
//   { invoice_id, token? }
//
// Output (success):
//   { success: true, email_sent: boolean, reason?: string }
//
// Fires the "your invoice is ready" email to the client when an invoice is
// issued. Called fire-and-forget by:
//   - create-invoice (when send_email=true)
//   - generate-monthly-retainer-invoices (transitively via create-invoice)
//
// If the client has no email on file we return success: false, reason:
// 'no_client_email' so callers can no-op cleanly without surfacing an error.
//
// Logs ClientActivityLog event_type='invoice_issued_email_sent' with
// event_category='invoice' on success.
// =============================================================================

const APP_URL  = 'https://app.marketingio.co.za';
const FROM     = 'Marketing iO Billing <hello@marketingio.co.za>';
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
  return {
    userId: String(user.id || ''),
    role:   String(user.role || 'system'),
    email:  String(user.email || ''),
    name:   String(user.full_name || ''),
  };
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function fmtZar(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDueDate(s: string): string {
  if (!s) return 'on receipt';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396498/marketing_io_email_header_zmlvtg.jpg" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396673/marketing_io_email_footer_b9dkwm.jpg" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
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

  const invoiceId = String(body?.invoice_id ?? '').trim();
  const tokenRaw  = String(body?.token ?? '').trim();
  if (!invoiceId) return Response.json({ error: 'invoice_id required' }, { status: 400 });

  const base44 = createClientFromRequest(req);

  // Resolve invoice.
  let invoice: any = null;
  try {
    const list = unwrapList(await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId }));
    invoice = list[0] || null;
  } catch (err) {
    console.error('[send-invoice-issued-email] Invoice.filter failed:', err);
  }
  if (!invoice) return Response.json({ error: 'invoice_not_found' }, { status: 404 });

  // Resolve client.
  const clientId = String(invoice.client_id || '').trim();
  if (!clientId) return Response.json({ success: false, reason: 'no_client_id' });

  let client: any = null;
  try {
    const list = unwrapList(await base44.asServiceRole.entities.Client.filter({ id: clientId }));
    client = list[0] || null;
  } catch (err) {
    console.error('[send-invoice-issued-email] Client.filter failed:', err);
  }
  if (!client) return Response.json({ success: false, reason: 'client_not_found' });

  const email = String(client.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ success: false, reason: 'no_client_email' });
  }

  const businessName     = String(client.business_name || invoice.client_name || 'your business');
  const contactFirstName = String(client.contact_person || '').split(' ')[0] || 'there';
  const invoiceNumber    = String(invoice.invoice_number || '');
  const totalAmount      = Number(invoice.total_amount ?? invoice.amount ?? 0);
  const dueDateStr       = fmtDueDate(String(invoice.due_date || ''));
  const lineItems: any[] = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  const lineItemsBlock = lineItems.length ? `
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;border-collapse:collapse;">
          <tr><td colspan="2" style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Line items</td></tr>
          ${lineItems.map((li: any) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${escapeHtml(li.description || li.product_name || 'Item')}${Number(li.quantity || 1) > 1 ? ` <span style="color:#64748b;">× ${Number(li.quantity)}</span>` : ''}</td>
              <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;text-align:right;white-space:nowrap;">R${fmtZar(Number(li.amount || 0) * Number(li.quantity || 1))}</td>
            </tr>`).join('')}
        </table>` : '';

  const invoiceUrl = `${APP_URL}/client/invoices/${invoiceId}`;

  // Send email.
  let emailSent = false;
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[send-invoice-issued-email] RESEND_API_KEY missing');
      return Response.json({ success: false, reason: 'email_not_configured' });
    }
    const resend = new Resend(apiKey);
    const html = wrapEmail(`
      <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Invoice ${escapeHtml(invoiceNumber)}</h1>
      <p style="margin:0 0 16px 0;">Dear ${escapeHtml(contactFirstName)},</p>
      <p style="margin:0 0 16px 0;">A new invoice is ready for <strong>${escapeHtml(businessName)}</strong>.</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;background:#f8fafc;border-radius:8px;">
        <tr>
          <td style="padding:12px 16px;font-size:14px;color:#64748b;">Invoice</td>
          <td style="padding:12px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">${escapeHtml(invoiceNumber)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Amount</td>
          <td style="padding:12px 16px;font-size:18px;color:#0f172a;text-align:right;font-weight:700;border-top:1px solid #e2e8f0;">R${fmtZar(totalAmount)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Due date</td>
          <td style="padding:12px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(dueDateStr)}</td>
        </tr>
      </table>
      ${lineItemsBlock}
      <table cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;"><tr><td>
        <a href="${invoiceUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">View Invoice &amp; Pay</a>
      </td></tr></table>
      <p style="margin:0 0 16px 0;">You can pay via PayFast (instant) or EFT. Banking details are on the invoice page once you log in.</p>
      <p style="margin:0 0 16px 0;font-size:14px;color:#64748b;">Questions? Reply to this email or call 010 102 0534.</p>
      <p style="margin:0 0 4px 0;">The Marketing iO Team</p>
      <p style="margin:0;font-style:italic;color:#a764e6;">Too good to stay hidden.</p>
    `);
    const result = await resend.emails.send({
      from:    FROM,
      to:      [email],
      subject: `Invoice ${invoiceNumber} from Marketing iO`,
      html,
    });
    if (result?.error) {
      console.error('[send-invoice-issued-email] Resend error:', result.error);
      return Response.json({ success: false, reason: 'resend_error', detail: String(result.error?.message || '') });
    }
    emailSent = true;
  } catch (err) {
    console.error('[send-invoice-issued-email] Resend send failed:', err);
    return Response.json({ success: false, reason: 'send_failed', detail: String((err as any)?.message || err) });
  }

  // Activity log — non-fatal.
  const actor = await deriveActor(base44, tokenRaw);
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      clientId,
      client_name:    businessName,
      actor_id:       actor?.userId || '',
      actor_role:     actor?.role || 'system',
      event_type:     'invoice_issued_email_sent',
      event_category: 'invoice',
      event_summary:  `Invoice ${invoiceNumber} email sent to ${email}`,
      event_label:    'Invoice email sent',
      event_metadata: { invoice_id: invoiceId, invoice_number: invoiceNumber, total_amount: totalAmount },
      logged_by:      actor?.userId || 'system',
      logged_by_name: actor?.name || actor?.email || 'Automation',
    });
  } catch (err) {
    console.error('[send-invoice-issued-email] ClientActivityLog.create failed (non-fatal):', err);
  }

  return Response.json({ success: true, email_sent: emailSent });
});
