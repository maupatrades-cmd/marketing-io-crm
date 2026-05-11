import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';

function wrapEmail(bodyHtml, ctaButton) {
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