import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  // Email-safe synthwave V3 shell. No position:absolute / flex — Outlook
  // strips both. White logo badge centred via table align="center" + cell
  // valign="middle". Inline SVG decoration renders in modern clients;
  // Outlook falls back to the gradient + bgcolor + white badge cleanly.
  const __MIO_LOGO_URL  = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';
  const __MIO_ACCENT    = 'linear-gradient(90deg,#dc2626 0%,#ec4899 50%,#fbbf24 100%)';
  const __MIO_HEADER_BG = 'linear-gradient(180deg,#1a0533 0%,#0a0a2e 50%,#000010 100%)';
  const __MIO_FOOTER_BG = 'linear-gradient(180deg,#000010 0%,#0a0a2e 50%,#1a0533 100%)';
  const __MIO_YEAR      = new Date().getFullYear();

  const __MIO_HEADER_SVG = '<svg width="600" height="240" viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display:block;width:600px;height:240px;">'
    + '<defs>'
    + '<linearGradient id="__mioH_bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a0533"/><stop offset="50%" stop-color="#0a0a2e"/><stop offset="100%" stop-color="#000010"/></linearGradient>'
    + '<radialGradient id="__mioH_sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="55%" stop-color="#ec4899"/><stop offset="100%" stop-color="#7c3aed"/></radialGradient>'
    + '<linearGradient id="__mioH_glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.5"/><stop offset="100%" stop-color="#ec4899" stop-opacity="0"/></linearGradient>'
    + '<filter id="__mioH_grid" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.6"/></filter>'
    + '<mask id="__mioH_slices"><circle cx="300" cy="156" r="85" fill="white"/><rect x="232" y="170" width="136" height="3" fill="black"/><rect x="245" y="184" width="110" height="4" fill="black"/><rect x="262" y="200" width="76" height="4" fill="black"/><rect x="278" y="216" width="44" height="5" fill="black"/></mask>'
    + '</defs>'
    + '<rect width="600" height="240" fill="url(#__mioH_bg)"/>'
    + '<g fill="#ffffff"><circle cx="50" cy="22" r="1.2" opacity="0.85"/><circle cx="120" cy="48" r="1.0" opacity="0.6"/><circle cx="200" cy="18" r="1.5" opacity="0.9"/><circle cx="290" cy="55" r="1.0" opacity="0.7"/><circle cx="380" cy="28" r="1.2" opacity="0.8"/><circle cx="470" cy="48" r="1.0" opacity="0.65"/><circle cx="540" cy="20" r="1.3" opacity="0.85"/></g>'
    + '<circle cx="300" cy="156" r="85" fill="url(#__mioH_sun)" mask="url(#__mioH_slices)"/>'
    + '<rect x="0" y="156" width="600" height="50" fill="url(#__mioH_glow)"/>'
    + '<line x1="0" y1="156" x2="600" y2="156" stroke="#ec4899" stroke-width="1.5"/>'
    + '<g opacity="0.6"><polygon points="40,156 100,118 160,156" fill="#7c3aed"/><polygon points="120,156 175,108 230,156" fill="#a855f7"/><polygon points="370,156 430,118 490,156" fill="#06b6d4"/><polygon points="450,156 510,108 570,156" fill="#7c3aed"/></g>'
    + '<g filter="url(#__mioH_grid)"><g stroke="#ec4899" stroke-width="0.8" fill="none" opacity="0.85"><line x1="0" y1="170" x2="600" y2="170"/><line x1="0" y1="186" x2="600" y2="186"/><line x1="0" y1="208" x2="600" y2="208"/><line x1="0" y1="234" x2="600" y2="234"/></g>'
    + '<g stroke="#06b6d4" stroke-width="0.7" fill="none" opacity="0.8"><line x1="300" y1="156" x2="0" y2="240"/><line x1="300" y1="156" x2="100" y2="240"/><line x1="300" y1="156" x2="200" y2="240"/><line x1="300" y1="156" x2="300" y2="240"/><line x1="300" y1="156" x2="400" y2="240"/><line x1="300" y1="156" x2="500" y2="240"/><line x1="300" y1="156" x2="600" y2="240"/></g></g>'
    + '</svg>';

  const __MIO_WAVES_SVG = '<svg width="552" height="100" viewBox="0 0 552 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block;width:100%;max-width:552px;height:auto;">'
    + '<defs><linearGradient id="__mioF_w" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7c3aed"/><stop offset="20%" stop-color="#ec4899"/><stop offset="40%" stop-color="#f59e0b"/><stop offset="60%" stop-color="#10b981"/><stop offset="80%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>'
    + '<g stroke="url(#__mioF_w)" fill="none" stroke-width="1">'
    + '<path d="M0 22 Q 69 8 138 22 T 276 22 T 414 22 T 552 22" opacity="0.55"/>'
    + '<path d="M0 32 Q 69 18 138 32 T 276 32 T 414 32 T 552 32" opacity="0.7"/>'
    + '<path d="M0 42 Q 69 28 138 42 T 276 42 T 414 42 T 552 42" opacity="0.85"/>'
    + '<path d="M0 50 Q 69 36 138 50 T 276 50 T 414 50 T 552 50" opacity="0.9"/>'
    + '<path d="M0 58 Q 69 44 138 58 T 276 58 T 414 58 T 552 58" opacity="0.85"/>'
    + '<path d="M0 68 Q 69 54 138 68 T 276 68 T 414 68 T 552 68" opacity="0.7"/>'
    + '<path d="M0 78 Q 69 64 138 78 T 276 78 T 414 78 T 552 78" opacity="0.6"/>'
    + '<path d="M0 88 Q 69 74 138 88 T 276 88 T 414 88 T 552 88" opacity="0.5"/>'
    + '</g></svg>';

  const __MIO_LI_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43A2.06 2.06 0 1 1 5.34 3.3a2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z"/></svg>';
  const __MIO_IG_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="17" cy="7" r="1.2" fill="#ffffff" fill-opacity="0.85"/></svg>';
  const __MIO_FB_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M24 12.07C24 5.45 18.63.07 12 .07S0 5.45 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.39H7.08v-3.47h3.05V9.43c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95H15.83c-1.5 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.02 24 18.07 24 12.07z"/></svg>';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse;background-color:#ffffff;">

<!-- HEADER -->
<tr><td style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;background-color:#0a0a2e;">
<tr><td width="600" height="240" align="center" valign="middle" bgcolor="#0a0a2e" style="width:600px;height:240px;background-color:#0a0a2e;background-image:${__MIO_HEADER_BG};padding:0;text-align:center;vertical-align:middle;">
<!--[if !mso]><!--><div style="font-size:0;line-height:0;height:0;overflow:visible;">${__MIO_HEADER_SVG}</div><!--<![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;"><tr>
<td width="420" height="130" align="center" valign="middle" bgcolor="#ffffff" style="width:420px;height:130px;background-color:#ffffff;border-radius:20px;padding:15px 30px;text-align:center;vertical-align:middle;box-shadow:0 0 40px rgba(255,255,255,0.4),0 0 80px rgba(236,72,153,0.3);">
<img src="${__MIO_LOGO_URL}" width="360" height="100" alt="Marketing iO" style="display:block;width:360px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
</td></tr></table>
</td></tr>
<tr><td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${__MIO_ACCENT};">&nbsp;</td></tr>
</table>
</td></tr>

<!-- BODY -->
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
<tr><td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${__MIO_ACCENT};">&nbsp;</td></tr>
<tr><td width="600" align="center" valign="top" bgcolor="#0a0a2e" style="width:600px;background-color:#0a0a2e;background-image:${__MIO_FOOTER_BG};padding:32px 24px;text-align:center;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<!--[if !mso]><!--><table role="presentation" width="552" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;"><tr><td align="center" style="font-size:0;line-height:0;">${__MIO_WAVES_SVG}</td></tr></table><!--<![endif]-->

<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;border-collapse:collapse;"><tr>
<td width="280" height="90" align="center" valign="middle" bgcolor="#ffffff" style="width:280px;height:90px;background-color:#ffffff;border-radius:16px;padding:10px 20px;text-align:center;vertical-align:middle;box-shadow:0 0 30px rgba(255,255,255,0.4),0 0 60px rgba(236,72,153,0.3);">
<img src="${__MIO_LOGO_URL}" width="240" height="70" alt="Marketing iO" style="display:block;width:240px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
</td></tr></table>

<p style="margin:0 0 18px;color:#ffffff;font-size:14px;font-style:italic;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;">Too good to stay hidden.</p>

<p style="margin:0 0 6px;color:#ffffff;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
<a href="mailto:hello@marketingio.africa" style="color:#ffffff;text-decoration:none;">hello@marketingio.africa</a>&nbsp;&bull;&nbsp;<a href="tel:0101020534" style="color:#ffffff;text-decoration:none;">010 102 0534</a>&nbsp;&bull;&nbsp;<a href="https://marketingio.africa" style="color:#ffffff;text-decoration:none;">marketingio.africa</a>
</p>
<p style="margin:0 0 22px;color:#ffffff;font-size:11px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">75 Marshall Street, Polokwane, 0699, South Africa</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px;border-collapse:collapse;"><tr>
<td style="padding:0 8px;"><a href="https://linkedin.com/company/marketingio" aria-label="Marketing iO on LinkedIn" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_LI_SVG}</a></td>
<td style="padding:0 8px;"><a href="https://instagram.com/marketingio" aria-label="Marketing iO on Instagram" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_IG_SVG}</a></td>
<td style="padding:0 8px;"><a href="https://facebook.com/marketingio" aria-label="Marketing iO on Facebook" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_FB_SVG}</a></td>
</tr></table>

<p style="margin:0 0 6px;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.6;">© ${__MIO_YEAR} Marketing iO. All rights reserved.</p>
<p style="margin:0;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">
<a href="https://app.marketingio.africa/unsubscribe" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a>&nbsp;&bull;&nbsp;<a href="https://marketingio.africa/privacy" style="color:#ffffff;text-decoration:underline;">Privacy Policy</a>&nbsp;&bull;&nbsp;<a href="https://app.marketingio.africa/preferences" style="color:#ffffff;text-decoration:underline;">Manage Preferences</a>
</p>
</td></tr>
</table>
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

async function sendSignupOtp(to, fullName, otp) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[auth-register] RESEND_API_KEY missing');
    return;
  }
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Hi ${fullName},</p>
    <p style="margin:0 0 16px 0;">Welcome to Marketing iO! Your verification code is:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#a764e6;text-align:center;padding:16px;background:#f5f3ff;border:2px solid rgba(167,100,230,0.2);border-radius:8px;font-family:monospace;margin:16px 0">${otp}</div>
    <p style="color:#64748b;font-size:14px;margin:0 0 8px 0;">This code expires in <strong>15 minutes</strong>.</p>
    <p style="color:#94a3b8;font-size:14px;margin:0;">If you didn't create an account, you can safely ignore this email.</p>`;

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: 'Marketing iO Team <hello@marketingio.co.za>',
    to,
    subject: 'Verify your Marketing iO account',
    html: wrapEmail(bodyHtml)
  });
  if (result.error) {
    console.error('[auth-register] OTP email failed:', result.error);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Step 1: Parse request
  console.log('[auth-register] Step: parsing request body');
  let fullName, first_name, last_name, email, phone, mobile_number, businessName, password;
  try {
    ({ fullName, first_name, last_name, email, phone, mobile_number, businessName, password } = await req.json());
  } catch (err) {
    console.error('[auth-register] request_parse_failed:', err.message);
    return Response.json({ error: 'request_parse_failed', detail: err.message }, { status: 500 });
  }

  // Step 2: Validate input
  console.log('[auth-register] Step: validating input');
  // Compose fullName from first_name + last_name when callers send the new
  // multi-step payload but omit fullName.
  if (!fullName && (first_name || last_name)) {
    fullName = `${first_name || ''} ${last_name || ''}`.trim();
  }
  if (!fullName || !email || !password || !businessName) {
    return Response.json({ error: 'All required fields must be provided.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email format.' }, { status: 400 });
  }
  // SA mobile validation — accept either +27XXXXXXXXX (12 chars) or 0XXXXXXXXX (10 digits).
  // mobile_number is the new strict field; legacy `phone` is left untouched for backwards compat.
  const rawMobile = (mobile_number || '').replace(/\s+/g, '');
  if (mobile_number !== undefined && rawMobile !== '') {
    const localFormat = /^0\d{9}$/.test(rawMobile);
    const intlFormat = /^\+27\d{9}$/.test(rawMobile);
    if (!localFormat && !intlFormat) {
      return Response.json({ error: 'Invalid SA mobile format. Use 0XXXXXXXXX or +27XXXXXXXXX.' }, { status: 400 });
    }
  }
  const normalizedEmail = email.toLowerCase().trim();

  // Step 3: Check existing account in BOTH AppUser and User entities. A staff/owner
  // account in User with this email would otherwise be shadowed by a new AppUser row
  // (auth-login prefers AppUser), silently locking the legacy account out of login.
  console.log('[auth-register] Step: checking existing account for', normalizedEmail);
  try {
    const existingAppUser = await base44.asServiceRole.entities.AppUser.filter({ email: normalizedEmail });
    if (existingAppUser && existingAppUser.length > 0) {
      return Response.json({ error: 'Account already exists with this email' }, { status: 409 });
    }
  } catch (err) {
    console.error('[auth-register] appuser_lookup_failed:', err.message);
    return Response.json({ error: 'appuser_lookup_failed', detail: err.message }, { status: 500 });
  }
  try {
    const existingUser = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (existingUser && existingUser.length > 0) {
      return Response.json({ error: 'Account already exists with this email' }, { status: 409 });
    }
  } catch (err) {
    console.error('[auth-register] user_lookup_failed:', err.message);
    return Response.json({ error: 'user_lookup_failed', detail: err.message }, { status: 500 });
  }

  // Step 4: Hash password
  console.log('[auth-register] Step: hashing password');
  let passwordHash;
  try {
    passwordHash = await bcrypt.hash(password, 10);
  } catch (err) {
    console.error('[auth-register] password_hash_failed:', err.message);
    return Response.json({ error: 'password_hash_failed', detail: err.message }, { status: 500 });
  }

  // Step 5: Create app user record (OTP included in create to avoid a separate update)
   console.log('[auth-register] Step: creating app user record');
   const otp = String(Math.floor(100000 + Math.random() * 900000));
   const otpExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
   let newUser;
   const userPayload = {
     email: normalizedEmail,
     full_name: fullName.trim(),
     role: 'client',
     password_hash: passwordHash,
     pending_verification: true,
     email_verified: false,
     failed_login_count: 0,
     pending_otp_code: otp,
     pending_otp_expires_at: otpExpires,
     pending_otp_purpose: 'signup_verification'
   };
   if (first_name) userPayload.first_name = first_name.trim();
   if (last_name) userPayload.last_name = last_name.trim();
   if (rawMobile) userPayload.mobile_number = rawMobile;
   try {
     newUser = await base44.asServiceRole.entities.AppUser.create(userPayload);
   } catch (err) {
     console.error('[auth-register] appuser_create_failed:', err.message);
     return Response.json({
       error: 'appuser_create_failed',
       detail: err.message,
       payload: { email: normalizedEmail, full_name: fullName.trim(), role: 'client' }
     }, { status: 500 });
   }
   const createdUserId = newUser.id;
   console.log('[auth-register] AppUser created, id:', createdUserId);

  // Step 6: Create client record
  console.log('[auth-register] Step: creating client record');
  let createdClientId = null;
  try {
    const newClient = await base44.asServiceRole.entities.Client.create({
      business_name: businessName.trim(),
      contact_person: fullName.trim(),
      email: normalizedEmail,
      phone: rawMobile || phone?.trim() || '',
      status: 'lead',
      client_user_id: newUser.id,
      portal_invitation_sent_at: new Date().toISOString(),
      signup_completed_steps: 1
    });
    createdClientId = newClient.id;
    console.log('[auth-register] Client created, id:', createdClientId);

    // Activity audit (Client Portal PR A). Best-effort — never break signup.
    try {
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id:      createdClientId,
        client_name:    String(newClient.business_name || newClient.contact_person || '').trim(),
        actor_id:       newUser.id,
        actor_role:     'client',
        event_type:     'account_created',
        event_category: 'account',
        event_summary:  'Account created',
        event_metadata: { email: normalizedEmail, source: 'self_signup' },
        event_label:    'Account created',
        logged_by:      newUser.id,
        logged_by_name: fullName.trim(),
      });
    } catch (logErr) {
      console.error('[auth-register] activity log failed (non-fatal):', logErr?.message);
    }
  } catch (err) {
    console.error('[auth-register] client_create_failed — rolling back app user:', err.message);
    try { await base44.asServiceRole.entities.AppUser.delete(createdUserId); } catch (_) {}
    return Response.json({ error: 'client_create_failed', detail: err.message }, { status: 500 });
  }

  // Step 7: OTP already stored in user record during creation — just log it
  console.log('[auth-register] Step: OTP already embedded in user record, skipping separate store');

  // Step 8: Send OTP email (non-fatal)
  console.log('[auth-register] Step: sending OTP email');
  try {
    await sendSignupOtp(normalizedEmail, fullName.trim(), otp);
    console.log('[auth-register] OTP email dispatched');
  } catch (emailErr) {
    console.error('[auth-register] OTP email send failed (non-fatal):', emailErr.message);
  }

  // ---------------------------------------------------------------------------
  // Step 9: Lead routing (non-blocking append — must NEVER fail signup).
  //   - Tag the just-created Client as a 'lead' with self_signup source +
  //     canonical app_user_id link. assigned_consultant_id intentionally left
  //     NULL so it surfaces in the owner's Lead Inbox for allocation.
  //   - Fire-and-forget owner notification email.
  // ---------------------------------------------------------------------------
  try {
    if (createdClientId) {
      try {
        await base44.asServiceRole.entities.Client.update(createdClientId, {
          lifecycle_stage: 'lead',
          lead_source_type: 'self_signup',
          app_user_id: newUser.id
        });
      } catch (leadFieldsErr) {
        console.error('[auth-register] lead-field tagging failed (non-fatal):', leadFieldsErr?.message);
      }

      let ownerExists = false;
      try {
        const owners = await base44.asServiceRole.entities.User.filter({ role: 'owner' });
        ownerExists = Array.isArray(owners) ? owners.length > 0 : !!owners;
      } catch (_) {}

      if (ownerExists) {
        base44.functions.invoke('send-owner-lead-notification', {
          lead_id: createdClientId,
          business_name: businessName.trim(),
          contact_person: fullName.trim(),
          email: normalizedEmail,
          phone: rawMobile || phone?.trim() || '',
          signup_at: new Date().toISOString()
        }).catch((notifErr) => {
          console.error('[auth-register] send-owner-lead-notification failed (non-fatal):', notifErr?.message);
        });
        console.log('[auth-register] new lead routed to owner inbox:', createdClientId);
      }
    }
  } catch (leadErr) {
    console.error('[auth-register] lead routing failed (non-blocking):', leadErr?.message);
  }

  // Step 10: Portal activity feed entry — non-blocking, fire-and-forget.
  if (createdClientId) {
    base44.functions.invoke('log-client-activity', {
      client_id: createdClientId,
      user_id: newUser.id,
      client_name: businessName.trim(),
      title: 'Welcome to Marketing iO!',
      body: 'Your account is set up. Browse products, message your consultant, or upload your brand assets to get started.',
      icon: 'Sparkles',
      category: 'success',
      source: 'signup',
      link: '/client-portal'
    }).catch((err: any) => {
      console.error('[auth-register] log-client-activity failed (non-fatal):', err?.message);
    });
  }

  console.log('[auth-register] Step: complete — user_id:', newUser.id);
  return Response.json({ user_id: newUser.id, client_id: createdClientId, email: normalizedEmail }, { status: 200 });
});