import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td align="center" valign="middle" background="https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg" bgcolor="#0f172a" style="background-color:#0f172a;background-image:url('https://res.cloudinary.com/didwjb1et/image/upload/e_gen_restore/v1778379260/wmremove-transformed_1_ecjtyh.jpg');background-position:center center;background-size:cover;background-repeat:no-repeat;padding:60px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="280" style="width:280px;max-width:80%;height:auto;display:block;margin:0 auto;filter:drop-shadow(0 0 24px rgba(167,100,230,0.85)) drop-shadow(0 0 48px rgba(236,72,153,0.55));" />
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