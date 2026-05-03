import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { campaign_slug, user_id, test_mode = false } = await req.json();

  if (!campaign_slug || !user_id) {
    return Response.json({ error: 'campaign_slug and user_id are required' }, { status: 400 });
  }

  // 1. Load campaign
  const campaigns = await base44.asServiceRole.entities.MarketingCampaign.filter({ slug: campaign_slug });
  const campaign = campaigns?.[0];
  if (!campaign) return Response.json({ error: 'Campaign not found' }, { status: 404 });
  if (!campaign.active && !test_mode) return Response.json({ error: 'Campaign is inactive' }, { status: 400 });

  // 2. Load user
  let user = null;
  try {
    const allUsers = await base44.asServiceRole.entities.User.list();
    user = allUsers?.find(u => u.id === user_id) || null;
  } catch (_) {}
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  // 3. Check email preferences (skip for test mode)
  if (!test_mode) {
    const prefs = await base44.asServiceRole.entities.EmailPreferences.filter({ user_id });
    const pref = prefs?.[0];
    if (pref) {
      const triggerType = campaign.trigger_type;
      if (triggerType === 'scheduled' && campaign_slug.includes('newsletter') && pref.newsletter_opted_in === false) {
        return Response.json({ skipped: true, reason: 'opted_out_newsletter' });
      }
      if (triggerType === 'scheduled' && campaign_slug.includes('spotlight') && pref.spotlight_opted_in === false) {
        return Response.json({ skipped: true, reason: 'opted_out_spotlight' });
      }
      if (triggerType === 'after_anniversary' && pref.anniversary_opted_in === false) {
        return Response.json({ skipped: true, reason: 'opted_out_anniversary' });
      }
      if (triggerType === 'after_login_inactivity' && pref.reengagement_opted_in === false) {
        return Response.json({ skipped: true, reason: 'opted_out_reengagement' });
      }
      if (triggerType === 'after_signup_verified' && pref.marketing_opted_in === false) {
        return Response.json({ skipped: true, reason: 'opted_out_marketing' });
      }
    }
  }

  // 4. Ensure unsubscribe token
  let unsubscribeToken = '';
  const prefsList = await base44.asServiceRole.entities.EmailPreferences.filter({ user_id });
  let existingPref = prefsList?.[0];
  if (!existingPref) {
    existingPref = await base44.asServiceRole.entities.EmailPreferences.create({
      user_id,
      email: user.email,
      marketing_opted_in: true,
      newsletter_opted_in: true,
      spotlight_opted_in: true,
      anniversary_opted_in: true,
      reengagement_opted_in: true,
      unsubscribe_token: crypto.randomUUID(),
      updated_at: new Date().toISOString()
    });
  } else if (!existingPref.unsubscribe_token) {
    await base44.asServiceRole.entities.EmailPreferences.update(existingPref.id, {
      unsubscribe_token: crypto.randomUUID()
    });
    existingPref.unsubscribe_token = existingPref.unsubscribe_token || crypto.randomUUID();
  }
  unsubscribeToken = existingPref.unsubscribe_token;

  // 5. Generate hero image
  let imageUrl = null;
  if (campaign.image_prompt) {
    try {
      const imgRes = await base44.asServiceRole.functions.invoke('generate-marketing-image', {
        prompt: campaign.image_prompt,
        aspect_ratio: '4:5',
        campaign_id: campaign.id
      });
      imageUrl = imgRes?.image_url || null;
    } catch (imgErr) {
      console.error('[send-campaign] Image generation failed:', imgErr.message);
    }
  }

  // 6. Render template variables
  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const currentMonth = months[now.getMonth()];
  const previousMonth = months[now.getMonth() === 0 ? 11 : now.getMonth() - 1];
  const firstName = (user.full_name || '').split(' ')[0] || user.full_name || 'there';

  // Load client for business_name
  const clients = await base44.asServiceRole.entities.Client.filter({ client_user_id: user_id });
  const businessName = clients?.[0]?.business_name || 'your business';

  const variableMap = {
    full_name: user.full_name || 'there',
    first_name: firstName,
    month: currentMonth,
    previous_month: previousMonth,
    business_name: businessName
  };

  let body = campaign.body_template;
  let subject = campaign.subject_line;
  Object.entries(variableMap).forEach(([key, val]) => {
    const re = new RegExp(`{{${key}}}`, 'g');
    body = body.replace(re, val);
    subject = subject.replace(re, val);
  });

  // 7. Wrap with branded wrapper (import inline since no local imports)
  const finalHtml = buildWrappedEmail(body, {
    heroImageUrl: imageUrl,
    unsubscribeToken,
    preheader: campaign.preheader || ''
  });

  // 8. Send email
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      subject,
      body: finalHtml,
      from_name: 'Marketing iO'
    });
  } catch (sendErr) {
    await base44.asServiceRole.entities.CampaignSend.create({
      campaign_id: campaign.id,
      campaign_slug,
      user_id,
      email: user.email,
      sent_at: new Date().toISOString(),
      status: 'failed',
      image_url: imageUrl || ''
    });
    return Response.json({ success: false, error: sendErr.message }, { status: 500 });
  }

  // 9. Record send
  await base44.asServiceRole.entities.CampaignSend.create({
    campaign_id: campaign.id,
    campaign_slug,
    user_id,
    email: user.email,
    sent_at: new Date().toISOString(),
    status: 'sent',
    image_url: imageUrl || '',
    opened: false
  });

  return Response.json({ success: true, email: user.email, image_url: imageUrl });
});

// Inline email wrapper (no local imports allowed in Deno functions)
function buildWrappedEmail(bodyHtml, options = {}) {
  const { heroImageUrl, unsubscribeToken = '', preheader = '' } = options;
  const unsubUrl = `https://app.marketingio.co.za/unsubscribe?token=${unsubscribeToken}`;
  const prefsUrl = `https://app.marketingio.co.za/client/profile?tab=email-preferences`;

  const preheaderDiv = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>`
    : '';

  const heroHtml = heroImageUrl
    ? `<tr><td style="padding:0 0 24px 0;"><img src="${heroImageUrl}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border-radius:8px;" alt=""/></td></tr>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title><style>a{color:#a764e6;text-decoration:none;}a:hover{text-decoration:underline;}@media only screen and (max-width:600px){.content-cell{padding:24px 16px!important;}}</style></head>
<body style="margin:0;padding:0;background-color:#f8f6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
${preheaderDiv}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6ff;"><tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td align="center" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);padding:28px 24px 20px 24px;">
<img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" height="40" alt="Marketing iO" style="display:block;height:40px;width:auto;filter:invert(1) brightness(10);"/>
<div style="margin-top:8px;font-size:12px;font-style:italic;letter-spacing:1px;color:rgba(255,255,255,0.9);">Too good to stay hidden.</div>
</td></tr>
<tr><td height="4" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td class="content-cell" style="padding:32px 24px;background-color:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
${heroHtml}
<tr><td style="font-size:16px;line-height:1.6;color:#1e293b;">${bodyHtml}</td></tr>
</table></td></tr>
<tr><td height="3" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="background-color:#0f172a;padding:32px 24px;">
<img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" height="28" alt="Marketing iO" style="display:block;height:28px;width:auto;filter:invert(1) brightness(10);margin:0 auto 12px auto;"/>
<div style="font-size:14px;font-weight:600;color:#f8fafc;margin-bottom:12px;">The Marketing iO Team</div>
<div style="font-size:12px;color:#94a3b8;line-height:1.8;margin-bottom:16px;">
Marketing iO (Pty) Ltd &middot; CIPC 2026303502<br>75 Marshall Street, Polokwane 0699<br>
☎ 010 102 0534 &bull; ✉ <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a><br>
🌐 <a href="https://marketingio.co.za" style="color:#a764e6;">marketingio.co.za</a>
</div>
<div style="font-size:12px;font-style:italic;color:#64748b;margin-bottom:16px;">Too good to stay hidden.</div>
<div style="height:1px;background:linear-gradient(90deg,transparent,#a764e6,#ec4899,transparent);margin-bottom:16px;"></div>
<div style="font-size:11px;color:#475569;line-height:1.6;">
You're receiving this because you have an account with Marketing iO.<br>
<a href="${prefsUrl}" style="color:#a764e6;">Update preferences</a> &middot; <a href="${unsubUrl}" style="color:#a764e6;">Unsubscribe</a>
</div>
</td></tr>
</table></td></tr></table>
</body></html>`;
}