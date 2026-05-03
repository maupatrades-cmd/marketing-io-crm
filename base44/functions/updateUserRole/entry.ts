import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { userId, newRole, session_token } = await req.json();

    // Verify caller is admin/owner via session token
    if (!session_token) {
      return Response.json({ error: 'Forbidden: session_token required' }, { status: 403 });
    }
    const callers = await base44.asServiceRole.entities.User.filter({ session_token });
    const caller = callers?.[0];
    if (!caller || (caller.role !== 'admin' && caller.role !== 'owner')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!userId || !newRole) {
      return Response.json({ error: 'Missing userId or newRole' }, { status: 400 });
    }

    // Update the user's role using service role
    const updated = await base44.asServiceRole.entities.User.update(userId, { role: newRole });

    return Response.json({ success: true, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});