import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';

function wrapEmail(bodyHtml, ctaButton) {
  const ctaHtml = ctaButton ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
    <a href="${ctaButton.url}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">${ctaButton.text}</a>
  </td></tr></table>` : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td align="center" style="padding:28px 24px;background:linear-gradient(135deg,#080c1a 0%,#1a0a2e 100%);">
  <img src="${LOGO_URL}" height="48" alt="Marketing iO" style="display:block;height:48px;width:auto;filter:invert(1) brightness(10);margin:0 auto;" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:4px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">
  ${bodyHtml}${ctaHtml}
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" height="32" style="height:32px;width:auto;display:block;margin:0 auto 12px auto;filter:invert(1) brightness(10);" />
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
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 503 });
  }

  const resend = new Resend(apiKey);

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi Thapelo,</p>
    <p style="margin:0 0 16px 0;">This is the <strong>production wrapper test</strong>. If you see:</p>
    <ul style="margin:0 0 16px 0;padding-left:20px;color:#1e293b;">
      <li>Dark navy header with transparent logo ✅</li>
      <li>Purple → pink gradient accent strip ✅</li>
      <li>White body with this text ✅</li>
      <li>Gradient CTA button below ✅</li>
      <li>Dark navy footer with company info ✅</li>
    </ul>
    <p style="margin:0;color:#64748b;font-size:14px;">— The migration is complete and the branded wrapper is ready for production.</p>`;

  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to: 'maupatrades@gmail.com',
    subject: 'Production wrapper test — Marketing iO',
    html: wrapEmail(bodyHtml, { text: 'View Your Dashboard →', url: 'https://app.marketingio.co.za' })
  });

  if (result.error) {
    return Response.json({ success: false, error: result.error.message || JSON.stringify(result.error) }, { status: 400 });
  }

  return Response.json({ success: true, message_id: result.data?.id, sent_to: 'maupatrades@gmail.com' });
});