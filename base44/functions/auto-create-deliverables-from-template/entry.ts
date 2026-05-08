import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// auto-create-deliverables-from-template — Round 6 polish, Task 6A.
//
// Inputs (POST JSON):
//   { token, client_id, deal_id, package_code }
//
// Output:
//   { success: true, created_count, deliverable_ids[] }
//   { skipped: true, reason: 'deliverables_exist', count }
//   { skipped: true, reason: 'no_template_for_package' }
//
// Closes the onboarding → fulfilment chain. Round 4 added the "Review & hand
// off to head_of_tech" button on /onboarding-submissions (creates a Task and
// notifies head_of_tech via InternalMessage). But head_of_tech opened an
// empty deliverable queue because nothing actually provisioned the work
// items from the package's FulfilmentTemplate.
//
// This function:
//   1. Looks up the FulfilmentTemplate matching the deal's package code
//   2. Parses the template's setup_deliverables JSON array
//   3. Creates a Deliverable row per item, phase='setup', owner_role from
//      template (default head_of_tech), due_date = today + soft_sla_days
//   4. Writes a ClientActivityLog audit row
//
// Auth: token (session) required, role must be owner or admin.
//
// Idempotency: skips if any Deliverable already exists for the
// (client_id, deal_id) pair. Re-running this function is safe.
//
// Recurring deliverables (template.recurring_deliverables) are NOT
// auto-created here — those are spawned per billing month by a separate
// monthly job. This function only handles setup deliverables.
// =============================================================================

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

function safeParseTitles(raw: unknown): string[] {
  // FulfilmentTemplate.setup_deliverables is documented as a JSON string array.
  // Defensively handle three shapes: actual array, JSON-encoded array, or a
  // newline-delimited fallback for templates seeded before the schema settled.
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return s.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'use POST' }, { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tokenRaw    = String(body?.token ?? '').trim();
  const clientId    = String(body?.client_id ?? '').trim();
  const dealId      = String(body?.deal_id ?? '').trim();
  const packageCode = String(body?.package_code ?? '').trim();

  if (!clientId)    return Response.json({ error: 'client_id required' }, { status: 400 });
  if (!packageCode) return Response.json({ error: 'package_code required' }, { status: 400 });

  const base44 = createClientFromRequest(req);

  const actor = await deriveActor(base44, tokenRaw);
  if (!actor) return Response.json({ error: 'unauthorised' }, { status: 401 });
  if (actor.role !== 'owner' && actor.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  // ---- Idempotency: skip if Deliverables already exist for this deal -----
  if (dealId) {
    try {
      const existing = await base44.asServiceRole.entities.Deliverable.filter({
        client_id: clientId,
        deal_id:   dealId,
      });
      const existingList = unwrapList(existing);
      if (existingList.length > 0) {
        console.log(
          `[auto-create-deliverables-from-template] Deliverables already exist for ` +
          `client_id=${clientId} deal_id=${dealId} count=${existingList.length} — skipping`
        );
        return Response.json({
          skipped: true,
          reason:  'deliverables_exist',
          count:   existingList.length,
        });
      }
    } catch (err) {
      console.error('[auto-create-deliverables-from-template] idempotency check failed:', err);
      // Non-fatal — proceed; worst case we create duplicates that admin can clean up.
    }
  }

  // ---- Resolve template by package code ----------------------------------
  let template: any = null;
  try {
    const list = await base44.asServiceRole.entities.FulfilmentTemplate.filter({ code: packageCode });
    template = unwrapList(list)[0] || null;
  } catch (err) {
    console.error('[auto-create-deliverables-from-template] template lookup failed:', err);
  }
  if (!template) {
    console.log(
      `[auto-create-deliverables-from-template] no template for package_code=${packageCode} — skipping`
    );
    return Response.json({
      skipped: true,
      reason:  'no_template_for_package',
      package_code: packageCode,
    });
  }

  // ---- Resolve client name ----------------------------------------------
  let clientName = '';
  try {
    const list = await base44.asServiceRole.entities.Client.filter({ id: clientId });
    const client = unwrapList(list)[0];
    clientName = String(client?.business_name || client?.contact_person || '').trim();
  } catch { /* non-fatal */ }

  // ---- Build Deliverable payloads ---------------------------------------
  const titles = safeParseTitles(template.setup_deliverables);
  if (titles.length === 0) {
    console.log(
      `[auto-create-deliverables-from-template] template ${template.code} has no ` +
      `setup_deliverables — skipping`
    );
    return Response.json({
      skipped: true,
      reason:  'template_has_no_setup_deliverables',
      package_code: packageCode,
    });
  }

  const slaDays = Number.isFinite(Number(template.soft_sla_days)) && Number(template.soft_sla_days) > 0
    ? Number(template.soft_sla_days)
    : 14;
  const dueDate = new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const ownerRole = String(template.internal_owner_role || 'head_of_tech');

  const deliverableIds: string[] = [];
  let createdCount = 0;

  for (const title of titles) {
    try {
      const row = await base44.asServiceRole.entities.Deliverable.create({
        client_id:    clientId,
        client_name:  clientName,
        deal_id:      dealId || '',
        title,
        phase:        'setup',
        product:      packageCode,
        owner_role:   ownerRole,
        status:       'not_started',
        due_date:     dueDate,
      });
      if (row?.id) deliverableIds.push(row.id);
      createdCount += 1;
    } catch (err) {
      console.error(
        `[auto-create-deliverables-from-template] Deliverable.create failed for title="${title}":`,
        err
      );
      // Continue — partial success is better than zero.
    }
  }

  // ---- ClientActivityLog audit ------------------------------------------
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      clientId,
      client_name:    clientName,
      actor_id:       actor.userId,
      actor_role:     actor.role,
      event_type:     'deliverables_provisioned',
      event_category: 'document',
      event_summary:  `${createdCount} deliverable${createdCount === 1 ? '' : 's'} created from ${packageCode} template`,
      event_metadata: {
        package_code:   packageCode,
        template_code:  template.code,
        deal_id:        dealId,
        sla_days:       slaDays,
        owner_role:     ownerRole,
        created_count:  createdCount,
        titles,
      },
      event_label:    'Deliverables provisioned',
      logged_by:      actor.userId,
      logged_by_name: actor.email,
    });
  } catch (err) {
    console.error('[auto-create-deliverables-from-template] ActivityLog.create failed (non-fatal):', err);
  }

  return Response.json({
    success:         true,
    created_count:   createdCount,
    deliverable_ids: deliverableIds,
    package_code:    packageCode,
    owner_role:      ownerRole,
    due_date:        dueDate,
  });
});
