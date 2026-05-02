import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins/owners can update user roles
    if (!user || (user.role !== 'admin' && user.role !== 'owner')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userId, newRole } = await req.json();

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