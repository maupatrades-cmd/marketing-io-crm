import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const HEAD_EMAIL = 'head@marketingio.co.za';
const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function urgencyToPriority(urgency: string): string {
  if (urgency === 'urgent') return 'urgent';
  if (urgency === 'high') return 'high';
  if (urgency === 'low') return 'low';
  return 'normal';
}

function categoryToMessageType(category: string, urgency: string): string {
  if (urgency === 'urgent' || category === 'complaint') return 'urgent_issue';
  if (category === 'billing') return 'billing_inquiry';
  if (category === 'fulfillment' || category === 'updates') return 'support_request';
  if (category === 'new_request') return 'general_inquiry';
  return 'general_inquiry';
}

async function sendUrgentEmail(opts: {
  client: any;
  category: string;
  urgency: string;
  specific: string;
  freeText: string;
  message: string;
  sender: any;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[log-whatsapp-contact] RESEND_API_KEY missing — skipping urgent escalation email');
    return false;
  }
  const { client, category, urgency, specific, freeText, message, sender } = opts;
  const businessName = client.business_name || 'Unknown business';
  const contact = client.contact_person || sender?.full_name || 'Unknown contact';
  const phone = client.phone || sender?.mobile_number || '—';

  const bodyHtml = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
  <div style="background:#0f172a;padding:18px;text-align:center;">
    <img src="${LOGO_URL}" alt="Marketing iO" width="180" style="display:block;margin:0 auto;" />
  </div>
  <div style="padding:24px;background:#fff;">
    <h2 style="color:#dc2626;margin:0 0 8px 0;">⚠️ Urgent contact via WhatsApp flow</h2>
    <p style="margin:0 0 12px 0;color:#475569;">A client just submitted a high-priority contact through the portal's guided WhatsApp flow.</p>
    <table cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px;margin:12px 0;">
      <tr><td style="color:#64748b;">Business</td><td><strong>${businessName}</strong></td></tr>
      <tr><td style="color:#64748b;">Contact</td><td>${contact}</td></tr>
      <tr><td style="color:#64748b;">Phone</td><td>${phone}</td></tr>
      <tr><td style="color:#64748b;">Category</td><td>${category}</td></tr>
      <tr><td style="color:#64748b;">Urgency</td><td><strong>${urgency.toUpperCase()}</strong></td></tr>
      <tr><td style="color:#64748b;">Specific</td><td>${specific}</td></tr>
      ${freeText ? `<tr><td style="color:#64748b;vertical-align:top;">Notes</td><td>${freeText}</td></tr>` : ''}
    </table>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0;" />
    <p style="color:#64748b;font-size:13px;margin:0 0 8px 0;">Outgoing WhatsApp message:</p>
    <pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:13px;white-space:pre-wrap;color:#0f172a;font-family:monospace;">${message.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre>
  </div>
</div>`;

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: 'Marketing iO Alerts <hello@marketingio.co.za>',
      to: HEAD_EMAIL,
      subject: `[URGENT VIA WHATSAPP] ${businessName}`,
      html: bodyHtml
    });
    if (result.error) {
      console.error('[log-whatsapp-contact] Resend error:', result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[log-whatsapp-contact] urgent email send failed:', err);
    return false;
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { client_id, category, urgency, specific, free_text, message } = body;
  if (!client_id || !category || !urgency || !specific) {
    return Response.json({ error: 'client_id, category, urgency, specific required' }, { status: 400 });
  }

  // Resolve client + sender. Best-effort — keep going even if either fails.
  let client: any = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (err) {
    console.error('[log-whatsapp-contact] client lookup failed:', err);
  }
  if (!client) {
    return Response.json({ success: false, reason: 'client_not_found' }, { status: 404 });
  }

  let sender: any = null;
  try {
    if (client.client_user_id) {
      const senders = await base44.asServiceRole.entities.AppUser.filter({ id: client.client_user_id });
      sender = Array.isArray(senders) ? senders[0] : senders;
    }
  } catch (err) {
    console.error('[log-whatsapp-contact] sender lookup failed:', err);
  }

  const subjectLine = `WhatsApp contact: ${category} – ${specific}`;
  const messageType = categoryToMessageType(category, urgency);
  const priority = urgencyToPriority(urgency);
  const meta = JSON.stringify({
    source: 'whatsapp_flow',
    category,
    urgency,
    specific,
    free_text: free_text || ''
  });

  let logId: string | null = null;
  try {
    const log = await base44.asServiceRole.entities.ClientCommunication.create({
      client_id: client.id,
      client_name: client.business_name || '',
      sender_id: sender?.id || client.client_user_id || '',
      sender_name: sender?.full_name || client.contact_person || '',
      sender_email: sender?.email || client.email || '',
      message_type: messageType,
      subject: subjectLine,
      message: message || '(no message captured)',
      status: 'new',
      priority,
      is_read: false,
      metadata: meta
    });
    logId = log?.id || null;
  } catch (err) {
    console.error('[log-whatsapp-contact] communication create failed:', err);
    return Response.json({ success: false, reason: 'log_failed' }, { status: 500 });
  }

  // Escalate to head@ for urgent or complaint flows. Fire-and-forget within
  // this request — don't block returning the log ID to the frontend.
  let escalated = false;
  if (urgency === 'urgent' || category === 'complaint') {
    escalated = await sendUrgentEmail({
      client,
      category,
      urgency,
      specific,
      freeText: free_text || '',
      message: message || '',
      sender
    });
  }

  return Response.json({ success: true, log_id: logId, escalated });
});
