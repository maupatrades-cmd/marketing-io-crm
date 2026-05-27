import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

// =============================================================================
// generate-msa-pdf — renders the 22-page Marketing iO MSA V3.0 to base64 PDF.
//
// Dual auth modes (mutually exclusive — caller picks one):
//   A) Staff preview:        { token, contract_id }
//                            - token is the mio_session_token
//                            - validated via auth-me; owner/admin only
//   B) Public client signing: { signing_token }
//                            - looks up Contract by signing_token
//                            - validates against signing_link_expires_at
//                            - no session required (called from /sign-contract)
//
// Mode B is invoked internally by get-contract-for-signing — keeping the
// generator code in one place per Base44's no-cross-import-from-lib
// constraint (see pdfGenerator.ts header). Per the same constraint, this
// file inlines:
//   - DIRECTOR_SIGNATURE_DATA_URL (source-of-truth: base44/lib/directorSignature.ts)
//   - The full MSA template generator (source-of-truth: base44/lib/msaTemplate.ts)
// When either changes, update the lib source AND inline copy in lockstep.
//
// Hardening on the public path mirrors payment-public-summary:
//   - Strict signing_token shape validation BEFORE any DB call
//   - Generic 404 for missing / malformed / expired / not-found
//   - No full token in logs (truncate to first 8 chars)
// =============================================================================

const ALLOWED_STAFF_ROLES = ['owner', 'admin'];

// Loose UUID-ish + legacy base36 token shape. Anything else → 404.
const TOKEN_SHAPE = /^[A-Za-z0-9-]{20,64}$/;

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function notFound() {
  return Response.json({ success: false, error: 'not_found_or_expired' }, { status: 404 });
}

// PDF transport: the rendered Uint8Array is wrapped in a Blob/File and
// pushed to Base44's UploadFile integration. We return the resulting HTTPS
// file_url instead of base64. Earlier base64-in-JSON transport caused
// suspected 502 gateway timeouts on the chained get-contract-for-signing
// invoke (megabyte response + byte-by-byte string encode); UploadFile keeps
// the response small (~100-byte URL string).

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = String(body?.token ?? '').trim();
  const contractId = String(body?.contract_id ?? '').trim();
  const signingToken = String(body?.signing_token ?? '').trim();

  let contract: any = null;
  let actorLabel = 'system';

  if (signingToken) {
    // ── Public path: caller has only the signing token ────────────────────
    if (!TOKEN_SHAPE.test(signingToken)) return notFound();
    console.log(
      `[generate-msa-pdf] public lookup token=${signingToken.slice(0, 8)}…`,
    );
    try {
      const list = unwrap(
        await base44.asServiceRole.entities.Contract.filter({ signing_token: signingToken }),
      );
      contract = list[0] || null;
    } catch (err) {
      console.error('[generate-msa-pdf] Contract.filter failed:', (err as any)?.message);
      return notFound();
    }
    if (!contract) return notFound();
    if (contract.signing_link_expires_at) {
      const exp = new Date(contract.signing_link_expires_at).getTime();
      if (Number.isFinite(exp) && exp < Date.now()) return notFound();
    }
    actorLabel = 'public_signing';
  } else if (token && contractId) {
    // ── Staff path: validate session via auth-me ─────────────────────────
    let actor: { userId: string; role: string } | null = null;
    try {
      const authRes = await base44.asServiceRole.functions.invoke('auth-me', { token });
      const authData = authRes?.data ?? authRes;
      if (authData?.user) {
        actor = {
          userId: String(authData.user.id || ''),
          role:   String(authData.user.role || 'client'),
        };
      }
    } catch (err) {
      console.error('[generate-msa-pdf] auth-me failed:', (err as any)?.message);
    }
    if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
    if (!ALLOWED_STAFF_ROLES.includes(actor.role)) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    try {
      const list = unwrap(await base44.asServiceRole.entities.Contract.filter({ id: contractId }));
      contract = list[0] || null;
    } catch (err) {
      console.error('[generate-msa-pdf] Contract.filter (staff path) failed:', (err as any)?.message);
      return Response.json({ error: 'contract_lookup_failed' }, { status: 500 });
    }
    if (!contract) return Response.json({ error: 'contract_not_found' }, { status: 404 });
    actorLabel = `staff_${actor.role}`;
  } else {
    return Response.json({
      error: 'missing_auth',
      detail: 'Provide either { signing_token } (public) or { token, contract_id } (staff).',
    }, { status: 400 });
  }

  // ── Fetch related Client + (optionally) FulfilmentTemplate deliverables ──
  let client: any = {};
  if (contract.client_id) {
    try {
      const cList = unwrap(
        await base44.asServiceRole.entities.Client.filter({ id: contract.client_id }),
      );
      client = cList[0] || {};
    } catch {
      // non-fatal — render with whatever's on the Contract row
    }
  }

  let deliverables: string[] = [];
  const pkgCode = String(contract.package === 'add_on' ? (contract.add_on_name || '') : (contract.package || '')).trim();
  if (pkgCode) {
    try {
      const tplList = unwrap(
        await base44.asServiceRole.entities.FulfilmentTemplate.filter({ code: pkgCode }),
      );
      const tpl = tplList[0];
      if (tpl) {
        try {
          const setupArr = JSON.parse(String(tpl.setup_deliverables || '[]'));
          const recurArr = JSON.parse(String(tpl.recurring_deliverables || '[]'));
          deliverables = [...(Array.isArray(setupArr) ? setupArr : []), ...(Array.isArray(recurArr) ? recurArr : [])]
            .filter((s) => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 7);
        } catch { /* fall back to empty list */ }
      }
    } catch {
      // non-fatal — leave deliverables blank
    }
  }

  // ── Signer payload (PR #125) ───────────────────────────────────────────
  // When the caller is finalize-signed-contract, body.signer is a populated
  // MsaSigner with audit fields. When the caller is get-contract-for-signing
  // (pre-signing view) or a staff preview, body.signer is undefined → page 19
  // signature line stays blank and page 20 keeps the placeholder text.
  const signerInput = body?.signer && typeof body.signer === 'object' ? body.signer : null;

  // ── Render PDF ─────────────────────────────────────────────────────────
  let bytes: Uint8Array;
  try {
    bytes = generateMsaPdf(contract, client, signerInput, { deliverables, account_manager: null });
  } catch (err) {
    console.error('[generate-msa-pdf] render failed:', (err as any)?.message);
    return Response.json({ error: 'render_failed', detail: (err as any)?.message }, { status: 500 });
  }

  // Upload to Base44 storage to get an HTTPS URL — replaces the megabyte
  // base64-in-JSON transport that was causing 502s on the chained call from
  // get-contract-for-signing.
  const contractRef = String(contract.id || '').slice(-8).toUpperCase();
  const filename    = `MSA-${contractRef}-${Date.now()}.pdf`;
  let pdfUrl: string | null = null;
  try {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const file = new File([blob], filename, { type: 'application/pdf' });
    const uploaded: any = await (base44 as any).asServiceRole.integrations.Core.UploadFile({ file });
    pdfUrl = uploaded?.file_url || uploaded?.url || uploaded?.data?.file_url || null;
    if (!pdfUrl) throw new Error('UploadFile returned no file_url');
  } catch (err) {
    console.error('[generate-msa-pdf] UploadFile failed:', (err as any)?.message);
    return Response.json({
      error:  'upload_failed',
      detail: (err as any)?.message,
    }, { status: 500 });
  }

  console.log(
    `[generate-msa-pdf] rendered+uploaded actor=${actorLabel} contract=${contractRef} bytes=${bytes.length} url=${pdfUrl}`,
  );

  return Response.json({
    success:            true,
    contract_id:        String(contract.id || ''),
    contract_reference: contractRef,
    pdf_url:            pdfUrl,
  });
});

// =============================================================================
// INLINED FROM base44/lib/msaTemplate.ts — DO NOT EDIT HERE WITHOUT UPDATING
// THE LIB SOURCE OF TRUTH IN LOCKSTEP. Per pdfGenerator.ts header constraint:
// Base44 functions cannot import from base44/lib/, so the canonical template
// is reproduced below. Update procedure:
//   1. Edit base44/lib/msaTemplate.ts (source-of-truth, used for reference).
//   2. Re-paste the body below (starts at "// ── BRAND CONSTANTS ──").
//   3. Re-paste DIRECTOR_SIGNATURE_DATA_URL from base44/lib/directorSignature.ts.
// =============================================================================

const DIRECTOR_SIGNATURE_DATA_URL =
  'data:image/png;base64,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';

const DIRECTOR_SIGNATURE_WIDTH_MM = 50;
const DIRECTOR_SIGNATURE_HEIGHT_MM = 19;

// ── BRAND CONSTANTS ─────────────────────────────────────────────────────────

const NAVY      = '#0A1F44';
const RED       = '#E2231A';
const DARK_GREY = '#333333';
const MID_GREY  = '#666666';
const LIGHT_BG  = '#F5F5F5';
const BORDER    = '#CCCCCC';

const MIO_DETAILS = {
  full_name:  'Thapelo Maupa',
  capacity:   'Director',
  email:      'thapelom@marketingio.co.za',
  reg_number: '2026303502',
  office:     'Polokwane, Limpopo, 0699, Republic of South Africa',
  website:    'www.marketingio.co.za',
  info_email: 'info@marketingio.co.za',
};

// Marketing iO director signature. Source-of-truth lives in
// ./directorSignature.ts (cherry-picked from PR #120). lib-to-lib imports
// work at the file-system level; functions consuming this template must
// still inline the constant per the Base44 no-cross-import constraint
// documented at the top of pdfGenerator.ts.
// DIRECTOR_SIGNATURE_DATA_URL inlined as DIRECTOR_SIGNATURE_DATA_URL above.


// ── PAGE GEOMETRY (mm, A4) ──────────────────────────────────────────────────

const PAGE_W   = 210;
const PAGE_H   = 297;
const ML       = 18;             // left margin
const MR       = 18;             // right margin
const CONTENT_W = PAGE_W - ML - MR;
const CONTENT_R = PAGE_W - MR;
const TOP      = 28;             // content top (below top band)
const BOTTOM   = 268;            // content bottom (above footer)

// ── TYPES ───────────────────────────────────────────────────────────────────

interface MsaContract {
  id?: string;
  package?: string | null;
  add_on_name?: string | null;
  setup_fee?: number | null;
  monthly_retainer?: number | null;
  status?: string | null;
  signing_status?: string | null;
  signed_by_client?: boolean;
  signed_by_mio?: boolean;
  signed_date?: string | null;
  client_signed_at?: string | null;
  marketing_io_signed_at?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  debit_order_date?: string | null;
  notes?: string | null;
}

interface MsaClient {
  business_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  id_reg_number?: string | null;
}

interface MsaSigner {
  // Identity
  full_name?: string;
  capacity?: string;
  id_number?: string;
  email?: string;
  signed_at?: string;
  place?: string;
  // Signature rendering — PR #125
  signature_method?: 'typed' | 'drawn';
  typed_signature?: string;                // rendered cursive-italic on page 19 when method='typed'
  signature_data_url?: string;             // image embed on page 19 when method='drawn'
  // Audit trail — PR #125. Populated by finalize-signed-contract and
  // rendered into page 20's audit-trail block instead of the placeholder.
  signed_ip_address?: string;
  signed_user_agent?: string;              // expected pre-truncated to 200 chars by caller
  document_hash?: string;                  // SHA-256 hex content fingerprint
}

interface MsaContext {
  contract: MsaContract;
  client:   MsaClient;
  signer?:  MsaSigner | null;
  deliverables?: string[];           // from FulfilmentTemplate, max 7 used
  account_manager?: string | null;
}

// ── PRODUCT LABEL MAP (for Package field human-readable rendering) ─────────

const PACKAGE_LABELS: Record<string, string> = {
  ignite:                       'Ignite',
  accelerate:                   'Accelerate',
  dominate:                     'Dominate',
  street_pulse:                 'Street Pulse',
  township_pulse:               'Township Pulse',
  add_on:                       'Add-On',
  ai_chatbot:                   'AI Chatbot',
  whatsapp_automation:          'WhatsApp Business Automation',
  reputation_management:        'Reputation Management',
  google_business_profile:      'Google Business Profile',
  email_newsletter:             'Email Newsletter Management',
  short_form_video:             'Short-Form Video Pack',
  sms_marketing:                'SMS Marketing Campaigns',
  staff_training_workshop:      'Staff Training Workshop',
  marketing_audit:              'Marketing Audit & Report',
  competitor_analysis:          'Competitor Analysis Report',
  ai_content_writing:           'AI Content Writing Service',
  crm_training_setup:           'CRM Training & Setup',
  print_signage:                'Print & Signage',
  domain_hosting_email:         'Domain, Hosting & Email',
  website_maintenance:          'Website Maintenance Retainer',
  paid_ads_management:          'Paid Ads Management',
  ecommerce_setup:              'E-commerce Setup',
  business_plan:                'Business Plan',
  website_design_only:          'Website Design Only',
  business_plan_website_bundle: 'Business Plan + Website Bundle',
};

function packageLabel(ctx: MsaContext): string {
  const pkg = String(ctx.contract.package || '').trim();
  // When the Contract is an add-on, prefer the add_on_name slug for the label.
  if (pkg === 'add_on' && ctx.contract.add_on_name) {
    return PACKAGE_LABELS[String(ctx.contract.add_on_name)]
        || titleize(String(ctx.contract.add_on_name));
  }
  return PACKAGE_LABELS[pkg] || titleize(pkg) || '—';
}

// ── HELPERS ─────────────────────────────────────────────────────────────────

function titleize(s: string): string {
  return s.split('_').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function fmtZar(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function contractRef(id?: string | null): string {
  if (!id) return 'PENDING';
  const s = String(id);
  return s.length > 8 ? s.slice(-8).toUpperCase() : s.toUpperCase();
}

function effectiveDate(c: MsaContract): string {
  return fmtDate(c.contract_start_date || c.signed_date || new Date().toISOString());
}

function setBody(doc: any, size = 9.5) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(DARK_GREY);
}
function setBold(doc: any, size = 10) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(NAVY);
}
function setMuted(doc: any, size = 8) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  doc.setTextColor(MID_GREY);
}

// Write wrapped body text starting at y, return new y.
function writeBody(doc: any, text: string, y: number, opts: { size?: number; indent?: number } = {}): number {
  const size = opts.size ?? 9.5;
  const indent = opts.indent ?? 0;
  setBody(doc, size);
  const lines = doc.splitTextToSize(text, CONTENT_W - indent);
  doc.text(lines, ML + indent, y);
  return y + lines.length * (size * 0.42) + 1.5;
}

// Write a section/clause header (navy bold).
function writeClauseHeader(doc: any, text: string, y: number, size = 11): number {
  setBold(doc, size);
  doc.text(text, ML, y);
  return y + 5.5;
}

// Bordered callout box for the "ACCELERATION CLAUSE" style red-emphasis blocks.
function writeCallout(doc: any, label: string, text: string, y: number): number {
  const lines = doc.splitTextToSize(text, CONTENT_W - 8);
  const labelHeight = 4;
  const textHeight  = lines.length * (9.5 * 0.42) + 1;
  const boxH = labelHeight + textHeight + 4;
  doc.setDrawColor(RED);
  doc.setLineWidth(0.4);
  doc.rect(ML, y, CONTENT_W, boxH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(RED);
  doc.text(label, ML + 4, y + 4);
  setBody(doc, 9.5);
  doc.text(lines, ML + 4, y + 4 + labelHeight);
  return y + boxH + 3;
}

// ── PER-PAGE CHROME (top band + bottom footer) ──────────────────────────────

function drawChrome(doc: any, pageNum: number) {
  // Top band — navy thin bar with title.
  doc.setFillColor(NAVY);
  doc.rect(0, 0, PAGE_W, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');
  doc.text('MASTER SERVICE AGREEMENT', CONTENT_R, 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Version 3.0 | Marketing iO (Pty) Ltd', CONTENT_R, 10, { align: 'right' });

  // Bottom: confidentiality line + page number.
  setMuted(doc, 7.5);
  doc.text(
    `Confidential | Marketing iO (Pty) Ltd | CIPC ${MIO_DETAILS.reg_number}`,
    ML, 278,
  );
  doc.text(`Page ${pageNum}`, CONTENT_R, 278, { align: 'right' });

  // Red ribbon: "TOO GOOD TO STAY HIDDEN" with initials line on its right.
  doc.setFillColor(RED);
  doc.rect(0, 283, PAGE_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor('#FFFFFF');
  doc.text('TOO GOOD TO STAY HIDDEN', ML + 2, 287.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    'Client Initials: _______ / Marketing iO Initials: _______',
    CONTENT_R, 287.5,
    { align: 'right' },
  );
}

// ── PAGE 1: COVER ───────────────────────────────────────────────────────────

function pageCover(doc: any, ctx: MsaContext) {
  // Top navy band wide
  doc.setFillColor(NAVY);
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor('#FFFFFF');
  doc.text('MARKETING iO (PTY) LTD', PAGE_W / 2, 13, { align: 'center' });

  // Title block
  doc.setTextColor(NAVY);
  doc.setFontSize(38);
  doc.text('Master', PAGE_W / 2, 70, { align: 'center' });
  doc.setFontSize(38);
  doc.text('Service Agreement', PAGE_W / 2, 86, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(MID_GREY);
  doc.text('Version 3.0 — Signing Edition', PAGE_W / 2, 96, { align: 'center' });

  // Red tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(RED);
  doc.text('"Too Good To Stay Hidden"', PAGE_W / 2, 118, { align: 'center' });

  // 4 merge-field rows
  const rowY0 = 150;
  const rowH = 12;
  const labelX = ML + 6;
  const valX = ML + 80;
  const rows: Array<[string, string]> = [
    ['CONTRACT REFERENCE', contractRef(ctx.contract.id)],
    ['CLIENT',             String(ctx.client.business_name || '—')],
    ['PACKAGE',            packageLabel(ctx)],
    ['EFFECTIVE DATE',     effectiveDate(ctx.contract)],
  ];
  for (let i = 0; i < rows.length; i++) {
    const y = rowY0 + i * rowH;
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.3);
    doc.line(ML, y + 6, CONTENT_R, y + 6);
    setBold(doc, 9);
    doc.text(rows[i][0], labelX, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(DARK_GREY);
    doc.setFontSize(10);
    doc.text(`[ ${rows[i][1]} ]`, valX, y + 4);
  }

  // Issuer block at bottom
  setMuted(doc, 8);
  doc.text('ISSUED BY', PAGE_W / 2, 240, { align: 'center' });
  setBold(doc, 10);
  doc.text('Marketing iO (Pty) Ltd', PAGE_W / 2, 246, { align: 'center' });
  setMuted(doc, 8.5);
  doc.text(`CIPC ${MIO_DETAILS.reg_number} | Polokwane, South Africa`, PAGE_W / 2, 252, { align: 'center' });
  doc.text(`${MIO_DETAILS.website} | ${MIO_DETAILS.info_email}`, PAGE_W / 2, 257, { align: 'center' });
}

// ── PAGE 2: PARTIES ─────────────────────────────────────────────────────────

function pageParties(doc: any, ctx: MsaContext) {
  let y = TOP;
  setBold(doc, 18);
  doc.text('Parties to the Agreement', ML, y);
  y += 7;
  y = writeBody(doc,
    'This Master Service Agreement ("Agreement") is entered into on the Effective Date specified on the cover page, by and between the following Parties:',
    y);
  y += 3;

  // PARTY 1 — navy header band + body
  doc.setFillColor(NAVY);
  doc.rect(ML, y, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor('#FFFFFF');
  doc.text('PARTY 1 — SERVICE PROVIDER', ML + 3, y + 5);
  y += 10;
  setBody(doc, 9.5);
  const p1Lines = [
    'Marketing iO (Pty) Ltd',
    `Registration Number: ${MIO_DETAILS.reg_number}`,
    `Registered Address: ${MIO_DETAILS.office}`,
    `Email: ${MIO_DETAILS.info_email}`,
    `Website: ${MIO_DETAILS.website}`,
    `Represented by: ${MIO_DETAILS.full_name} (${MIO_DETAILS.capacity}, duly authorised)`,
    '(hereinafter referred to as "Marketing iO")',
  ];
  for (const l of p1Lines) { doc.text(l, ML + 3, y); y += 4.5; }
  y += 2;

  // "— AND —" centred separator
  setBold(doc, 10);
  doc.text('— AND —', PAGE_W / 2, y, { align: 'center' });
  y += 6;

  // PARTY 2 — red header band + merge-fields
  doc.setFillColor(RED);
  doc.rect(ML, y, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor('#FFFFFF');
  doc.text('PARTY 2 — CLIENT', ML + 3, y + 5);
  y += 10;
  setBody(doc, 9.5);
  const cap = ctx.signer?.capacity?.trim() || '';
  const rep = ctx.client.contact_person || '';
  const p2Lines: Array<[string, string]> = [
    ['Registered/Trading Name:', String(ctx.client.business_name || '')],
    ['Registration Number:',     String(ctx.client.id_reg_number || '')],
    ['Registered Address:',      String(ctx.client.address || '')],
    ['Email Address:',           String(ctx.client.email || '')],
    ['Telephone:',               String(ctx.client.phone || '')],
    ['Represented by:',          String(rep)],
    ['Capacity:',                String(cap)],
  ];
  for (const [label, val] of p2Lines) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(NAVY);
    doc.text(label, ML + 3, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(DARK_GREY);
    doc.text(val, ML + 50, y);
    doc.setDrawColor(BORDER);
    doc.line(ML + 50, y + 1, CONTENT_R - 3, y + 1);
    y += 6;
  }
  setBody(doc, 9);
  doc.text('(hereinafter referred to as the "Client")', ML + 3, y);
  y += 8;

  y = writeBody(doc,
    'Marketing iO and the Client are referred to collectively as the "Parties" and individually as a "Party".',
    y);
  y += 2;
  setBold(doc, 9.5);
  doc.text('RECITAL:', ML, y);
  setBody(doc, 9.5);
  const recital = doc.splitTextToSize(
    ' The Client wishes to engage Marketing iO to provide certain digital marketing, field marketing, and related services, and Marketing iO has agreed to render such services on the terms and conditions set out in this Agreement. The Parties accordingly agree as follows:',
    CONTENT_W - 18);
  doc.text(recital, ML + 18, y);
}

// ── PAGE 3: CLAUSE 1 — DEFINITIONS ──────────────────────────────────────────

const DEFINITIONS: Array<[string, string]> = [
  ['"Agreement"',           'means this Master Service Agreement together with Schedule A, the POPIA Operator Agreement, and any duly signed Change Orders.'],
  ['"Business Day"',        'means any day other than a Saturday, Sunday, or official public holiday in the Republic of South Africa.'],
  ['"Change Order"',        'means a written instrument signed by both Parties that varies the scope, fees, or timelines of the Services.'],
  ['"Client"',              'means the party identified as Party 2 on the Parties page of this Agreement.'],
  ['"Deliverables"',        'means the services, materials, content, and output produced by Marketing iO as set out in Schedule A.'],
  ['"Effective Date"',      'means the commencement date as specified on the cover page of this Agreement.'],
  ['"Go-Live"',             'means the date on which the applicable setup deliverables under Schedule A have been completed and made available to the Client, or on which campaigns, accounts, or assets are activated for public-facing use, whichever is earlier.'],
  ['"Monthly Retainer"',    'means the recurring monthly fee specified on the cover page and in Schedule A.'],
  ['"Operator"',            'means Marketing iO when acting as a data processor under POPIA on behalf of the Client as Responsible Party.'],
  ['"Personal Information"','means as defined in section 1 of POPIA, being information relating to an identifiable, living, natural person.'],
  ['"POPIA"',               'means the Protection of Personal Information Act 4 of 2013, including its regulations and any successor legislation.'],
  ['"Services"',            'means the marketing, advertising, content, and related services described in Schedule A.'],
  ['"Setup Fee"',           'means the once-off onboarding fee specified on the cover page and in Schedule A.'],
  ['"Term"',                'means the duration of this Agreement as set out in Clause 3.'],
];

function pageClause1(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 1 | DEFINITIONS AND INTERPRETATION', TOP, 12);
  y = writeBody(doc,
    'In this Agreement, unless the context clearly indicates otherwise, the following expressions shall bear the meanings assigned to them below, and cognate expressions shall bear corresponding meanings:',
    y);
  y += 1;
  for (const [term, def] of DEFINITIONS) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(NAVY);
    doc.text(term, ML, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(DARK_GREY);
    const defLines = doc.splitTextToSize(def, CONTENT_W - 47);
    doc.text(defLines, ML + 47, y);
    y += Math.max(defLines.length * 3.8, 4.5) + 0.5;
  }
  y += 2;
  setBold(doc, 9.5);
  doc.text('1.2 Order of Precedence.', ML, y);
  setBody(doc, 9.5);
  const opLines = doc.splitTextToSize(
    ' In the event of any conflict between documents forming part of this Agreement, the following order of precedence shall apply (highest to lowest):',
    CONTENT_W - 36);
  doc.text(opLines, ML + 36, y);
  y += opLines.length * 4 + 2;
  const order = [
    'Signed Change Orders (most recent prevailing)',
    'Schedule A — Service Specification',
    'Master Service Agreement (this document)',
    'POPIA Operator Agreement',
  ];
  setBody(doc, 9.5);
  for (let i = 0; i < order.length; i++) {
    doc.text(`${i + 1}.  ${order[i]}`, ML + 8, y);
    y += 4.8;
  }
}

// ── PAGE 4: CLAUSES 2, 3, 4 ─────────────────────────────────────────────────

function pageClauses234(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 2 | ENGAGEMENT OF SERVICES', TOP);
  y = writeBody(doc, '2.1 The Client hereby engages Marketing iO to provide the Services on the terms and conditions set out in this Agreement, and Marketing iO accepts such engagement.', y);
  y = writeBody(doc, '2.2 Marketing iO shall provide the Services with due skill, care, and diligence, in accordance with industry best practice and applicable South African law.', y);
  y = writeBody(doc, '2.3 The Services shall commence on the Effective Date and shall be performed in accordance with Schedule A.', y);
  y = writeBody(doc, '2.4 Marketing iO reserves the right to engage approved sub-contractors, freelancers, or specialist service providers to deliver the Services, and remains responsible for their performance.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 3 | TERM AND RENEWAL', y);
  y = writeBody(doc, '3.1 This Agreement shall endure for an initial Term of 12 (twelve) months from the Effective Date ("Initial Term").', y);
  y = writeBody(doc, '3.2 Upon expiry of the Initial Term, this Agreement shall automatically renew for successive periods of 12 (twelve) months each ("Renewal Term"), unless either Party provides written notice of non-renewal not less than 30 (thirty) days prior to the expiry of the then-current Term.', y);
  y = writeBody(doc, '3.3 Either Party may terminate this Agreement during a Renewal Term by providing 30 (thirty) days\' written notice. Termination during the Initial Term is governed by Clause 11.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 4 | FEES AND PAYMENT', y);
  y = writeBody(doc, '4.1 The Client shall pay the Setup Fee on the date of signature of this Agreement, or as otherwise specified in Schedule A.', y);
  y = writeBody(doc, '4.2 The Monthly Retainer shall be payable monthly in advance, on the 1st or 15th of each calendar month as elected by the Client at signing, via EFT, debit order, or such other method as the Parties may agree.', y);
  y = writeBody(doc, '4.3 All fees are quoted exclusive of VAT (where applicable) and shall be invoiced by Marketing iO accordingly.', y);
  y = writeBody(doc, '4.4 Should the Client fail to pay any amount due within 7 (seven) days of the due date, Marketing iO shall issue a written reminder.', y);
  y = writeBody(doc, '4.5 If the Client fails to remedy the non-payment within 7 (seven) days of the reminder, Marketing iO reserves the right to suspend all Services until payment is received in full.', y);
  y = writeBody(doc, '4.6 If a debit order is returned unpaid, Marketing iO shall be entitled to re-present the debit order within 7 (seven) days.', y);
  y += 1;

  y = writeCallout(doc, 'ACCELERATION CLAUSE.',
    '4.7 If two (2) or more debit orders fail within any 12 (twelve) month period, the entire outstanding balance payable by the Client under this Agreement (including all remaining Monthly Retainer amounts to the end of the then-current Term) shall become immediately due and payable in full.',
    y);

  y = writeBody(doc, '4.8 All amounts not paid by the due date shall bear interest at the maximum rate permitted under the National Credit Act, calculated daily from the due date until the date of actual payment.', y);
  y = writeBody(doc, '4.9 The Client shall not be entitled to withhold or set off any payment due under this Agreement, save by order of a competent court.', y);
}

// ── PAGE 5: CLAUSES 5, 6 ────────────────────────────────────────────────────

function pageClauses56(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 5 | CLIENT OBLIGATIONS', TOP);
  y = writeBody(doc, '5.1 The Client undertakes to:', y);
  y = writeBody(doc, '5.1.1 provide all information, content, brand assets, brand guidelines, and access credentials reasonably required by Marketing iO to deliver the Services;', y, { indent: 4 });
  y = writeBody(doc, '5.1.2 respond to feedback requests, approval requests, and queries from Marketing iO within the timeframes set out in Clause 6;', y, { indent: 4 });
  y = writeBody(doc, '5.1.3 ensure that the Client\'s nominated representatives are available for scheduled meetings, calls, and reviews;', y, { indent: 4 });
  y = writeBody(doc, '5.1.4 warrant that any Personal Information provided to Marketing iO has been collected lawfully, with the requisite consent from data subjects, and in compliance with POPIA and all applicable data protection laws;', y, { indent: 4 });
  y = writeBody(doc, '5.1.5 obtain and maintain all licences, permits, and regulatory approvals required for the Client\'s business and for the publication of any Deliverables.', y, { indent: 4 });
  y = writeBody(doc, '5.2 Marketing iO shall not be liable for any delay, defect, or failure in the Services caused by the Client\'s failure to comply with Clause 5.1.', y);
  y = writeBody(doc, '5.3 The Client shall reimburse Marketing iO for any additional costs reasonably incurred by Marketing iO as a result of Client delays, non-compliance, or changes to instructions, subject to the Change Order process in Clause 17.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 6 | DELIVERY, ACCEPTANCE, AND SERVICE LEVELS', y);
  y = writeBody(doc, '6.1 Marketing iO shall deliver the Deliverables in accordance with the Soft SLA and Hard SLA timeframes specified in Schedule A.', y);
  y = writeBody(doc, '6.2 Upon delivery of a Deliverable, the Client shall have 5 (five) Business Days within which to review the Deliverable and provide written feedback or approval.', y);
  y = writeBody(doc, '6.3 All feedback must be submitted in writing through the designated communication channel specified in Clause 14.', y);

  y = writeCallout(doc, 'DEEMED ACCEPTANCE.',
    '6.4 If the Client does not provide written feedback or rejection within 5 (five) Business Days of delivery, the Deliverable shall be deemed accepted and approved for publication or implementation, and Marketing iO shall be entitled to proceed accordingly.',
    y);

  y = writeBody(doc, '6.5 Accepted (or deemed accepted) Deliverables may not be rejected or subject to further revisions beyond the revision limits specified in Schedule A. Additional revisions shall be treated as a Change Order under Clause 17.', y);
  y = writeBody(doc, '6.6 The Client remains responsible for the accuracy, legality, and appropriateness of all content approved (expressly or by deemed acceptance) for publication.', y);

  y = writeCallout(doc, 'CLIENT DELAY EXTENSION.',
    '6.7 Any delay by the Client in providing feedback, approvals, content, access, or payment shall automatically extend all applicable project timelines and Go-Live dates by a period equal to the length of the delay. The Client shall not be entitled to claim breach or deduction by reason of such extended timelines.',
    y);
}

// ── PAGE 6: CLAUSES 7, 8, 9 ─────────────────────────────────────────────────

function pageClauses789(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 7 | INTELLECTUAL PROPERTY RIGHTS', TOP);
  y = writeBody(doc, '7.1 All pre-existing intellectual property of Marketing iO, including without limitation its proprietary tools, templates, methodologies, workflows, software, frameworks, and creative systems ("Marketing iO IP"), shall remain the exclusive property of Marketing iO at all times.', y);
  y = writeBody(doc, '7.2 Custom Deliverables created specifically for the Client during the Term shall remain the property of Marketing iO until all Setup Fees and Monthly Retainers due under this Agreement have been paid in full.', y);
  y = writeBody(doc, '7.3 Upon full payment of all fees and successful completion of the Services, ownership of custom Deliverables shall transfer to the Client, save for any embedded Marketing iO IP, which remains the property of Marketing iO and is licensed to the Client on a non-exclusive, non-transferable basis for the Client\'s internal business use.', y);
  y = writeBody(doc, '7.4 The Client grants Marketing iO a perpetual, royalty-free, non-exclusive licence to use anonymised case studies, performance data, and testimonials for marketing and portfolio purposes.', y);
  y = writeBody(doc, '7.5 The Client shall not reverse-engineer, decompile, or attempt to circumvent any proprietary process, tool, or system used by Marketing iO in delivering the Services.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 8 | CONFIDENTIALITY', y);
  y = writeBody(doc, '8.1 Each Party undertakes to maintain strict confidentiality regarding all proprietary, commercial, financial, technical, and strategic information disclosed to it by the other Party during the Term ("Confidential Information").', y);
  y = writeBody(doc, '8.2 Confidential Information includes, without limitation, business strategies, financial data, customer lists, supplier lists, pricing, proprietary techniques, source code, and any information marked or reasonably identifiable as confidential.', y);
  y = writeBody(doc, '8.3 The obligations in this Clause 8 shall survive termination of this Agreement for a period of 3 (three) years.', y);
  y = writeBody(doc, '8.4 Confidential Information may be disclosed only where required by law, court order, or regulatory authority, subject to prompt written notice to the other Party where lawfully permitted.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 9 | WARRANTIES AND DISCLAIMERS', y);
  y = writeBody(doc, '9.1 Marketing iO warrants that the Services shall be performed with reasonable skill, care, and diligence in accordance with prevailing industry standards.', y);
  y = writeBody(doc, '9.2 Marketing iO does not warrant or guarantee any specific business outcome, sales figure, conversion rate, ranking, engagement metric, or return on investment. Digital marketing results are inherently variable and depend on numerous factors outside Marketing iO\'s control.', y);
  y = writeBody(doc, '9.3 The Client acknowledges that the Services are subject to the operation, policies, algorithms, and availability of third-party platforms (including but not limited to Google, Meta, TikTok, LinkedIn, X, YouTube, and email service providers), market conditions, and the Client\'s own execution capability.', y);
  y = writeBody(doc, '9.4 Marketing iO makes no warranty of uninterrupted service, freedom from defects, or error-free delivery.', y);
  y = writeBody(doc, '9.5 All other warranties, conditions, and representations, whether express or implied, statutory or otherwise, are excluded to the fullest extent permitted by law.', y);
}

// ── PAGE 7: CLAUSES 10, 11 ──────────────────────────────────────────────────

function pageClauses1011(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 10 | LIMITATION OF LIABILITY', TOP);
  y = writeBody(doc, '10.1 Neither Party shall be liable to the other for any indirect, incidental, consequential, special, punitive, or exemplary damages, including without limitation loss of profit, loss of revenue, loss of goodwill, loss of data, or loss of business opportunity, however caused.', y);
  y = writeBody(doc, '10.2 Marketing iO\'s total aggregate liability under this Agreement, whether in contract, delict, negligence, statute, or otherwise, shall not exceed an amount equal to 3 (three) times the Monthly Retainer last paid by the Client.', y);
  y = writeBody(doc, '10.3 The limitation in Clause 10.2 applies cumulatively to all claims arising from or in connection with this Agreement.', y);
  y = writeBody(doc, '10.4 The Client assumes all risk associated with the publication, distribution, and use of Deliverables on any platform.', y);
  y = writeBody(doc, '10.5 Nothing in this Clause shall exclude or limit liability for fraud, wilful misconduct, or any liability that cannot be excluded by law.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 11 | TERMINATION', y);
  y = writeBody(doc, '11.1 Either Party may terminate this Agreement at the end of the Initial Term or any Renewal Term by giving 30 (thirty) days\' prior written notice.', y);
  y = writeBody(doc, '11.2 Either Party may terminate this Agreement with immediate effect (without notice period) in the event of:', y);
  y = writeBody(doc, '11.2.1 a material breach by the other Party that is not remedied within 7 (seven) days of written notice;', y, { indent: 4 });
  y = writeBody(doc, '11.2.2 the other Party\'s insolvency, business rescue, liquidation, sequestration, or appointment of an administrator;', y, { indent: 4 });
  y = writeBody(doc, '11.2.3 threatening, abusive, or harassing conduct directed at Marketing iO staff, sub-operators, or representatives.', y, { indent: 4 });
  y = writeBody(doc, '11.3 Upon termination, the Client shall pay all outstanding fees due, including the Monthly Retainer for the notice period.', y);
  y = writeBody(doc, '11.4 Termination shall not entitle the Client to any refund of Setup Fees or pre-paid amounts.', y);
  y = writeBody(doc, '11.5 Marketing iO shall make all Deliverables available to the Client for collection for a period of 30 (thirty) days following termination. After this period, Marketing iO shall be under no obligation to retain such Deliverables.', y);
  y = writeBody(doc, '11.6 All Confidential Information shall be returned or destroyed within 10 (ten) Business Days of termination, save for copies required to be retained by law or for legitimate record-keeping purposes.', y);

  y = writeCallout(doc, 'DELIVERABLE STORAGE.',
    '11.7 Marketing iO is not required to retain Deliverables, source files, working files, raw assets, or backups indefinitely after the expiry of the 30-day post-termination window in Clause 11.5. The Client is responsible for collecting and archiving its own copies of all required materials within this window.',
    y);
}

// ── PAGE 8: CLAUSE 12 — SPECIAL CLAUSES TABLE ───────────────────────────────

const SPECIAL_CLAUSES: Array<[string, string, string]> = [
  ['12.1',  'ACCELERATION ON FAILED DEBITS',     'As per Clause 4.7, two (2) or more failed debit orders within any 12-month period trigger immediate payment of the full outstanding balance for the then-current Term.'],
  ['12.2',  'NO-CHARGEBACK INDEMNITY',           'The Client indemnifies Marketing iO against any chargebacks, payment reversals, or disputes filed with the Client\'s bank or payment provider in respect of validly invoiced amounts.'],
  ['12.3',  'DEEMED ACCEPTANCE',                 'Per Clause 6.4: Client silence for more than 5 Business Days constitutes acceptance.'],
  ['12.4',  'NO OFF-CONTRACT PROMISES',          'No verbal undertaking, side agreement, or informal amendment shall be valid unless reduced to writing and signed by both Parties.'],
  ['12.5',  'ATTORNEY-AND-OWN-CLIENT COSTS',     'The unsuccessful Party in any legal proceeding shall pay the prevailing Party\'s legal costs on an attorney-and-own-client scale.'],
  ['12.6',  'SUSPENSION DOES NOT EXTEND TERM',   'Suspension of Services for non-payment or breach does not extend the Initial Term or any Renewal Term, and the Client remains liable for fees during suspension.'],
  ['12.7',  'NO PUBLIC DISPARAGEMENT',           'Neither Party shall publish, post, or communicate any derogatory or defamatory statement about the other Party, its staff, or its services.'],
  ['12.8',  'STAFF NON-LIABILITY',               'Marketing iO personnel acting in their professional capacity (including as Operator under POPIA) shall not bear personal liability for processing or operational decisions.'],
  ['12.9',  'FORMAL COMMUNICATION ONLY',         'All notices, instructions, approvals, and amendments must be in writing via the designated channels in Clause 14. WhatsApp, SMS, and voice communications are not binding unless confirmed in writing through a designated channel.'],
  ['12.10', '12-MONTH NON-POACHING',             'The Client shall not directly engage, employ, or contract any Marketing iO staff member or sub-operator for a period of 12 (twelve) months following termination. Breach gives rise to liquidated damages of R50,000 (fifty thousand Rand) per person, which the Parties agree is a genuine pre-estimate of loss.'],
  ['12.11', 'NO DIRECT ENGAGEMENT WITH SUB-OPERATORS', 'The Client shall not directly contract with any of Marketing iO\'s sub-contractors, freelancers, or specialist providers introduced via the Services, without Marketing iO\'s prior written consent.'],
  ['12.12', 'THREAT / HARASSMENT',               'Any threatening, abusive, or harassing conduct directed at Marketing iO staff shall result in immediate termination without refund and without further obligation.'],
];

function pageClause12(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 12 | SPECIAL CLAUSES AND TIGHTENING PROVISIONS', TOP);

  // Table header bar
  doc.setFillColor(NAVY);
  doc.rect(ML, y, CONTENT_W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor('#FFFFFF');
  doc.text('NO.',         ML + 2,  y + 4);
  doc.text('PROVISION',   ML + 14, y + 4);
  doc.text('DESCRIPTION', ML + 70, y + 4);
  y += 8;

  setBody(doc, 7.8);
  for (const [num, prov, desc] of SPECIAL_CLAUSES) {
    const provLines = doc.splitTextToSize(prov, 52);
    const descLines = doc.splitTextToSize(desc, CONTENT_W - 70);
    const rowH = Math.max(provLines.length, descLines.length) * 3.4 + 2;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(NAVY);
    doc.text(num, ML + 2, y);
    doc.text(provLines, ML + 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(DARK_GREY);
    doc.text(descLines, ML + 70, y);

    y += rowH;
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.2);
    doc.line(ML, y - 0.5, CONTENT_R, y - 0.5);
    y += 0.5;
  }
}

// ── PAGE 9: CLAUSES 13, 14 ──────────────────────────────────────────────────

function pageClauses1314(doc: any, ctx: MsaContext) {
  let y = writeClauseHeader(doc, 'CLAUSE 13 | DISPUTE RESOLUTION AND GOVERNING LAW', TOP);
  y = writeBody(doc, '13.1 This Agreement is governed by and construed in accordance with the laws of the Republic of South Africa.', y);
  y = writeBody(doc, '13.2 The Parties consent to the exclusive jurisdiction of the High Court of South Africa, Limpopo Division, sitting in Polokwane, in respect of any dispute arising out of or relating to this Agreement.', y);
  y = writeBody(doc, '13.3 The Parties shall use reasonable endeavours to resolve any dispute through good-faith negotiation before commencing legal proceedings. Either Party may, by written notice, require a senior representatives\' meeting within 10 (ten) Business Days.', y);
  y = writeBody(doc, '13.4 If negotiation fails to resolve the dispute within 20 (twenty) Business Days of the notice referred to in Clause 13.3, either Party may proceed to litigation.', y);
  y = writeBody(doc, '13.5 Nothing in this Clause prevents either Party from approaching a court for urgent interim relief.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 14 | NOTICES AND FORMAL COMMUNICATION', y);
  y = writeBody(doc, '14.1 All formal notices, instructions, approvals, and communications under this Agreement must be in writing and sent to the following designated addresses:', y);
  y += 1;

  // 2-col table
  const colW = (CONTENT_W - 4) / 2;
  const col1X = ML;
  const col2X = ML + colW + 4;
  doc.setFillColor(NAVY);
  doc.rect(col1X, y, colW, 6, 'F');
  doc.rect(col2X, y, colW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor('#FFFFFF');
  doc.text('FOR MARKETING iO', col1X + 2, y + 4);
  doc.text('FOR THE CLIENT',    col2X + 2, y + 4);
  y += 8;

  setBody(doc, 9);
  const mioRows = [
    'Marketing iO (Pty) Ltd',
    'Polokwane, Limpopo',
    `Email: ${MIO_DETAILS.info_email}`,
    'Attention: The Director',
  ];
  const cliRows = [
    `Trading Name: ${ctx.client.business_name || ''}`,
    `Address: ${ctx.client.address || ''}`,
    `Email: ${ctx.client.email || ''}`,
    `Attention: ${ctx.client.contact_person || ''}`,
  ];
  const maxRows = Math.max(mioRows.length, cliRows.length);
  for (let i = 0; i < maxRows; i++) {
    const m = mioRows[i] || '';
    const c = cliRows[i] || '';
    const mLines = doc.splitTextToSize(m, colW - 4);
    const cLines = doc.splitTextToSize(c, colW - 4);
    doc.text(mLines, col1X + 2, y);
    doc.text(cLines, col2X + 2, y);
    y += Math.max(mLines.length, cLines.length) * 4 + 1;
  }
  y += 2;

  y = writeBody(doc, '14.2 Notices are deemed received upon successful transmission if sent by email during a Business Day, or on the next Business Day if sent outside business hours.', y);
  y = writeBody(doc, '14.3 Each Party shall designate a primary point of contact and notify the other Party of any change in writing.', y);
  y = writeBody(doc, '14.4 Informal communications via WhatsApp, SMS, voice call, or social media are not binding and do not constitute formal notice for the purposes of this Agreement.', y);
}

// ── PAGE 10: CLAUSES 15, 16 ─────────────────────────────────────────────────

function pageClauses1516(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 15 | GENERAL PROVISIONS', TOP);
  const items: Array<[string, string]> = [
    ['15.1 Entire Agreement.',     'This Agreement, together with Schedule A and the POPIA Operator Agreement, constitutes the entire agreement between the Parties and supersedes all prior negotiations, representations, and understandings, whether written or oral.'],
    ['15.2 Severability.',         'If any provision of this Agreement is held to be invalid, unlawful, or unenforceable, the remaining provisions shall continue in full force and effect.'],
    ['15.3 No Waiver.',            'No failure or delay by either Party in exercising any right under this Agreement shall operate as a waiver of that right.'],
    ['15.4 Assignment.',           'Neither Party may assign, cede, or transfer its rights or obligations under this Agreement without the prior written consent of the other Party, save that Marketing iO may assign to a successor entity following a reorganisation.'],
    ['15.5 Relationship.',         'Nothing in this Agreement shall create a partnership, joint venture, agency, or employment relationship between the Parties.'],
    ['15.6 Third-Party Beneficiaries.', 'This Agreement is binding only on the Parties and their permitted successors and assigns. No third party shall have any right of action under or in connection with this Agreement.'],
    ['15.7 Amendment.',            'No amendment to this Agreement shall be valid unless reduced to writing and signed by both Parties.'],
    ['15.8 Counterparts.',         'This Agreement may be executed in counterparts, including electronically, and all counterparts together shall constitute one and the same instrument.'],
    ['15.9 Force Majeure.',        'Neither Party shall be liable for failure or delay in performance caused by events beyond its reasonable control, including without limitation acts of God, natural disasters, civil unrest, war, government action, pandemics, load-shedding of exceptional duration, or major internet/telecommunications failures.'],
  ];
  for (const [label, text] of items) {
    setBold(doc, 9.5);
    doc.text(label, ML, y);
    setBody(doc, 9.5);
    const lines = doc.splitTextToSize(' ' + text, CONTENT_W - doc.getTextWidth(label));
    doc.text(lines, ML + doc.getTextWidth(label), y);
    y += lines.length * 4 + 1.5;
  }
  y += 3;
  y = writeClauseHeader(doc, 'CLAUSE 16 | EXECUTION', y);
  y = writeBody(doc, 'This Agreement is executed by the Parties on the dates indicated on the signature pages at the end of this document. Each Party warrants that the person signing on its behalf is duly authorised to do so. The Parties intend that this Agreement may be signed and exchanged electronically and that electronic signatures (including via Documenso, OpenSign, or comparable e-signature platforms) shall be valid and binding in terms of the Electronic Communications and Transactions Act, 2002.', y);
}

// ── PAGE 11: CLAUSES 17, 18, 19 ─────────────────────────────────────────────

function pageClauses171819(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 17 | CHANGE REQUESTS AND OUT-OF-SCOPE WORK', TOP);
  y = writeBody(doc, '17.1 Any request from the Client for work, deliverables, or services falling outside the scope of Schedule A shall constitute a Change Request.', y);
  y = writeBody(doc, '17.2 All Change Requests must be submitted in writing via the designated channel in Clause 14.', y);
  y = writeBody(doc, '17.3 Marketing iO shall provide a written quotation, revised timeline, and impact assessment within 5 (five) Business Days of receiving a Change Request.', y);
  y = writeBody(doc, '17.4 No additional work shall commence until the Client has signed a Change Order accepting the revised fees, scope, and timeline.', y);
  y = writeBody(doc, '17.5 Out-of-scope work performed at the Client\'s verbal request without a signed Change Order shall nevertheless be billable at Marketing iO\'s then-prevailing rates.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 18 | THIRD-PARTY PLATFORMS AND SERVICES', y);
  y = writeBody(doc, '18.1 The Services may involve the use of third-party platforms, including but not limited to Google, Meta, TikTok, LinkedIn, X, YouTube, Mailchimp, Resend, Supabase, Cloudflare, and payment providers.', y);
  y = writeBody(doc, '18.2 Marketing iO shall not be liable for any outage, suspension, account ban, policy change, algorithm change, pricing change, terms-of-service change, or service interruption caused by any third-party platform.', y);
  y = writeBody(doc, '18.3 The Client shall comply with the terms and policies of all relevant third-party platforms used in the delivery of the Services.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 19 | ADVERTISING, MEDIA SPEND, AND PLATFORM OWNERSHIP', y);
  y = writeBody(doc, '19.1 All advertising spend, media budgets, platform fees, and licensing fees shall remain for the Client\'s account and shall be funded directly by the Client unless otherwise agreed in writing.', y);
  y = writeBody(doc, '19.2 Marketing iO provides no warranty or guarantee in respect of advertising performance, reach, engagement, conversions, or return on advertising spend.', y);

  y = writeCallout(doc, 'PLATFORM ACCOUNT OWNERSHIP.',
    '19.3 Wherever practicable, advertising and platform accounts (including Google Ads, Meta Business Manager, Google Analytics, Google Search Console, and similar) shall be created in and remain the property of the Client, with Marketing iO granted administrator or manager-level access for the duration of the Services. Upon termination, the Client\'s account ownership and access shall be unaffected, and Marketing iO\'s access shall be revoked.',
    y);

  y = writeBody(doc, '19.4 Where, for technical or operational reasons, an account must be created under Marketing iO\'s ownership, the Parties shall agree in writing on transfer arrangements upon termination, subject to the technical limitations of the relevant platform.', y);
}

// ── PAGE 12: CLAUSES 20–24 ──────────────────────────────────────────────────

function pageClauses2024(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 20 | WEBSITES, HOSTING, EMAIL, AND DATA SERVICES', TOP);
  y = writeBody(doc, '20.1 Where Marketing iO provides hosting, domain registration, email services, or data infrastructure as part of the Services, such services remain subject to the ongoing payment of the Monthly Retainer.', y);
  y = writeBody(doc, '20.2 Non-payment may result in suspension of hosting, email, or domain services in accordance with Clause 4.5.', y);
  y = writeBody(doc, '20.3 Migration of websites, domains, or email infrastructure to a third-party provider following termination may be charged as a separate professional service, subject to a written quotation.', y);
  y += 2;

  y = writeClauseHeader(doc, 'CLAUSE 21 | CONTENT APPROVAL AND PUBLISHING AUTHORITY', y);
  y = writeBody(doc, '21.1 All content prepared by Marketing iO shall be submitted to the Client for review and approval.', y);
  y = writeBody(doc, '21.2 Approved content (including content deemed accepted under Clause 6.4) is authorised for publication, distribution, and use by Marketing iO in the agreed channels.', y);
  y = writeBody(doc, '21.3 The Client warrants that any third-party content, image, trademark, or material supplied by the Client to Marketing iO is properly licensed or owned by the Client, and indemnifies Marketing iO against any claim arising from the use of such Client-supplied material.', y);
  y += 2;

  y = writeClauseHeader(doc, 'CLAUSE 22 | AI TOOLS, AUTOMATION, AND EMERGING TECHNOLOGIES', y);
  y = writeBody(doc, '22.1 The Client acknowledges and consents to Marketing iO\'s use of artificial intelligence tools, large language models, generative imaging tools, automation platforms, and similar emerging technologies in the delivery of the Services.', y);
  y = writeBody(doc, '22.2 Marketing iO shall apply reasonable quality control over all AI-generated output before delivery, but final approval remains the responsibility of the Client.', y);
  y = writeBody(doc, '22.3 The Client shall not input Confidential Information into any AI tool without first confirming with Marketing iO that the relevant tool meets the data protection requirements of this Agreement.', y);
  y += 2;

  y = writeClauseHeader(doc, 'CLAUSE 23 | LOGIN CREDENTIALS AND ACCOUNT SECURITY', y);
  y = writeBody(doc, '23.1 The Client is responsible for the secure custody of all login credentials, passwords, multi-factor authentication devices, and recovery codes for accounts owned by the Client.', y);
  y = writeBody(doc, '23.2 Marketing iO shall not be liable for any loss arising from unauthorised access to Client-owned accounts where such access was caused by the Client\'s failure to maintain reasonable security practices.', y);
  y = writeBody(doc, '23.3 Where Marketing iO is granted access to Client accounts, Marketing iO shall implement reasonable internal controls to safeguard such access.', y);
  y += 2;

  y = writeClauseHeader(doc, 'CLAUSE 24 | DATA RETENTION AND BACKUPS', y);
  y = writeBody(doc, '24.1 Marketing iO may maintain operational backups of Client data and Deliverables for the purpose of providing the Services.', y);
  y = writeBody(doc, '24.2 Backups are maintained for operational and disaster-recovery purposes only and do not constitute a long-term archival service.', y);
  y = writeBody(doc, '24.3 Long-term retention of Client data, source files, or backups beyond the 30-day post-termination window in Clause 11.5 is not guaranteed and shall not be relied upon by the Client.', y);
}

// ── PAGE 13: CLAUSES 25–27 + END MARKER ─────────────────────────────────────

function pageClauses2527(doc: any) {
  let y = writeClauseHeader(doc, 'CLAUSE 25 | TESTIMONIALS AND CLIENT FEEDBACK', TOP);
  y = writeBody(doc, '25.1 Marketing iO may publish, reproduce, and reference any testimonial, review, or positive feedback voluntarily provided by the Client, for marketing and portfolio purposes.', y);
  y = writeBody(doc, '25.2 The Client may withdraw consent to the use of a specific testimonial by written notice, in which case Marketing iO shall remove the testimonial from its active marketing channels within 20 (twenty) Business Days.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 26 | RESPONSE TIMES AND SUPPORT', y);
  y = writeBody(doc, '26.1 Marketing iO\'s standard support hours are 08:00–17:00, Monday to Friday (excluding South African public holidays).', y);
  y = writeBody(doc, '26.2 Response time targets stated in this Agreement or in Schedule A are service goals and not guaranteed service levels, save where expressly stated to be a binding service level.', y);
  y = writeBody(doc, '26.3 Urgent or after-hours support, where available, may be billed at premium rates.', y);
  y += 3;

  y = writeClauseHeader(doc, 'CLAUSE 27 | SURVIVAL', y);
  y = writeBody(doc, '27.1 The following provisions shall survive termination or expiry of this Agreement to the extent necessary to give effect to their purpose: Clauses 4 (Fees due), 7 (IP), 8 (Confidentiality), 9 (Warranties and Disclaimers), 10 (Limitation of Liability), 11.5–11.7 (Post-termination handling), 12 (Special Clauses), 13 (Dispute Resolution), 14 (Notices), 17 (Change Orders), 22 (AI), 24 (Data Retention), and 27 (Survival).', y);
  y += 12;

  setBold(doc, 11);
  doc.setTextColor(NAVY);
  doc.text('END OF MAIN AGREEMENT BODY', PAGE_W / 2, y, { align: 'center' });
  y += 5;
  setMuted(doc, 9);
  doc.text('Schedule A, the POPIA Operator Agreement, and the Execution Pages follow.', PAGE_W / 2, y, { align: 'center' });
}

// ── PAGE 14: SCHEDULE A — SERVICE SPEC TABLE ────────────────────────────────

function pageScheduleATable(doc: any, ctx: MsaContext) {
  let y = TOP;
  setBold(doc, 16);
  doc.text('Schedule A', ML, y);
  y += 6;
  setBold(doc, 11);
  doc.setTextColor(RED);
  doc.text('SERVICE SPECIFICATION', ML, y);
  y += 5;
  y = writeBody(doc, 'This Schedule A forms part of the Master Service Agreement between Marketing iO and the Client and specifies the Services, fees, timelines, and inclusions/exclusions applicable to the engagement.', y);
  y += 3;

  // Two-col table
  const labelW = 70;
  const detailX = ML + labelW + 4;
  doc.setFillColor(NAVY);
  doc.rect(ML, y, CONTENT_W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor('#FFFFFF');
  doc.text('FIELD',  ML + 2,    y + 4);
  doc.text('DETAIL', detailX,   y + 4);
  y += 7;

  const billingDate = String(ctx.contract.debit_order_date || '').trim();
  const billingLine = billingDate === '1st'
    ? '[X] 1st of each month       [ ] 15th of each month'
    : billingDate === '15th'
      ? '[ ] 1st of each month       [X] 15th of each month'
      : '[ ] 1st of each month       [ ] 15th of each month';

  const rows: Array<[string, string]> = [
    ['Contract Reference',           contractRef(ctx.contract.id)],
    ['Client Trading Name',          String(ctx.client.business_name || '')],
    ['Effective Date',               effectiveDate(ctx.contract)],
    ['Selected Package',             packageLabel(ctx)],
    ['Setup Fee',                    `R ${fmtZar(ctx.contract.setup_fee)} (excl. VAT)`],
    ['Monthly Retainer',             `R ${fmtZar(ctx.contract.monthly_retainer)} (excl. VAT)`],
    ['Initial Term',                 '12 (twelve) months'],
    ['Billing Date',                 billingLine],
    ['Payment Method',               '[ ] EFT       [ ] Debit Order       [ ] Other: _______________'],
    ['Soft SLA (Standard Response)', '5 (five) Business Days'],
    ['Hard SLA (Maximum Response)',  '10 (ten) Business Days'],
    ['Primary Client Contact',       String(ctx.client.contact_person || '')],
    ['Marketing iO Account Manager', String(ctx.account_manager || '')],
  ];
  setBody(doc, 9);
  for (const [label, val] of rows) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(NAVY);
    doc.text(label, ML + 2, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(DARK_GREY);
    const valLines = doc.splitTextToSize(val, CONTENT_W - labelW - 8);
    doc.text(valLines, detailX, y + 4);
    const rowH = Math.max(7, valLines.length * 4 + 2);
    y += rowH;
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.2);
    doc.line(ML, y, CONTENT_R, y);
  }
  y += 6;
  setBold(doc, 11);
  doc.text('Included Deliverables', ML, y);
}

// ── PAGE 15: SCHEDULE A — DELIVERABLES + SCOPE EXCLUSIONS ───────────────────

function pageScheduleADeliverables(doc: any, ctx: MsaContext) {
  let y = TOP;
  setMuted(doc, 9);
  const intro = doc.splitTextToSize(
    '(To be completed at signing — list of all Deliverables, channels, deliverable frequency, revision limits, and any package-specific terms as per the selected Package)',
    CONTENT_W);
  doc.text(intro, ML, y);
  y += intro.length * 4 + 4;

  setBody(doc, 9.5);
  const deliverables = ctx.deliverables || [];
  for (let i = 0; i < 7; i++) {
    const num = i + 1;
    const item = deliverables[i] || '';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(NAVY);
    doc.text(`${num}.`, ML, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(DARK_GREY);
    if (item) {
      const lines = doc.splitTextToSize(item, CONTENT_W - 8);
      doc.text(lines, ML + 6, y);
      y += Math.max(6, lines.length * 4 + 2);
    } else {
      doc.setDrawColor(BORDER);
      doc.line(ML + 6, y + 1, CONTENT_R, y + 1);
      y += 6;
    }
  }
  y += 4;

  setBold(doc, 12);
  doc.text('Scope Exclusions', ML, y);
  y += 5;
  y = writeBody(doc, 'The following are excluded from the Services unless expressly included in writing as a Change Order:', y);
  y += 1;
  const exclusions = [
    'Services outside the agreed package scope as listed under Included Deliverables;',
    'Additional revisions beyond the package revision limit;',
    'Third-party fees (advertising spend, software licences, stock media, platform fees);',
    'Custom development, integrations, or bespoke software work;',
    'Work performed outside standard business hours (Monday–Friday, 08:00–17:00);',
    'Delays caused by the Client\'s failure to provide feedback, content, or access;',
    'Changes to the Client\'s platforms, systems, or branding outside Marketing iO\'s control;',
    'Crisis communications, reputation management, or legal disputes.',
  ];
  setBody(doc, 9.5);
  for (const e of exclusions) {
    doc.setTextColor(RED);
    doc.text('×', ML, y);
    doc.setTextColor(DARK_GREY);
    const lines = doc.splitTextToSize(e, CONTENT_W - 8);
    doc.text(lines, ML + 6, y);
    y += Math.max(4.5, lines.length * 4) + 0.5;
  }
}

// ── PAGE 16: POPIA PART 1 ───────────────────────────────────────────────────

function pagePopia1(doc: any) {
  let y = TOP;
  setBold(doc, 16);
  doc.text('POPIA Operator Agreement', ML, y);
  y += 6;
  setBold(doc, 11);
  doc.setTextColor(RED);
  doc.text('DATA PROCESSING ADDENDUM', ML, y);
  y += 5;
  y = writeBody(doc, 'This POPIA Operator Agreement forms an integral part of the Master Service Agreement and governs the processing of Personal Information by Marketing iO on behalf of the Client.', y);
  y += 2;

  const items: Array<[string, string]> = [
    ['1. Appointment as Operator',
     'Marketing iO is appointed as an Operator (data processor) under the Protection of Personal Information Act 4 of 2013 ("POPIA"). Marketing iO shall process Personal Information provided by the Client only for the purpose of delivering the Services and in accordance with the Client\'s documented instructions, save where required by law.'],
    ['2. Scope of Processing',
     'Personal Information processed under this Agreement may include: names, email addresses, telephone numbers, demographic information, website analytics data, social media engagement data, transactional data, and other information provided by the Client or collected on the Client\'s behalf in the course of delivering the Services. Processing is strictly limited to delivering the Services described in Schedule A.'],
    ['3. Sub-Operators',
     'The Client acknowledges and consents to Marketing iO\'s use of the following sub-operators in delivering the Services: Supabase (data hosting, EU-Ireland region), Yoco (payment processing), Resend (transactional email delivery), Cloudflare (content delivery and security), Google Workspace (email infrastructure), and other reputable third-party service providers as may be required. Marketing iO shall ensure each sub-operator is bound by data protection obligations no less stringent than those in this Agreement.'],
    ['4. Security Measures',
     'Marketing iO shall implement appropriate, reasonable technical and organisational security measures, including encryption in transit, access controls, multi-factor authentication for administrator access, periodic security reviews, and staff confidentiality undertakings, to protect Personal Information against unauthorised access, loss, destruction, or unlawful processing.'],
    ['5. Data Subject Rights',
     'The Client remains the Responsible Party and shall be responsible for responding to data subject requests for access, correction, deletion, objection, or restriction of processing. Marketing iO shall provide reasonable assistance to the Client in fulfilling such requests where Marketing iO holds the relevant data.'],
    ['6. Breach Notification',
     'In the event of a confirmed or reasonably suspected compromise of Personal Information, Marketing iO shall notify the Client without undue delay and in any event within 72 (seventy-two) hours of becoming aware of the incident, providing such information as is reasonably available. The Client, as Responsible Party, shall determine whether to notify the Information Regulator and affected data subjects in terms of section 22 of POPIA.'],
  ];
  for (const [h, b] of items) {
    setBold(doc, 10);
    doc.text(h, ML, y);
    y += 4.5;
    y = writeBody(doc, b, y);
    y += 1.5;
  }
}

// ── PAGE 17: POPIA PART 2 ───────────────────────────────────────────────────

function pagePopia2(doc: any) {
  let y = TOP;
  const items: Array<[string, string]> = [
    ['7. Cross-Border Transfers',
     'Where Personal Information is transferred outside the Republic of South Africa (including for hosting purposes), Marketing iO shall ensure that the recipient is subject to a law, binding corporate rules, or binding agreement that provides an adequate level of protection consistent with POPIA.'],
    ['8. Data Return and Deletion',
     'Upon termination of the Master Service Agreement, Marketing iO shall, at the Client\'s written election, either return all Personal Information to the Client in a structured, commonly-used electronic format, or securely delete or anonymise it, within 30 (thirty) days, unless retention is required by law or legitimate record-keeping purposes.'],
    ['9. Records',
     'Marketing iO shall maintain reasonable records of its processing activities as Operator and shall make such records available to the Client on reasonable written request, subject to confidentiality undertakings.'],
  ];
  for (const [h, b] of items) {
    setBold(doc, 10);
    doc.text(h, ML, y);
    y += 4.5;
    y = writeBody(doc, b, y);
    y += 2;
  }
}

// ── PAGE 18: EXECUTION PART 1 ───────────────────────────────────────────────

function signatureBox(doc: any, x: number, y: number, w: number, label: string, value: string, opts: { multi?: boolean; italic?: boolean } = {}): number {
  setMuted(doc, 7.5);
  doc.text(label, x, y);
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.3);
  const lineY = y + 5.5;
  doc.line(x, lineY, x + w, lineY);
  if (value) {
    setBody(doc, 10);
    if (opts.italic) doc.setFont('helvetica', 'italic');
    doc.setTextColor(NAVY);
    doc.text(value, x + 1, y + 4);
  }
  return lineY + 4;
}

function pageExecution1(doc: any, ctx: MsaContext) {
  let y = TOP;
  setBold(doc, 16);
  doc.text('Execution of Agreement', ML, y);
  y += 6;
  y = writeBody(doc, 'IN WITNESS WHEREOF the Parties have caused this Agreement to be executed by their duly authorised representatives. By signing below, each Party confirms that it has read, understood, and accepts all terms of this Master Service Agreement, Schedule A, and the POPIA Operator Agreement, and that it intends to be legally bound by them.', y);
  y += 2;

  // Acknowledgement checklist box
  doc.setDrawColor(NAVY);
  doc.setLineWidth(0.4);
  const checklistY = y;
  doc.rect(ML, checklistY, CONTENT_W, 32);
  setBold(doc, 9.5);
  doc.text('PRE-SIGNATURE ACKNOWLEDGEMENT CHECKLIST', ML + 3, checklistY + 5);
  setBody(doc, 9);
  const items = [
    'I have read and understood the Master Service Agreement (Clauses 1–27).',
    'I have reviewed and agree to Schedule A — Service Specification.',
    'I have reviewed and agree to the POPIA Operator Agreement.',
    'I confirm I have authority to bind the entity I represent.',
    'I have initialled each page of this Agreement.',
  ];
  let cy = checklistY + 10;
  for (const it of items) {
    doc.text(`[ ]  ${it}`, ML + 3, cy);
    cy += 4.5;
  }
  y = checklistY + 34;

  setBold(doc, 10);
  doc.setTextColor(RED);
  doc.text('↓ PLEASE COMPLETE AND SIGN BELOW ↓', PAGE_W / 2, y, { align: 'center' });
  y += 5;

  // MIO signature block
  doc.setFillColor(NAVY);
  doc.rect(ML, y, CONTENT_W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');
  doc.text('SIGNED FOR AND ON BEHALF OF MARKETING iO (PTY) LTD', ML + 3, y + 4);
  y += 9;
  const sigSignedByMio = ctx.contract.signed_by_mio === true;
  y = signatureBox(doc, ML, y, CONTENT_W, 'Full Name', MIO_DETAILS.full_name);
  y = signatureBox(doc, ML, y, CONTENT_W, 'Capacity', MIO_DETAILS.capacity);
  y = signatureBox(doc, ML, y, CONTENT_W, 'Email Address', MIO_DETAILS.email);
  // Signature line: real PNG when we have it AND signed; typed notation
  // as a fallback when the asset isn't wired yet but the contract is signed;
  // blank line when not yet signed.
  setMuted(doc, 7.5);
  doc.text('Signature', ML, y);
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.3);
  const sigLineY = y + DIRECTOR_SIGNATURE_HEIGHT_MM + 2;
  doc.line(ML, sigLineY, ML + CONTENT_W, sigLineY);
  if (sigSignedByMio && DIRECTOR_SIGNATURE_DATA_URL) {
    try {
      doc.addImage(
        DIRECTOR_SIGNATURE_DATA_URL,
        'PNG',
        ML + 1,
        y + 1,
        DIRECTOR_SIGNATURE_WIDTH_MM,
        DIRECTOR_SIGNATURE_HEIGHT_MM,
      );
    } catch {
      // If image embedding fails (corrupt base64), gracefully fall through
      // to the typed notation so the page still renders.
      setBody(doc, 10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(NAVY);
      doc.text(`/s/ ${MIO_DETAILS.full_name}`, ML + 1, y + 7);
    }
  } else if (sigSignedByMio) {
    setBody(doc, 10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(NAVY);
    doc.text(`/s/ ${MIO_DETAILS.full_name}`, ML + 1, y + 7);
  }
  y = sigLineY + 4;
  setMuted(doc, 7);
  doc.text('(e-signature)', ML, y);
  y += 4;
  y = signatureBox(doc, ML, y, CONTENT_W, 'Date Signed',
    sigSignedByMio ? fmtDate(ctx.contract.marketing_io_signed_at || ctx.contract.signed_date) : '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'Place of Signing',
    sigSignedByMio ? 'Polokwane, Limpopo' : '');
  y += 4;

  // Client signature block — top half (full name, capacity, ID, email)
  doc.setFillColor(RED);
  doc.rect(ML, y, CONTENT_W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');
  doc.text('SIGNED FOR AND ON BEHALF OF THE CLIENT', ML + 3, y + 4);
  y += 9;
  const signer = ctx.signer || {};
  y = signatureBox(doc, ML, y, CONTENT_W, 'Full Name',         signer.full_name || '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'Capacity / Position', signer.capacity || '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'ID Number',         signer.id_number || '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'Email Address',     signer.email || '');
}

// ── PAGE 19: EXECUTION PART 2 (Client signature image + date + place) ──────

function pageExecution2(doc: any, ctx: MsaContext) {
  let y = TOP;
  const signer = ctx.signer || {};
  // Signature box
  setMuted(doc, 7.5);
  doc.text('Signature', ML, y);
  doc.setDrawColor(BORDER);
  doc.rect(ML, y + 2, CONTENT_W, 30);

  if (signer.signature_method === 'drawn' && signer.signature_data_url) {
    // Drawn signature: embed as image, fall through to blank on render failure.
    try {
      doc.addImage(signer.signature_data_url, 'PNG', ML + 3, y + 4, 80, 26);
    } catch {
      // ignore — leave blank
    }
  } else if (
    (signer.signature_method === 'typed' || (!signer.signature_method && signer.typed_signature)) &&
    signer.typed_signature
  ) {
    // Typed signature: render in cursive italic at 22pt, navy text.
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(22);
    doc.setTextColor(NAVY);
    doc.text(String(signer.typed_signature), ML + 5, y + 22);
  } else if (signer.signature_data_url) {
    // Legacy fallback (PR #122 pre-method shape) — image without explicit method.
    try {
      doc.addImage(signer.signature_data_url, 'PNG', ML + 3, y + 4, 80, 26);
    } catch {
      // ignore — leave blank
    }
  }

  setMuted(doc, 7);
  doc.text('(e-signature)', ML, y + 35);
  y += 40;

  y = signatureBox(doc, ML, y, CONTENT_W, 'Date Signed', signer.signed_at ? fmtDate(signer.signed_at) : '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'Place of Signing', signer.place || '');
}

// ── PAGE 20: WITNESSES + AUDIT TRAIL ────────────────────────────────────────

function pageWitnesses(doc: any, ctx: MsaContext) {
  let y = TOP;
  setBold(doc, 16);
  doc.text('Witnesses', ML, y);
  y += 6;
  y = writeBody(doc, 'The undersigned witnesses confirm having observed the Parties (or their authorised representatives) sign this Agreement.', y);
  y += 2;

  // Witness 1
  doc.setFillColor(NAVY);
  doc.rect(ML, y, CONTENT_W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');
  doc.text('WITNESS 1 — ON BEHALF OF MARKETING iO', ML + 3, y + 4);
  y += 9;
  y = signatureBox(doc, ML, y, CONTENT_W, 'Full Name',  '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'ID Number',  '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'Signature',  '', { italic: true });
  setMuted(doc, 7);
  doc.text('(e-signature)', ML, y);
  y += 4;
  y = signatureBox(doc, ML, y, CONTENT_W, 'Date Signed', '');
  y += 5;

  // Witness 2
  doc.setFillColor(RED);
  doc.rect(ML, y, CONTENT_W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#FFFFFF');
  doc.text('WITNESS 2 — ON BEHALF OF THE CLIENT', ML + 3, y + 4);
  y += 9;
  y = signatureBox(doc, ML, y, CONTENT_W, 'Full Name',  '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'ID Number',  '');
  y = signatureBox(doc, ML, y, CONTENT_W, 'Signature',  '', { italic: true });
  setMuted(doc, 7);
  doc.text('(e-signature)', ML, y);
  y += 4;
  y = signatureBox(doc, ML, y, CONTENT_W, 'Date Signed', '');
  y += 6;

  // E-Signature Audit Trail — PR #125
  // When ctx.signer has audit fields populated (finalize-signed-contract has
  // run after the client signed), render a real audit table. Otherwise keep
  // the legacy explainer + red placeholder so unsigned previews look correct.
  const signer = ctx.signer || {};
  const hasAudit = Boolean(
    signer.signed_ip_address || signer.signed_at || signer.document_hash,
  );

  doc.setDrawColor(NAVY);
  doc.setLineWidth(0.5);
  const auditY = y;
  const auditH = hasAudit ? 50 : 30;
  doc.rect(ML, auditY, CONTENT_W, auditH);
  setBold(doc, 9.5);
  doc.text('E-SIGNATURE AUDIT TRAIL', ML + 3, auditY + 5);
  setBody(doc, 8.5);
  const trail = doc.splitTextToSize(
    'Where this Agreement is signed via an electronic signature platform (Documenso, OpenSign, DocuSign, or comparable), the platform-generated audit trail — including signer identity verification, IP address, timestamp, geolocation (where available), and document hash — shall form part of the executed Agreement and shall be admissible as evidence of execution in terms of the Electronic Communications and Transactions Act, 2002.',
    CONTENT_W - 6);
  doc.text(trail, ML + 3, auditY + 9);

  if (hasAudit) {
    let ay = auditY + 22;
    const rows: Array<[string, string]> = [
      ['Signer',           `${signer.full_name || ''} <${signer.email || ''}>`],
      ['Capacity',         signer.capacity || ''],
      ['Signature method', signer.signature_method || ''],
      ['Timestamp (UTC)',  signer.signed_at || ''],
      ['IP address',       signer.signed_ip_address || 'unknown'],
      ['User agent',       String(signer.signed_user_agent || '').slice(0, 80)],
      ['Document hash',    signer.document_hash || ''],
    ];
    setBody(doc, 7);
    for (const [label, val] of rows) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(NAVY);
      doc.text(`${label}:`, ML + 3, ay);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(DARK_GREY);
      doc.text(String(val), ML + 35, ay);
      ay += 3.5;
    }
  } else {
    setMuted(doc, 8);
    doc.setTextColor(RED);
    doc.text('[Will be populated upon e-signature]', ML + 3, auditY + auditH - 2);
  }
}

// ── PAGE 21: BLANK SPACER (chrome only) ─────────────────────────────────────

function pageBlankSpacer(_doc: any) {
  // intentionally empty body — chrome is drawn by the post-pass.
}

// ── PAGE 22: WELCOME (no chrome) ────────────────────────────────────────────

function pageWelcome(doc: any) {
  setBold(doc, 11);
  doc.setTextColor(NAVY);
  doc.text('WELCOME TO MARKETING iO', PAGE_W / 2, 80, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  doc.setTextColor(NAVY);
  doc.text("Let's make you", PAGE_W / 2, 120, { align: 'center' });
  doc.text('impossible to miss.', PAGE_W / 2, 138, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(RED);
  doc.text('"Too Good To Stay Hidden"', PAGE_W / 2, 155, { align: 'center' });

  setMuted(doc, 9);
  doc.text('Marketing iO (Pty) Ltd', PAGE_W / 2, 220, { align: 'center' });
  doc.text(`CIPC Registration: ${MIO_DETAILS.reg_number}`, PAGE_W / 2, 225, { align: 'center' });
  doc.text('Polokwane | Limpopo | South Africa', PAGE_W / 2, 235, { align: 'center' });
  doc.text(MIO_DETAILS.website, PAGE_W / 2, 240, { align: 'center' });
  doc.text(MIO_DETAILS.info_email, PAGE_W / 2, 245, { align: 'center' });
}

// ── MAIN GENERATOR ──────────────────────────────────────────────────────────

function generateMsaPdf(
  contract: MsaContract,
  client: MsaClient,
  signer?: MsaSigner | null,
  options: { deliverables?: string[]; account_manager?: string | null } = {},
): Uint8Array {
  const ctx: MsaContext = {
    contract,
    client,
    signer: signer || null,
    deliverables: options.deliverables || [],
    account_manager: options.account_manager || null,
  };

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  pageCover(doc, ctx);
  doc.addPage();
  pageParties(doc, ctx);
  doc.addPage();
  pageClause1(doc);
  doc.addPage();
  pageClauses234(doc);
  doc.addPage();
  pageClauses56(doc);
  doc.addPage();
  pageClauses789(doc);
  doc.addPage();
  pageClauses1011(doc);
  doc.addPage();
  pageClause12(doc);
  doc.addPage();
  pageClauses1314(doc, ctx);
  doc.addPage();
  pageClauses1516(doc);
  doc.addPage();
  pageClauses171819(doc);
  doc.addPage();
  pageClauses2024(doc);
  doc.addPage();
  pageClauses2527(doc);
  doc.addPage();
  pageScheduleATable(doc, ctx);
  doc.addPage();
  pageScheduleADeliverables(doc, ctx);
  doc.addPage();
  pagePopia1(doc);
  doc.addPage();
  pagePopia2(doc);
  doc.addPage();
  pageExecution1(doc, ctx);
  doc.addPage();
  pageExecution2(doc, ctx);
  doc.addPage();
  pageWitnesses(doc, ctx);
  doc.addPage();
  pageBlankSpacer(doc);
  doc.addPage();
  pageWelcome(doc);

  // Apply chrome to pages 2-21 (skip cover and welcome).
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total - 1; i++) {
    doc.setPage(i);
    drawChrome(doc, i);
  }

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}
