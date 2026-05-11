import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function generateToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
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
  try {
    const base44 = createClientFromRequest(req);
    const { dealId } = await req.json();

    if (!dealId) {
      return Response.json({ error: "dealId required" }, { status: 400 });
    }

    const deals = await base44.asServiceRole.entities.Deal.filter({ id: dealId });
    const deal = Array.isArray(deals) ? deals[0] : deals;
    if (!deal) return Response.json({ error: "Deal not found" }, { status: 404 });

    const existing = await base44.asServiceRole.entities.ClientOnboardingSubmission.filter({ deal_id: dealId });
    if (existing && existing.length > 0) {
      return Response.json({ success: true, message: "Submission already exists", token: existing[0].submission_token });
    }

    const clients = await base44.asServiceRole.entities.Client.filter({ id: deal.client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;
    if (!client || !client.email) return Response.json({ error: "Client or client email not found" }, { status: 404 });

    const token = generateToken();

    const submission = await base44.asServiceRole.entities.ClientOnboardingSubmission.create({
      client_id: deal.client_id,
      deal_id: dealId,
      submission_token: token,
      submission_status: "not_started",
    });

    const formUrl = `https://app.base44.com/client-onboarding/${token}`;
    const contactName = client.contact_person?.split(" ")[0] || "there";

    const bodyHtml = `
      <p style="margin:0 0 16px 0;">Hi ${contactName},</p>
      <p style="margin:0 0 16px 0;">We're excited to get you set up! To get started with Marketing iO, please complete a quick onboarding form.</p>
      <p style="margin:0 0 16px 0;">This form takes just 15–20 minutes and helps us understand your business, brand, and goals.</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td>
        <a href="${formUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Complete Onboarding Form →</a>
      </td></tr></table>
      <p style="margin:0 0 16px 0;color:#94a3b8;font-size:14px;">Or copy this link: <a href="${formUrl}" style="color:#a764e6;word-break:break-all;">${formUrl}</a></p>
      <p style="margin:0;color:#64748b;font-size:14px;">Please complete this within 5 business days to keep your onboarding on track.</p>`;

    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (!apiKey) {
      console.error('[createOnboardingSubmission] RESEND_API_KEY missing');
    } else {
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: 'Marketing iO Team <hello@marketingio.co.za>',
        to: client.email,
        subject: `Action Required — Complete Your Marketing iO Onboarding`,
        html: wrapEmail(bodyHtml)
      });
      if (result.error) console.error('[createOnboardingSubmission] Email failed:', result.error);
    }

    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id: deal.client_id,
      client_name: client.business_name,
      event_type: "communication_sent",
      event_label: "Onboarding form link sent",
      logged_by: "system",
      logged_by_name: "Automation"
    });

    return Response.json({ success: true, message: "Onboarding submission created and email sent", token, formUrl, client: client.email });
  } catch (error) {
    console.error("Error creating onboarding submission:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});