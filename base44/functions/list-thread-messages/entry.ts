import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function callerIsParticipant(thread: any, client: any, callerId: string, callerRole: string): boolean {
  if (!callerId) return false;
  if (callerRole === 'owner') return true;
  if (thread.consultant_id && thread.consultant_id === callerId) return true;
  if (Array.isArray(thread.participants) && thread.participants.includes(callerId)) return true;
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
  const { thread_id, before_message_id, token } = body;

  if (!thread_id) return Response.json({ error: 'thread_id required' }, { status: 400 });
  if (!token) return Response.json({ error: 'token required' }, { status: 401 });

  // LB-028: derive caller identity from session token. Prior version trusted
  // current_user_id / current_user_role from the request body, letting anyone
  // claim any user_id or role to read any thread's messages.
  let caller: any = null;
  try {
    const callerList = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    caller = (Array.isArray(callerList) ? callerList[0] : null) || null;
  } catch (err) {
    console.error('[list-thread-messages] caller lookup failed:', err);
  }
  if (!caller) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!caller.session_expires_at || new Date(caller.session_expires_at) < new Date()) {
    return Response.json({ error: 'session_expired' }, { status: 401 });
  }
  const current_user_id = caller.id;
  const current_user_role = caller.role;

  // Load thread.
  let thread: any = null;
  try {
    const threads = await base44.asServiceRole.entities.ClientThread.filter({ id: thread_id });
    thread = Array.isArray(threads) ? threads[0] : threads;
  } catch (_) {}
  if (!thread) return Response.json({ error: 'thread_not_found' }, { status: 404 });

  let client: any = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: thread.client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (_) {}

  if (!callerIsParticipant(thread, client, current_user_id, current_user_role)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // Load messages. The Base44 SDK doesn't expose cursor pagination on a
  // generic filter, so we fetch the most recent 50, optionally trim to those
  // before a known message_id (passed as cutoff), and return ascending.
  let messages: any[] = [];
  try {
    const raw = await base44.asServiceRole.entities.ClientThreadMessage
      .filter({ thread_id }, '-created_date', 50);
    messages = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  } catch (err) {
    console.error('[list-thread-messages] messages load failed:', err);
  }

  if (before_message_id) {
    const idx = messages.findIndex(m => m.id === before_message_id);
    if (idx >= 0) messages = messages.slice(idx + 1);
  }

  // Reverse to ascending (oldest first).
  messages = messages.reverse();

  // Mark all messages not yet read by this user as read.
  const updates: Promise<any>[] = [];
  for (const m of messages) {
    const readBy: string[] = Array.isArray(m.read_by) ? m.read_by : [];
    if (!readBy.includes(current_user_id)) {
      const next = [...readBy, current_user_id];
      updates.push(
        base44.asServiceRole.entities.ClientThreadMessage.update(m.id, { read_by: next })
          .catch(err => console.error('[list-thread-messages] read mark failed for', m.id, err))
      );
      m.read_by = next;
    }
  }
  // Don't block the response on the update fan-out — fire and forget.
  Promise.allSettled(updates).catch(() => {});

  // Reset unread for the caller's role since they're viewing now.
  const unreadField = unreadFieldFor(current_user_role);
  if (unreadField && (thread[unreadField] || 0) > 0) {
    try {
      await base44.asServiceRole.entities.ClientThread.update(thread.id, { [unreadField]: 0 });
      thread[unreadField] = 0;
    } catch (err) {
      console.error('[list-thread-messages] unread reset failed:', err);
    }
  }

  return Response.json({ thread, messages });
});
