// =============================================================================
// pdfGenerator.ts — shared PDF module (Client Portal upgrade Decision 3).
//
// IMPORTANT — Base44 deployment constraint:
//   Each base44/functions/<name>/entry.ts is packaged as an isolated Deno
//   deployment. Functions CANNOT import from sibling paths like
//   base44/lib/. This file therefore acts as a source-of-truth reference;
//   each consumer inlines a copy of the helpers it needs.
//
// PR A adds:
//   - withBrandedLayout(doc, opts)  — navy/purple Marketing iO header + footer
//   - generateActivityPDF(doc, params)  — typed helper for activity audit
//
// PRs B and G extend with:
//   - generateInvoicePDF (PR B)
//   - generateStatementPDF (PR B)
//   - generateRoleActivityPDF (PR G)
//
// Library: jsPDF 4.0.0 (already used by generateSignedPDF and
// generate-campaign-report — Decision 3 says "wraps the existing PDF
// library, no new library introduced").
//
// Brand spec (locked in Master Index):
//   primary navy   #1A1A2E
//   accent purple  #6A4C93
//   footer pink    #E91E63
//   font:          Helvetica (jsPDF built-in)
// =============================================================================

// ---- Brand constants -------------------------------------------------------
export const BRAND = {
  navy:        '#1A1A2E',
  navyRgb:     [26,  26,  46]   as [number, number, number],
  purple:      '#6A4C93',
  purpleRgb:   [106, 76,  147]  as [number, number, number],
  pink:        '#E91E63',
  pinkRgb:     [233, 30,  99]   as [number, number, number],
  white:       '#FFFFFF',
  whiteRgb:    [255, 255, 255]  as [number, number, number],
  textGrey:    '#475569',
  textGreyRgb: [71,  85,  105]  as [number, number, number],
  bodyText:    '#1E293B',
  bodyTextRgb: [30,  41,  59]   as [number, number, number],
};

// ---- Branded layout ---------------------------------------------------------
//
// Stamps a navy header (with title + subtitle in white) and a footer band on
// the CURRENT page. Call this once per page just after addPage() (or right
// after creating the doc for page 1).
//
// Returns the y-coordinate from which body content should start.
//
// Usage (consumer-side, copy-pasted into the function):
//   import { jsPDF } from 'npm:jspdf@4.0.0';
//   const doc = new jsPDF('p', 'mm', 'a4');
//   const startY = withBrandedLayout(doc, {
//     title:    'Activity Audit Trail',
//     subtitle: 'Acme (Pty) Ltd · 1 Apr 2026 – 30 Apr 2026',
//     footerLine: 'Generated for Acme (Pty) Ltd on 7 May 2026. Confidential.',
//   });
//   // ... draw body starting at y=startY ...
// =============================================================================
export interface BrandedLayoutOptions {
  title:        string;
  subtitle?:    string;
  footerLine?:  string;
  pageNumber?:  number;
  totalPages?:  number;
}

export function withBrandedLayout(doc: any, opts: BrandedLayoutOptions): number {
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ---- Header band: navy with purple accent stripe -------------------------
  doc.setFillColor(...BRAND.navyRgb);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(...BRAND.purpleRgb);
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  doc.setTextColor(...BRAND.whiteRgb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MARKETING iO', 12, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  doc.text('Too good to stay hidden.', 12, 17);

  // Right-aligned title.
  doc.setTextColor(...BRAND.whiteRgb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(opts.title, pageWidth - 12, 13, { align: 'right' });

  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 220);
    doc.text(opts.subtitle, pageWidth - 12, 19, { align: 'right' });
  }

  // ---- Footer band: pink accent + faint footer text -----------------------
  doc.setFillColor(...BRAND.pinkRgb);
  doc.rect(0, pageHeight - 12, pageWidth, 1, 'F');

  doc.setTextColor(...BRAND.textGreyRgb);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (opts.footerLine) {
    doc.text(opts.footerLine, 12, pageHeight - 6);
  }
  if (opts.pageNumber) {
    const total = opts.totalPages ? `/${opts.totalPages}` : '';
    doc.text(`Page ${opts.pageNumber}${total}`, pageWidth - 12, pageHeight - 6, { align: 'right' });
  }

  // Body content starts below the header band + a small gap.
  return 38;
}

// =============================================================================
// generateActivityPDF — PR A
//
// Renders an activity audit trail PDF for a single client.
//
// Inputs:
//   doc         — jsPDF instance (caller creates so they can chunk pages)
//   params:
//     clientName, businessName, dateRangeLabel
//     entries: ClientActivityLog rows (oldest-first or newest-first; renderer
//              respects the order it receives)
//     viewerRole: 'client' | 'admin' | 'owner' — admin/owner sees actor + IP
//
// The function paginates automatically when content overflows.
// =============================================================================
export interface ActivityPDFParams {
  clientName:     string;
  businessName?:  string;
  dateRangeLabel: string;
  entries: Array<{
    created_date?:   string;
    event_summary?:  string;
    event_label?:    string;
    title?:          string;
    event_category?: string;
    event_type?:     string;
    actor_role?:     string;
    logged_by_name?: string;
    ip_address?:     string;
    user_agent?:     string;
  }>;
  viewerRole?: 'client' | 'admin' | 'owner';
}

export function generateActivityPDF(doc: any, p: ActivityPDFParams): void {
  const showActor = p.viewerRole === 'admin' || p.viewerRole === 'owner';
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Date().toLocaleString('en-ZA', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone:  'Africa/Johannesburg',
  });
  const footerLine =
    `Generated for ${p.businessName || p.clientName} on ${generatedAt}. Confidential.`;
  const subtitle = `${p.clientName} · ${p.dateRangeLabel}`;

  // ---- Cover page --------------------------------------------------------
  withBrandedLayout(doc, {
    title:      'Activity Audit Trail',
    subtitle,
    footerLine,
    pageNumber: 1,
  });

  doc.setTextColor(...BRAND.bodyTextRgb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(p.businessName || p.clientName, 12, 60);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.textGreyRgb);
  doc.text(`Date range: ${p.dateRangeLabel}`,        12, 70);
  doc.text(`Generated:  ${generatedAt}`,             12, 76);
  doc.text(`Total events: ${p.entries.length}`,      12, 82);
  doc.text('Activity Audit Trail v1.0',              12, 88);

  doc.setDrawColor(...BRAND.purpleRgb);
  doc.setLineWidth(0.4);
  doc.line(12, 95, pageWidth - 12, 95);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.bodyTextRgb);
  const blurb = showActor
    ? 'This document is a complete audit trail of every activity recorded for this client during the date range above. Includes actor information and security details (IP, user agent) for authentication events.'
    : 'This document lists everything you have done on Marketing iO during the date range above. Keep it for your records.';
  doc.text(doc.splitTextToSize(blurb, pageWidth - 24), 12, 105);

  // ---- Event pages -------------------------------------------------------
  doc.addPage();
  let pageNumber = 2;
  let y = withBrandedLayout(doc, {
    title:      'Activity Audit Trail',
    subtitle,
    footerLine,
    pageNumber,
  });

  const rowMin = 12;       // minimum vertical space per event
  const lineH  = 5;        // line height for body text
  const wrapW  = pageWidth - 24;

  if (p.entries.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...BRAND.textGreyRgb);
    doc.setFontSize(11);
    doc.text('No activity recorded for this date range.', 12, y + 8);
    return;
  }

  for (const e of p.entries) {
    // Compute approximate height needed for this entry to know if we
    // need to break to a new page.
    const summary = e.event_summary || e.title || e.event_label || '(no summary)';
    const summaryLines = doc.splitTextToSize(summary, wrapW);
    const actorLine    = showActor
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

    // Timestamp.
    const ts = e.created_date
      ? new Date(e.created_date).toLocaleString('en-ZA', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone:  'Africa/Johannesburg',
        })
      : '';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.textGreyRgb);
    doc.text(ts, 12, y);

    // Category tag (right-aligned).
    if (e.event_category) {
      doc.setTextColor(...BRAND.purpleRgb);
      doc.setFont('helvetica', 'bold');
      doc.text(e.event_category.toUpperCase(), pageWidth - 12, y, { align: 'right' });
    }

    y += 4;

    // Summary.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.bodyTextRgb);
    doc.text(summaryLines, 12, y);
    y += summaryLines.length * lineH;

    // Actor line (admin/owner viewers only).
    if (actorLine) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.textGreyRgb);
      doc.text(actorLine, 12, y);
      y += lineH;
    }

    // Security fields for auth-related events.
    if (securityRelevant) {
      const sec = [
        e.ip_address ? `IP ${e.ip_address}` : '',
        e.user_agent ? `UA ${(e.user_agent || '').slice(0, 80)}` : '',
      ].filter(Boolean).join(' · ');
      if (sec) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(...BRAND.textGreyRgb);
        doc.text(sec, 12, y);
        y += lineH;
      }
    }

    // Light separator.
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.2);
    doc.line(12, y + 1, pageWidth - 12, y + 1);
    y += 5;
  }
}
