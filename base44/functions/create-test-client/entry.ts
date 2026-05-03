import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const email = 'queenasdice@gmail.com';
  const password = 'Thapelo15!';
  const fullName = 'Queen Test Client';

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existing = await base44.asServiceRole.entities.User.filter({ email });
    if (existing && existing.length > 0) {
      return Response.json({ message: 'User already exists', email }, { status: 200 });
    }

    // Create user
    const user = await base44.asServiceRole.entities.User.create({
      email,
      full_name: fullName,
      role: 'client',
      password_hash: passwordHash,
      email_verified: true,
      pending_verification: false,
    });

    // Create client record
    const client = await base44.asServiceRole.entities.Client.create({
      business_name: 'Test Business',
      contact_person: fullName,
      email,
      phone: '082 000 0000',
      status: 'active',
      package: 'ignite',
      client_user_id: user.id,
      portal_invitation_sent_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      user_id: user.id,
      client_id: client.id,
      email,
      password: 'Thapelo15!',
      message: 'Test client created successfully. You can now log in.',
    }, { status: 200 });
  } catch (error) {
    console.error('[create-test-client] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});