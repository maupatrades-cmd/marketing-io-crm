import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// LB-024: Daily cron that processes Clients past their 14-day cooling-off
// window. Schedule via Base44 Automation at 03:00 SAST (01:00 UTC), mirroring
// sweep-client-churn.
//
// Policy (SARS + POPIA compliant):
//   1. Financial records (Invoice, Payment, Commission, Contract) — ANONYMISE
//      PII fields in place (replace client_name / email / phone / address etc.
//      with "[deleted]"). Keep all amounts, dates, transaction IDs, line items
//      intact. Keep client_id reference; the Client row becomes a tombstone.
//   2. ContractSignature — keep the signed PDF / document URL (legal evidence)
//      but scrub signer_name + signer_id_number.
//   3. Personal-data entities (ClientCommunication, ClientUpload,
//      ClientOnboardingSubmission, ClientNotification, OTPCode) — hard delete.
//      ClientActivityLog rows for this client are deleted except for one
//      tombstone row written by this function as the audit trail.
//   4. AppUser — hard delete.
//   5. Client row — anonymise (PII → "[deleted]") and set anonymised_at.
//      Row is retained so financial entities retain valid client_id reference.
//   6. Email 3 sent to the snapshot email BEFORE AppUser is deleted.
//
// Body: { dry_run?: boolean, cron_secret?: string }
// Auth: if Deno.env.CRON_SECRET is set, callers must match it. Otherwise the
// function runs unauthenticated (Base44 Automation triggers it on schedule).

const FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Marketing iO Team <hello@marketingio.co.za>';
const DELETED_STR = '[deleted]';
const DELETED_CLIENT_STR = '[deleted client]';

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title></head>
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

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

async function anonymiseFinancial(base44: any, entityName: string, clientId: string, dryRun: boolean): Promise<number> {
  let rows: any[] = [];
  try {
    rows = unwrapList(await base44.asServiceRole.entities[entityName].filter({ client_id: clientId }));
  } catch (err) {
    console.error(`[process-pending-deletions] ${entityName}.filter failed:`, err);
    return 0;
  }
  if (dryRun) return rows.length;

  let count = 0;
  for (const row of rows) {
    const patch: Record<string, unknown> = {};
    // Common PII fields that may exist on these entities — patch defensively.
    if ('client_name' in row) patch.client_name = DELETED_CLIENT_STR;
    if ('client_email' in row) patch.client_email = DELETED_STR;
    if ('client_phone' in row) patch.client_phone = DELETED_STR;
    if ('contact_person' in row) patch.contact_person = DELETED_STR;
    if ('contact_email' in row) patch.contact_email = DELETED_STR;
    if ('contact_phone' in row) patch.contact_phone = DELETED_STR;
    if ('billing_email' in row) patch.billing_email = DELETED_STR;
    if ('email' in row) patch.email = DELETED_STR;
    if ('phone' in row) patch.phone = DELETED_STR;
    if ('address' in row) patch.address = DELETED_STR;
    if (Object.keys(patch).length === 0) { count++; continue; }
    try {
      await base44.asServiceRole.entities[entityName].update(row.id, patch);
      count++;
    } catch (err) {
      console.error(`[process-pending-deletions] ${entityName}.update ${row.id} failed:`, err);
    }
  }
  return count;
}

async function hardDeleteAll(base44: any, entityName: string, filter: any, dryRun: boolean): Promise<number> {
  let rows: any[] = [];
  try {
    rows = unwrapList(await base44.asServiceRole.entities[entityName].filter(filter));
  } catch (err) {
    console.error(`[process-pending-deletions] ${entityName}.filter failed:`, err);
    return 0;
  }
  if (dryRun) return rows.length;

  let count = 0;
  for (const row of rows) {
    try {
      await base44.asServiceRole.entities[entityName].delete(row.id);
      count++;
    } catch (err) {
      console.error(`[process-pending-deletions] ${entityName}.delete ${row.id} failed:`, err);
    }
  }
  return count;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const providedSecret = String(body?.cron_secret || '');

  // Optional auth: if CRON_SECRET is configured, require it. This lets you
  // run the function manually for testing as owner, and also lets Base44
  // Automation include the secret in its body when wiring the schedule.
  const expectedSecret = Deno.env.get('CRON_SECRET') || '';
  if (expectedSecret && providedSecret !== expectedSecret) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();

  // Find Clients past their 14-day cooling-off window.
  let candidates: any[] = [];
  try {
    candidates = unwrapList(await base44.asServiceRole.entities.Client.filter({ deletion_pending: true }));
  } catch (err) {
    console.error('[process-pending-deletions] Client.filter failed:', err);
    return Response.json({ error: 'client_filter_failed', detail: String(err) }, { status: 500 });
  }

  const due = candidates.filter(c => {
    if (!c.deletion_scheduled_at) return false;
    if (c.anonymised_at) return false; // already processed
    return c.deletion_scheduled_at <= nowIso;
  });

  const results: any[] = [];

  for (const client of due) {
    const summary: any = {
      client_id: client.id,
      original_business_name: client.business_name || null,
      deletion_scheduled_at: client.deletion_scheduled_at,
      anonymised: {},
      deleted: {},
      errors: [],
    };

    // Snapshot email + name BEFORE we delete anything (needed for Email 3).
    let snapshotEmail: string | null = String(client.email || '').trim() || null;
    let snapshotName: string = String(client.contact_person || client.business_name || 'there');
    let snapshotAppUserId: string | null = null;

    try {
      const list = unwrapList(await base44.asServiceRole.entities.AppUser.filter({ id: client.client_user_id }));
      const appUser = list[0];
      if (appUser) {
        snapshotAppUserId = appUser.id;
        if (!snapshotEmail) snapshotEmail = appUser.email;
        if (!snapshotName || snapshotName === 'there') snapshotName = String(appUser.full_name || snapshotName);
      }
    } catch (err) {
      console.error('[process-pending-deletions] AppUser snapshot failed:', err);
    }

    // 1. Anonymise financial records.
    for (const ent of ['Invoice', 'Payment', 'Commission', 'Contract']) {
      try {
        summary.anonymised[ent] = await anonymiseFinancial(base44, ent, client.id, dryRun);
      } catch (err: any) {
        summary.errors.push({ step: `anonymise ${ent}`, detail: String(err?.message || err) });
      }
    }

    // 2. ContractSignature — scrub PII but keep document_url / pdf.
    if (!dryRun) {
      try {
        const contracts = unwrapList(await base44.asServiceRole.entities.Contract.filter({ client_id: client.id }));
        let sigCount = 0;
        for (const c of contracts) {
          let sigs: any[] = [];
          try {
            sigs = unwrapList(await base44.asServiceRole.entities.ContractSignature.filter({ contract_id: c.id }));
          } catch (_) { /* entity may not exist or no rows */ }
          for (const sig of sigs) {
            const patch: Record<string, unknown> = {};
            if ('signer_name' in sig) patch.signer_name = DELETED_STR;
            if ('signer_id_number' in sig) patch.signer_id_number = DELETED_STR;
            if ('signer_email' in sig) patch.signer_email = DELETED_STR;
            if (Object.keys(patch).length === 0) continue;
            try {
              await base44.asServiceRole.entities.ContractSignature.update(sig.id, patch);
              sigCount++;
            } catch (err) {
              console.error('[process-pending-deletions] ContractSignature.update failed:', err);
            }
          }
        }
        summary.anonymised.ContractSignature = sigCount;
      } catch (err: any) {
        summary.errors.push({ step: 'anonymise ContractSignature', detail: String(err?.message || err) });
      }
    }

    // 3. Hard-delete personal-data entities. ClientActivityLog handled
    //    separately at the end (we want one tombstone to survive as audit).
    for (const ent of ['ClientCommunication', 'ClientUpload', 'ClientOnboardingSubmission', 'ClientNotification']) {
      try {
        summary.deleted[ent] = await hardDeleteAll(base44, ent, { client_id: client.id }, dryRun);
      } catch (err: any) {
        summary.errors.push({ step: `delete ${ent}`, detail: String(err?.message || err) });
      }
    }

    // 4. OTPCode by email (no client_id link).
    if (snapshotEmail) {
      try {
        summary.deleted.OTPCode = await hardDeleteAll(base44, 'OTPCode', { email: snapshotEmail.toLowerCase().trim() }, dryRun);
      } catch (err: any) {
        summary.errors.push({ step: 'delete OTPCode', detail: String(err?.message || err) });
      }
    }

    // 5. Delete all ClientActivityLog rows for this client EXCEPT we'll write
    //    a tombstone at the end.
    try {
      summary.deleted.ClientActivityLog = await hardDeleteAll(base44, 'ClientActivityLog', { client_id: client.id }, dryRun);
    } catch (err: any) {
      summary.errors.push({ step: 'delete ClientActivityLog', detail: String(err?.message || err) });
    }

    // 6. Send Email 3 BEFORE we touch AppUser / Client. Last email this
    //    address will receive from us.
    if (!dryRun && snapshotEmail) {
      try {
        const apiKey = Deno.env.get('RESEND_API_KEY');
        if (apiKey) {
          const resend = new Resend(apiKey);
          const dateHuman = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });
          const html = wrapEmail(`
            <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Your Marketing iO account has been deleted</h1>
            <p style="margin:0 0 16px 0;">Hi ${escapeHtml(snapshotName)},</p>
            <p style="margin:0 0 16px 0;">As requested, your Marketing iO account and all associated data have been permanently deleted on <strong>${escapeHtml(dateHuman)}</strong>.</p>
            <p style="margin:0 0 16px 0;">We're sorry to see you go. If you'd like to use Marketing iO again in the future, you're welcome to sign up again at <a href="https://marketingio.co.za" style="color:#a764e6;">marketingio.co.za</a>.</p>
            <p style="margin:24px 0 4px 0;">Thank you for being part of Marketing iO.</p>
            <p style="margin:0 0 4px 0;">— The Marketing iO Team</p>
            <p style="margin:24px 0 0 0;color:#94a3b8;font-size:12px;">Marketing iO (Pty) Ltd · marketingio.co.za · info@marketingio.co.za</p>
          `);
          await resend.emails.send({
            from: FROM,
            to: snapshotEmail,
            subject: 'Your Marketing iO account has been deleted',
            html,
          });
          summary.email_3_sent = true;
        }
      } catch (err) {
        console.error('[process-pending-deletions] Email 3 send failed (non-fatal):', err);
        summary.email_3_sent = false;
      }
    }

    // 7. Hard-delete AppUser.
    if (snapshotAppUserId && !dryRun) {
      try {
        await base44.asServiceRole.entities.AppUser.delete(snapshotAppUserId);
        summary.deleted.AppUser = 1;
      } catch (err: any) {
        summary.errors.push({ step: 'delete AppUser', detail: String(err?.message || err) });
      }
      // Mirror built-in User delete if present (LB-281 dual-write counterpart).
      if (snapshotEmail) {
        try {
          const userList = unwrapList(await base44.asServiceRole.entities.User.filter({ email: snapshotEmail.toLowerCase().trim() }));
          for (const u of userList) {
            try {
              await base44.asServiceRole.entities.User.delete(u.id);
              summary.deleted.User = (summary.deleted.User || 0) + 1;
            } catch (_) { /* non-fatal */ }
          }
        } catch (_) { /* non-fatal */ }
      }
    }

    // 8. Anonymise the Client row itself (tombstone). Keep row so financial
    //    records retain valid client_id references.
    if (!dryRun) {
      try {
        await base44.asServiceRole.entities.Client.update(client.id, {
          business_name: DELETED_CLIENT_STR,
          contact_person: DELETED_STR,
          email: DELETED_STR,
          phone: DELETED_STR,
          address: DELETED_STR,
          id_reg_number: DELETED_STR,
          notes: DELETED_STR,
          notification_preferences: '',
          cancellation_reason: DELETED_STR,
          status: 'cancelled',
          deletion_pending: false,
          deletion_scheduled_at: null,
          deletion_cancel_token: null,
          anonymised_at: nowIso,
        });
        summary.anonymised.Client = 1;
      } catch (err: any) {
        summary.errors.push({ step: 'anonymise Client', detail: String(err?.message || err) });
      }
    }

    // 9. Write the tombstone audit log entry. Last surviving ClientActivityLog
    //    row for this client.
    if (!dryRun) {
      try {
        await base44.asServiceRole.entities.ClientActivityLog.create({
          client_id: client.id,
          client_name: DELETED_CLIENT_STR,
          actor_id: 'system',
          actor_role: 'system',
          event_type: 'account_permanently_deleted',
          event_category: 'account',
          event_label: 'Account permanently deleted',
          event_summary: `POPIA: Account anonymised and personal data removed after 14-day cooling-off period. Financial records retained per SARS 5-year requirement.`,
          event_metadata: {
            original_business_name: summary.original_business_name,
            deletion_scheduled_at: client.deletion_scheduled_at,
            processed_at: nowIso,
            anonymised: summary.anonymised,
            deleted: summary.deleted,
            errors: summary.errors,
          },
          logged_by: 'system',
          logged_by_name: 'process-pending-deletions cron',
        });
        summary.tombstone_written = true;
      } catch (err) {
        console.error('[process-pending-deletions] tombstone write failed:', err);
        summary.tombstone_written = false;
      }
    }

    results.push(summary);
  }

  return Response.json({
    success: true,
    dry_run: dryRun,
    processed_at: nowIso,
    candidates_found: candidates.length,
    due_for_processing: due.length,
    results,
  });
});
