import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// send-invoice-chase — Round 4 of recovery plan.
//
// Inputs (POST JSON):
//   { invoice_id, stage, token, custom_message? }
//   - stage: 'reminder' | 'firm' | 'final' | 'escalation' (Day 1 / 3 / 7 / 14)
//   - custom_message: optional admin override paragraph
//
// Output:
//   { success: true, email_sent, communication_id?, activity_id? }
//
// Sends a chase email to the buyer at the appropriate severity for the
// stage. Logs ClientCommunication and ClientActivityLog. Designed to be
// called from the /admin/invoices chase queue row action.
//
// Auth: token (session token) required, role owner|admin.
// =============================================================================

const FROM      = 'Marketing iO Accounts <accounts@marketingio.co.za>';
const HEAD_BCC  = 'head@marketingio.co.za';
const LOGO_URL  = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';
const APP_URL   = 'https://app.marketingio.co.za';

const STAGE_META: Record<string, { subject: (n: string, ref: string) => string; tone: string; severity: 'low'|'medium'|'high' }> = {
  reminder:   { subject: (_, ref) => `Friendly reminder: invoice ${ref}`,                    tone: 'gentle',   severity: 'low' },
  firm:       { subject: (_, ref) => `Invoice ${ref} — please action`,                       tone: 'firm',     severity: 'medium' },
  final:      { subject: (_, ref) => `Final notice: invoice ${ref}`,                          tone: 'final',    severity: 'high' },
  escalation: { subject: (n, ref) => `Account on hold pending payment — invoice ${ref}`,     tone: 'escalate', severity: 'high' },
};

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function buildBody(opts: {
  contactName: string;
  businessName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  daysOutstanding: number;
  stage: string;
  customMessage?: string;
}) {
  const { contactName, businessName, invoiceNumber, amount, dueDate, daysOutstanding, stage, customMessage } = opts;
  const amt = Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const greeting = contactName ? `Hi ${escapeHtml(contactName)},` : `Hi there,`;
  const intro = (() => {
    switch (stage) {
      case 'reminder':
        return `<p>This is a quick reminder that invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(businessName)}</strong> is currently outstanding.</p>`;
      case 'firm':
        return `<p>Invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${escapeHtml(businessName)}</strong> is now <strong>${daysOutstanding} days past due</strong>. Please action this when you have a moment.</p>`;
      case 'final':
        return `<p>This is a final notice for invoice <strong>${escapeHtml(invoiceNumber)}</strong>, currently <strong>${daysOutstanding} days past due</strong>. Please settle within the next 24 hours to avoid service interruption.</p>`;
      case 'escalation':
        return `<p>Per our terms, your account for <strong>${escapeHtml(businessName)}</strong> is being placed on hold pending payment of invoice <strong>${escapeHtml(invoiceNumber)}</strong> (${daysOutstanding} days past due). Active deliverables and integrations will pause until settlement.</p>`;
      default:
        return `<p>Invoice <strong>${escapeHtml(invoiceNumber)}</strong> requires your attention.</p>`;
    }
  })();
  const detailBlock = `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;background:#f8fafc;border-radius:8px;width:100%;">
      <tr><td style="padding:18px 20px;color:#1e293b;font-size:14px;">
        <strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}<br>
        <strong>Amount due:</strong> R${amt}<br>
        <strong>Due date:</strong> ${escapeHtml(dueDate || 'on receipt')}<br>
        <strong>Days outstanding:</strong> ${daysOutstanding}
      </td></tr>
    </table>`;
  const cta = `<div style="text-align:center;margin:24px 0;"><a href="${APP_URL}/client/invoices" style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">View &amp; pay invoice</a></div>`;
  const customBlock = customMessage
    ? `<p style="background:#fef3c7;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:4px;">${escapeHtml(customMessage).replace(/\n/g, '<br>')}</p>`
    : '';
  const closing = stage === 'escalation'
    ? `<p>If you have already paid in the last 24 hours, please reply with proof of payment so we can release your account immediately.</p>`
    : `<p>If you've already paid, thank you — please ignore this. If you have any questions or need a payment plan, just reply to this email.</p>`;
  return `<h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">${greeting.replace(',', '')}</h1>${intro}${detailBlock}${customBlock}${cta}${closing}<p style="margin-top:24px;color:#64748b;font-size:14px;">— Marketing iO Accounts</p>`;
}

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

async function deriveActor(base44: any, token: string) {
  if (!token) return null;
  let user: any = null;
  try {
    const list = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    user = unwrapList(list)[0] || null;
  } catch { /* try legacy */ }
  if (!user) {
    try {
      const list = await base44.asServiceRole.entities.User.filter({ session_token: token });
      user = unwrapList(list)[0] || null;
    } catch { return null; }
  }
  if (!user) return null;
  if (!user.session_expires_at || new Date(user.session_expires_at) < new Date()) return null;
  return { userId: String(user.id || ''), role: String(user.role || 'client'), email: String(user.email || '') };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const invoiceId      = String(body?.invoice_id ?? '').trim();
  const stage          = String(body?.stage ?? 'reminder').trim();
  const tokenRaw       = String(body?.token ?? '').trim();
  const customMessage  = body?.custom_message ? String(body.custom_message) : '';

  if (!invoiceId) return Response.json({ error: 'invoice_id required' }, { status: 400 });
  if (!STAGE_META[stage]) return Response.json({ error: 'unknown_stage' }, { status: 400 });

  const base44 = createClientFromRequest(req);

  const actor = await deriveActor(base44, tokenRaw);
  if (!actor) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // Resolve invoice + client.
  const invList = await base44.asServiceRole.entities.Invoice.filter({ id: invoiceId });
  const invoice = unwrapList(invList)[0];
  if (!invoice) return Response.json({ error: 'invoice_not_found' }, { status: 404 });

  const cliList = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
  const client = unwrapList(cliList)[0];
  if (!client?.email) return Response.json({ error: 'client_email_missing' }, { status: 422 });

  const dueDate = String(invoice.due_date || '');
  let daysOutstanding = 0;
  if (dueDate) {
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    daysOutstanding = Math.max(0, Math.floor((now - due) / (24 * 60 * 60 * 1000)));
  }
  const amount = Number(invoice.total_amount || invoice.total || invoice.amount || 0);

  const subject = STAGE_META[stage].subject(client.business_name || '', invoice.invoice_number || invoiceId);
  const html    = wrapEmail(buildBody({
    contactName:   String(client.contact_person || '').trim(),
    businessName:  String(client.business_name || '').trim(),
    invoiceNumber: String(invoice.invoice_number || invoiceId),
    amount,
    dueDate,
    daysOutstanding,
    stage,
    customMessage,
  }));

  let emailSent = false;
  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from:    FROM,
        to:      [client.email],
        bcc:     [HEAD_BCC],
        subject,
        html,
        reply_to: 'accounts@marketingio.co.za',
      });
      emailSent = true;
    } else {
      console.error('[send-invoice-chase] RESEND_API_KEY missing');
    }
  } catch (err) {
    console.error('[send-invoice-chase] Resend send failed:', err);
  }

  // ClientCommunication audit
  let communicationId: string | null = null;
  try {
    const comm = await base44.asServiceRole.entities.ClientCommunication.create({
      client_id:   client.id,
      sender_id:   actor.userId,
      sender_role: actor.role,
      direction:   'outbound',
      channel:     'email',
      subject,
      message:     `Chase email (${stage}) sent for invoice ${invoice.invoice_number || invoiceId}.${customMessage ? '\n\nCustom note:\n' + customMessage : ''}`,
      status:      emailSent ? 'resolved' : 'new',
    });
    communicationId = comm?.id || null;
  } catch (err) {
    console.error('[send-invoice-chase] ClientCommunication.create failed (non-fatal):', err);
  }

  // ClientActivityLog audit
  let activityId: string | null = null;
  try {
    const act = await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      client.id,
      client_name:    String(client.business_name || '').trim(),
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'invoice_chase_sent',
      event_category: 'invoice',
      event_summary:  `Chase email (${stage}) for invoice ${invoice.invoice_number || invoiceId}`,
      event_metadata: {
        invoice_id:      invoiceId,
        invoice_number:  invoice.invoice_number,
        stage,
        days_outstanding: daysOutstanding,
        amount,
      },
      event_label:    `Chase ${stage}`,
      logged_by:      actor.userId,
      logged_by_name: actor.email,
    });
    activityId = act?.id || null;
  } catch (err) {
    console.error('[send-invoice-chase] ClientActivityLog.create failed (non-fatal):', err);
  }

  return Response.json({
    success:          true,
    email_sent:       emailSent,
    communication_id: communicationId,
    activity_id:      activityId,
  });
});
