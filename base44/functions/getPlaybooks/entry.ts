import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { token } = await req.json();

  if (!token) {
    return Response.json({ error: 'Token required' }, { status: 400 });
  }

  // Validate session
  const appUsers = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
  const user = appUsers?.[0];

  if (!user || !user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  const playbooks = await base44.asServiceRole.entities.Playbook.list();

  return Response.json({ playbooks, user_role: user.role });
});