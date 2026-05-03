import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { token } = await req.json();

  if (!token) {
    return Response.json({ error: 'Token is required.' }, { status: 400 });
  }

  const users = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
  if (!users || users.length === 0) {
    return Response.json({ error: 'Invalid session' }, { status: 401 });
  }

  const user = users[0];

  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Session expired' }, { status: 401 });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
      email_verified: user.email_verified
    }
  }, { status: 200 });
});