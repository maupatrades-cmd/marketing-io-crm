import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

const PRODUCT_CATALOG = [
  { id: 'ignite', name: 'Ignite', emoji: '🚀', type: 'package', setup_price: 3980, monthly_price: 490, term_months: 12 },
  { id: 'accelerate', name: 'Accelerate', emoji: '📈', type: 'package', setup_price: 6500, monthly_price: 890, term_months: 12 },
  { id: 'dominate', name: 'Dominate', emoji: '🏆', type: 'package', setup_price: 9800, monthly_price: 1490, term_months: 12 },
  { id: 'street_pulse', name: 'Street Pulse', emoji: '📍', type: 'physical', setup_price: 700, monthly_price: 3700, term_months: 3 },
  { id: 'township_pulse', name: 'Township Pulse', emoji: '🏪', type: 'physical', setup_price: 1300, monthly_price: 0 },
  { id: 'ai_chatbot', name: 'AI Chatbot', emoji: '🤖', type: 'addon', setup_price: 6500, monthly_price: 350 },
  { id: 'whatsapp_automation', name: 'WhatsApp Business Automation', emoji: '📱', type: 'addon', setup_price: 3500, monthly_price: 200 },
  { id: 'reputation_management', name: 'Reputation Management', emoji: '⭐', type: 'addon', setup_price: 0, monthly_price: 1800 },
  { id: 'google_business_profile', name: 'Google Business Profile', emoji: '📍', type: 'addon', setup_price: 800, monthly_price: 0 },
  { id: 'email_newsletter', name: 'Email Newsletter Management', emoji: '📧', type: 'addon', setup_price: 0, monthly_price: 900 },
  { id: 'short_form_video', name: 'Short-Form Video Pack', emoji: '🎬', type: 'addon', setup_price: 0, monthly_price: 1500 },
  { id: 'sms_marketing', name: 'SMS Marketing Campaigns', emoji: '💬', type: 'addon', setup_price: 500, monthly_price: 500 },
  { id: 'staff_training', name: 'Staff Training Workshops', emoji: '🎓', type: 'addon', setup_price: 3500, monthly_price: 0 },
  { id: 'marketing_audit', name: 'Marketing Audit & Report', emoji: '🔍', type: 'addon', setup_price: 2000, monthly_price: 0 },
  { id: 'competitor_analysis', name: 'Competitor Analysis Report', emoji: '🎯', type: 'addon', setup_price: 1500, monthly_price: 0 },
  { id: 'ai_content_writing', name: 'AI Content Writing Service', emoji: '✍️', type: 'addon', setup_price: 0, monthly_price: 800 },
  { id: 'crm_training', name: 'CRM Training & Setup', emoji: '⚙️', type: 'addon', setup_price: 3000, monthly_price: 0 },
  { id: 'website_maintenance', name: 'Website Maintenance Retainer', emoji: '🛠️', type: 'addon', setup_price: 0, monthly_price: 550 },
  { id: 'paid_ads_management', name: 'Paid Ads Management', emoji: '🎯', type: 'addon', setup_price: 0, monthly_price: 0 }
];

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
  <div style="height:1px;background:linear-gradient(90deg,transparent,#a764e6,#ec4899,transparent);margin:16px 0;"></div>
  <div style="font-size:12px;font-style:italic;color:#a764e6;">Too good to stay hidden.</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { session_token, product_id, client_message } = await req.json();

  if (!session_token || !product_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate session token
  const users = await base44.asServiceRole.entities.User.filter({ session_token });
  const user = users?.[0];
  if (!user || !user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    console.error('[submit-enquiry] Invalid or expired session');
    return Response.json({ error: 'Invalid session' }, { status: 401 });
  }

  // Get client record
  const clients = await base44.asServiceRole.entities.Client.filter({ client_user_id: user.id });
  const client = clients?.[0];
  if (!client) {
    return Response.json({ error: 'No client account found' }, { status: 404 });
  }

  // Look up product
  const product = PRODUCT_CATALOG.find(p => p.id === product_id);
  if (!product) {
    return Response.json({ error: 'Product not found' }, { status: 404 });
  }

  // Create EnquiryEvent
  const enquiry = await base44.asServiceRole.entities.EnquiryEvent.create({
    client_user_id: user.id,
    client_id: client.id,
    product_id: product.id,
    product_name: product.name,
    product_type: product.type,
    client_message: client_message || null,
    status: 'new'
  });

  // Create Deal
  const dealValue = product.setup_price + (product.monthly_price * (product.term_months || 0));
  const deal = await base44.asServiceRole.entities.Deal.create({
    client_id: client.id,
    client_name: client.business_name,
    deal_type: 'add_on',
    package: client.package || 'none',
    stage: 'new_lead',
    setup_fee: product.setup_price,
    monthly_retainer: product.monthly_price,
    probability: 30,
    source: 'inbound',
    notes: `Portal enquiry: ${product.name}. Client message: ${client_message || 'none'}`
  });

  // Update enquiry with deal_id
  await base44.asServiceRole.entities.EnquiryEvent.update(enquiry.id, { deal_id: deal.id });

  // Send emails
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[submit-enquiry] RESEND_API_KEY not set');
    return Response.json({ success: true, enquiry_id: enquiry.id, deal_id: deal.id }, { status: 200 });
  }

  const resend = new Resend(apiKey);

  // Email to Owner
  const ownerBody = `
    <p style="margin:0 0 16px 0;"><strong>New Portal Enquiry!</strong></p>
    <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0 0 8px 0;"><strong>Business:</strong> ${client.business_name}</p>
      <p style="margin:0 0 8px 0;"><strong>Contact:</strong> ${client.contact_person}</p>
      <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${client.email}</p>
      <p style="margin:0 0 8px 0;"><strong>Phone:</strong> ${client.phone || 'N/A'}</p>
      <p style="margin:0;"><strong>Product:</strong> ${product.emoji} ${product.name}</p>
    </div>
    <p style="margin:0 0 8px 0;"><strong>Pricing:</strong></p>
    <p style="margin:0 0 8px 0;">Setup: R${product.setup_price.toLocaleString()} · Monthly: R${product.monthly_price.toLocaleString()}</p>
    ${client_message ? `<p style="margin:0 0 16px 0;"><strong>Client's Message:</strong><br />${client_message}</p>` : ''}
    <p style="margin:0;"><a href="https://marketingio.co.za/deals" style="color:#a764e6;text-decoration:none;font-weight:600;">View Deal in CRM →</a></p>`;

  // Email to Client
  const clientBody = `
    <p style="margin:0 0 16px 0;">Hi ${user.full_name},</p>
    <p style="margin:0 0 16px 0;">We received your enquiry about <strong>${product.emoji} ${product.name}</strong>.</p>
    <p style="margin:0 0 16px 0;">Our team will contact you within <strong>4 hours</strong> to discuss how we can help.</p>
    <div style="background:#f0f4f8;padding:16px;border-radius:8px;margin:16px 0;">
      <p style="margin:0 0 8px 0;"><strong>Setup Fee:</strong> R${product.setup_price.toLocaleString()}</p>
      <p style="margin:0;"><strong>Monthly:</strong> R${product.monthly_price.toLocaleString()}</p>
    </div>
    <p style="margin:0 0 16px 0;">Questions in the meantime? Reply to this email anytime.</p>
    <p style="margin:0;text-align:center;font-size:14px;color:#94a3b8;">—</p>
    <p style="margin:8px 0 0 0;text-align:center;font-size:12px;color:#94a3b8;">Marketing iO Team</p>`;

  // Send all 3 emails in parallel
  await Promise.all([
    resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: 'maupatrades@gmail.com',
      subject: `🔥 New Portal Enquiry: ${product.name} from ${client.business_name}`,
      html: wrapEmail(ownerBody)
    }),
    resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: user.email,
      subject: `We got your enquiry — ${product.name}`,
      html: wrapEmail(clientBody)
    }),
    resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: 'info@marketingio.co.za',
      subject: `New enquiry assigned for follow-up: ${product.name}`,
      html: wrapEmail(ownerBody)
    })
  ]);

  console.log('[submit-enquiry] Success:', enquiry.id);
  return Response.json({ success: true, enquiry_id: enquiry.id, deal_id: deal.id }, { status: 200 });
});