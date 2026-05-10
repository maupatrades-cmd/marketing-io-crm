import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
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