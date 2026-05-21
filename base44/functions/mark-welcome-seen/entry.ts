import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { session_token } = await req.json();

    if (!session_token) {
      return Response.json({ error: 'session_token required' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.AppUser.filter({ session_token });
    const user = users?.[0];
    if (!user) {
      return Response.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (!user.welcome_seen_at) {
      await base44.asServiceRole.entities.AppUser.update(user.id, {
        welcome_seen_at: new Date().toISOString()
      });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});