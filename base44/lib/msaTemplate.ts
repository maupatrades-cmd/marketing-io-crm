// =============================================================================
// msaTemplate.ts — Marketing iO Master Service Agreement V3.0 generator.
//
// Reproduces the 22-page MSA Signing Edition in jspdf, with merge fields
// populated from Contract + Client + (optionally) Signer at render time.
//
// Page map (matches the source PDF):
//   1   Cover                          (no chrome footer)
//   2   Parties to the Agreement
//   3   Clause 1 — Definitions
//   4   Clauses 2-4 — Engagement / Term / Fees
//   5   Clauses 5-6 — Obligations / Delivery & SLA
//   6   Clauses 7-9 — IP / Confidentiality / Warranties
//   7   Clauses 10-11 — Liability / Termination
//   8   Clause 12 — Special Provisions (12-row table)
//   9   Clauses 13-14 — Dispute / Notices (2-col table)
//   10  Clauses 15-16 — General / Execution
//   11  Clauses 17-19 — Change / Platforms / Advertising
//   12  Clauses 20-24 — Hosting / Approval / AI / Logins / Backups
//   13  Clauses 25-27 — Testimonials / Support / Survival
//   14  Schedule A part 1 — Service spec table
//   15  Schedule A part 2 — Deliverables + scope exclusions
//   16  POPIA part 1 — Sections 1-6
//   17  POPIA part 2 — Sections 7-9
//   18  Execution part 1 — Checklist + MIO block + Client block top
//   19  Execution part 2 — Client signature image + date
//   20  Witnesses + Audit Trail
//   21  Blank (intentional spacer with chrome)
//   22  Welcome (no chrome footer)
//
// Chrome (top band + bottom footer + red ribbon + initials line) runs on
// pages 2-21. Cover (1) and Welcome (22) have no chrome — matches source.
//
// TODO: move MIO_DETAILS to SystemSettings entity in a future PR.
// =============================================================================

import { jsPDF } from 'npm:jspdf@4.0.0';
import {
  DIRECTOR_SIGNATURE_DATA_URL,
  DIRECTOR_SIGNATURE_WIDTH_MM,
  DIRECTOR_SIGNATURE_HEIGHT_MM,
} from './directorSignature.ts';

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
  // PR 2 — pre-printed on every page footer (chrome) and the Witness 1 block.
  // TODO: move to SystemSettings so future personnel changes don't require
  // a code deploy.
  initials:           'TNP',
  witness_full_name:  'Riana du Plessis — Co-Founder and CFO',
};

// Marketing iO director signature. Source-of-truth lives in
// ./directorSignature.ts (cherry-picked from PR #120). lib-to-lib imports
// work at the file-system level; functions consuming this template must
// still inline the constant per the Base44 no-cross-import constraint
// documented at the top of pdfGenerator.ts.
const MIO_SIGNATURE_PNG_DATA_URL = DIRECTOR_SIGNATURE_DATA_URL;


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

export interface MsaContract {
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

export interface MsaClient {
  business_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  id_reg_number?: string | null;
}

export interface MsaSigner {
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
  // PR 2 — client's initials (rendered on every page footer); optional client
  // witness name (rendered into page 20 Witness 2 block).
  initials?: string;
  witness_full_name?: string;
}

export interface MsaContext {
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

function drawChrome(doc: any, pageNum: number, ctx: MsaContext) {
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
  // PR 2 — fill the initials slots when the signer payload has them, else
  // keep the blank-line placeholder for the pre-signing / unsigned render.
  // Marketing iO's initials are always pre-printed (MIO_DETAILS.initials).
  const _signer = ctx.signer || {};
  const _clientInits = _signer.initials
    ? String(_signer.initials).toUpperCase()
    : '_______';
  doc.text(
    `Client Initials: ${_clientInits}  /  Marketing iO Initials: ${MIO_DETAILS.initials}`,
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
  if (sigSignedByMio && MIO_SIGNATURE_PNG_DATA_URL) {
    try {
      doc.addImage(
        MIO_SIGNATURE_PNG_DATA_URL,
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
    try {
      doc.addImage(signer.signature_data_url, 'PNG', ML + 3, y + 4, 80, 26);
    } catch {
      // ignore — leave blank
    }
  } else if (
    (signer.signature_method === 'typed' || (!signer.signature_method && signer.typed_signature)) &&
    signer.typed_signature
  ) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(22);
    doc.setTextColor(NAVY);
    doc.text(String(signer.typed_signature), ML + 5, y + 22);
  } else if (signer.signature_data_url) {
    // Legacy fallback (PR #122 pre-method shape).
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
  // PR 2 — pre-fill MIO witness name. ID / Signature / Date stay blank
  // fill-in lines for Riana to manually sign on a printed copy if needed.
  y = signatureBox(doc, ML, y, CONTENT_W, 'Full Name',  MIO_DETAILS.witness_full_name);
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
  // PR 2 — pre-fill client witness name from form. ID / Signature / Date
  // stay blank fill-in lines (locked decision Option A — name only).
  const _w2 = String((ctx.signer && ctx.signer.witness_full_name) || '').trim();
  y = signatureBox(doc, ML, y, CONTENT_W, 'Full Name',  _w2);
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

export function generateMsaPdf(
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
    drawChrome(doc, i, ctx);
  }

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}
