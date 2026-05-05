import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Universal helper for writing portal-feed entries. Callers should fire-and-forget
// — never block the parent flow if this returns 500.
//
// Body: { client_id, user_id?, client_name?, title, body?, icon?, category?, source?, link? }
// All fields except client_id + title are optional. Sensible defaults applied.

const DEFAULT_CATEGORY = 'info';
const DEFAULT_SOURCE = 'system';
const DEFAULT_ICON = 'Bell';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try {
    body = await req.json();
  } catch {
    console.error('[log-client-activity] invalid_json');
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    client_id,
    user_id,
    client_name,
    title,
    body: detailBody,
    icon,
    category,
    source,
    link
  } = body || {};

  if (!client_id) {
    console.error('[log-client-activity] missing client_id');
    return Response.json({ error: 'client_id required' }, { status: 400 });
  }
  if (!title) {
    console.error('[log-client-activity] missing title');
    return Response.json({ error: 'title required' }, { status: 400 });
  }

  try {
    const row = await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id,
      client_name: client_name || '',
      user_id: user_id || '',
      title,
      body: detailBody || '',
      icon: icon || DEFAULT_ICON,
      category: category || DEFAULT_CATEGORY,
      source: source || DEFAULT_SOURCE,
      link: link || '',
      // Legacy mirror so existing CRM views that read event_label still work.
      event_type: 'note',
      event_label: title
    });
    return Response.json({ success: true, activity_id: row?.id });
  } catch (err: any) {
    console.error('[log-client-activity] create failed:', err?.message);
    return Response.json({ error: 'create_failed', detail: err?.message }, { status: 500 });
  }
});
