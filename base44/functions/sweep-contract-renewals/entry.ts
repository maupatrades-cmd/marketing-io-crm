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
  // Email-safe synthwave V3 shell. No position:absolute / flex — Outlook
  // strips both. White logo badge centred via table align="center" + cell
  // valign="middle". Inline SVG decoration renders in modern clients;
  // Outlook falls back to the gradient + bgcolor + white badge cleanly.
  const __MIO_LOGO_URL  = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';
  const __MIO_ACCENT    = 'linear-gradient(90deg,#dc2626 0%,#ec4899 50%,#fbbf24 100%)';
  const __MIO_HEADER_BG = 'linear-gradient(180deg,#1a0533 0%,#0a0a2e 50%,#000010 100%)';
  const __MIO_FOOTER_BG = 'linear-gradient(180deg,#000010 0%,#0a0a2e 50%,#1a0533 100%)';
  const __MIO_YEAR      = new Date().getFullYear();

  const __MIO_HEADER_SVG = '<svg width="600" height="240" viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display:block;width:600px;height:240px;">'
    + '<defs>'
    + '<linearGradient id="__mioH_bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a0533"/><stop offset="50%" stop-color="#0a0a2e"/><stop offset="100%" stop-color="#000010"/></linearGradient>'
    + '<radialGradient id="__mioH_sun" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="55%" stop-color="#ec4899"/><stop offset="100%" stop-color="#7c3aed"/></radialGradient>'
    + '<linearGradient id="__mioH_glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ec4899" stop-opacity="0.5"/><stop offset="100%" stop-color="#ec4899" stop-opacity="0"/></linearGradient>'
    + '<filter id="__mioH_grid" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.6"/></filter>'
    + '<mask id="__mioH_slices"><circle cx="300" cy="156" r="85" fill="white"/><rect x="232" y="170" width="136" height="3" fill="black"/><rect x="245" y="184" width="110" height="4" fill="black"/><rect x="262" y="200" width="76" height="4" fill="black"/><rect x="278" y="216" width="44" height="5" fill="black"/></mask>'
    + '</defs>'
    + '<rect width="600" height="240" fill="url(#__mioH_bg)"/>'
    + '<g fill="#ffffff"><circle cx="50" cy="22" r="1.2" opacity="0.85"/><circle cx="120" cy="48" r="1.0" opacity="0.6"/><circle cx="200" cy="18" r="1.5" opacity="0.9"/><circle cx="290" cy="55" r="1.0" opacity="0.7"/><circle cx="380" cy="28" r="1.2" opacity="0.8"/><circle cx="470" cy="48" r="1.0" opacity="0.65"/><circle cx="540" cy="20" r="1.3" opacity="0.85"/></g>'
    + '<circle cx="300" cy="156" r="85" fill="url(#__mioH_sun)" mask="url(#__mioH_slices)"/>'
    + '<rect x="0" y="156" width="600" height="50" fill="url(#__mioH_glow)"/>'
    + '<line x1="0" y1="156" x2="600" y2="156" stroke="#ec4899" stroke-width="1.5"/>'
    + '<g opacity="0.6"><polygon points="40,156 100,118 160,156" fill="#7c3aed"/><polygon points="120,156 175,108 230,156" fill="#a855f7"/><polygon points="370,156 430,118 490,156" fill="#06b6d4"/><polygon points="450,156 510,108 570,156" fill="#7c3aed"/></g>'
    + '<g filter="url(#__mioH_grid)"><g stroke="#ec4899" stroke-width="0.8" fill="none" opacity="0.85"><line x1="0" y1="170" x2="600" y2="170"/><line x1="0" y1="186" x2="600" y2="186"/><line x1="0" y1="208" x2="600" y2="208"/><line x1="0" y1="234" x2="600" y2="234"/></g>'
    + '<g stroke="#06b6d4" stroke-width="0.7" fill="none" opacity="0.8"><line x1="300" y1="156" x2="0" y2="240"/><line x1="300" y1="156" x2="100" y2="240"/><line x1="300" y1="156" x2="200" y2="240"/><line x1="300" y1="156" x2="300" y2="240"/><line x1="300" y1="156" x2="400" y2="240"/><line x1="300" y1="156" x2="500" y2="240"/><line x1="300" y1="156" x2="600" y2="240"/></g></g>'
    + '</svg>';

  const __MIO_WAVES_SVG = '<svg width="552" height="100" viewBox="0 0 552 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block;width:100%;max-width:552px;height:auto;">'
    + '<defs><linearGradient id="__mioF_w" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#7c3aed"/><stop offset="20%" stop-color="#ec4899"/><stop offset="40%" stop-color="#f59e0b"/><stop offset="60%" stop-color="#10b981"/><stop offset="80%" stop-color="#06b6d4"/><stop offset="100%" stop-color="#8b5cf6"/></linearGradient></defs>'
    + '<g stroke="url(#__mioF_w)" fill="none" stroke-width="1">'
    + '<path d="M0 22 Q 69 8 138 22 T 276 22 T 414 22 T 552 22" opacity="0.55"/>'
    + '<path d="M0 32 Q 69 18 138 32 T 276 32 T 414 32 T 552 32" opacity="0.7"/>'
    + '<path d="M0 42 Q 69 28 138 42 T 276 42 T 414 42 T 552 42" opacity="0.85"/>'
    + '<path d="M0 50 Q 69 36 138 50 T 276 50 T 414 50 T 552 50" opacity="0.9"/>'
    + '<path d="M0 58 Q 69 44 138 58 T 276 58 T 414 58 T 552 58" opacity="0.85"/>'
    + '<path d="M0 68 Q 69 54 138 68 T 276 68 T 414 68 T 552 68" opacity="0.7"/>'
    + '<path d="M0 78 Q 69 64 138 78 T 276 78 T 414 78 T 552 78" opacity="0.6"/>'
    + '<path d="M0 88 Q 69 74 138 88 T 276 88 T 414 88 T 552 88" opacity="0.5"/>'
    + '</g></svg>';

  const __MIO_LI_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43A2.06 2.06 0 1 1 5.34 3.3a2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z"/></svg>';
  const __MIO_IG_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="17" cy="7" r="1.2" fill="#ffffff" fill-opacity="0.85"/></svg>';
  const __MIO_FB_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M24 12.07C24 5.45 18.63.07 12 .07S0 5.45 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.39H7.08v-3.47h3.05V9.43c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95H15.83c-1.5 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.02 24 18.07 24 12.07z"/></svg>';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title><!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]--></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse;background-color:#ffffff;">

<!-- HEADER -->
<tr><td style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;background-color:#0a0a2e;">
<tr><td width="600" height="240" align="center" valign="middle" bgcolor="#0a0a2e" style="width:600px;height:240px;background-color:#0a0a2e;background-image:${__MIO_HEADER_BG};padding:0;text-align:center;vertical-align:middle;">
<!--[if !mso]><!--><div style="font-size:0;line-height:0;height:0;overflow:visible;">${__MIO_HEADER_SVG}</div><!--<![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;"><tr>
<td width="420" height="130" align="center" valign="middle" bgcolor="#ffffff" style="width:420px;height:130px;background-color:#ffffff;border-radius:20px;padding:15px 30px;text-align:center;vertical-align:middle;box-shadow:0 0 40px rgba(255,255,255,0.4),0 0 80px rgba(236,72,153,0.3);">
<img src="${__MIO_LOGO_URL}" width="360" height="100" alt="Marketing iO" style="display:block;width:360px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
</td></tr></table>
</td></tr>
<tr><td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${__MIO_ACCENT};">&nbsp;</td></tr>
</table>
</td></tr>

<!-- BODY -->
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${body}
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
<tr><td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${__MIO_ACCENT};">&nbsp;</td></tr>
<tr><td width="600" align="center" valign="top" bgcolor="#0a0a2e" style="width:600px;background-color:#0a0a2e;background-image:${__MIO_FOOTER_BG};padding:32px 24px;text-align:center;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<!--[if !mso]><!--><table role="presentation" width="552" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;"><tr><td align="center" style="font-size:0;line-height:0;">${__MIO_WAVES_SVG}</td></tr></table><!--<![endif]-->

<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;border-collapse:collapse;"><tr>
<td width="280" height="90" align="center" valign="middle" bgcolor="#ffffff" style="width:280px;height:90px;background-color:#ffffff;border-radius:16px;padding:10px 20px;text-align:center;vertical-align:middle;box-shadow:0 0 30px rgba(255,255,255,0.4),0 0 60px rgba(236,72,153,0.3);">
<img src="${__MIO_LOGO_URL}" width="240" height="70" alt="Marketing iO" style="display:block;width:240px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
</td></tr></table>

<p style="margin:0 0 18px;color:#ffffff;font-size:14px;font-style:italic;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;line-height:1.4;">Too good to stay hidden.</p>

<p style="margin:0 0 6px;color:#ffffff;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
<a href="mailto:hello@marketingio.africa" style="color:#ffffff;text-decoration:none;">hello@marketingio.africa</a>&nbsp;&bull;&nbsp;<a href="tel:0101020534" style="color:#ffffff;text-decoration:none;">010 102 0534</a>&nbsp;&bull;&nbsp;<a href="https://marketingio.africa" style="color:#ffffff;text-decoration:none;">marketingio.africa</a>
</p>
<p style="margin:0 0 22px;color:#ffffff;font-size:11px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">75 Marshall Street, Polokwane, 0699, South Africa</p>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px;border-collapse:collapse;"><tr>
<td style="padding:0 8px;"><a href="https://linkedin.com/company/marketingio" aria-label="Marketing iO on LinkedIn" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_LI_SVG}</a></td>
<td style="padding:0 8px;"><a href="https://instagram.com/marketingio" aria-label="Marketing iO on Instagram" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_IG_SVG}</a></td>
<td style="padding:0 8px;"><a href="https://facebook.com/marketingio" aria-label="Marketing iO on Facebook" style="text-decoration:none;display:inline-block;line-height:0;">${__MIO_FB_SVG}</a></td>
</tr></table>

<p style="margin:0 0 6px;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.6;">© ${__MIO_YEAR} Marketing iO. All rights reserved.</p>
<p style="margin:0;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">
<a href="https://app.marketingio.africa/unsubscribe" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a>&nbsp;&bull;&nbsp;<a href="https://marketingio.africa/privacy" style="color:#ffffff;text-decoration:underline;">Privacy Policy</a>&nbsp;&bull;&nbsp;<a href="https://app.marketingio.africa/preferences" style="color:#ffffff;text-decoration:underline;">Manage Preferences</a>
</p>
</td></tr>
</table>
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