import { Resend } from 'npm:resend@3.2.0';

Deno.serve(async (req) => {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'RESEND_API_KEY not configured in environment variables' }, { status: 503 });
  }

  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to: 'maupatrades@gmail.com',
    subject: 'Logo render test — Marketing iO',
    html: `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;padding:20px 0">
  <tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:white;border-radius:12px;overflow:hidden">
      <tr>
        <td style="background:#0f172a;padding:24px 24px 20px;text-align:center">
          <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/de9bcf4a8_marketingiomainlogo.png" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto" />
        </td>
      </tr>
      <tr>
        <td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:6px 0;font-size:0;line-height:0">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 24px;color:#1e293b;font-size:16px;line-height:1.6">
          <p style="margin:0 0 16px">Hi Thapelo,</p>
          <p style="margin:0 0 16px">Logo render test — if you see the Marketing iO logo above (white on purple/pink gradient), the email wrapper is ready for production.</p>
          <p style="margin:0">— The Marketing iO Team</p>
        </td>
      </tr>
      <tr>
        <td style="background:#0f172a;padding:24px;text-align:center;color:#cbd5e1;font-size:12px">
          <p style="margin:0 0 8px;color:white;font-weight:600">Marketing iO (Pty) Ltd · CIPC 2026303502</p>
          <p style="margin:0">75 Marshall Street, Polokwane 0699 · ☎ 010 102 0534 · ✉ info@marketingio.co.za</p>
          <p style="margin:8px 0 0;color:#a764e6;font-style:italic">Too good to stay hidden.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`
  });

  if (result.error) {
    return Response.json({ success: false, error: result.error.message || JSON.stringify(result.error) }, { status: 400 });
  }

  return Response.json({ success: true, message_id: result.data?.id, sent_to: 'maupatrades@gmail.com' });
});