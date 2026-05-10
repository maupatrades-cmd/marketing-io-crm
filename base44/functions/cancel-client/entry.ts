/**
 * cancel-client
 * Cancels a client: flips status, cancels unpaid invoices, logs activity,
 * notifies all admins.
 *
 * Input: { token, client_id, reason }
 * Auth: owner or admin only
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { client_id, reason } = body;

    if (!client_id) {
      return Response.json({ error: "client_id is required" }, { status: 400 });
    }

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!["owner", "admin"].includes(user.role)) {
      return Response.json({ error: "Forbidden: owner or admin only" }, { status: 403 });
    }

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;
    if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

    // Idempotency
    if (["cancelled", "churned"].includes(client.status)) {
      return Response.json({ skipped: true, current_status: client.status });
    }

    // Update client
    await base44.asServiceRole.entities.Client.update(client_id, {
      status: "cancelled",
      deactivated_at: new Date().toISOString(),
      cancellation_reason: reason || "",
    });

    // Cancel unpaid invoices
    const allInvoices = await base44.asServiceRole.entities.Invoice.filter({ client_id });
    const invoiceList = Array.isArray(allInvoices) ? allInvoices : [];
    const cancelledInvoices = [];

    for (const inv of invoiceList) {
      if (inv.status === "sent") {
        try {
          await base44.asServiceRole.entities.Invoice.update(inv.id, {
            status: "cancelled",
            notes: `${inv.notes ? inv.notes + " | " : ""}Cancelled: Client cancelled`,
          });
          cancelledInvoices.push(inv.id);
        } catch (err) {
          console.error(`[cancel-client] Invoice cancel failed for ${inv.id}:`, err);
        }
      }
    }

    // Log activity
    try {
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id,
        event_type: "client_cancelled",
        event_category: "account",
        event_label: `Client cancelled`,
        event_summary: `${client.business_name} cancelled. Reason: ${reason || "Not specified"}. ${cancelledInvoices.length} invoice(s) also cancelled.`,
        metadata: { reason, cancelled_invoices: cancelledInvoices, cancelled_by: user.id },
      });
    } catch (logErr) {
      console.error("[cancel-client] ActivityLog failed:", logErr);
    }

    // Notify all admins
    try {
     const admins = await base44.asServiceRole.entities.AppUser.filter({ role: "admin" });
     const adminList = Array.isArray(admins) ? admins : [];
     for (const admin of adminList) {
       await base44.asServiceRole.entities.ClientNotification.create({
         recipient_user_id: admin.id,
         client_id,
         notification_type: "client_cancelled",
         title: `Client cancelled: ${client.business_name}`,
         body: `${client.business_name} has been cancelled. Reason: ${reason || "Not specified"}. ${cancelledInvoices.length} invoice(s) cancelled.`,
         related_entity_type: "Client",
         related_entity_id: client_id,
         action_url: `/clients/${client_id}`,
         is_read: false,
       });
     }
    } catch (notifErr) {
     console.error("[cancel-client] Admin notify failed:", notifErr);
    }

    // Send email to CLIENT
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey && client.email) {
     const resend = new Resend(apiKey);
     try {
       await resend.emails.send({
         from: 'Marketing iO Team <hello@marketingio.co.za>',
         to: client.email,
         subject: `Your account with Marketing iO has been cancelled`,
         html: `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Account Cancelled</title>
    </head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;">
    <tr><td align="center">
    <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
     <tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
       <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto;" />
     </td></tr>
     <tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
     <tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">
       <h1 style="margin:0 0 16px 0;font-size:24px;color:#0f172a;">Account Cancelled</h1>
       <p style="margin:0 0 16px 0;color:#475569;">Hi ${String(client.contact_person || client.business_name).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))},</p>
       <p style="margin:0 0 16px 0;color:#475569;">
         We're writing to confirm that your Marketing iO account has been cancelled. Your service will no longer be active, and no further invoices will be issued.
       </p>
       <div style="background:#f8fafc;border-left:4px solid #a764e6;padding:16px;margin:24px 0;border-radius:4px;">
         <p style="margin:0;color:#475569;"><strong>Account:</strong> ${String(client.business_name).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}</p>
         ${reason ? `<p style="margin:8px 0 0 0;color:#475569;"><strong>Reason:</strong> ${String(reason).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}</p>` : ''}
       </div>
       <p style="margin:0 0 24px 0;color:#475569;">
         If you have questions or would like to discuss this cancellation, please don't hesitate to reach out to our team.
       </p>
       <p style="margin:0 0 24px 0;color:#475569;">
         <strong>Contact us:</strong><br>
         📧 <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a><br>
         ☎ <a href="tel:0101020534" style="color:#a764e6;text-decoration:none;">010 102 0534</a>
       </p>
       <p style="margin:0;color:#64748b;font-style:italic;">Thank you for being part of the Marketing iO journey.</p>
     </td></tr>
     <tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
     <tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
       <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png" alt="Marketing iO" width="140" style="width:140px;height:auto;display:block;margin:0 auto 12px auto;" />
       <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Marketing iO (Pty) Ltd &middot; CIPC 2026303502</div>
       <div style="font-size:12px;color:#94a3b8;line-height:1.8;">75 Marshall Street, Polokwane 0699<br>☎ 010 102 0534 &bull; <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
     </td></tr>
    </table>
    </td></tr>
    </table>
    </body>
    </html>`,
       });
       console.log('[cancel-client] Email sent to client:', client.email);
     } catch (emailErr) {
       console.error("[cancel-client] Email to client failed (non-fatal):", emailErr);
     }
    }

    return Response.json({
     success: true,
     client_id,
     status: "cancelled",
     cancelled_invoices: cancelledInvoices,
    });
  } catch (err) {
    console.error("[cancel-client] Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});