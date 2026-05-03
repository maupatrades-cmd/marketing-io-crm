import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Notifies the assigned field agent (and admin) when a client uploads a brand asset.
 * Payload: { client_id, upload_id, file_name, file_type }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { client_id, upload_id, file_name, file_type } = await req.json();

    if (!client_id) {
      return Response.json({ error: 'client_id required' }, { status: 400 });
    }

    // Fetch client to get assigned field agent
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientName = client.business_name || 'A client';
    const fileLabel = file_name || 'a file';
    const typeLabel = file_type ? file_type.replace(/_/g, ' ') : 'document';

    // Create an internal task for the assigned field agent (or any admin)
    await base44.asServiceRole.entities.Task.create({
      title: `Review new asset from ${clientName}: ${fileLabel}`,
      client_id,
      client_name: clientName,
      status: 'open',
      priority: 'medium',
      due_date: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        return d.toISOString().split('T')[0];
      })(),
      auto_generated: true,
      description: `Client uploaded a new ${typeLabel}. Please review and action as needed.`,
      ...(client.assigned_field_agent ? { assigned_to: client.assigned_field_agent } : {}),
    });

    // Log activity
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id,
      client_name: clientName,
      event_type: 'document_uploaded',
      event_label: `Client uploaded: ${fileLabel} (${typeLabel})`,
      logged_by: 'system',
      logged_by_name: 'Client Portal',
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('notifyStaffOnUpload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});