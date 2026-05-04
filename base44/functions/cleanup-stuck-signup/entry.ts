import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Accept email from body
  let email = '';
  try {
    const body = await req.json();
    email = body.email || '';
  } catch (_) {}

  if (!email) {
    return Response.json({ error: 'email required in request body' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const deleted = { user: false, otps: 0, clients: 0 };
  let userId = null;

  // 1. Find user
  const users = await base44.asServiceRole.entities.AppUser.filter({ email: normalizedEmail });
  const user = users?.[0];
  userId = user?.id || null;

  // 2. Delete OTP codes for this email
  const otps = await base44.asServiceRole.entities.OTPCode.filter({ email: normalizedEmail });
  for (const otp of (otps || [])) {
    await base44.asServiceRole.entities.OTPCode.delete(otp.id);
    deleted.otps++;
  }

  // 3. Delete Client records linked to user
  if (userId) {
    const clients = await base44.asServiceRole.entities.Client.filter({ client_user_id: userId });
    for (const client of (clients || [])) {
      await base44.asServiceRole.entities.Client.delete(client.id);
      deleted.clients++;
    }

    // 4. Delete the User
    await base44.asServiceRole.entities.AppUser.delete(userId);
    deleted.user = true;
  }

  return Response.json({ deleted, email: normalizedEmail, user_id: userId });
});