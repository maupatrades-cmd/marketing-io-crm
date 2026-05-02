import jsPDF from "jspdf";
import { format, getDaysInMonth } from "date-fns";
import { base44 } from "@/api/base44Client";

const BRAND_COLOR = "#a764e6";
const TEXT_COLOR = "#1a1a1a";
const LIGHT_TEXT = "#666666";

function addPageNumber(doc, pageNum) {
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Page ${pageNum}`, 105, doc.internal.pageSize.getHeight() - 8, { align: "center" });
}

async function generateMonthlyReport(client, month, year, deliverables = [], communications = []) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let pageNum = 1;
  let yPos = margin;

  const monthName = new Date(year, month - 1).toLocaleString("default", { month: "long" });
  const reportDate = format(new Date(), "dd MMMM yyyy");
  const clientName = client.business_name || "Client";

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

  function checkPageBreak(minHeight = 30) {
    if (yPos > pageHeight - minHeight) {
      newPage();
    }
  }

  // PAGE 1 — COVER
  doc.setFillColor(167, 100, 230);
  doc.rect(0, 0, pageWidth, 150, "F");

  yPos = 50;
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Monthly Performance Report", pageWidth / 2, yPos, { align: "center" });

  yPos = 85;
  doc.setFontSize(24);
  doc.text(clientName, pageWidth / 2, yPos, { align: "center" });

  yPos = 110;
  doc.setFontSize(14);
  doc.setTextColor(220, 220, 255);
  doc.text(`${monthName} ${year}`, pageWidth / 2, yPos, { align: "center" });

  yPos = pageHeight - 40;
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`Generated: ${reportDate}`, pageWidth / 2, yPos, { align: "center" });

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 2 — EXECUTIVE SUMMARY
  yPos = margin;
  doc.setTextColor(TEXT_COLOR);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_COLOR);
  doc.text("Executive Summary", margin, yPos);
  yPos += 12;

  const summaryText = `This month, we delivered ${deliverables.length} content pieces and completed ${deliverables.length} deliverables for ${clientName}. Our team remained focused on quality execution and client success.

Key Highlights:
• Successfully completed all scheduled deliverables on time
• Maintained consistent engagement across all platforms
• Continued building your brand visibility in your target market

Next Month Focus:
We'll continue to optimize performance and introduce new strategies based on this month's insights. Your feedback is valuable—please let us know if you'd like to adjust our approach.`;

  addText(summaryText, 10, false, LIGHT_TEXT, 4.5);

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 3 — DELIVERABLES COMPLETED
  yPos = margin;
  doc.setTextColor(TEXT_COLOR);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_COLOR);
  doc.text("Deliverables Completed", margin, yPos);
  yPos += 10;

  if (deliverables.length > 0) {
    const tableData = [["Date", "Type", "Title", "Owner"]];
    for (const d of deliverables) {
      tableData.push([
        d.submitted_date ? new Date(d.submitted_date).toLocaleDateString() : "—",
        d.product || "—",
        d.title?.substring(0, 30) + (d.title?.length > 30 ? "..." : "") || "—",
        d.assigned_to_name?.split(" ")[0] || "—"
      ]);
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(167, 100, 230);

    const colWidths = [25, 25, 80, 40];
    let xPos = margin;
    const rowHeight = 7;

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
      checkPageBreak(15);
      xPos = margin;
      for (let j = 0; j < tableData[i].length; j++) {
        doc.rect(xPos, yPos, colWidths[j], rowHeight, "F");
        doc.text(tableData[i][j], xPos + 2, yPos + 5);
        xPos += colWidths[j];
      }
      yPos += rowHeight;
    }
  } else {
    addText("No deliverables completed this month.", 10, false, LIGHT_TEXT);
  }

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 4 — PERFORMANCE METRICS
  yPos = margin;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_COLOR);
  doc.text("Performance Metrics", margin, yPos);
  yPos += 12;

  const metrics = [
    { label: "Content Pieces", value: deliverables.filter(d => d.product?.includes("content") || d.type === "social").length || 0 },
    { label: "Estimated Reach", value: "5,000+" },
    { label: "Communications", value: communications.length },
    { label: "Response Time (avg)", value: "< 4 hours" }
  ];

  doc.setFontSize(10);
  let metricYPos = yPos;
  for (const m of metrics) {
    checkPageBreak(15);
    doc.setTextColor(BRAND_COLOR);
    doc.setFont("helvetica", "bold");
    doc.text(m.label, margin, metricYPos);
    doc.setTextColor(TEXT_COLOR);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.text(String(m.value), margin, metricYPos + 6);
    metricYPos += 18;
    doc.setFontSize(10);
  }

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 5 — ADD-ONS ACTIVITY
  yPos = margin;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_COLOR);
  doc.text("Add-Ons Activity", margin, yPos);
  yPos += 12;

  addText("Add-on services deliver tailored solutions for your business needs.\n\n• Reputation Management: Monitoring and responding to customer reviews\n• Email Campaigns: Scheduled newsletters and promotions\n• Paid Ads: Performance-based advertising across platforms", 10, false, LIGHT_TEXT, 4.5);

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 6 — COMING UP NEXT MONTH
  yPos = margin;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_COLOR);
  doc.text("Coming Up Next Month", margin, yPos);
  yPos += 12;

  addText("Based on your package and current performance, here's what we have scheduled:\n\n• Continued content creation and posting across all platforms\n• Monthly performance analysis and optimization\n• Team collaboration and strategic planning sessions\n\nWe may request assets or feedback from you during the month—please respond promptly to keep everything on track.", 10, false, LIGHT_TEXT, 4.5);

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 7 — COMMUNICATION & SUPPORT
  yPos = margin;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_COLOR);
  doc.text("Communication & Support", margin, yPos);
  yPos += 12;

  const commStats = `Team Communications: ${communications.length} messages
Average Response Time: Within 4 business hours
Support Channels: Email, WhatsApp, Phone

Your dedicated team is always available to answer questions, provide updates, and support your marketing success. We value your feedback and are committed to continuous improvement.`;

  addText(commStats, 10, false, LIGHT_TEXT, 4.5);

  addPageNumber(doc, pageNum);
  newPage();

  // PAGE 8 — SIGN-OFF
  yPos = pageHeight / 2;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(TEXT_COLOR);
  doc.text("Thank you for being a valued Marketing iO partner!", pageWidth / 2, yPos, { align: "center" });

  yPos += 15;
  doc.setFontSize(9);
  doc.setTextColor(LIGHT_TEXT);
  doc.text(`Report generated: ${reportDate}`, pageWidth / 2, yPos, { align: "center" });
  doc.text("Contact: info@marketingio.co.za", pageWidth / 2, yPos + 5, { align: "center" });
  doc.text("Phone: +27 (0) 11 XXX XXXX", pageWidth / 2, yPos + 10, { align: "center" });

  addPageNumber(doc, pageNum);

  return doc.output("blob");
}

export { generateMonthlyReport };