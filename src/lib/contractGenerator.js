import jsPDF from "jspdf";
import { format } from "date-fns";

const BRAND_COLOR = "#a764e6";
const ACCENT_COLOR = "#ec4899";
const TEXT_COLOR = "#1a1a1a";
const LIGHT_TEXT = "#666666";

// CONTRACT COUNTER — stored in localStorage to maintain sequencing
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
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Initials: ___ / ___", 150, pageHeight - 10);
}

async function generateContractPDF(deal, client, packageData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let pageNum = 1;
  let yPos = margin;

  const contractRef = getNextContractNumber();
  const today = format(new Date(), "dd MMMM yyyy");
  const startDate = deal.created_date ? format(new Date(deal.created_date), "dd MMMM yyyy") : today;

  // Helper to add a new page
  function newPage() {
    addPageNumber(doc, pageNum, 20); // Total pages = 20
    addInitialsLine(doc, pageHeight);
    doc.addPage();
    pageNum += 1;
    yPos = margin;
  }

  // Helper to add text with auto-wrapping
  function addText(text, fontSize = 10, isBold = false, color = TEXT_COLOR, lineSpacing = 5) {
    doc.setFontSize(fontSize);
    doc.setTextColor(color === "light" ? 102 : parseInt(color.slice(1, 3), 16), 
                     color === "light" ? 102 : parseInt(color.slice(3, 5), 16),
                     color === "light" ? 102 : parseInt(color.slice(5, 7), 16));
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
  doc.text("Master Service Agreement", pageWidth / 2, 30, { align: "center" });
  
  yPos = 75;
  doc.setTextColor(TEXT_COLOR);
  addHeading("Between the Parties", 1);
  yPos += 5;
  
  addText("Marketing iO (Pty) Ltd", 11, true);
  addText("(CIPC Registration: 2026303502)", 10, false, LIGHT_TEXT);
  yPos += 5;
  addText("AND", 11, true);
  yPos += 5;
  addText(client.business_name || "Client Name", 11, true);
  addText(client.id_reg_number ? `(CIPC/ID: ${client.id_reg_number})` : "", 10, false, LIGHT_TEXT);
  
  yPos += 20;
  doc.setDrawColor(167, 100, 230);
  doc.rect(margin, yPos - 5, contentWidth, 40);
  yPos += 3;
  
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.setFont("helvetica", "normal");
  doc.text(`Contract Reference: ${contractRef}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`Date: ${today}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`Package: ${packageData?.label || deal.package || "Core Package"}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`Setup Fee: R${(deal.setup_fee || 0).toLocaleString()}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`Monthly Retainer: R${(deal.monthly_retainer || 0).toLocaleString()}`, margin + 5, yPos);
  
  addPageNumber(doc, pageNum, 20);
  addInitialsLine(doc, pageHeight);
  pageNum += 1;

  // PAGES 2-15 — 16 CLAUSES
  const clauses = [
    {
      num: "1",
      title: "DEFINITIONS AND INTERPRETATION",
      text: `In this Agreement, unless the context clearly indicates otherwise:
- "Client" means the party identified above
- "Services" means the digital marketing services as described in Schedule A
- "Effective Date" means ${startDate}
- "Setup Fee" means R${(deal.setup_fee || 0).toLocaleString()}
- "Monthly Retainer" means R${(deal.monthly_retainer || 0).toLocaleString()}
- "Term" means 12 (twelve) months from the Effective Date
- "Deliverables" means the services and output as per Schedule A
- "Operator" means Marketing iO acting as a data processor under POPIA
- "Personal Data" means information relating to an identified or identifiable natural person`
    },
    {
      num: "2",
      title: "ENGAGEMENT OF SERVICES",
      text: `2.1 The Client hereby engages Marketing iO to provide the Services on the terms and conditions set out in this Agreement.
2.2 Marketing iO agrees to provide the Services with due skill, care and diligence, in accordance with industry best practice.
2.3 The Services shall commence on the Effective Date and shall be performed in accordance with Schedule A.
2.4 Marketing iO reserves the right to use approved subcontractors to deliver Services where necessary.`
    },
    {
      num: "3",
      title: "TERM AND RENEWAL",
      text: `3.1 This Agreement is for an initial Term of 12 (twelve) months from the Effective Date.
3.2 This Agreement shall automatically renew for successive 12-month periods unless either party provides written notice of non-renewal at least 30 (thirty) days prior to the expiry of the then-current Term.
3.3 Either party may terminate this Agreement at any time by providing 30 (thirty) days' written notice, except in cases of material breach, which shall trigger immediate termination.`
    },
    {
      num: "4",
      title: "FEES AND PAYMENT",
      text: `4.1 The Client shall pay the Setup Fee on the date of signature of this Agreement.
4.2 The Monthly Retainer shall be payable in advance on the 1st or 15th of each calendar month as elected by the Client, via EFT or debit order.
4.3 All fees are exclusive of VAT (if applicable) and shall be invoiced monthly.
4.4 Should the Client fail to pay any amount due within 7 (seven) days of the due date, a written reminder shall be issued.
4.5 If payment is not received within 7 (seven) days of the reminder, Marketing iO reserves the right to suspend Services pending payment.
4.6 If a debit order fails, Marketing iO shall attempt re-presentation within 7 (seven) days.
4.7 ACCELERATION CLAUSE: If two (2) or more debit orders fail within a 12-month period, the entire outstanding balance under this Agreement shall become immediately due and payable in full.
4.8 All late payments shall incur a penalty at 10% per annum or as permitted by law.`
    },
    {
      num: "5",
      title: "CLIENT OBLIGATIONS",
      text: `5.1 The Client shall:
5.1.1 Provide all necessary information, assets, and access required to deliver the Services;
5.1.2 Approve Deliverables within the timeframes specified in Clause 6;
5.1.3 Ensure all personnel are available for scheduled meetings and calls;
5.1.4 Warrant that any personal data provided to Marketing iO has been provided with the explicit consent of the data subject(s) and in compliance with POPIA and all applicable data protection laws.
5.2 Failure to meet these obligations may result in delays for which Marketing iO shall not be liable.
5.3 The Client shall reimburse Marketing iO for any additional costs incurred due to Client delays or non-compliance.`
    },
    {
      num: "6",
      title: "DELIVERY, ACCEPTANCE AND SERVICE LEVELS",
      text: `6.1 Marketing iO shall deliver Deliverables in accordance with the Soft and Hard SLAs specified in Schedule A.
6.2 Upon delivery, the Client shall have 5 (five) business days to review and provide feedback.
6.3 Feedback must be submitted in writing via the designated communication channel (Clause 14).
6.4 DEEMED ACCEPTANCE: If the Client does not provide feedback within 5 (five) business days of delivery, the Deliverable shall be deemed accepted and approved for publication/implementation.
6.5 Approved Deliverables may not be rejected or subject to additional revision requests after the 5-day acceptance period.
6.6 The Client remains responsible for the accuracy and appropriateness of all content approved by them.`
    },
    {
      num: "7",
      title: "INTELLECTUAL PROPERTY RIGHTS",
      text: `7.1 All pre-existing intellectual property owned by Marketing iO (tools, templates, methodologies, frameworks) shall remain the exclusive property of Marketing iO.
7.2 Custom work created specifically for the Client during the Term shall be the property of Marketing iO until all fees (Setup and Retainer) have been paid in full.
7.3 Upon full payment of all outstanding fees and successful completion of the Services, Marketing iO shall transfer ownership of custom Deliverables to the Client.
7.4 The Client grants Marketing iO a non-exclusive license to use anonymised case studies and testimonials for marketing purposes.
7.5 The Client shall not reverse-engineer or attempt to circumvent any proprietary processes or tools used by Marketing iO.`
    },
    {
      num: "8",
      title: "CONFIDENTIALITY",
      text: `8.1 Both parties agree to maintain strict confidentiality regarding all proprietary information disclosed during the Term.
8.2 Confidential information includes business strategies, financial data, client lists, and proprietary techniques.
8.3 This obligation shall survive termination of this Agreement for a period of 3 (three) years.
8.4 Confidential information may be disclosed only where required by law or court order, subject to prompt written notice to the other party.`
    },
    {
      num: "9",
      title: "WARRANTIES AND DISCLAIMERS",
      text: `9.1 Marketing iO warrants that the Services shall be performed with due skill, care and diligence in accordance with industry standards.
9.2 Marketing iO does NOT warrant that the Services will achieve any specific business results, sales figures, or return on investment.
9.3 Digital marketing results are subject to third-party platforms, algorithms, market conditions and the Client's own execution, which are beyond Marketing iO's control.
9.4 Marketing iO makes no warranty regarding uninterrupted service or error-free delivery.
9.5 The Client acknowledges that marketing is not an exact science and results may vary.`
    },
    {
      num: "10",
      title: "LIMITATION OF LIABILITY",
      text: `10.1 Neither party shall be liable for indirect, incidental, consequential or punitive damages.
10.2 Marketing iO's total liability under this Agreement shall be capped at 3 (three) times the monthly Retainer fee.
10.3 This cap applies to all claims, whether in contract, tort, negligence, or otherwise.
10.4 The Client assumes all risk associated with the publication and use of Deliverables on their platforms.
10.5 Marketing iO shall not be liable for Client losses arising from Client's failure to follow recommendations or implement Services correctly.`
    },
    {
      num: "11",
      title: "TERMINATION",
      text: `11.1 Either party may terminate this Agreement by providing 30 (thirty) days' written notice.
11.2 Immediate termination (without notice period) is permitted in the case of:
- Material breach by the other party not cured within 7 (seven) days of written notice;
- Insolvency, liquidation, or administration of either party;
- Threatening or harassing behaviour toward Marketing iO staff.
11.3 Upon termination, the Client shall pay all outstanding fees through the notice period.
11.4 Termination does not extend the initial Term and does not entitle the Client to a refund of Setup Fees.
11.5 Marketing iO shall make all Deliverables available to the Client for a period of 30 (thirty) days post-termination.
11.6 All confidential information shall be returned or destroyed within 10 (ten) days of termination.`
    },
    {
      num: "12",
      title: "SPECIAL CLAUSES AND TIGHTENING PROVISIONS",
      text: `12.1 ACCELERATION ON FAILED DEBITS: As per Clause 4.7, two (2) or more failed debit orders in a 12-month period trigger immediate payment of the full outstanding balance.
12.2 NO CHARGEBACK INDEMNITY: The Client indemnifies Marketing iO against any chargebacks, reversals or disputes filed with their bank or payment provider.
12.3 DEEMED ACCEPTANCE: Silence after 5 business days constitutes acceptance of all Deliverables (Clause 6.4).
12.4 NO OFF-CONTRACT PROMISES: No verbal promises, side agreements or amendments are valid unless in writing and signed by both parties.
12.5 ATTORNEY-AND-OWN-CLIENT COSTS: The losing party in any dispute shall reimburse the prevailing party's legal costs on an attorney-and-own-client basis.
12.6 SUSPENSION DOES NOT EXTEND TERM: Service suspension (e.g. for non-payment) does not extend the Term.
12.7 NO PUBLIC DISPARAGEMENT: Neither party shall make derogatory public statements about the other without prior written consent.
12.8 STAFF LIABILITY: Marketing iO personnel acting as Operator under POPIA are not personally liable for data processing decisions.
12.9 FORMAL COMMUNICATION ONLY: All notices and instructions must be in writing via the designated channel (Clause 14). Verbal or informal communications are not binding.
12.10 12-MONTH NON-POACHING: The Client agrees not to directly engage any Marketing iO staff member or sub-operator for 12 (twelve) months post-termination. Breach results in liquidated damages of R50,000 per person.
12.11 NO DIRECT ENGAGEMENT WITH SUB-OPERATORS: The Client shall not directly contract with any of Marketing iO's sub-contractors or specialists without written consent.
12.12 THREAT/HARASSMENT: Any threatening, harassing or abusive behaviour toward Marketing iO staff shall result in immediate termination.`
    },
    {
      num: "13",
      title: "DISPUTE RESOLUTION AND GOVERNING LAW",
      text: `13.1 This Agreement is governed by and construed in accordance with the laws of the Republic of South Africa.
13.2 Any disputes arising from this Agreement shall be subject to the exclusive jurisdiction of the High Court in and for the Province of Limpopo, with Polokwane as the forum.
13.3 The parties agree to attempt good-faith negotiation before pursuing legal action.
13.4 If negotiation fails, either party may proceed to litigation.`
    },
    {
      num: "14",
      title: "NOTICES AND FORMAL COMMUNICATION",
      text: `14.1 All formal notices, instructions and communications must be in writing and sent to the addresses below:
FOR MARKETING iO: info@marketingio.co.za
FOR CLIENT: ${client.email || "[Client email address]"}
14.2 Notices are deemed received upon sending if via email, or 5 (five) business days after posting if by mail.
14.3 The Client agrees to designate a primary contact person for all communications.
14.4 Informal messages, phone calls or WhatsApp communications are not binding and do not constitute formal notice.`
    },
    {
      num: "15",
      title: "GENERAL PROVISIONS",
      text: `15.1 ENTIRE AGREEMENT: This Agreement, including Schedule A, constitutes the entire agreement and supersedes all prior negotiations and agreements.
15.2 SEVERABILITY: If any provision is found invalid, the remainder of the Agreement shall continue in force.
15.3 NO WAIVER: Failure to enforce any right does not constitute a waiver of that right.
15.4 ASSIGNMENT: Neither party may assign this Agreement without the written consent of the other party.
15.5 RELATIONSHIP: Nothing in this Agreement creates a partnership, joint venture, or employment relationship.
15.6 THIRD-PARTY BENEFICIARIES: This Agreement is binding only on the parties and their successors.
15.7 AMENDMENT: This Agreement may only be amended in writing and signed by both parties.`
    },
    {
      num: "16",
      title: "SIGNATURES",
      text: `16.1 This Agreement is executed as at the date first written above.`
    }
  ];

  for (const clause of clauses) {
    checkPageBreak(40);
    doc.setPage(pageNum);
    yPos = margin;
    
    addHeading(`CLAUSE ${clause.num}: ${clause.title}`, 2);
    addText(clause.text, 9, false, TEXT_COLOR, 4);
    yPos += 8;
    
    addPageNumber(doc, pageNum, 20);
    addInitialsLine(doc, pageHeight);
    doc.addPage();
    pageNum += 1;
  }

  // PAGES 16-17 — SCHEDULE A
  doc.setPage(pageNum);
  yPos = margin;
  addHeading("SCHEDULE A: SERVICE SPECIFICATION", 1);
  yPos += 5;
  
  addHeading("Service Details", 2);
  addText(`Package: ${packageData?.label || deal.package}`, 10, true);
  addText(`Setup Fee: R${(deal.setup_fee || 0).toLocaleString()}`, 9);
  addText(`Monthly Retainer: R${(deal.monthly_retainer || 0).toLocaleString()}`, 9);
  addText(`Initial Term: 12 months`, 9);
  addText(`Soft SLA: ${packageData?.softSLA || "5"} business days`, 9);
  addText(`Hard SLA: ${packageData?.hardSLA || "10"} business days`, 9);
  
  yPos += 10;
  addHeading("Included Deliverables", 2);
  const deliverables = packageData?.deliverables || [
    "Social media strategy and setup",
    "Monthly content planning and creation",
    "Monthly performance reporting",
    "Client communication and support"
  ];
  for (const del of deliverables) {
    addText(`• ${del}`, 9);
  }
  
  yPos += 10;
  addHeading("Scope Exclusions", 2);
  const exclusions = [
    "Services outside the agreed package scope",
    "Client's failure to provide timely feedback or approvals",
    "Changes to Client's platform or systems beyond Marketing iO's control",
    "Third-party fees (e.g. paid advertising, licensing)",
    "Work performed outside agreed working hours",
    "Revisions beyond the specified revision limit"
  ];
  for (const excl of exclusions) {
    addText(`• ${excl}`, 9);
  }
  
  addPageNumber(doc, pageNum, 20);
  addInitialsLine(doc, pageHeight);
  doc.addPage();
  pageNum += 1;

  // PAGES 18-19 — POPIA OPERATOR AGREEMENT
  doc.setPage(pageNum);
  yPos = margin;
  addHeading("POPIA OPERATOR AGREEMENT", 1);
  yPos += 5;
  
  addHeading("1. Processor Appointment", 2);
  addText(`Marketing iO is appointed as an Operator (data processor) under the Protection of Personal Information Act, 2013. Marketing iO shall process personal data provided by the Client only for the purpose of delivering the Services and in accordance with the Client's documented instructions.`, 9);
  
  yPos += 8;
  addHeading("2. Scope of Processing", 2);
  addText(`Personal data processed includes: email addresses, names, phone numbers, website analytics data, social media engagement data, and any other personally identifiable information provided by the Client. Processing is limited to the purpose of delivering marketing services as per Schedule A.`, 9);
  
  yPos += 8;
  addHeading("3. Subprocessors", 2);
  addText(`The Client acknowledges that Marketing iO may use the following subprocessors:`, 9, false);
  const subprocessors = [
    "Supabase (data hosting)",
    "Yoco (payment processing)",
    "Resend (email delivery)",
    "Cloudflare (content delivery)"
  ];
  for (const sub of subprocessors) {
    addText(`• ${sub}`, 9);
  }
  
  yPos += 8;
  addHeading("4. Security Measures", 2);
  addText(`Marketing iO implements appropriate technical and organisational security measures including encryption, access controls, regular security audits, and staff training to protect personal data against unauthorized access, loss or damage.`, 9);
  
  yPos += 8;
  addHeading("5. Data Subject Rights", 2);
  addText(`The Client shall remain the Responsible Party and shall be responsible for responding to data subject requests for access, correction, erasure and objection. Marketing iO shall assist the Client in fulfilling these obligations where necessary.`, 9);
  
  yPos += 8;
  addHeading("6. Breach Notification", 2);
  addText(`In the event of a confirmed or suspected data breach, Marketing iO shall notify the Client within 72 (seventy-two) hours. The Client is responsible for determining whether to notify the Information Regulator.`, 9);
  
  yPos += 8;
  addHeading("7. Data Return and Deletion", 2);
  addText(`Upon termination of this Agreement, Marketing iO shall, at the Client's election, either return all personal data to the Client or securely delete it within 30 (thirty) days, unless retention is required by law.`, 9);
  
  checkPageBreak(20);
  addPageNumber(doc, pageNum, 20);
  addInitialsLine(doc, pageHeight);
  doc.addPage();
  pageNum += 1;

  // PAGE 20 — SIGNATURE PAGE
  doc.setPage(pageNum);
  yPos = margin;
  
  addHeading("EXECUTION OF AGREEMENT", 1);
  yPos += 15;
  
  addText(`IN WITNESS WHEREOF the parties have executed this Agreement as at the date first written above.`, 10, true);
  yPos += 20;
  
  // Marketing iO signature block
  addHeading("MARKETING iO (PTY) LTD", 3);
  yPos += 15;
  doc.line(margin, yPos, margin + 50, yPos);
  yPos += 2;
  addText(`Signature`, 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 50, yPos);
  yPos += 2;
  addText(`Name: Thapelo Maupa`, 8, false, LIGHT_TEXT);
  yPos += 8;
  addText(`Capacity: Director`, 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 50, yPos);
  yPos += 2;
  addText(`Date: _________________`, 8, false, LIGHT_TEXT);
  yPos += 15;
  
  // Client signature block
  addHeading(`${client.business_name || "CLIENT"}`, 3);
  yPos += 15;
  doc.line(margin, yPos, margin + 50, yPos);
  yPos += 2;
  addText(`Signature`, 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 50, yPos);
  yPos += 2;
  addText(`Name: _________________________________`, 8, false, LIGHT_TEXT);
  yPos += 8;
  addText(`Position: _______________________________`, 8, false, LIGHT_TEXT);
  yPos += 8;
  doc.line(margin, yPos, margin + 50, yPos);
  yPos += 2;
  addText(`Date: _________________`, 8, false, LIGHT_TEXT);
  yPos += 15;
  
  // Witness blocks
  addHeading("WITNESSES", 3);
  yPos += 10;
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text("Witness 1:", margin, yPos);
  yPos += 8;
  doc.line(margin, yPos, margin + 40, yPos);
  yPos += 8;
  doc.text("Witness 2:", margin, yPos);
  yPos += 8;
  doc.line(margin, yPos, margin + 40, yPos);
  
  addPageNumber(doc, pageNum, 20);
  addInitialsLine(doc, pageHeight);

  return doc.output("blob");
}

export { generateContractPDF, getNextContractNumber };