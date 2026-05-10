import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function determineSenderRole(thread: any, client: any, senderId: string): string {
  if (thread.owner_id && thread.owner_id === senderId) return 'owner';
  if (thread.consultant_id && thread.consultant_id === senderId) return 'consultant';
  if (client?.client_user_id && client.client_user_id === senderId) return 'client';
  // Fall back: participant but unknown role — treat as consultant for display.
  return 'consultant';
}

async function lookupParticipant(base44: any, userId: string): Promise<{ name?: string; email?: string }> {
  if (!userId) return {};
  // Try AppUser first (clients), then User (staff/owner).
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ id: userId });
    const u = Array.isArray(appUsers) ? appUsers[0] : appUsers;
    if (u) return { name: u.full_name, email: u.email };
  } catch (_) {}
  try {
    const users = await base44.asServiceRole.entities.User.filter({ id: userId });
    const u = Array.isArray(users) ? users[0] : users;
    if (u) return { name: u.full_name, email: u.email };
  } catch (_) {}
  return {};
}

function notificationEmail(opts: { to: string; senderName: string; clientName: string; preview: string }) {
  const { to, senderName, clientName, preview } = opts;
  return {
    to,
    subject: `New message from ${senderName} in ${clientName}`,
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="background:#0f172a;padding:18px;text-align:center;">
    <img src="${LOGO_URL}" alt="Marketing iO" width="180" />
  </div>
  <div style="padding:24px;background:#fff;">
    <h2 style="margin:0 0 12px 0;color:#0f172a;">New message in ${clientName}</h2>
    <p style="margin:0 0 12px 0;color:#475569;"><strong>${senderName}</strong> sent:</p>
    <blockquote style="margin:0 0 16px 0;padding:12px 16px;background:#f1f5f9;border-left:3px solid #a764e6;color:#0f172a;border-radius:4px;font-size:14px;line-height:1.5;">${preview.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</blockquote>
    <a href="https://app.marketingio.co.za/client/messages" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Open thread →</a>
  </div>
</div>`
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { thread_id, sender_id, message } = await req.json();

  if (!thread_id || !sender_id || !message || !message.trim()) {
    return Response.json({ error: 'thread_id, sender_id, message required' }, { status: 400 });
  }

  // Load thread.
  let thread: any = null;
  try {
    const threads = await base44.asServiceRole.entities.ClientThread.filter({ id: thread_id });
    thread = Array.isArray(threads) ? threads[0] : threads;
  } catch (err) {
    console.error('[send-thread-message] thread lookup failed:', err);
  }
  if (!thread) return Response.json({ error: 'thread_not_found' }, { status: 404 });

  // Load client (for client_user_id / business_name).
  let client: any = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: thread.client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (_) {}

  // Permission: sender must be a participant.
  const isOwner = thread.owner_id && thread.owner_id === sender_id;
  const isConsultant = thread.consultant_id && thread.consultant_id === sender_id;
  const isClient = client?.client_user_id && client.client_user_id === sender_id;
  const isParticipant = isOwner || isConsultant || isClient
    || (Array.isArray(thread.participants) && thread.participants.includes(sender_id));
  if (!isParticipant) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const senderRole = determineSenderRole(thread, client, sender_id);
  const senderInfo = await lookupParticipant(base44, sender_id);
  const senderName = senderInfo.name || 'Marketing iO';
  const trimmedMessage = message.trim();

  // Create the message.
  let newMessage: any;
  try {
    newMessage = await base44.asServiceRole.entities.ClientThreadMessage.create({
      thread_id,
      client_id: thread.client_id,
      sender_id,
      sender_name: senderName,
      sender_role: senderRole,
      message: trimmedMessage,
      is_system_message: false,
      read_by: [sender_id]
    });
  } catch (err) {
    console.error('[send-thread-message] message create failed:', err);
    return Response.json({ error: 'message_create_failed' }, { status: 500 });
  }

  // Activity audit (Client Portal PR A): message_sent_by_client when the
  // client is the sender, message_received_by_client otherwise (admin/staff
  // sent → from the client's POV, they received it).
  try {
    const isClientSender = senderRole === 'client';
    const eventType    = isClientSender ? 'message_sent_by_client' : 'message_received_by_client';
    const eventSummary = isClientSender
      ? 'Sent a message to the team'
      : `Received a message from ${senderName}`;
    const actorRole    = isClientSender ? 'client'
                       : senderRole === 'owner'      ? 'owner'
                       : senderRole === 'consultant' ? 'admin'
                       : 'system';
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      thread.client_id,
      client_name:    String(client?.business_name || client?.contact_person || '').trim(),
      actor_id:       String(sender_id || ''),
      actor_role:     actorRole,
      event_type:     eventType,
      event_category: 'communication',
      event_summary:  eventSummary,
      event_metadata: {
        thread_id:    thread.id,
        message_id:   newMessage?.id,
        sender_role:  senderRole,
        preview:      trimmedMessage.slice(0, 140),
      },
      event_label:    eventSummary,
      logged_by:      String(sender_id || ''),
      logged_by_name: senderName,
    });
  } catch (logErr) {
    console.error('[send-thread-message] activity log failed (non-fatal):', logErr);
  }

  // Compute new unread counters: every role EXCEPT the sender's gets +1.
  const update: any = {
    last_message_at: new Date().toISOString(),
    last_message_preview: trimmedMessage.slice(0, 100)
  };

  // Track which participants need a notification email — those whose unread
  // was 0 before this message (i.e., they're not actively in the thread).
  const notifyTargets: { userId: string; role: string }[] = [];

  if (senderRole !== 'client') {
    const before = thread.unread_count_client || 0;
    update.unread_count_client = before + 1;
    if (before === 0 && client?.client_user_id) notifyTargets.push({ userId: client.client_user_id, role: 'client' });
  }
  if (senderRole !== 'consultant' && thread.consultant_id) {
    const before = thread.unread_count_consultant || 0;
    update.unread_count_consultant = before + 1;
    if (before === 0) notifyTargets.push({ userId: thread.consultant_id, role: 'consultant' });
  }
  if (senderRole !== 'owner' && thread.owner_id) {
    const before = thread.unread_count_owner || 0;
    update.unread_count_owner = before + 1;
    if (before === 0) notifyTargets.push({ userId: thread.owner_id, role: 'owner' });
  }

  try {
    await base44.asServiceRole.entities.ClientThread.update(thread.id, update);
  } catch (err) {
    console.error('[send-thread-message] thread update failed:', err);
  }

  // Send notification emails to inactive participants.
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (apiKey && notifyTargets.length > 0) {
    const resend = new Resend(apiKey);
    for (const target of notifyTargets) {
      try {
        const info = await lookupParticipant(base44, target.userId);
        if (!info.email) continue;
        const email = notificationEmail({
          to: info.email,
          senderName,
          clientName: thread.client_name || client?.business_name || 'a client',
          preview: trimmedMessage.slice(0, 280)
        });
        await resend.emails.send({
          from: 'Marketing iO Team <hello@marketingio.co.za>',
          ...email
        });
      } catch (err) {
        console.error('[send-thread-message] notification email failed for', target, err);
      }
    }
  }

  return Response.json({ success: true, message: newMessage });
});
