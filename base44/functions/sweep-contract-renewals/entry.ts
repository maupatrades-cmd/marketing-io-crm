/**
 * sweep-contract-renewals
 * Sends renewal reminder emails for contracts with auto_renews=true that are
 * exactly 30, 7, or 0 days from contract_end_date.
 * Idempotent: skips if last_renewal_reminder_at is from today (SAST).
 *
 * Input: { dry_run?: boolean }
 * Schedule: daily 09:00 SAST (07:00 UTC)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "accounts@marketingio.co.za";
const REMINDER_STAGES = [30, 7, 0];

function toSASTDateString(date = new Date()) {
  const sast = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  return sast.toISOString().slice(0, 10);
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
}

function wrapEmail(body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396498/marketing_io_email_header_zmlvtg.jpg" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${body}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778396673/marketing_io_email_footer_b9dkwm.jpg" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendRenewalEmail({ contract, client, stage }) {
  const endDate = new Date(contract.contract_end_date).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
  const stageLabel = stage === 0 ? "today" : `in ${stage} days`;

  const htmlBody = wrapEmail(`
    <p>Dear ${client.contact_person || client.business_name},</p>
    <p>This is a reminder that your <strong>${contract.package?.replace(/_/g, " ")}</strong> contract with Marketing iO is set to renew <strong>${stageLabel}</strong> on <strong>${endDate}</strong>.</p>
    <p><strong>What happens next:</strong> Your contract will automatically renew for the same term and monthly retainer (R${(contract.monthly_retainer || 0).toLocaleString()}/month).</p>
    <p>If you have any questions or wish to discuss your contract options, please contact us before the renewal date:</p>
    <p><a href="mailto:accounts@marketingio.co.za">accounts@marketingio.co.za</a></p>
    <p>Thank you for being a valued Marketing iO client.</p>
    <p>Warm regards,<br>The Marketing iO Team</p>
  `);

  const subjectMap = {
    30: `Your Marketing iO contract renews in 30 days`,
    7:  `Reminder: Your contract renews in 7 days`,
    0:  `Your Marketing iO contract renews today`,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Marketing iO Accounts <${FROM_EMAIL}>`,
      to: [client.email],
      subject: subjectMap[stage] || `Your contract renews ${stageLabel}`,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend failed: ${err}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const todayStr = toSASTDateString();

    // Fetch all active/signed contracts that auto_renew
    const allContracts = await base44.asServiceRole.entities.Contract.filter({ auto_renews: true });
    const contracts = Array.isArray(allContracts) ? allContracts : [];

    const candidates = [];

    for (const contract of contracts) {
      if (!["signed", "active"].includes(contract.status)) continue;
      if (!contract.contract_end_date) continue;

      const daysUntilEnd = daysBetween(todayStr, contract.contract_end_date);
      const matchedStage = REMINDER_STAGES.find(s => s === daysUntilEnd);
      if (matchedStage === undefined) continue;

      // Idempotency: skip if already reminded today
      if (contract.last_renewal_reminder_at) {
        const lastReminderDay = toSASTDateString(new Date(contract.last_renewal_reminder_at));
        if (lastReminderDay === todayStr) {
          candidates.push({ contract_id: contract.id, client_name: contract.client_name, stage: matchedStage, skipped: true, reason: "already_reminded_today" });
          continue;
        }
      }

      candidates.push({ contract, stage: matchedStage, skipped: false });
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        today: todayStr,
        candidates: candidates.map(c => ({
          contract_id: c.contract?.id || c.contract_id,
          client_name: c.contract?.client_name || c.client_name,
          stage: c.stage,
          skipped: c.skipped,
          reason: c.reason,
        })),
      });
    }

    const sent = [];
    const skipped = [];

    for (const candidate of candidates) {
      if (candidate.skipped) {
        skipped.push(candidate);
        continue;
      }

      const { contract, stage } = candidate;

      // Fetch client record
      let client = null;
      try {
        const clients = await base44.asServiceRole.entities.Client.filter({ id: contract.client_id });
        client = Array.isArray(clients) ? clients[0] : clients;
      } catch (err) {
        console.error(`[sweep-contract-renewals] Client fetch failed for ${contract.client_id}:`, err);
      }

      if (!client?.email) {
        skipped.push({ contract_id: contract.id, reason: "no_client_email" });
        continue;
      }

      try {
        await sendRenewalEmail({ contract, client, stage });

        // Update contract
        await base44.asServiceRole.entities.Contract.update(contract.id, {
          last_renewal_reminder_at: new Date().toISOString(),
        });

        // Log activity
        await base44.asServiceRole.entities.ClientActivityLog.create({
          client_id: contract.client_id,
          event_type: "renewal_reminder_sent",
          event_category: "communication",
          event_label: `Renewal reminder sent (${stage}-day notice)`,
          event_summary: `Contract renewal reminder emailed for end date ${contract.contract_end_date}`,
          metadata: { contract_id: contract.id, stage, contract_end_date: contract.contract_end_date },
        });

        sent.push({ contract_id: contract.id, client_name: client.business_name, stage });
      } catch (err) {
        console.error(`[sweep-contract-renewals] Send failed for contract ${contract.id}:`, err);
        skipped.push({ contract_id: contract.id, reason: err.message });
      }
    }

    return Response.json({ sent_count: sent.length, skipped_count: skipped.length, sent, skipped });
  } catch (err) {
    console.error("[sweep-contract-renewals] Fatal error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});