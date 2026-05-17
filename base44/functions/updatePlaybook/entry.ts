import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { token, playbook_id, data } = await req.json();

  if (!token || !playbook_id) {
    return Response.json({ error: 'Token and playbook_id required' }, { status: 400 });
  }

  // Validate session and role
  const appUsers = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
  const user = appUsers?.[0];

  if (!user || !user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  if (!['owner', 'admin', 'founder'].includes(user.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await base44.asServiceRole.entities.Playbook.update(playbook_id, data);
  return Response.json({ playbook: updated });
});