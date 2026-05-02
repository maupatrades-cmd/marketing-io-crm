import jsPDF from "jspdf";
import { format } from "date-fns";

const BRAND_COLOR = "#a764e6";
const ACCENT_COLOR = "#ec4899";
const TEXT_COLOR = "#1a1a1a";
const LIGHT_TEXT = "#666666";

function getNextContractNumber() {
  const year = new Date().getFullYear();
  const key = `contract_counter_${year}`;
  let counter = parseInt(localStorage.getItem(key) || "0");
  counter += 1;
  localStorage.setItem(key, counter.toString());
  return `MIO-MSA-${year}-${String(counter).padStart(4, "0")}`;
}

function addPageNumber(doc, pageNum, totalPages) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Page ${pageNum} of ${totalPages}`, 105, pageHeight - 8, { align: "center" });
}

function addInitialsLine(doc, pageHeight) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("MARKETING iO INITIALS ___", margin, pageHeight - 10);
  doc.text("CLIENT INITIALS ___", pageWidth - margin - 40, pageHeight - 10);
  doc.text("Date: ________________", pageWidth / 2 - 25, pageHeight - 10);
}

const PACKAGE_SCHEDULES = {
  ignite: {
    label: "Ignite",
    setupFee: 3980,
    monthlyFee: 490,
    softSLA: 5,
    hardSLA: 10,
    term: 12,
    deliverables: [
      "Social media strategy and basic setup (1 platform)",
      "Monthly content calendar (4 posts per week)",
      "Graphic design support (basic templates)",
      "Monthly performance reporting",
      "Email support during business hours",
      "Basic SEO on-page recommendations"
    ],
    exclusions: [
      "Multi-platform management",
      "Video content creation",
      "Paid advertising management",
      "Influencer outreach",
      "Advanced analytics",
      "Crisis management support"
    ]
  },
  accelerate: {
    label: "Accelerate",
    setupFee: 6500,
    monthlyFee: 890,
    softSLA: 5,
    hardSLA: 10,
    term: 12,
    deliverables: [
      "Social media strategy across 2-3 platforms",
      "Monthly content calendar (5-6 posts per week per platform)",
      "Professional graphic design and branding",
      "Monthly performance reporting with insights",
      "Email and WhatsApp support (within 24 hours)",
      "SEO strategy and basic implementation",
      "Quarterly strategy review calls"
    ],
    exclusions: [
      "Video content production",
      "Paid advertising beyond strategy",
      "Influencer partnerships",
      "Custom app development",
      "24/7 support"
    ]
  },
  dominate: {
    label: "Dominate",
    setupFee: 9800,
    monthlyFee: 1490,
    softSLA: 5,
    hardSLA: 10,
    term: 12,
    deliverables: [
      "Full social media management (4+ platforms)",
      "Weekly content calendar with daily posting",
      "Professional video content (2 videos per month)",
      "Advanced graphic design and brand consistency",
      "Weekly performance reporting and optimization",
      "Dedicated account manager",
      "SEO strategy, on-page and technical optimization",
      "Paid ads strategy and monthly recommendations",
      "Quarterly in-person strategy sessions",
      "Priority support (same-day response)"
    ],
    exclusions: [
      "Paid advertising execution (strategy only)",
      "Custom software development",
      "24/7 support outside business hours"
    ]
  },
  street_pulse: {
    label: "Street Pulse",
    setupFee: 700,
    monthlyFee: 4000,
    softSLA: 5,
    hardSLA: 10,
    term: 3,
    deliverables: [
      "Field agent deployment to identified geographic zones",
      "Flyer design and printing coordination",
      "Door-to-door distribution in target areas",
      "Weekly distribution reports with GPS tracking",
      "Direct customer engagement and feedback collection",
      "Lead capture and qualification"
    ],
    exclusions: [
      "Digital marketing services",
      "Online advertising",
      "Multiple geographic zones (add-on cost)"
    ]
  },
  township_pulse: {
    label: "Township Pulse",
    setupFee: 2200,
    monthlyFee: 0,
    softSLA: 7,
    hardSLA: 14,
    term: 0,
    deliverables: [
      "Strategic poster placement in high-traffic township locations",
      "Poster design (up to 3 revisions)",
      "Printing and installation coordination",
      "Monthly placement report",
      "Competitor analysis of poster placements"
    ],
    exclusions: [
      "Exclusive venue rights",
      "Ongoing replacement of damaged posters",
      "Digital distribution"
    ]
  }
};

async function generateContractPDF(deal, client, packageData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let pageNum = 1;
  let yPos = margin;
  const totalPages = 26;

  const contractRef = getNextContractNumber();
  const today = format(new Date(), "dd MMMM yyyy");
  const effectiveDate = "25 May 2026";

  const pkg = PACKAGE_SCHEDULES[deal.package] || PACKAGE_SCHEDULES.ignite;

  function newPage() {
    addPageNumber(doc, pageNum, totalPages);
    addInitialsLine(doc, pageHeight);
    doc.addPage();
    pageNum += 1;
    yPos = margin;
  }

  function addText(text, fontSize = 10, isBold = false, color = TEXT_COLOR, lineSpacing = 5) {
    doc.setFontSize(fontSize);
    if (color === "light") {
      doc.setTextColor(102, 102, 102);
    } else {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      doc.setTextColor(r, g, b);
    }
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += lines.length * lineSpacing;
  }

  function addHeading(text, level = 1) {
    const sizes = { 1: 14, 2: 12, 3: 10 };
    addText(text, sizes[level], true, BRAND_COLOR, 7);
    yPos += 3;
  }

  function checkPageBreak(minHeight = 30) {
    if (yPos > pageHeight - minHeight) {
      newPage();
    }
  }

  // PAGE 1 — COVER PAGE
  doc.setFillColor(167, 100, 230);
  doc.rect(0, 0, pageWidth, 60, "F");
  
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("MARKETING iO", pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(18);
  doc.text("Master Service Agreement", pageWidth / 2, 32, { align: "center" });
  doc.setFontSize(10);
  doc.text("Schedule A's · POPIA Operator Agreement", pageWidth / 2, 42, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text("Too good to stay hidden.", pageWidth / 2, 52, { align: "center" });
  
  yPos = 75;
  doc.setTextColor(TEXT_COLOR);
  
  addHeading("MARKETING iO (PTY) LTD", 2);
  addText("CIPC Registration: 2026303502", 9, false, LIGHT_TEXT);
  addText("75 Marshall Street, Polokwane 0699, South Africa", 9, false, LIGHT_TEXT);
  addText("info@marketingio.co.za", 9, false, LIGHT_TEXT);
  
  yPos += 15;
  
  addText("Status: Final — Legal Review Complete", 10, true, ACCENT_COLOR);
  yPos += 10;
  
  addText(`Contract Reference: ${contractRef}`, 9);
  addText(`Effective Date: ${effectiveDate}`, 9);
  addText(`Version: 2.0`, 9);
  addText(`Generated: ${today}`, 9);
  
  yPos += 15;
  doc.setDrawColor(167, 100, 230);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 10;
  addText("IMPORTANT: Each party must initial every page of this Agreement as evidence of review and acceptance.", 8, true);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 2 — TABLE OF CONTENTS
  yPos = margin;
  addHeading("TABLE OF CONTENTS", 1);
  yPos += 8;
  
  const contents = [
    "PART 1: MASTER SERVICE AGREEMENT (Pages 3-14)",
    "  Clause 1: Definitions (Page 3)",
    "  Clause 2: Engagement and Services (Page 4)",
    "  Clause 3: Term and Renewal (Page 4)",
    "  Clause 4: Fees and Payment (Pages 5-6)",
    "  Clause 5: Client Obligations (Page 6)",
    "  Clause 6: Delivery, Acceptance and SLAs (Page 7)",
    "  Clause 7: Intellectual Property (Page 7)",
    "  Clause 8: Confidentiality (Page 8)",
    "  Clause 9: Warranties (Page 8)",
    "  Clause 10: Limitation of Liability (Page 9)",
    "  Clause 11: Termination (Page 9)",
    "  Clause 12: Special Clauses (Pages 9-10)",
    "  Clause 13: Dispute Resolution (Page 10)",
    "  Clause 14: Notices (Page 10)",
    "  Clause 15: General Provisions (Page 11)",
    "  Clause 16: Signatures (Page 11)",
    "",
    "PART 2-6: SCHEDULE A VARIANTS (Pages 12-16)",
    "  Schedule A — Ignite (Page 12)",
    "  Schedule A — Accelerate (Page 13)",
    "  Schedule A — Dominate (Page 14)",
    "  Schedule A — Street Pulse (Page 15)",
    "  Schedule A — Township Pulse (Page 16)",
    "",
    "PART 7: POPIA OPERATOR AGREEMENT (Pages 17-23)",
    "EXECUTION PAGE (Pages 24-26)"
  ];
  
  for (const item of contents) {
    addText(item, 9);
  }
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 3 — INTRODUCTION & DEFINITIONS
  yPos = margin;
  addHeading("PART 1: MASTER SERVICE AGREEMENT", 1);
  yPos += 8;
  
  addHeading("INTRODUCTION AND PARTIES", 2);
  addText("This Master Service Agreement ('Agreement') is entered into between:", 9);
  yPos += 5;
  
  doc.setFontSize(9);
  doc.setTextColor(TEXT_COLOR);
  
  const introTable = [
    { label: "MARKETING iO (PTY) LTD", value: "CIPC 2026303502, 75 Marshall Street, Polokwane 0699" },
    { label: "AND", value: "" },
    { label: client.business_name || "[CLIENT NAME]", value: `CIPC/ID: ${client.id_reg_number || "[NUMBER]"}` }
  ];
  
  for (const row of introTable) {
    doc.setFont("helvetica", "bold");
    doc.text(row.label, margin, yPos);
    yPos += 6;
    if (row.value) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(102, 102, 102);
      doc.text(row.value, margin + 5, yPos);
      yPos += 6;
    }
    doc.setTextColor(TEXT_COLOR);
  }
  
  yPos += 8;
  addHeading("CLAUSE 1: DEFINITIONS AND INTERPRETATION", 2);
  
  const definitions = [
    { term: '"Agreement"', def: "This Master Service Agreement and all Schedules attached hereto." },
    { term: '"Business Day"', def: "Any day other than Saturday, Sunday or a South African public holiday." },
    { term: '"Client"', def: "The party identified above as the recipient of Services." },
    { term: '"Confidential Information"', def: "Business strategies, financial data, client lists, and proprietary techniques." },
    { term: '"Deliverables"', def: "The services and output as specified in Schedule A." },
    { term: '"Effective Date"', def: `${effectiveDate}` },
    { term: '"Fees"', def: "The Setup Fee and Monthly Retainer as specified in Schedule A." },
    { term: '"Initial Term"', def: "The initial contract period as specified in Schedule A (12 or 3 months)." },
    { term: '"Marketing iO"', def: "Marketing iO (Pty) Ltd, CIPC 2026303502." },
    { term: '"POPIA"', def: "The Protection of Personal Information Act, 2013 (Act 4 of 2013)." },
    { term: '"Renewal Term"', def: "Successive 12-month periods following the Initial Term, if auto-renewed." },
    { term: '"Retainer"', def: "The monthly fee for ongoing Services as per Schedule A." },
    { term: '"Schedule A"', def: "The service specification document for the selected package." },
    { term: '"Services"', def: "The digital marketing and support services as described in Schedule A." },
    { term: '"Setup Fee"', def: "The once-off fee payable on signature for service commencement." },
    { term: '"Term"', def: "The Initial Term plus any Renewal Terms." }
  ];
  
  for (const d of definitions) {
    checkPageBreak(15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(d.term, margin, yPos);
    yPos += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(102, 102, 102);
    const lines = doc.splitTextToSize(d.def, contentWidth - 10);
    doc.text(lines, margin + 5, yPos);
    yPos += lines.length * 4 + 2;
    doc.setTextColor(TEXT_COLOR);
  }
  
  checkPageBreak(20);
  yPos += 5;
  addText("1.2 Headings in this Agreement are for convenience only and do not affect interpretation.", 9);
  addText("1.3 In calculating days, the first day is excluded and the last day is included. Where a deadline falls on a non-Business Day, it is extended to the next Business Day.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 4 — CLAUSES 2 & 3
  yPos = margin;
  addHeading("CLAUSE 2: ENGAGEMENT OF SERVICES", 2);
  addText("2.1 The Client hereby engages Marketing iO to provide the Services on the terms and conditions set out in this Agreement.", 9);
  yPos += 3;
  addText("2.2 The provisions of Schedule A take precedence on all product-specific matters, including scope, deliverables, and service levels.", 9);
  yPos += 3;
  addText("2.3 Marketing iO agrees to provide the Services with due skill, care and diligence in accordance with industry best practices.", 9);
  yPos += 3;
  addText("2.4 NO WARRANTY OF RESULTS: Marketing iO makes no warranty that the Services will result in: (a) leads or sales; (b) any specific search engine ranking; (c) social media followers or engagement; (d) revenue increase or return on investment; or (e) any other commercial outcome. Results depend on third-party platforms, algorithms, market conditions, and the Client's own execution.", 9);
  
  yPos += 12;
  addHeading("CLAUSE 3: TERM AND RENEWAL", 2);
  addText(`3.1 This Agreement is for an initial Term of ${pkg.term} (${pkg.term === 12 ? 'twelve' : 'three'}) months from the Effective Date.`, 9);
  yPos += 3;
  addText("3.2 This Agreement shall automatically renew for successive 12-month periods ('Renewal Terms') unless either party provides written notice of non-renewal at least 30 (thirty) days prior to the expiry of the then-current Term.", 9);
  yPos += 3;
  addText("3.3 Either party may terminate this Agreement with 30 (thirty) days' written notice, except in cases of material breach (immediate termination permitted).", 9);
  
  checkPageBreak(15);
  yPos += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const cpaNote = doc.splitTextToSize(
    "CONSUMER PROTECTION ACT NOTE: Auto-renewal of fixed-term consumer agreements is regulated by section 14 of the CPA and Regulation 5. Where the Client is a 'consumer' under the CPA, Marketing iO shall notify the Client in writing 40–80 business days before expiry of the option to terminate or accept renewal.",
    contentWidth
  );
  doc.text(cpaNote, margin, yPos);
  yPos += cpaNote.length * 4 + 2;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_COLOR);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 5-6 — CLAUSE 4: FEES AND PAYMENT
  yPos = margin;
  addHeading("CLAUSE 4: FEES AND PAYMENT", 2);
  addText(`4.1 The Client shall pay the Setup Fee of R${pkg.setupFee.toLocaleString()} on the date of signature, before Services commence.`, 9);
  yPos += 3;
  addText(`4.2 The Monthly Retainer of R${pkg.monthlyFee.toLocaleString()} (if applicable) is exclusive of VAT and payable monthly in advance on the 1st or 15th of each month, via EFT or debit order.`, 9);
  yPos += 3;
  addText("4.3 Marketing iO may not be VAT registered. If VAT is applicable, it shall be added to invoices.", 9);
  yPos += 3;
  addText("4.4 Setup Fee is invoiced on signature and must be paid in full before Services commence.", 9);
  yPos += 3;
  addText("4.5 If a debit order fails, Marketing iO shall notify the Client within 3 (three) Business Days. If payment is not received within 7 (seven) Business Days of notification, Marketing iO may suspend Services. Suspension for 30 (thirty) days without payment results in automatic termination of this Agreement.", 9);
  yPos += 3;
  addText("4.6 Late payments incur interest at the Prime Rate plus 2% per annum, calculated daily and compounded monthly.", 9);
  
  checkPageBreak(25);
  yPos += 3;
  addText("4.7 ACCELERATION ON FAILED DEBITS: If three (3) or more debit orders fail within any rolling twelve (12) month period of the Term, the full remaining Monthly Retainer for the balance of the then-current Term shall become immediately due and payable in full as a liquidated debt, without further notice.", 9);
  yPos += 3;
  addText("4.8 NO CHARGEBACKS OR REVERSALS: The Client irrevocably warrants that it shall not dispute, reverse, or chargeback any payment made under this Agreement. The Client indemnifies Marketing iO against all claims, costs and expenses (including attorney-and-own-client legal costs) arising from any chargeback or reversal attempt.", 9);
  yPos += 3;
  addText("4.9 Service suspension (e.g. for non-payment) does not extend the Term or delay the expiry date.", 9);
  yPos += 3;
  addText("4.10 DEFAULT AND COST RECOVERY: If the Client defaults on any payment, the Client shall reimburse Marketing iO for all reasonable costs of recovery, including: (a) attorney-and-own-client legal costs on an attorney scale; (b) debt collection commission at 15% of the amount collected; (c) tracing fees; and (d) any court costs.", 9);
  yPos += 3;
  addText("4.11 NONREFUNDABLE AMOUNTS: The Setup Fee and any payments made are non-refundable, even if Services are suspended or terminated due to Client breach or change of circumstances.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 6-7 — CLAUSES 5 & 6
  yPos = margin;
  addHeading("CLAUSE 5: CLIENT OBLIGATIONS", 2);
  addText("5.1 The Client shall:", 9);
  yPos += 2;
  const clientObs = [
    "5.1.1 Provide all necessary information, assets, access, approvals and login credentials required to deliver the Services;",
    "5.1.2 Approve or reject Deliverables within the 5-business-day review window (Clause 6);",
    "5.1.3 Make final decisions on content, strategy and implementation in a timely manner;",
    "5.1.4 Warrant that any personal data provided to Marketing iO has been obtained with explicit consent and in full compliance with POPIA and all applicable data protection laws;",
    "5.1.5 Ensure the Client's debit order mandate is valid, authorized and properly signed;",
    "5.1.6 Warrant that all information provided to Marketing iO is accurate, complete and lawful;",
    "5.1.7 Ensure that all content provided or approved by the Client is lawful, original or properly licensed, and does not infringe third-party rights."
  ];
  for (const obs of clientObs) {
    addText(obs, 9);
    yPos += 2;
  }
  yPos += 5;
  addText("5.2 Failure by the Client to meet these obligations shall not constitute a breach by Marketing iO, and Marketing iO shall not be liable for any resulting delays.", 9);
  yPos += 3;
  addText("5.3 The Client shall reimburse Marketing iO for any additional costs incurred due to Client delays, non-compliance or provision of inaccurate information.", 9);
  
  checkPageBreak(25);
  yPos += 12;
  addHeading("CLAUSE 6: DELIVERY, ACCEPTANCE AND SERVICE LEVELS", 2);
  addText(`6.1 Marketing iO shall deliver Deliverables within the Service Level Agreements (SLAs) specified in Schedule A: Soft SLA = ${pkg.softSLA} business days; Hard SLA = ${pkg.hardSLA} business days.`, 9);
  yPos += 3;
  addText("6.2 Upon delivery, the Client shall have exactly 5 (five) Business Days to review and provide detailed feedback.", 9);
  yPos += 3;
  addText("6.3 Feedback must be submitted in writing via the designated communication channel (Clause 14).", 9);
  yPos += 3;
  addText("6.4 DEEMED ACCEPTANCE: If the Client does not provide feedback or reject a Deliverable within 5 (five) Business Days of delivery, the Deliverable shall be deemed accepted and approved for publication, implementation or distribution. The Client cannot subsequently reject or demand revisions of a deemed-accepted Deliverable.", 9);
  yPos += 3;
  addText("6.5 After acceptance (whether express or deemed), the Client may not request additional revisions beyond those originally included in the package scope.", 9);
  yPos += 3;
  addText("6.6 The Client remains fully responsible for the accuracy, legality and appropriateness of all content approved, and assumes all risks associated with publication.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 7-8 — CLAUSES 7, 8, 9
  yPos = margin;
  addHeading("CLAUSE 7: INTELLECTUAL PROPERTY RIGHTS", 2);
  addText("7.1 All pre-existing intellectual property owned by Marketing iO (tools, templates, methodologies, frameworks, software) shall remain the exclusive property of Marketing iO and may not be copied or used outside the scope of Services.", 9);
  yPos += 3;
  addText("7.2 Custom Deliverables created specifically for the Client shall remain the property of Marketing iO until all Setup Fees and Retainer payments have been paid in full.", 9);
  yPos += 3;
  addText("7.3 Upon full payment of all outstanding fees and completion of Services, Marketing iO shall transfer ownership of custom Deliverables to the Client.", 9);
  yPos += 3;
  addText("7.4 The Client grants Marketing iO a non-exclusive, royalty-free license to use anonymised case studies, testimonials and success metrics for marketing and promotional purposes.", 9);
  yPos += 3;
  addText("7.5 The Client shall not reverse-engineer, deconstruct or attempt to circumvent any proprietary processes, tools or systems used by Marketing iO.", 9);
  
  checkPageBreak(25);
  yPos += 12;
  addHeading("CLAUSE 8: CONFIDENTIALITY", 2);
  addText("8.1 Both parties agree to maintain strict confidentiality regarding all proprietary information disclosed during the Term.", 9);
  yPos += 3;
  addText("8.2 Confidential information includes business strategies, financial data, client lists, marketing plans and proprietary techniques.", 9);
  yPos += 3;
  addText("8.3 This obligation shall survive termination of this Agreement for a period of 3 (three) years.", 9);
  yPos += 3;
  addText("8.4 Confidential information may be disclosed only where required by law or court order, subject to prompt written notice to the other party to allow for protective measures.", 9);
  
  yPos += 12;
  addHeading("CLAUSE 9: WARRANTIES AND DISCLAIMERS", 2);
  addText("9.1 Marketing iO warrants that the Services shall be performed with due skill, care and diligence in accordance with industry standards.", 9);
  yPos += 3;
  addText("9.2 MARKETING iO MAKES NO WARRANTY THAT SERVICES WILL ACHIEVE ANY SPECIFIC BUSINESS RESULTS, including leads, sales, search rankings, social media growth or revenue increase.", 9);
  yPos += 3;
  addText("9.3 Digital marketing results depend on third-party platforms (Google, Facebook, Instagram, TikTok), their algorithms, market conditions and the Client's own execution and compliance.", 9);
  yPos += 3;
  addText("9.4 Marketing iO makes no warranty regarding uninterrupted service or error-free Deliverables.", 9);
  yPos += 3;
  addText("9.5 The Client acknowledges that marketing is not an exact science and results may vary significantly.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 8-9 — CLAUSES 10, 11
  yPos = margin;
  addHeading("CLAUSE 10: LIMITATION OF LIABILITY", 2);
  addText("10.1 Neither party shall be liable for indirect, incidental, consequential, special or punitive damages, including loss of profits, revenue or business opportunity.", 9);
  yPos += 3;
  addText(`10.2 Marketing iO's total liability under this Agreement is capped at 3 (three) times the monthly Retainer fee (R${(pkg.monthlyFee * 3).toLocaleString()}).`, 9);
  yPos += 3;
  addText("10.3 This cap applies to all claims, whether in contract, tort, negligence, strict liability or otherwise.", 9);
  yPos += 3;
  addText("10.4 The Client assumes all risk associated with the publication and use of Deliverables on Client's platforms, websites and channels.", 9);
  yPos += 3;
  addText("10.5 Marketing iO shall not be liable for Client losses arising from the Client's failure to follow recommendations, implement Services correctly or maintain Client's systems.", 9);
  
  checkPageBreak(25);
  yPos += 12;
  addHeading("CLAUSE 11: TERMINATION", 2);
  addText("11.1 Either party may terminate this Agreement by providing 30 (thirty) days' written notice to the other party.", 9);
  yPos += 3;
  addText("11.2 IMMEDIATE TERMINATION (without notice period) is permitted in the case of: (a) material breach not cured within 7 (seven) Business Days of written notice; (b) insolvency, liquidation or administration of either party; or (c) threatening, harassing or abusive behaviour toward Marketing iO staff.", 9);
  yPos += 3;
  addText("11.3 Upon termination, the Client shall pay all outstanding fees through the end of the notice period or current month.", 9);
  yPos += 3;
  addText("11.4 Termination does not extend the Initial Term and does not entitle the Client to a refund of Setup Fees or prepaid Retainers.", 9);
  yPos += 3;
  addText("11.5 Marketing iO shall make all Deliverables available to the Client for download for 30 (thirty) days post-termination, after which access is removed.", 9);
  yPos += 3;
  addText("11.6 The Client shall return or securely destroy all Confidential Information within 10 (ten) Business Days of termination.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 9-10 — CLAUSE 12 & 13
  yPos = margin;
  addHeading("CLAUSE 12: SPECIAL CLAUSES AND TIGHTENING PROVISIONS", 2);
  addText("12.1 ACCELERATION: As per Clause 4.7, three (3) failed debit orders in any rolling 12-month period trigger immediate payment of all remaining Retainer due for the balance of the Term.", 9);
  yPos += 3;
  addText("12.2 NO-CHARGEBACK INDEMNITY: The Client indemnifies Marketing iO against chargebacks, reversals, disputes or claims filed with their bank, payment processor or card scheme.", 9);
  yPos += 3;
  addText("12.3 DEEMED ACCEPTANCE: Silence after 5 Business Days constitutes acceptance of all Deliverables (Clause 6.4).", 9);
  yPos += 3;
  addText("12.4 NO OFF-CONTRACT PROMISES: No verbal promises, side agreements, payment extensions or amendments are valid unless in writing and signed by both parties.", 9);
  yPos += 3;
  addText("12.5 ATTORNEY-AND-OWN-CLIENT COSTS: The losing party in any dispute or litigation shall reimburse the prevailing party's legal costs on an attorney-and-own-client scale.", 9);
  yPos += 3;
  addText("12.6 SUSPENSION DOES NOT EXTEND TERM: Service suspension (e.g. for non-payment) does not extend the Term or delay the termination date.", 9);
  yPos += 3;
  addText("12.7 NO PUBLIC DISPARAGEMENT: Neither party shall make derogatory, defamatory or disparaging public statements about the other without prior written consent.", 9);
  yPos += 3;
  addText("12.8 STAFF LIABILITY SHIELD: Marketing iO personnel shall not be personally liable for data processing decisions or POPIA compliance actions.", 9);
  yPos += 3;
  addText("12.9 FORMAL COMMUNICATION ONLY: All notices, instructions and claims must be in writing via the designated channel (Clause 14). Verbal, informal, WhatsApp or phone communications are NOT binding.", 9);
  
  checkPageBreak(20);
  yPos += 3;
  addText("12.10 12-MONTH NON-POACHING: The Client agrees not to directly engage any Marketing iO staff member, sub-contractor or specialist for 12 (twelve) months post-termination. Breach results in liquidated damages of R50,000 per person.", 9);
  yPos += 3;
  addText("12.11 NO DIRECT ENGAGEMENT WITH SUB-OPERATORS: The Client shall not directly contract with any of Marketing iO's sub-contractors, specialists or associates without written consent.", 9);
  yPos += 3;
  addText("12.12 THREAT/HARASSMENT CLAUSE: Any threatening, harassing, abusive or disrespectful behaviour toward Marketing iO staff shall result in immediate termination of this Agreement without notice.", 9);
  
  yPos += 12;
  addHeading("CLAUSE 13: DISPUTE RESOLUTION AND GOVERNING LAW", 2);
  addText("13.1 This Agreement is governed by and construed in accordance with the laws of the Republic of South Africa.", 9);
  yPos += 3;
  addText("13.2 The parties submit to the exclusive jurisdiction of the High Court of South Africa in the Province of Limpopo, with Polokwane as the forum for any disputes.", 9);
  yPos += 3;
  addText("13.3 The parties agree to attempt good-faith negotiation before pursuing legal action.", 9);
  yPos += 3;
  addText("13.4 If negotiation fails, either party may proceed to litigation.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGE 10-11 — CLAUSES 14, 15, 16
  yPos = margin;
  addHeading("CLAUSE 14: NOTICES AND FORMAL COMMUNICATION", 2);
  addText("14.1 All formal notices, instructions and communications must be in writing and sent to:", 9);
  yPos += 4;
  addText("FOR MARKETING iO: info@marketingio.co.za", 9, false, BRAND_COLOR);
  addText(`FOR CLIENT: ${client.email || "[Client email address]"}`, 9, false, BRAND_COLOR);
  yPos += 5;
  addText("14.2 Email notices are deemed received on sending; postal notices are deemed received 5 (five) Business Days after posting.", 9);
  yPos += 3;
  addText("14.3 The Client designates a single primary contact person for all communications.", 9);
  yPos += 3;
  addText("14.4 Informal messages, WhatsApp communications, phone calls, or social media are NOT binding and do not constitute formal notice.", 9);
  
  checkPageBreak(25);
  yPos += 12;
  addHeading("CLAUSE 15: GENERAL PROVISIONS", 2);
  addText("15.1 ENTIRE AGREEMENT: This Agreement, including all Schedules, constitutes the entire agreement and supersedes all prior negotiations, proposals and understandings.", 9);
  yPos += 3;
  addText("15.2 SEVERABILITY: If any provision is found invalid or unenforceable, the remainder of the Agreement shall continue in full force.", 9);
  yPos += 3;
  addText("15.3 NO WAIVER: Failure or delay to enforce any right does not constitute a waiver of that right.", 9);
  yPos += 3;
  addText("15.4 ASSIGNMENT: Neither party may assign, transfer or delegate this Agreement without the written consent of the other party.", 9);
  yPos += 3;
  addText("15.5 INDEPENDENT RELATIONSHIP: This Agreement does not create a partnership, joint venture, agency or employment relationship between the parties.", 9);
  yPos += 3;
  addText("15.6 NO THIRD-PARTY BENEFICIARIES: This Agreement binds only the parties and their successors; no third party has rights or claims.", 9);
  yPos += 3;
  addText("15.7 AMENDMENT: This Agreement may only be amended in writing and signed by both parties.", 9);
  yPos += 3;
  addText("15.8 ELECTRONIC SIGNATURES: Counterparts and electronic signatures are valid under the Electronic Communications and Transactions Act, 25 of 2002.", 9);
  yPos += 3;
  addText("15.9 FORCE MAJEURE: Neither party is liable for failure to perform due to circumstances beyond reasonable control (war, natural disaster, pandemic, government action).", 9);
  
  checkPageBreak(15);
  yPos += 12;
  addHeading("CLAUSE 16: SIGNATURES", 2);
  addText("16.1 This Agreement is executed as at the Effective Date.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  newPage();

  // PAGES 12-16 — SCHEDULE A VARIANTS
  const scheduleData = [
    { key: "ignite", page: 12 },
    { key: "accelerate", page: 13 },
    { key: "dominate", page: 14 },
    { key: "street_pulse", page: 15 },
    { key: "township_pulse", page: 16 }
  ];

  for (const sched of scheduleData) {
    const s = PACKAGE_SCHEDULES[sched.key];
    yPos = margin;
    
    addHeading(`SCHEDULE A — ${s.label.toUpperCase()}`, 1);
    yPos += 8;
    
    addHeading("Service Details", 2);
    addText(`Package: ${s.label}`, 9);
    addText(`Setup Fee: R${s.setupFee.toLocaleString()}`, 9);
    if (s.monthlyFee > 0) {
      addText(`Monthly Retainer: R${s.monthlyFee.toLocaleString()}`, 9);
    } else {
      addText(`Monthly Retainer: Once-off (no recurring fees)`, 9);
    }
    addText(`Initial Term: ${s.term} months`, 9);
    addText(`Soft SLA: ${s.softSLA} business days`, 9);
    addText(`Hard SLA: ${s.hardSLA} business days`, 9);
    
    checkPageBreak(40);
    yPos += 8;
    addHeading("Included Deliverables", 2);
    for (const del of s.deliverables) {
      checkPageBreak(8);
      addText(`• ${del}`, 8);
      yPos += 1;
    }
    
    checkPageBreak(30);
    yPos += 5;
    addHeading("Scope Exclusions", 2);
    for (const excl of s.exclusions) {
      checkPageBreak(8);
      addText(`• ${excl}`, 8);
      yPos += 1;
    }
    
    addPageNumber(doc, pageNum, totalPages);
    addInitialsLine(doc, pageHeight);
    if (sched.key !== "township_pulse") doc.addPage();
    pageNum += 1;
    yPos = margin;
  }

  // PAGES 17-23 — POPIA OPERATOR AGREEMENT
  yPos = margin;
  addHeading("PART 7: POPIA OPERATOR AGREEMENT", 1);
  yPos += 5;
  addText("This POPIA Operator Agreement is incorporated as part of the Master Service Agreement and governs the processing of personal data.", 9);
  
  checkPageBreak(20);
  yPos += 8;
  addHeading("1. OPERATOR APPOINTMENT", 2);
  addText("Marketing iO is appointed as an Operator (data processor) under the Protection of Personal Information Act, 2013. Marketing iO shall process personal data provided by the Client only for the purpose of delivering the Services and in accordance with the Client's documented instructions.", 9);
  
  checkPageBreak(15);
  yPos += 8;
  addHeading("2. SCOPE OF PROCESSING", 2);
  addText("Personal data processed may include: names, email addresses, phone numbers, physical addresses, website analytics data, social media engagement data, customer demographics, and any other personally identifiable information provided by the Client. Processing is limited strictly to the purpose of delivering marketing services as per Schedule A.", 9);
  
  checkPageBreak(15);
  yPos += 8;
  addHeading("3. SUBPROCESSORS", 2);
  addText("The Client acknowledges that Marketing iO may use the following subprocessors:", 9);
  const subs = ["Supabase (database hosting, EU region)", "Yoco (payment processing)", "Resend (email delivery)", "Cloudflare (CDN and security)"];
  for (const sub of subs) {
    addText(`• ${sub}`, 9);
  }
  
  checkPageBreak(15);
  yPos += 5;
  addHeading("4. SECURITY MEASURES", 2);
  addText("Marketing iO implements appropriate technical and organisational security measures including encryption, access controls, regular security audits, staff training, and incident response procedures to protect personal data against unauthorised access, loss, damage or disclosure.", 9);
  
  checkPageBreak(15);
  yPos += 8;
  addHeading("5. DATA SUBJECT RIGHTS", 2);
  addText("The Client remains the Responsible Party under POPIA and is responsible for responding to data subject requests for access, correction, erasure and objection. Marketing iO shall cooperate and assist the Client in fulfilling these obligations where necessary.", 9);
  
  checkPageBreak(15);
  yPos += 8;
  addHeading("6. BREACH NOTIFICATION", 2);
  addText("In the event of a confirmed or suspected personal data breach, Marketing iO shall notify the Client within 72 (seventy-two) hours. The Client remains responsible for determining whether to notify the Information Regulator and affected data subjects.", 9);
  
  checkPageBreak(15);
  yPos += 8;
  addHeading("7. DATA RETURN AND DELETION", 2);
  addText("Upon termination of this Agreement, Marketing iO shall, at the Client's election, either return all personal data to the Client in a structured, commonly-used format or securely delete it within 30 (thirty) days, unless retention is required by law.", 9);
  
  checkPageBreak(15);
  yPos += 8;
  addHeading("8. AUDIT AND INSPECTION RIGHTS", 2);
  addText("The Client may, at reasonable notice, audit Marketing iO's compliance with this POPIA Agreement. Marketing iO shall cooperate and provide reasonable access to records and facilities.", 9);
  
  checkPageBreak(15);
  yPos += 8;
  addHeading("9. LIABILITY AND INDEMNITY", 2);
  addText("Marketing iO shall indemnify the Client against claims arising from Marketing iO's violation of this POPIA Agreement or POPIA itself, except where the violation was due to the Client's instructions or failure to comply with data protection laws.", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  doc.addPage();
  pageNum += 1;

  // PAGES 24-26 — EXECUTION PAGES
  yPos = margin;
  addHeading("EXECUTION PAGE", 1);
  yPos += 15;
  
  addText("IN WITNESS WHEREOF the parties execute this Agreement as at the Effective Date.", 10, true);
  yPos += 20;
  
  // Marketing iO signature
  addHeading("MARKETING iO (PTY) LTD", 3);
  yPos += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Signature", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Thapelo Maupa", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Title: Director", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Date: ___________________", 8, false, LIGHT_TEXT);
  
  checkPageBreak(30);
  yPos += 15;
  
  // Client signature
  addHeading(`${client.business_name || "CLIENT"}`, 3);
  yPos += 10;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Signature", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Full Name: _________________________________", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Position/Title: ____________________________", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Date: ___________________", 8, false, LIGHT_TEXT);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  doc.addPage();
  pageNum += 1;

  // PAGE 25 — WITNESSES
  yPos = margin;
  addHeading("WITNESSES", 1);
  yPos += 15;
  
  addText("WITNESS 1", 10, true);
  yPos += 10;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Signature", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Full Name: _________________________________", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("ID Number: _________________________________", 8, false, LIGHT_TEXT);
  
  checkPageBreak(30);
  yPos += 15;
  
  addText("WITNESS 2", 10, true);
  yPos += 10;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Signature", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("Full Name: _________________________________", 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 60, yPos);
  yPos += 3;
  addText("ID Number: _________________________________", 8, false, LIGHT_TEXT);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);
  doc.addPage();
  pageNum += 1;

  // PAGE 26 — FINAL NOTES
  yPos = margin;
  addHeading("IMPORTANT NOTES FOR ALL PARTIES", 1);
  yPos += 8;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(236, 72, 153);
  doc.text("1. INITIALS REQUIRED", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_COLOR);
  addText("Each party MUST initial every page at the bottom right corner as evidence of having read and understood the Agreement. Pages without initials may be deemed unreviewed.", 9);
  
  yPos += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(236, 72, 153);
  doc.text("2. GOVERNING LAW", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_COLOR);
  addText("This Agreement is governed exclusively by the laws of the Republic of South Africa. Any disputes are subject to the jurisdiction of the High Court in Limpopo, Polokwane.", 9);
  
  yPos += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(236, 72, 153);
  doc.text("3. NO VERBAL MODIFICATIONS", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_COLOR);
  addText("Any changes or additions to this Agreement must be in writing and signed by both parties. Verbal promises, WhatsApp messages or informal agreements are not valid.", 9);
  
  yPos += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(236, 72, 153);
  doc.text("4. ACCELERATION REMINDER", margin, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_COLOR);
  addText("If three (3) debit orders fail in any 12-month period, the full remaining balance becomes immediately due and payable without further notice (Clause 4.7).", 9);
  
  addPageNumber(doc, pageNum, totalPages);
  addInitialsLine(doc, pageHeight);

  return doc.output("blob");
}

export { generateContractPDF, getNextContractNumber };