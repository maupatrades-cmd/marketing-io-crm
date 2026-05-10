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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, purpose } = await req.json();

  if (!email || !purpose) {
    return Response.json({ error: 'Email and purpose are required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Look up account in AppUser (client portal) first, then fall back to User (staff/CRM directory).
  // Each lookup wrapped in its own try so a transient AppUser error doesn't defeat the User fallback.
  let user;
  let userEntity;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ email: normalizedEmail });
    if (appUsers?.[0]) {
      user = appUsers[0];
      userEntity = 'AppUser';
    }
  } catch (err) {
    console.error('[resend-otp] AppUser lookup failed:', err);
  }

  // NOTE: Legacy User entity fallback removed — all users must be in AppUser.

  if (!user) {
    // Return success even if not found — don't expose user existence
    return Response.json({ success: true });
  }

  const newOtp = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = purpose === 'login_mfa'
    ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
    : new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await base44.asServiceRole.entities.AppUser.update(user.id, {
    pending_otp_code: newOtp,
    pending_otp_expires_at: expiry,
    pending_otp_purpose: purpose
  });

  const purposeLabel = purpose === 'signup_verification' ? 'verify your account' : 'complete your login';
  const expiryLabel = purpose === 'login_mfa' ? '10 minutes' : '15 minutes';

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${user.full_name || 'there'},</p>
    <p style="margin:0 0 16px 0;">Here is your new Marketing iO code to ${purposeLabel}:</p>
    <div style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#a764e6;text-align:center;padding:20px;background:#f5f3ff;border:2px solid rgba(167,100,230,0.2);border-radius:8px;font-family:monospace;margin:16px 0">${newOtp}</div>
    <p style="color:#64748b;font-size:14px;margin:0 0 8px 0;">This code expires in <strong>${expiryLabel}</strong>.</p>
    <p style="color:#94a3b8;font-size:14px;margin:0;">If you didn't request this code, please ignore this email.</p>`;

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[resend-otp] RESEND_API_KEY not set');
    return Response.json({ error: 'Email service not configured' }, { status: 500 });
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'Marketing iO Team <hello@marketingio.co.za>',
      to: normalizedEmail,
      subject: `Your new Marketing iO code: ${newOtp}`,
      html: wrapEmail(bodyHtml)
    });
    
    if (result.error) {
      console.error('[resend-otp] Email send failed:', result.error);
      return Response.json({ error: 'Failed to send email', detail: result.error }, { status: 500 });
    }
    
    console.log('[resend-otp] Email sent successfully:', result.id);
  } catch (emailErr) {
    console.error('[resend-otp] Email send exception:', emailErr.message);
    return Response.json({ error: 'Email service error', detail: emailErr.message }, { status: 500 });
  }

  return Response.json({ success: true });
});