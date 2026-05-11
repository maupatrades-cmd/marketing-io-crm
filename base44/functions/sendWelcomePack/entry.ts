import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

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
  try {
    const base44 = createClientFromRequest(req);
    const { dealId, clientId } = await req.json();

    if (!dealId || !clientId) {
      return Response.json({ error: "dealId and clientId required" }, { status: 400 });
    }

    const [deal, client] = await Promise.all([
      base44.asServiceRole.entities.Deal.filter({ id: dealId }),
      base44.asServiceRole.entities.Client.filter({ id: clientId }),
    ]);

    if (!deal || !client) {
      return Response.json({ error: "Deal or Client not found" }, { status: 404 });
    }

    const dealRecord = Array.isArray(deal) ? deal[0] : deal;
    const clientRecord = Array.isArray(client) ? client[0] : client;

    if (!clientRecord.email) {
      return Response.json({ error: "Client email not found" }, { status: 400 });
    }

    const packageLabel = dealRecord.package !== "none" ? dealRecord.package : dealRecord.add_on_name || "Custom Package";
    const clientName = clientRecord.business_name || "Client";
    const contactFirstName = clientRecord.contact_person?.split(" ")[0] || "Valued Client";

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Dear ${contactFirstName},</p>
      <p style="margin:0 0 16px 0;">Welcome to Marketing iO! We're thrilled to have <strong>${clientName}</strong> on board.</p>
      <p style="margin:0 0 16px 0;">Here's what happens next:</p>
      <ol style="margin:0 0 16px 0;padding-left:20px;line-height:2;">
        <li>Review your Welcome Pack</li>
        <li>Pay the setup invoice (within 5 days)</li>
        <li>Complete the onboarding form</li>
        <li>Sign the debit mandate</li>
        <li>Share your brand assets with us</li>
      </ol>
      <p style="margin:0 0 16px 0;">We'll guide you through every step. If you have any questions, reach out anytime at <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a>.</p>
      <p style="margin:0;">Let's get your business visible, heard, and growing!</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
        <a href="https://app.marketingio.co.za/client-portal" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Open Client Portal →</a>
      </td></tr></table>`;

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[sendWelcomePack] RESEND_API_KEY missing');
      return Response.json({ error: 'Email service not configured' }, { status: 500 });
    }
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: clientRecord.email,
      subject: `Welcome to Marketing iO, ${clientName}!`,
      html: wrapEmail(bodyHtml)
    });

    if (result.error) {
      console.error('[sendWelcomePack] Email failed:', result.error);
      return Response.json({ error: result.error.message || 'Email send failed' }, { status: 500 });
    }

    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id: clientId,
      client_name: clientName,
      event_type: "communication_sent",
      event_label: "Welcome Pack email sent",
      logged_by: "system",
      logged_by_name: "Automation"
    });

    return Response.json({ success: true, message: "Welcome Pack email sent successfully", client: clientRecord.email });
  } catch (error) {
    console.error("Error sending Welcome Pack:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});