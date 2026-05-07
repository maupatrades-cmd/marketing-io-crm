import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

// =============================================================================
// generate-activity-pdf — Client Portal PR A.
//
// Inputs (POST JSON):
//   { client_id, date_range_start?, date_range_end?, viewer_role?, token? }
//
// Output:
//   { pdf_base64, file_name, event_count }
//
// We return base64 instead of streaming binary because Base44's invoke layer
// works best with JSON payloads. The frontend (ActivityFeed) decodes the
// base64 client-side and triggers the browser's download.
//
// Auth model:
//   - token (session token) MUST be supplied.
//   - If user.role is admin/owner, ANY client_id is allowed.
//   - Otherwise (client role), client_id must equal the user's own
//     Client.id. Field consultants and CPCs are denied outright.
//
// PDF helpers are inlined from base44/lib/pdfGenerator.ts (Base44 functions
// can't import from sibling paths). Keep the two in sync — see the lib
// file's header comment for the explanation.
// =============================================================================

// ---- Brand constants (mirrored from base44/lib/pdfGenerator.ts) -----------
const BRAND_NAVY:    [number, number, number] = [26,  26,  46];
const BRAND_PURPLE:  [number, number, number] = [106, 76,  147];
const BRAND_PINK:    [number, number, number] = [233, 30,  99];
const BRAND_WHITE:   [number, number, number] = [255, 255, 255];
const BRAND_GREY:    [number, number, number] = [71,  85,  105];
const BRAND_BODY:    [number, number, number] = [30,  41,  59];

interface BrandedLayoutOptions {
  title:        string;
  subtitle?:    string;
  footerLine?:  string;
  pageNumber?:  number;
}

function withBrandedLayout(doc: any, opts: BrandedLayoutOptions): number {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(...BRAND_NAVY);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(...BRAND_PURPLE);
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  doc.setTextColor(...BRAND_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MARKETING iO', 12, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  doc.text('Too good to stay hidden.', 12, 17);

  doc.setTextColor(...BRAND_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(opts.title, pageWidth - 12, 13, { align: 'right' });

  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 220);
    doc.text(opts.subtitle, pageWidth - 12, 19, { align: 'right' });
  }

  doc.setFillColor(...BRAND_PINK);
  doc.rect(0, pageHeight - 12, pageWidth, 1, 'F');

  doc.setTextColor(...BRAND_GREY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (opts.footerLine) {
    doc.text(opts.footerLine, 12, pageHeight - 6);
  }
  if (opts.pageNumber) {
    doc.text(`Page ${opts.pageNumber}`, pageWidth - 12, pageHeight - 6, { align: 'right' });
  }

  return 38;
}

// ---- Session derivation (mirrored from auth-me) ----------------------------
function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

async function deriveActorFromSessionToken(base44: any, token: string) {
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
  return {
    userId: String(user.id || ''),
    role:   String(user.role || 'client'),
    email:  String(user.email || ''),
  };
}

async function findClientForUser(base44: any, userId: string) {
  if (!userId) return null;
  for (const filter of [{ client_user_id: userId }, { app_user_id: userId }]) {
    try {
      const list = await base44.asServiceRole.entities.Client.filter(filter);
      const c = unwrapList(list)[0];
      if (c) return c;
    } catch { /* try next */ }
  }
  return null;
}

// ---- Date range helper -----------------------------------------------------
function fmtRangeLabel(startIso: string | null, endIso: string | null): string {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  if (!startIso && !endIso) return 'All time';
  if (startIso && endIso)   return `${fmt(startIso)} – ${fmt(endIso)}`;
  if (startIso)             return `From ${fmt(startIso)}`;
  return `Up to ${fmt(endIso!)}`;
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

  const clientId  = String(body?.client_id ?? '').trim();
  const startIso  = body?.date_range_start ? String(body.date_range_start) : null;
  const endIso    = body?.date_range_end   ? String(body.date_range_end)   : null;
  const tokenRaw  = String(body?.token ?? '').trim();
  const viewerRoleHint = String(body?.viewer_role ?? '').trim().toLowerCase();

  if (!clientId) {
    return Response.json({ error: 'client_id required' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  // ---- Auth: token required, role-aware client_id check -------------------
  const actor = await deriveActorFromSessionToken(base44, tokenRaw);
  if (!actor) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }
  // Field Consultants and CPCs are explicitly denied (Master Index Decision 1).
  if (actor.role === 'field_agent' || actor.role === 'cpc' || actor.role === 'driver') {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
  const isStaff = actor.role === 'admin' || actor.role === 'owner';
  if (!isStaff) {
    const ownClient = await findClientForUser(base44, actor.userId);
    if (!ownClient || ownClient.id !== clientId) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  // ---- Resolve client + load entries -------------------------------------
  let client: any = null;
  try {
    const list = await base44.asServiceRole.entities.Client.filter({ id: clientId });
    client = unwrapList(list)[0] || null;
  } catch (err) {
    console.error('[generate-activity-pdf] Client lookup failed:', err);
  }
  if (!client) {
    return Response.json({ error: 'client_not_found' }, { status: 404 });
  }

  // Pull a generous slice and filter client-side. The SDK doesn't expose
  // gte/lte operators, so we over-fetch (max 1000 rows per call) and trim.
  // For a single client over a typical range this is plenty; if a single
  // client ever exceeds a thousand events we can paginate the PDF query.
  let entries: any[] = [];
  try {
    const rows = await base44.asServiceRole.entities.ClientActivityLog
      .filter({ client_id: clientId }, '-created_date', 1000);
    entries = unwrapList(rows);
  } catch (err) {
    console.error('[generate-activity-pdf] entries fetch failed:', err);
  }

  if (startIso) {
    const startMs = new Date(startIso).getTime();
    entries = entries.filter((e) => e?.created_date && new Date(e.created_date).getTime() >= startMs);
  }
  if (endIso) {
    const endMs = new Date(endIso).getTime();
    entries = entries.filter((e) => e?.created_date && new Date(e.created_date).getTime() <= endMs);
  }

  // Effective viewerRole — staff pass through, clients always 'client'.
  const viewerRole: 'client' | 'admin' | 'owner' =
    isStaff ? (viewerRoleHint === 'owner' ? 'owner' : 'admin') : 'client';

  // ---- Build the PDF -----------------------------------------------------
  const businessName = String(client.business_name || client.contact_person || 'Client').trim();
  const dateRangeLabel = fmtRangeLabel(startIso, endIso);
  const generatedAt = new Date().toLocaleString('en-ZA', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone:  'Africa/Johannesburg',
  });
  const footerLine = `Generated for ${businessName} on ${generatedAt}. Confidential.`;
  const subtitle   = `${businessName} · ${dateRangeLabel}`;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const showActor  = viewerRole === 'admin' || viewerRole === 'owner';

  // ---- Cover page -------------------------------------------------------
  withBrandedLayout(doc, {
    title:      'Activity Audit Trail',
    subtitle,
    footerLine,
    pageNumber: 1,
  });

  doc.setTextColor(...BRAND_BODY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(businessName, 12, 60);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_GREY);
  doc.text(`Date range: ${dateRangeLabel}`,    12, 70);
  doc.text(`Generated:  ${generatedAt}`,       12, 76);
  doc.text(`Total events: ${entries.length}`,  12, 82);
  doc.text('Activity Audit Trail v1.0',        12, 88);

  doc.setDrawColor(...BRAND_PURPLE);
  doc.setLineWidth(0.4);
  doc.line(12, 95, pageWidth - 12, 95);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_BODY);
  const blurb = showActor
    ? 'This document is a complete audit trail of every activity recorded for this client during the date range above. Includes actor information and security details (IP, user agent) for authentication events.'
    : 'This document lists everything you have done on Marketing iO during the date range above. Keep it for your records.';
  doc.text(doc.splitTextToSize(blurb, pageWidth - 24), 12, 105);

  // ---- Event pages ------------------------------------------------------
  const rowMin = 12;
  const lineH  = 5;
  const wrapW  = pageWidth - 24;

  if (entries.length === 0) {
    doc.addPage();
    let y2 = withBrandedLayout(doc, {
      title:      'Activity Audit Trail',
      subtitle,
      footerLine,
      pageNumber: 2,
    });
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...BRAND_GREY);
    doc.setFontSize(11);
    doc.text('No activity recorded for this date range.', 12, y2 + 8);
  } else {
    doc.addPage();
    let pageNumber = 2;
    let y = withBrandedLayout(doc, {
      title:      'Activity Audit Trail',
      subtitle,
      footerLine,
      pageNumber,
    });

    // Render newest-first to match the on-screen order.
    for (const e of entries) {
      const summary = e.event_summary || e.title || e.event_label || '(no summary)';
      const summaryLines = doc.splitTextToSize(summary, wrapW);
      const actorLine = showActor
        ? `${(e.actor_role || 'unknown').toUpperCase()} · ${e.logged_by_name || ''}`.trim()
        : null;
      const securityRelevant = showActor &&
        (e.event_type === 'login_success' || e.event_type === 'login_failed' ||
         e.event_type === 'password_changed' || e.event_type === 'password_reset_requested' ||
         e.event_type === 'password_reset_completed') &&
        (e.ip_address || e.user_agent);

      let approxHeight = rowMin + (summaryLines.length - 1) * lineH;
      if (actorLine)        approxHeight += lineH;
      if (securityRelevant) approxHeight += lineH;

      if (y + approxHeight > pageHeight - 18) {
        doc.addPage();
        pageNumber += 1;
        y = withBrandedLayout(doc, {
          title:      'Activity Audit Trail',
          subtitle,
          footerLine,
          pageNumber,
        });
      }

      const ts = e.created_date
        ? new Date(e.created_date).toLocaleString('en-ZA', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone:  'Africa/Johannesburg',
          })
        : '';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND_GREY);
      doc.text(ts, 12, y);

      if (e.event_category) {
        doc.setTextColor(...BRAND_PURPLE);
        doc.setFont('helvetica', 'bold');
        doc.text(String(e.event_category).toUpperCase(), pageWidth - 12, y, { align: 'right' });
      }

      y += 4;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_BODY);
      doc.text(summaryLines, 12, y);
      y += summaryLines.length * lineH;

      if (actorLine) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...BRAND_GREY);
        doc.text(actorLine, 12, y);
        y += lineH;
      }

      if (securityRelevant) {
        const sec = [
          e.ip_address ? `IP ${e.ip_address}` : '',
          e.user_agent ? `UA ${(e.user_agent || '').slice(0, 80)}` : '',
        ].filter(Boolean).join(' · ');
        if (sec) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(...BRAND_GREY);
          doc.text(sec, 12, y);
          y += lineH;
        }
      }

      doc.setDrawColor(220, 220, 230);
      doc.setLineWidth(0.2);
      doc.line(12, y + 1, pageWidth - 12, y + 1);
      y += 5;
    }
  }

  // jsPDF returns a binary string for 'datauristring' (we'd have to strip the
  // prefix) or an ArrayBuffer for 'arraybuffer'. ArrayBuffer is cleaner.
  const ab: ArrayBuffer = doc.output('arraybuffer');
  const bytes = new Uint8Array(ab);
  // Convert Uint8Array → base64 (chunked to avoid call-stack overflows on
  // large PDFs from String.fromCharCode(...bytes)).
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const pdfBase64 = btoa(binary);

  const safeName = businessName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'client';
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `marketing-io-activity-${safeName}-${stamp}.pdf`;

  return Response.json({
    pdf_base64:  pdfBase64,
    file_name:   fileName,
    event_count: entries.length,
  });
});
