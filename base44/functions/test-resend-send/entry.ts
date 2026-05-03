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
    subject: 'Resend test from Marketing iO CRM',
    html: '<div style="font-family:sans-serif;background:linear-gradient(135deg,#a764e6,#ec4899);color:white;padding:32px;text-align:center;border-radius:8px"><h1 style="margin:0">Marketing iO</h1><p style="margin:8px 0 0;font-style:italic">Too good to stay hidden.</p></div><div style="font-family:sans-serif;padding:24px;color:#1e293b"><p>Hi Thapelo,</p><p>If you\'re reading this in your inbox, Resend is wired up correctly and email delivery is working from app.marketingio.co.za.</p><p>This is a one-time test send. The full email system will use this same pipeline.</p><p>— The Marketing iO Team</p></div>'
  });

  if (result.error) {
    return Response.json({ success: false, error: result.error.message || JSON.stringify(result.error) }, { status: 400 });
  }

  return Response.json({ success: true, message_id: result.data?.id, sent_to: 'maupatrades@gmail.com' });
});