import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
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
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

const statusMessages = {
  awaiting_client: {
    subject: 'Your deliverable is ready for review',
    message: (title, clientName) => `Hi ${clientName},<br><br>Your deliverable <strong>${title}</strong> is ready for your review. You have 5 business days to approve or request changes. Please <a href="https://app.marketingio.co.za/client/deliverables" style="color:#a764e6;">view it in your portal</a>.`
  },
  client_reviewing: {
    subject: 'We received your feedback',
    message: (title, clientName) => `Hi ${clientName},<br><br>We received your feedback on <strong>${title}</strong>. Our team is working on your requested changes.`
  },
  in_progress: {
    subject: 'Work in progress on your deliverable',
    message: (title, clientName) => `Hi ${clientName},<br><br>We're actively working on <strong>${title}</strong>. Check your portal for progress updates.`
  },
  completed: {
    subject: 'Deliverable completed!',
    message: (title, clientName) => `Hi ${clientName},<br><br>Your deliverable <strong>${title}</strong> has been completed and approved. Thank you!`
  }
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { deliverable_id, old_status, new_status } = await req.json();

  if (!deliverable_id || !new_status) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const deliverable = await base44.asServiceRole.entities.Deliverable.filter({ id: deliverable_id });
    if (!deliverable || !deliverable[0]) {
      return Response.json({ success: false, message: 'Deliverable not found' }, { status: 404 });
    }

    const del = deliverable[0];
    const client = await base44.asServiceRole.entities.Client.filter({ id: del.client_id });
    if (!client || !client[0]) {
      return Response.json({ success: true, message: 'Client not found' }, { status: 200 });
    }

    const c = client[0];
    const config = statusMessages[new_status];
    if (!config || !c.email) {
      return Response.json({ success: true });
    }

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">${config.message(del.title, c.contact_person || 'there')}</p>
      <p style="font-size:14px;color:#94a3b8;margin:0;"><a href="https://app.marketingio.co.za/client/portal" style="color:#a764e6;">Go to your portal →</a></p>`;

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: 'Marketing iO Team <hello@marketingio.co.za>',
        to: c.email,
        subject: config.subject,
        html: wrapEmail(bodyHtml)
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[notify-client-deliverable-update]', err);
    return Response.json({ success: true });
  }
});