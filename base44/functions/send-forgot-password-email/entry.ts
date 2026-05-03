import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Always return 200 — don't reveal if user exists
  const users = await base44.asServiceRole.entities.User.filter({ email: email.toLowerCase().trim() });
  const user = users?.[0];

  if (!user) {
    await base44.asServiceRole.entities.SecurityEvent.create({
      event_type: 'password_reset_requested',
      email,
      details: 'Reset attempted for non-existent email'
    });
    return Response.json({ success: true });
  }

  // Generate reset token
  const resetToken = crypto.randomUUID().replace(/-/g, '');
  await base44.asServiceRole.entities.OTPCode.create({
    email: email.toLowerCase().trim(),
    code: resetToken,
    purpose: 'password_reset',
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    generated_at: new Date().toISOString(),
    user_id: user.id,
    used: false
  });

  // Get or cache the hero image for forgot_password campaign
  let heroImageUrl = null;
  try {
    const settingsList = await base44.asServiceRole.entities.SystemSettings.list();
    const settings = settingsList?.[0];
    if (settings?.forgot_password_hero_url) {
      heroImageUrl = settings.forgot_password_hero_url;
    } else {
      // Generate once and cache
      const imgRes = await base44.asServiceRole.functions.invoke('generate-marketing-image', {
        prompt: 'A secure padlock icon rendered as soft 3D illustration with Marketing iO purple and pink gradient lighting, professional and trustworthy mood, minimal clean composition.',
        aspect_ratio: '4:5',
        campaign_id: 'forgot_password'
      });
      if (imgRes?.image_url && !imgRes.fallback) {
        heroImageUrl = imgRes.image_url;
        if (settings) {
          await base44.asServiceRole.entities.SystemSettings.update(settings.id, {
            forgot_password_hero_url: heroImageUrl
          });
        }
      }
    }
  } catch (_) {}

  const resetUrl = `https://app.marketingio.co.za/reset-password?token=${resetToken}`;
  const body = buildResetEmail(user.full_name || 'there', resetUrl, heroImageUrl);

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'Reset your Marketing iO password',
      body,
      from_name: 'Marketing iO'
    });
  } catch (emailErr) {
    console.error('Reset email failed:', emailErr);
  }

  await base44.asServiceRole.entities.SecurityEvent.create({
    event_type: 'password_reset_requested',
    email,
    user_id: user.id,
    details: 'Password reset email sent'
  });

  return Response.json({ success: true });
});

function buildResetEmail(fullName, resetUrl, heroImageUrl) {
  const heroHtml = heroImageUrl
    ? `<tr><td style="padding:0 0 24px 0;"><img src="${heroImageUrl}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:8px;" alt=""/></td></tr>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background-color:#f8f6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6ff;"><tr><td align="center" style="padding:24px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td align="center" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);padding:28px 24px 20px 24px;">
<img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" height="40" alt="Marketing iO" style="display:block;height:40px;width:auto;filter:invert(1) brightness(10);"/>
<div style="margin-top:8px;font-size:12px;font-style:italic;letter-spacing:1px;color:rgba(255,255,255,0.9);">Too good to stay hidden.</div>
</td></tr>
<tr><td height="4" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
${heroHtml}
<tr><td>
<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi ${fullName},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">We received a request to reset your Marketing iO password.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 24px 0;">Click the button below to set a new password. The link expires in <strong>30 minutes</strong> for your security.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;"><tr><td><a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Reset Password →</a></td></tr></table>
<p style="font-size:14px;line-height:1.6;color:#64748b;margin:0 0 16px 0;">Or copy this link: <a href="${resetUrl}" style="color:#a764e6;word-break:break-all;">${resetUrl}</a></p>
<p style="font-size:14px;color:#94a3b8;margin:0 0 8px 0;">If you didn't request this, ignore this email — your account is safe.</p>
<p style="font-size:14px;color:#94a3b8;margin:0;">For help: <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a></p>
</td></tr>
</table>
</td></tr>
<tr><td height="3" style="background:linear-gradient(90deg,#a764e6 0%,#ec4899 100%);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="background-color:#0f172a;padding:24px;">
<img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" height="24" alt="Marketing iO" style="display:block;height:24px;width:auto;filter:invert(1) brightness(10);margin:0 auto 10px auto;"/>
<div style="font-size:12px;color:#94a3b8;line-height:1.8;">Marketing iO (Pty) Ltd &middot; CIPC 2026303502<br>75 Marshall Street, Polokwane 0699 &bull; <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
<div style="height:1px;background:linear-gradient(90deg,transparent,#a764e6,#ec4899,transparent);margin:16px 0;"></div>
<div style="font-size:11px;color:#475569;">You're receiving this because you have an account with Marketing iO.</div>
</td></tr>
</table></td></tr></table>
</body></html>`;
}