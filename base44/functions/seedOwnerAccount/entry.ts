import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

// ONE-TIME function — run once via test_backend_function, then delete or ignore.
// Creates the owner account for maupatrades@gmail.com
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const email = 'business.lekgoro@gmail.com';
  const password = 'MarketingIO2026!';
  const hash = await bcrypt.hash(password, 10);

  // Check if already exists
  const existing = await base44.asServiceRole.entities.User.filter({ email });
  if (existing && existing.length > 0) {
    return Response.json({
      message: 'Owner account already exists.',
      user_id: existing[0].id,
      hash
    });
  }

  const newUser = await base44.asServiceRole.entities.User.create({
    email,
    full_name: 'Thapelo Maupa',
    role: 'owner',
    password_hash: hash,
    pending_verification: false,
    email_verified: true,
    failed_login_count: 0
  });

  return Response.json({
    message: 'Owner account created successfully.',
    user_id: newUser.id,
    email,
    hash
  });
});