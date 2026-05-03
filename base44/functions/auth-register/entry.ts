import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { fullName, email, phone, businessName, password } = await req.json();

  if (!fullName || !email || !password || !businessName) {
    return Response.json({ error: 'All required fields must be provided.' }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email format.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
  if (existing && existing.length > 0) {
    return Response.json({ error: 'Account already exists' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let createdUserId = null;
  let createdClientId = null;

  const newUser = await base44.asServiceRole.entities.User.create({
    email: normalizedEmail,
    full_name: fullName.trim(),
    phone: phone?.trim() || '',
    role: 'client',
    password_hash: passwordHash,
    pending_verification: true,
    email_verified: false,
    failed_login_count: 0
  });
  createdUserId = newUser.id;

  try {
    const newClient = await base44.asServiceRole.entities.Client.create({
      business_name: businessName.trim(),
      contact_person: fullName.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || '',
      status: 'lead',
      client_user_id: newUser.id,
      portal_invitation_sent_at: new Date().toISOString()
    });
    createdClientId = newClient.id;
  } catch (clientErr) {
    // Roll back user if client creation fails
    await base44.asServiceRole.entities.User.delete(createdUserId);
    console.error('Client creation failed, rolled back user:', clientErr);
    return Response.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }

  // Generate OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  try {
    await base44.asServiceRole.entities.OTPCode.create({
      email: normalizedEmail,
      code: otp,
      purpose: 'signup_verification',
      expires_at: expires,
      used: false,
      generated_at: new Date().toISOString(),
      user_id: newUser.id
    });
  } catch (otpErr) {
    // Roll back both records
    if (createdClientId) { try { await base44.asServiceRole.entities.Client.delete(createdClientId); } catch (_) {} }
    await base44.asServiceRole.entities.User.delete(createdUserId);
    return Response.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
  }

  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedEmail,
      subject: 'Verify your Marketing iO account',
      body: `Hi ${fullName.trim()},\n\nWelcome to Marketing iO!\n\nYour verification code is: ${otp}\n\nThis code expires in 15 minutes.\n\n— The Marketing iO Team`
    });
  } catch (emailErr) {
    console.error('OTP email failed:', emailErr);
  }

  return Response.json({ user_id: newUser.id, email: normalizedEmail }, { status: 200 });
});