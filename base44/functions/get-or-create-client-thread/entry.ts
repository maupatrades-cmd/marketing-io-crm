import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Resolve the consultant assigned to a client. Falls back through the most
// reliable signals we have today.
async function resolveConsultantId(base44: any, client: any): Promise<string | null> {
  if (client?.assigned_field_agent) return client.assigned_field_agent;
  try {
    const onboarding = await base44.asServiceRole.entities.ClientOnboarding
      .filter({ client_id: client.id }, '-created_date', 1);
    const o = Array.isArray(onboarding) ? onboarding[0] : onboarding;
    if (o?.assigned_admin_id) return o.assigned_admin_id;
  } catch (_) {}
  return null;
}

async function resolveOwnerId(base44: any): Promise<string | null> {
  try {
    const owners = await base44.asServiceRole.entities.User.filter({ role: 'owner' });
    const o = Array.isArray(owners) ? owners[0] : owners;
    return o?.id || null;
  } catch (_) {
    return null;
  }
}

function callerIsParticipant(thread: any, client: any, callerId: string, callerRole: string): boolean {
  if (!callerId) return false;
  if (callerRole === 'owner') return true;
  if (thread.consultant_id && thread.consultant_id === callerId) return true;
  if (Array.isArray(thread.participants) && thread.participants.includes(callerId)) return true;
  // Direct client linkage as a final check.
  if (client?.client_user_id && client.client_user_id === callerId) return true;
  return false;
}

function unreadFieldFor(role: string): string | null {
  if (role === 'client') return 'unread_count_client';
  if (role === 'consultant') return 'unread_count_consultant';
  if (role === 'owner') return 'unread_count_owner';
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const { client_id, token } = body;

  if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 });
  if (!token) return Response.json({ error: 'token required' }, { status: 401 });

  // LB-029: derive caller identity from session token. Prior version trusted
  // current_user_id / current_user_role from the request body, letting anyone
  // claim any user_id or role to read or create any client's thread.
  let caller: any = null;
  try {
    const callerList = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    caller = (Array.isArray(callerList) ? callerList[0] : null) || null;
  } catch (err) {
    console.error('[get-or-create-client-thread] caller lookup failed:', err);
  }
  if (!caller) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!caller.session_expires_at || new Date(caller.session_expires_at) < new Date()) {
    return Response.json({ error: 'session_expired' }, { status: 401 });
  }
  const current_user_id = caller.id;
  const current_user_role = caller.role;

  // Load client first so permission checks have something to chew on.
  let client: any = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (err) {
    console.error('[get-or-create-client-thread] client lookup failed:', err);
  }
  if (!client) return Response.json({ error: 'client_not_found' }, { status: 404 });

  // Find existing thread.
  let thread: any = null;
  try {
    const threads = await base44.asServiceRole.entities.ClientThread.filter({ client_id });
    thread = Array.isArray(threads) ? threads[0] : threads;
  } catch (err) {
    console.error('[get-or-create-client-thread] thread lookup failed:', err);
  }

  // Create thread if missing. Owner is allowed to bootstrap; client themselves
  // can also bootstrap their own thread.
  let ownerId: string | null = null;
  let consultantId: string | null = null;

  if (!thread) {
    const allowedToCreate =
      current_user_role === 'owner'
      || (client.client_user_id && client.client_user_id === current_user_id);
    if (!allowedToCreate) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    consultantId = await resolveConsultantId(base44, client);
    ownerId = await resolveOwnerId(base44);

    const participants = [
      client.client_user_id,
      consultantId,
      ownerId
    ].filter(Boolean);

    try {
      thread = await base44.asServiceRole.entities.ClientThread.create({
        client_id,
        client_name: client.business_name || '',
        participants,
        consultant_id: consultantId || '',
        owner_id: ownerId || '',
        last_message_at: new Date().toISOString(),
        last_message_preview: '',
        unread_count_client: 0,
        unread_count_consultant: 0,
        unread_count_owner: 0,
        status: 'active'
      });
    } catch (err) {
      console.error('[get-or-create-client-thread] thread create failed:', err);
      return Response.json({ error: 'thread_create_failed' }, { status: 500 });
    }

    // Activity audit (Client Portal PR A): support_request_opened — only on
    // brand-new thread creation, not when an existing thread is fetched.
    try {
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id,
        client_name:    String(client.business_name || client.contact_person || '').trim(),
        actor_id:       String(current_user_id || ''),
        actor_role:     String(current_user_role || 'client').toLowerCase() === 'client' ? 'client' : 'system',
        event_type:     'support_request_opened',
        event_category: 'support',
        event_summary:  'Support thread opened',
        event_metadata: { thread_id: thread?.id, consultant_id: consultantId, owner_id: ownerId },
        event_label:    'Support thread opened',
        logged_by:      String(current_user_id || ''),
        logged_by_name: '',
      });
    } catch (logErr) {
      console.error('[get-or-create-client-thread] activity log failed (non-fatal):', logErr);
    }

    // Auto-post welcome system message.
    let consultantName = 'your consultant';
    if (consultantId) {
      try {
        const u = await base44.asServiceRole.entities.User.filter({ id: consultantId });
        const c = Array.isArray(u) ? u[0] : u;
        if (c?.full_name) consultantName = c.full_name;
      } catch (_) {}
    }
    const welcome = `Welcome to your Marketing iO team chat. ${consultantName} is your dedicated consultant. Thapelo (Owner) is also here when you need him.`;
    try {
      await base44.asServiceRole.entities.ClientThreadMessage.create({
        thread_id: thread.id,
        client_id,
        sender_id: ownerId || consultantId || 'system',
        sender_name: 'Marketing iO',
        sender_role: 'owner',
        message: welcome,
        is_system_message: true,
        read_by: []
      });
      // Reflect in thread last_message + bump unreads for everyone (system
      // message counts as something to acknowledge).
      await base44.asServiceRole.entities.ClientThread.update(thread.id, {
        last_message_at: new Date().toISOString(),
        last_message_preview: welcome.slice(0, 100),
        unread_count_client: 1,
        unread_count_consultant: consultantId ? 1 : 0,
        unread_count_owner: ownerId ? 1 : 0
      });
      // Refresh local copy.
      thread = { ...thread, last_message_preview: welcome.slice(0, 100),
        unread_count_client: 1,
        unread_count_consultant: consultantId ? 1 : 0,
        unread_count_owner: ownerId ? 1 : 0 };
    } catch (err) {
      console.error('[get-or-create-client-thread] welcome message failed (non-fatal):', err);
    }
  }

  // Permission check (now that thread exists).
  if (!callerIsParticipant(thread, client, current_user_id, current_user_role)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // Reset unread for the caller's role since they're viewing now.
  const unreadField = unreadFieldFor(current_user_role);
  if (unreadField && (thread[unreadField] || 0) > 0) {
    try {
      await base44.asServiceRole.entities.ClientThread.update(thread.id, { [unreadField]: 0 });
      thread[unreadField] = 0;
    } catch (err) {
      console.error('[get-or-create-client-thread] unread reset failed:', err);
    }
  }

  // Return thread + last 50 messages ascending.
  let messages: any[] = [];
  try {
    const raw = await base44.asServiceRole.entities.ClientThreadMessage
      .filter({ thread_id: thread.id }, '-created_date', 50);
    messages = (Array.isArray(raw) ? raw : (raw ? [raw] : [])).reverse();
  } catch (err) {
    console.error('[get-or-create-client-thread] messages load failed:', err);
  }

  return Response.json({ thread, messages });
});
