import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const PORTAL_URL = 'https://app.marketingio.co.za/client-portal';
const HERO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function wrapEmail(bodyHtml: string) {
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
  const { client_id } = await req.json();

  if (!client_id) {
    return Response.json({ error: 'client_id required' }, { status: 400 });
  }

  let client: any = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (err) {
    console.error('[send-signup-welcome-email] client lookup failed:', err);
  }

  if (!client) {
    return Response.json({ success: true, email_sent: false, reason: 'client_not_found' });
  }

  // Refresh hero image if missing or stale. Best-effort — never block the email.
  const heroFresh = client.hero_image_url
    && client.hero_image_generated_at
    && (Date.now() - new Date(client.hero_image_generated_at).getTime() < HERO_CACHE_TTL_MS);

  if (!heroFresh) {
    try {
      const hasPackage = !!(client.package && client.package !== 'none');
      const res = await base44.functions.invoke('generate-hero-image', {
        business_name: client.business_name,
        industry: client.industry,
        package: client.package,
        has_package: hasPackage,
        missing_addons: []
      });
      if (res?.data?.url) {
        client.hero_image_url = res.data.url;
        client.hero_image_copy = res.data.copy || client.hero_image_copy;
      }
    } catch (err) {
      console.error('[send-signup-welcome-email] hero refresh failed:', err);
    }
  }

  const firstName = (client.contact_person?.split(' ')[0]) || client.business_name || 'there';
  const heroImageUrl = client.hero_image_url || '';
  const heroCopy = client.hero_image_copy || `Your business deserves more than where it is right now.`;

  const heroBlock = heroImageUrl
    ? `
<div style="margin:24px 0 32px 0;border-radius:12px;overflow:hidden;">
  <img src="${heroImageUrl}" alt="" style="width:100%;height:auto;display:block;" />
</div>`
    : '';

  const bodyHtml = `
<h1 style="margin:0 0 8px 0;font-size:32px;font-weight:bold;color:#0f172a;line-height:1.2;">
  Welcome to Marketing iO, ${firstName}.
</h1>

<p style="margin:0 0 24px 0;font-size:18px;color:#475569;line-height:1.5;">
  This isn't a generic "thanks for signing up" email. Read this — it'll change how you think about your business.
</p>
${heroBlock}
<h2 style="margin:0 0 24px 0;font-size:24px;font-weight:bold;color:#1e293b;line-height:1.4;">
  ${heroCopy}
</h2>

<h3 style="margin:32px 0 12px 0;font-size:20px;font-weight:bold;color:#a764e6;">
  Here's the truth nobody tells South African business owners:
</h3>

<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#334155;">
  <strong>If you're stuck at R50,000 a month in revenue</strong>, it's not because your product is bad. It's not because you're working too little. It's because <strong>you're invisible to the people who would already buy from you</strong>.
</p>

<p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#334155;">
  Right now, in your area, customers are typing their problem into Google or scrolling Instagram looking for a solution. They walk into your competitor's shop instead of yours. Why? Because your competitor showed up first.
</p>

<h3 style="margin:32px 0 16px 0;font-size:20px;font-weight:bold;color:#1e293b;">
  What R50K → R200K actually looks like:
</h3>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 24px 0;">
  <tr>
    <td style="padding:16px;background:#fef3f2;border-left:4px solid #ec4899;border-radius:4px;">
      <strong style="color:#1e293b;font-size:16px;">Without digital infrastructure (where most SA SMEs are stuck):</strong>
      <ul style="margin:12px 0 0 0;padding-left:20px;color:#475569;font-size:15px;line-height:1.7;">
        <li>You rely on word-of-mouth — slow, unpredictable</li>
        <li>You miss 70% of after-hours customer enquiries</li>
        <li>Your competitors with WhatsApp automation reply in 2 seconds</li>
        <li>One bad Google review costs you 30 future customers</li>
        <li>Your "marketing" is boosting random Facebook posts that go nowhere</li>
        <li>You stay at R30K-R50K/month forever</li>
      </ul>
    </td>
  </tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 24px 0;">
  <tr>
    <td style="padding:16px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;">
      <strong style="color:#1e293b;font-size:16px;">With professional digital infrastructure (Marketing iO clients):</strong>
      <ul style="margin:12px 0 0 0;padding-left:20px;color:#475569;font-size:15px;line-height:1.7;">
        <li><strong>Professional website</strong> that converts visitors to leads 24/7</li>
        <li><strong>WhatsApp Business automation</strong> replying within 2 seconds, even at 3am</li>
        <li><strong>Google Business Profile</strong> ranking you first in local searches</li>
        <li><strong>Reputation management</strong> protecting your reviews</li>
        <li><strong>Short-form video content</strong> reaching customers on TikTok and Instagram</li>
        <li><strong>Targeted paid ads</strong> putting you in front of buyers ready to spend</li>
        <li><strong>AI chatbot</strong> closing deals while you sleep</li>
        <li><strong>CRM</strong> ensuring no lead ever slips through the cracks</li>
      </ul>
      <p style="margin:16px 0 0 0;color:#1e293b;font-size:15px;font-weight:bold;">
        Result: R150K - R200K+/month within 6-12 months. Not theory. Math.
      </p>
    </td>
  </tr>
</table>

<h3 style="margin:32px 0 16px 0;font-size:20px;font-weight:bold;color:#1e293b;">
  The math is simple:
</h3>

<p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:#334155;">
  → 100 extra customers a month finding you online via Google + ads<br>
  → Each customer worth R2,000 average<br>
  → That's R200,000 in additional monthly revenue
</p>

<p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#334155;">
  This isn't optimism. <strong>This is what's already happening to your competitors</strong>. They didn't get smarter — they just stopped trying to do it alone.
</p>

<h3 style="margin:32px 0 16px 0;font-size:20px;font-weight:bold;color:#1e293b;">
  How Marketing iO works:
</h3>

<p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;color:#334155;">
  Pick the foundation that fits where you are now. We handle <em>everything</em> — strategy, design, content, ads, automation, reputation. You focus on what only YOU can do: serving customers and running your business.
</p>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 24px 0;">
  <tr>
    <td width="33%" valign="top" style="padding:16px;background:#fafafa;border-radius:8px;">
      <p style="margin:0 0 8px 0;font-size:24px;">🚀</p>
      <p style="margin:0 0 4px 0;font-size:16px;font-weight:bold;color:#1e293b;">Ignite</p>
      <p style="margin:0 0 4px 0;font-size:13px;color:#475569;line-height:1.5;">Look professional online — fast.</p>
      <p style="margin:0;font-size:14px;font-weight:bold;color:#a764e6;">R3,980 + R490/mo</p>
    </td>
    <td width="2%">&nbsp;</td>
    <td width="33%" valign="top" style="padding:16px;background:#fafafa;border-radius:8px;">
      <p style="margin:0 0 8px 0;font-size:24px;">📈</p>
      <p style="margin:0 0 4px 0;font-size:16px;font-weight:bold;color:#1e293b;">Accelerate</p>
      <p style="margin:0 0 4px 0;font-size:13px;color:#475569;line-height:1.5;">Stop coasting. Start growing.</p>
      <p style="margin:0;font-size:14px;font-weight:bold;color:#a764e6;">R6,500 + R890/mo</p>
    </td>
    <td width="2%">&nbsp;</td>
    <td width="33%" valign="top" style="padding:16px;background:#fafafa;border-radius:8px;">
      <p style="margin:0 0 8px 0;font-size:24px;">🏆</p>
      <p style="margin:0 0 4px 0;font-size:16px;font-weight:bold;color:#1e293b;">Dominate</p>
      <p style="margin:0 0 4px 0;font-size:13px;color:#475569;line-height:1.5;">Own your market.</p>
      <p style="margin:0;font-size:14px;font-weight:bold;color:#a764e6;">R9,800 + R1,490/mo</p>
    </td>
  </tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" style="margin:32px 0;">
  <tr>
    <td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);border-radius:8px;">
      <a href="${PORTAL_URL}" style="display:inline-block;padding:16px 36px;color:#ffffff;text-decoration:none;font-weight:bold;font-size:17px;">
        Enter Your Portal &amp; Pick Your Path →
      </a>
    </td>
  </tr>
</table>

<h3 style="margin:32px 0 12px 0;font-size:20px;font-weight:bold;color:#1e293b;">
  Or talk to us directly:
</h3>

<p style="margin:0 0 12px 0;font-size:16px;line-height:1.7;color:#334155;">
  Not sure which package fits? Got a unique situation? Just want to ask honest questions before deciding?
</p>

<p style="margin:0 0 24px 0;font-size:16px;line-height:1.7;color:#334155;">
  📞 <strong>010 102 0534</strong><br>
  ✉️ <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;font-weight:bold;">info@marketingio.co.za</a><br>
  💬 Reply directly to this email.
</p>

<p style="margin:0 0 8px 0;font-size:16px;line-height:1.7;color:#334155;">
  We're not here to sell you stuff you don't need. We're here to help South African SMEs win.
</p>

<p style="margin:24px 0 0 0;font-size:16px;line-height:1.7;color:#334155;">
  Welcome aboard.
</p>

<p style="margin:8px 0 0 0;font-size:16px;font-weight:bold;color:#1e293b;">
  Thapelo Maupa<br>
  <span style="font-weight:normal;color:#475569;">Founder, Marketing iO</span>
</p>
`;

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[send-signup-welcome-email] RESEND_API_KEY missing');
    return Response.json({ success: true, email_sent: false, reason: 'no_resend_key' });
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: client.email,
      subject: `${firstName}, here's what most South African businesses miss`,
      html: wrapEmail(bodyHtml)
    });
    if (result.error) {
      console.error('[send-signup-welcome-email] Resend error:', result.error);
      return Response.json({ success: true, email_sent: false, reason: 'resend_error' });
    }
    return Response.json({ success: true, email_sent: true });
  } catch (err) {
    console.error('[send-signup-welcome-email] send failed:', err);
    return Response.json({ success: true, email_sent: false, reason: 'exception' });
  }
});
