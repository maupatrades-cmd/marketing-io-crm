import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEAD_EMAIL = 'head@marketingio.co.za';
const FROM = 'Marketing iO Team <hello@marketingio.co.za>';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const PORTAL_URL = 'https://app.marketingio.co.za/client-portal';

function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td align="center" valign="middle" background="https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg" bgcolor="#0f172a" style="background-color:#0f172a;background-image:url('https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg');background-position:center center;background-size:cover;background-repeat:no-repeat;padding:60px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="280" style="width:280px;max-width:80%;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 0 24px rgba(167,100,230,0.85)) drop-shadow(0 0 48px rgba(236,72,153,0.55));" />
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

function escapeHtml(s: string): string {
  return String(s).replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function fmtZAR(n: number): string {
  return `R${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function lineItemsTable(items: any[]): string {
  if (!Array.isArray(items) || items.length === 0) return '';
  const rows = items.map(li => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;">${escapeHtml(li.product_name || li.description || 'Item')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center;">${li.quantity || 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;">${fmtZAR(Number(li.amount || 0) * (li.quantity || 1))}</td>
    </tr>`).join('');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:16px 0;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const apiKey = Deno.env.get('RESEND_API_KEY');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { payment_id } = body;
  if (!payment_id) {
    return Response.json({ error: 'payment_id required' }, { status: 400 });
  }

  if (!apiKey) {
    console.error('[send-payment-receipt-email] RESEND_API_KEY missing');
    return Response.json({ success: false, reason: 'resend_not_configured' });
  }
  const resend = new Resend(apiKey);

  // Fetch Payment.
  const payments = await base44.asServiceRole.entities.Payment.filter({ id: payment_id });
  const payment = Array.isArray(payments) ? payments[0] : payments;
  if (!payment) {
    return Response.json({ error: 'Payment not found' }, { status: 404 });
  }

  // Fetch Invoice + Client.
  const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: payment.invoice_id });
  const invoice = Array.isArray(invoices) ? invoices[0] : invoices;
  const clients = await base44.asServiceRole.entities.Client.filter({ id: payment.client_id });
  const client = Array.isArray(clients) ? clients[0] : clients;

  if (!invoice || !client) {
    return Response.json({ error: 'Invoice or Client not found' }, { status: 404 });
  }

  const firstName = (client.contact_person?.split(' ')[0]) || client.business_name || 'there';
  const invoiceNumber = invoice.invoice_number || invoice.id;
  const totalPaid = Number(payment.amount || invoice.total || invoice.total_amount || 0);
  const ref = payment.gateway_pf_payment_id || payment.gateway_reference || payment.id;

  const lineItemsHtml = lineItemsTable(invoice.line_items || []);

  const clientHtml = wrapEmail(`
    <h1 style="margin:0 0 8px 0;font-size:24px;color:#0f172a;">Payment received — thank you, ${escapeHtml(firstName)} 🎉</h1>
    <p style="margin:0 0 16px 0;color:#475569;">We've received your payment for <strong>Invoice ${escapeHtml(invoiceNumber)}</strong>. Your project is officially in motion.</p>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px 20px;margin:16px 0;">
      <div style="font-size:12px;text-transform:uppercase;color:#16a34a;letter-spacing:0.5px;margin-bottom:4px;">Total Paid</div>
      <div style="font-size:28px;font-weight:700;color:#0f172a;">${fmtZAR(totalPaid)}</div>
    </div>

    ${lineItemsHtml}

    <p style="margin:16px 0 8px 0;font-size:13px;color:#64748b;">
      <strong>Payment reference:</strong> ${escapeHtml(ref)}<br>
      <strong>Date:</strong> ${new Date(payment.completed_at || Date.now()).toLocaleString('en-ZA')}
    </p>

    <h3 style="margin:24px 0 8px 0;font-size:16px;color:#0f172a;">What happens next</h3>
    <ul style="margin:0 0 16px 18px;padding:0;color:#475569;font-size:14px;">
      <li>Your team is notified and will reach out within 24 hours.</li>
      <li>Track your project anytime in the <a href="${PORTAL_URL}" style="color:#a764e6;">Marketing iO Portal</a>.</li>
      <li>Need help? Reply to this email or contact ☎ 010 102 0534.</li>
    </ul>

    <p style="margin:16px 0 0 0;color:#475569;">— The Marketing iO Team</p>
  `);

  const ownerHtml = `
    <h2 style="margin:0 0 8px 0;color:#16a34a;">💰 New payment — ${fmtZAR(totalPaid)}</h2>
    <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;margin:12px 0;">
      <tr><td style="color:#64748b;">Business</td><td><strong>${escapeHtml(client.business_name || '')}</strong></td></tr>
      <tr><td style="color:#64748b;">Contact</td><td>${escapeHtml(client.contact_person || '')}</td></tr>
      <tr><td style="color:#64748b;">Email</td><td>${escapeHtml(client.email || '')}</td></tr>
      <tr><td style="color:#64748b;">Phone</td><td>${escapeHtml(client.phone || '—')}</td></tr>
      <tr><td style="color:#64748b;">Invoice</td><td>${escapeHtml(invoiceNumber)}</td></tr>
      <tr><td style="color:#64748b;">Type</td><td>${escapeHtml(invoice.type || invoice.invoice_type || '')}</td></tr>
      <tr><td style="color:#64748b;">Amount</td><td><strong>${fmtZAR(totalPaid)}</strong></td></tr>
      <tr><td style="color:#64748b;">Reference</td><td>${escapeHtml(ref)}</td></tr>
    </table>
    <p><a href="https://app.marketingio.co.za/clients/${client.id}" style="color:#a764e6;">Open client record →</a></p>
  `;

  let clientSent = false;
  let ownerSent = false;

  if (client.email) {
    try {
      await resend.emails.send({
        from: FROM,
        to: client.email,
        subject: `Payment received — Invoice ${invoiceNumber} paid`,
        html: clientHtml
      });
      clientSent = true;
    } catch (err) {
      console.error('[send-payment-receipt-email] client send failed:', err);
    }
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: HEAD_EMAIL,
      subject: `[NEW PAYMENT] R${totalPaid.toFixed(2)} from ${client.business_name || client.id}`,
      html: ownerHtml
    });
    ownerSent = true;
  } catch (err) {
    console.error('[send-payment-receipt-email] head send failed:', err);
  }

  return Response.json({ success: true, client_email_sent: clientSent, owner_email_sent: ownerSent });
});
