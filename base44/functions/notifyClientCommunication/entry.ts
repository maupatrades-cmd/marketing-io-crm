import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { communication_id } = await req.json();

    if (!communication_id) {
      return Response.json({ error: 'Missing communication_id' }, { status: 400 });
    }

    // Fetch the communication
    const comm = await base44.asServiceRole.entities.ClientCommunication.get(communication_id);
    if (!comm) {
      return Response.json({ error: 'Communication not found' }, { status: 404 });
    }

    // Get client info
    const client = await base44.asServiceRole.entities.Client.get(comm.client_id);
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get admin/owner users to notify
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const owners = await base44.asServiceRole.entities.User.filter({ role: 'owner' });
    const notifyUsers = [...(Array.isArray(admins) ? admins : [admins]), ...(Array.isArray(owners) ? owners : [owners])].filter(u => u.email);

    // Create in-app notifications for admin/owner
    for (const staffMember of notifyUsers) {
      try {
        await base44.asServiceRole.entities.InternalMessage.create({
          recipient_id: staffMember.id,
          recipient_name: staffMember.full_name,
          recipient_email: staffMember.email,
          sender_name: comm.sender_name,
          sender_email: comm.sender_email,
          subject: `New Client Message: ${comm.subject}`,
          message: `${comm.client_name} (${comm.sender_name}) sent a ${comm.message_type.replace(/_/g, ' ')} message.\n\nSubject: ${comm.subject}\n\nMessage: ${comm.message}`,
          message_type: 'client_communication',
          related_entity_type: 'ClientCommunication',
          related_entity_id: communication_id,
          priority: comm.priority,
          is_read: false,
        });
      } catch (err) {
        console.warn(`Failed to create internal message for ${staffMember.email}:`, err.message);
      }
    }

    // Send email notification to owner/admin if available
    const primaryRecipient = notifyUsers.length > 0 ? notifyUsers[0] : null;
    if (primaryRecipient?.email) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: primaryRecipient.email,
          from_name: 'Marketing iO',
          subject: `New Client Message from ${comm.client_name}`,
          body: `
            <h2>${comm.subject}</h2>
            <p><strong>From:</strong> ${comm.sender_name} (${comm.client_name})</p>
            <p><strong>Type:</strong> ${comm.message_type.replace(/_/g, ' ')}</p>
            <p><strong>Priority:</strong> ${comm.priority}</p>
            
            <hr style="margin: 20px 0;">
            
            <p>${comm.message.replace(/\n/g, '<br>')}</p>
            
            <hr style="margin: 20px 0;">
            
            <p><a href="https://app.marketingio.co.za/clients/${comm.client_id}" style="background: #a764e6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">View Client</a></p>
            <p>Best regards,<br>Marketing iO</p>
          `,
        });
      } catch (emailErr) {
        console.warn('Email notification failed:', emailErr.message);
      }
    }

    return Response.json({ success: true, notified: notifyUsers.length });
  } catch (error) {
    console.error('[notifyClientCommunication]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});