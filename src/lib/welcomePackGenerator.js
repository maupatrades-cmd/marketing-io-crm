import jsPDF from "jspdf";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

const BRAND_COLOR = "#a764e6";
const ACCENT_COLOR = "#ec4899";
const TEXT_COLOR = "#1a1a1a";
const LIGHT_TEXT = "#666666";

function addPageNumber(doc, pageNum) {
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Page ${pageNum}`, 105, doc.internal.pageSize.getHeight() - 8, { align: "center" });
}

async function generateWelcomePack(deal, client, packageLabel) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let pageNum = 1;
  let yPos = margin;

  const today = format(new Date(), "dd MMMM yyyy");
  const contactFirstName = client.contact_person?.split(" ")[0] || "valued client";

  // Helper functions
  function newPage() {
    addPageNumber(doc, pageNum);
    doc.addPage();
    pageNum += 1;
    yPos = margin;
  }

  function addText(text, fontSize = 10, isBold = false, color = TEXT_COLOR, lineSpacing = 5) {
    doc.setFontSize(fontSize);
    doc.setTextColor(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += lines.length * lineSpacing;
  }

  function addHeading(text, level = 1) {
    const sizes = { 1: 24, 2: 16, 3: 12 };
    addText(text, sizes[level], true, BRAND_COLOR, 8);
    yPos += 3;
  }

  function checkPageBreak(minHeight = 30) {
    if (yPos > pageHeight - minHeight) {
      newPage();
    }
  }

  // PAGE 1 — COVER
  doc.setFillColor(167, 100, 230);
  doc.rect(0, 0, pageWidth, 120, "F");

  yPos = 40;
  doc.setFontSize(36);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Welcome to Marketing iO", pageWidth / 2, yPos, { align: "center" });

  yPos = 70;
  doc.setFontSize(28);
  doc.text(client.business_name || "our family", pageWidth / 2, yPos, { align: "center" });

  yPos = 90;
  doc.setFontSize(12);
  doc.setTextColor(220, 220, 255);
  doc.setFont("helvetica", "normal");
  doc.text("Too good to stay hidden", pageWidth / 2, yPos, { align: "center" });

  yPos = pageHeight - 40;
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(today, pageWidth / 2, yPos, { align: "center" });

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 2 — FOUNDER'S LETTER
  yPos = margin;
  doc.setTextColor(TEXT_COLOR);
  
  addText(`Dear ${contactFirstName},`, 11, true, TEXT_COLOR, 5);
  yPos += 8;

  const letter = `Welcome to the Marketing iO family! We're thrilled to have you on board.

Over the next few weeks, our team will be working closely with you to get your brand visible, your message heard, and your business growing. You've chosen a partner that's committed to your success—and we're excited to prove it.

In this Welcome Pack, you'll find everything you need to know about what happens next, how we work together, and who to reach out to when you need us. We've broken down the onboarding process into manageable steps, and we're here to guide you every step of the way.

Your success is our success. Let's get to work.`;

  addText(letter, 10, false, LIGHT_TEXT, 4.5);
  yPos += 15;

  addText("Thapelo Maupa", 11, true, BRAND_COLOR);
  addText("General Manager & Founder", 9, false, LIGHT_TEXT);
  addText("Marketing iO", 9, false, LIGHT_TEXT);
  yPos += 8;
  doc.setDrawColor(167, 100, 230);
  doc.line(margin, yPos, margin + 40, yPos);

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 3 — YOUR PACKAGE
  yPos = margin;
  
  doc.setFontSize(28);
  doc.setTextColor(BRAND_COLOR);
  doc.setFont("helvetica", "bold");
  doc.text(packageLabel || "Your Package", margin, yPos);
  yPos += 12;

  addText(`Setup Fee: R${(deal.setup_fee || 0).toLocaleString()}`, 10, true, TEXT_COLOR);
  addText(`Monthly Retainer: R${(deal.monthly_retainer || 0).toLocaleString()}`, 10, true, TEXT_COLOR);
  addText(`Contract Term: 12 months`, 10, false, LIGHT_TEXT);
  yPos += 10;

  addHeading("What's Included", 2);
  const deliverables = [
    "Professional social media setup and management",
    "Monthly content creation and posting",
    "Performance tracking and reporting",
    "Client support and communication",
    "Strategic guidance and optimisation",
    "Brand consistency across all platforms"
  ];
  for (const item of deliverables) {
    addText(`• ${item}`, 9);
  }

  yPos += 10;
  addHeading("Your Soft SLA", 2);
  addText("We commit to delivering work within 5 business days of request. For rush requests, contact your manager.", 9, false, LIGHT_TEXT);

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 4 — WHAT HAPPENS NEXT (12-step timeline)
  yPos = margin;
  addHeading("What Happens Next", 1);
  yPos += 8;

  const timeline = [
    { step: 1, action: "Welcome Pack received", days: "Today" },
    { step: 2, action: "Setup invoice paid", days: "Within 5 days" },
    { step: 3, action: "Onboarding form completed", days: "Within 5 days" },
    { step: 4, action: "Debit mandate signed", days: "Within 5 days" },
    { step: 5, action: "Brand assets shared", days: "Within 7 days" },
    { step: 6, action: "Onboarding call held", days: "Day 5-7" },
    { step: 7, action: "Brand kit finalised", days: "Day 10" },
    { step: 8, action: "First content drafted", days: "Day 12" },
    { step: 9, action: "Client review window", days: "Day 13-17" },
    { step: 10, action: "Refinements completed", days: "Day 18-20" },
    { step: 11, action: "Go-live", days: "Day 21" },
    { step: 12, action: "First monthly report", days: "Day 30" }
  ];

  for (const item of timeline) {
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setTextColor(167, 100, 230);
    doc.setFont("helvetica", "bold");
    doc.text(`${item.step}. ${item.action}`, margin, yPos);
    
    doc.setFontSize(8);
    doc.setTextColor(LIGHT_TEXT);
    doc.setFont("helvetica", "normal");
    doc.text(item.days, margin + 120, yPos);
    
    yPos += 7;
  }

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 5 — FIRST 7 DAYS TABLE
  yPos = margin;
  addHeading("Your First 7 Days", 1);
  yPos += 5;

  // Table
  const tableData = [
    ["Day", "Action", "Owner"],
    ["1", "Welcome Pack received, setup invoice issued", "Marketing iO"],
    ["2-3", "Setup payment processed", "You"],
    ["3-5", "Onboarding form completed", "You"],
    ["4-5", "Debit mandate signed", "You"],
    ["5-7", "Onboarding call scheduled & held", "Both"],
    ["7", "Brand assets delivered", "You"],
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(167, 100, 230);

  const colWidths = [20, 100, 50];
  let xPos = margin;
  const rowHeight = 8;

  // Header
  for (let i = 0; i < tableData[0].length; i++) {
    doc.rect(xPos, yPos, colWidths[i], rowHeight, "F");
    doc.text(tableData[0][i], xPos + 2, yPos + 5);
    xPos += colWidths[i];
  }
  yPos += rowHeight;

  // Rows
  doc.setTextColor(TEXT_COLOR);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(245, 245, 250);

  for (let i = 1; i < tableData.length; i++) {
    xPos = margin;
    for (let j = 0; j < tableData[i].length; j++) {
      doc.rect(xPos, yPos, colWidths[j], rowHeight, "F");
      doc.text(tableData[i][j], xPos + 2, yPos + 5);
      xPos += colWidths[j];
    }
    yPos += rowHeight;
  }

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 6 — YOUR TEAM
  yPos = margin;
  addHeading("Your Marketing iO Team", 1);
  yPos += 10;

  const team = [
    { initials: "TM", name: "Thapelo Maupa", role: "Founder & GM", desc: "Sets your strategy and oversees your success" },
    { initials: "CF", name: "Co-Founder & Investor", role: "Strategic Partner", desc: "Ensures alignment with your business goals" },
    { initials: "HT", name: "Head of Tech", role: "Build & Integration", desc: "Brings your vision to life across digital platforms" },
    { initials: "AO", name: "Admin & Operations", role: "Day-to-Day Lead", desc: "Your main point of contact for daily updates" },
  ];

  const avatarRadius = 15;
  const avatarSpacing = (contentWidth - 4 * avatarRadius) / 4;

  for (let i = 0; i < team.length; i++) {
    const xCenter = margin + avatarRadius + i * (2 * avatarRadius + avatarSpacing);
    
    // Avatar circle
    doc.setFillColor(167, 100, 230);
    doc.circle(xCenter, yPos + avatarRadius, avatarRadius, "F");
    
    // Initials text
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(team[i].initials, xCenter, yPos + avatarRadius + 4, { align: "center" });
  }

  yPos += 2 * avatarRadius + 15;

  // Team details
  doc.setFontSize(9);
  doc.setTextColor(TEXT_COLOR);
  doc.setFont("helvetica", "bold");
  let detailYPos = yPos;
  for (const member of team) {
    doc.text(member.name, margin, detailYPos);
    detailYPos += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(LIGHT_TEXT);
    doc.text(member.role, margin, detailYPos);
    detailYPos += 4;
    const descLines = doc.splitTextToSize(member.desc, 40);
    doc.text(descLines, margin, detailYPos);
    detailYPos += descLines.length * 3 + 5;
    doc.setFontSize(9);
    doc.setTextColor(TEXT_COLOR);
    doc.setFont("helvetica", "bold");
  }

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 7 — HOW TO REACH US
  yPos = margin;
  addHeading("How to Reach Us", 1);
  yPos += 8;

  const contactData = [
    ["Issue Type", "Channel", "Response Time"],
    ["Daily questions", "WhatsApp / Team Lead", "Within 4 business hours"],
    ["Approvals", "Email", "Within 24 hours"],
    ["Strategic decisions", "Email to Founder", "Within 48 hours"],
    ["Emergencies", "Direct call", "Same day"],
  ];

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(167, 100, 230);

  const contactColWidths = [40, 70, 50];
  let contactXPos = margin;
  yPos += 5;

  // Header
  for (let i = 0; i < contactData[0].length; i++) {
    doc.rect(contactXPos, yPos, contactColWidths[i], rowHeight, "F");
    doc.text(contactData[0][i], contactXPos + 2, yPos + 5);
    contactXPos += contactColWidths[i];
  }
  yPos += rowHeight;

  // Rows
  doc.setTextColor(TEXT_COLOR);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(245, 245, 250);

  for (let i = 1; i < contactData.length; i++) {
    contactXPos = margin;
    for (let j = 0; j < contactData[i].length; j++) {
      doc.rect(contactXPos, yPos, contactColWidths[j], rowHeight, "F");
      doc.text(contactData[i][j], contactXPos + 2, yPos + 5);
      contactXPos += contactColWidths[j];
    }
    yPos += rowHeight;
  }

  yPos += 15;
  addText("Email: info@marketingio.co.za", 9, false, BRAND_COLOR);

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 8 — ACTION ITEMS CHECKLIST
  yPos = margin;
  addHeading("Your Action Items", 1);
  yPos += 12;

  const actionItems = [
    "Pay setup invoice (within 5 days)",
    "Complete onboarding form",
    "Sign debit mandate for monthly retainer",
    "Send brand assets (logo, colours, photos)",
    "Confirm onboarding call time with us",
  ];

  doc.setFontSize(11);
  doc.setTextColor(TEXT_COLOR);
  for (const item of actionItems) {
    checkPageBreak(20);
    
    // Checkbox
    doc.setDrawColor(167, 100, 230);
    doc.rect(margin, yPos, 5, 5);
    
    // Item text
    doc.setFont("helvetica", "normal");
    doc.text(`${item}`, margin + 10, yPos + 3);
    
    yPos += 10;
  }

  yPos += 15;
  doc.setFontSize(10);
  doc.setTextColor(LIGHT_TEXT);
  doc.setFont("helvetica", "italic");
  doc.text("Once you've checked these off, you're ready to go!", margin, yPos);

  addPageNumber(doc, pageNum);

  return doc.output("blob");
}

export { generateWelcomePack };