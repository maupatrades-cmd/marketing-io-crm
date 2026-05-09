import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

// ONE-TIME migration: ensures the owner account exists in AppUser.
// Safe to run multiple times (idempotent).
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const email = 'business.lekgoro@gmail.com';
  const password = 'MarketingIO2026!';

  // Check if already in AppUser
  try {
    const existing = await base44.asServiceRole.entities.AppUser.filter({ email });
    if (existing && existing.length > 0) {
      return Response.json({ message: 'Owner already in AppUser.', id: existing[0].id });
    }
  } catch (err) {
    console.error('AppUser check failed:', err);
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const newUser = await base44.asServiceRole.entities.AppUser.create({
      email,
      full_name: 'Lekgoro',
      role: 'owner',
      password_hash: hash,
      pending_verification: false,
      email_verified: true,
      failed_login_count: 0,
    });

    return Response.json({
      message: 'Owner AppUser created successfully.',
      id: newUser?.id || newUser?.data?.id,
      email,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});