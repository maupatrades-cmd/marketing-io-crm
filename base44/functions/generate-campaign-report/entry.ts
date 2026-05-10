import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';
import { Resend } from 'npm:resend@3.2.0';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

function getLastMonth() {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  return { year, month };
}

function formatMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

function wrapEmailHTML(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Campaign Report</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:20px 0;"><tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="240" style="width:240px;height:auto;display:block;margin:0 auto;" />
</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:5px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 24px;background:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;">${bodyHtml}</td></tr>
<tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:3px 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="background:#0f172a;padding:28px 24px;text-align:center;">
  <img src="${LOGO_URL}" alt="Marketing iO" width="140" style="width:140px;height:auto;display:block;margin:0 auto 12px auto;" />
  <div style="font-size:13px;font-weight:600;color:#f8fafc;margin-bottom:8px;">Marketing iO (Pty) Ltd · CIPC 2026303502</div>
  <div style="font-size:12px;color:#94a3b8;line-height:1.8;">75 Marshall Street, Polokwane 0699<br>☎ 010 102 0534 &bull; <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a></div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function generatePDFReport(client, campaigns, campaignSends) {
  const { year, month } = getLastMonth();
  const monthYear = formatMonthYear(year, month);
  const pdf = new jsPDF('p', 'mm', 'a4');

  // Title
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, 210, 40, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.text(`Campaign Report`, 15, 20);
  pdf.setFontSize(12);
  pdf.text(monthYear, 15, 30);

  // Client info
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  pdf.text(`Client: ${client.business_name}`, 15, 55);
  pdf.text(`Contact: ${client.contact_person}`, 15, 65);
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated on: ${new Date().toLocaleDateString('en-ZA')}`, 15, 75);

  let yPosition = 90;

  // Campaign summaries
  if (campaigns && campaigns.length > 0) {
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.text('Campaigns Sent', 15, yPosition);
    yPosition += 12;

    campaigns.slice(0, 5).forEach((campaign) => {
      const sends = campaignSends.filter(s => s.campaign_id === campaign.id) || [];
      const opened = sends.filter(s => s.opened).length;
      const openRate = sends.length > 0 ? ((opened / sends.length) * 100).toFixed(1) : 0;

      pdf.setFontSize(10);
      pdf.setTextColor(30, 30, 30);
      pdf.text(`• ${campaign.name}`, 15, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`   Sent: ${sends.length} | Opened: ${opened} (${openRate}%)`, 15, yPosition);
      yPosition += 8;

      if (yPosition > 270) {
        pdf.addPage();
        yPosition = 20;
      }
    });
  }

  // Summary stats
  const totalSends = campaignSends.length;
  const totalOpened = campaignSends.filter(s => s.opened).length;
  const overallOpenRate = totalSends > 0 ? ((totalOpened / totalSends) * 100).toFixed(1) : 0;

  yPosition += 10;
  pdf.setFillColor(240, 240, 240);
  pdf.rect(15, yPosition, 180, 40, 'F');

  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(11);
  pdf.text('Overall Performance', 20, yPosition + 8);

  pdf.setFontSize(10);
  pdf.text(`Total Emails Sent: ${totalSends}`, 20, yPosition + 18);
  pdf.text(`Total Opens: ${totalOpened}`, 110, yPosition + 18);
  pdf.text(`Overall Open Rate: ${overallOpenRate}%`, 20, yPosition + 28);

  // Footer note
  yPosition += 50;
  pdf.setFontSize(9);
  pdf.setTextColor(150, 150, 150);
  pdf.text('For detailed insights, visit your portal at app.marketingio.co.za/client-portal', 15, yPosition);

  return pdf.output('arraybuffer');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { client_id } = await req.json();

  if (!client_id) {
    return Response.json({ error: 'Missing client_id' }, { status: 400 });
  }

  try {
    // Fetch client
    const client = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    if (!client?.[0]) {
      return Response.json({ success: true });
    }

    const c = client[0];

    // Fetch campaigns for this client (if linked via deal or directly)
    const campaigns = await base44.asServiceRole.entities.MarketingCampaign.filter({}, '-created_date', 50);
    const campaignSends = await base44.asServiceRole.entities.CampaignSend.filter({}, '-sent_at', 500);

    if (!campaigns || campaigns.length === 0) {
      return Response.json({ success: true, message: 'No campaigns to report' });
    }

    // Generate PDF
    const pdfBuffer = await generatePDFReport(c, campaigns, campaignSends);

    // Send email
    const apiKey = Deno.env.get('RESEND_API_KEY');
    if (apiKey && c.email) {
      const resend = new Resend(apiKey);
      const { year, month } = getLastMonth();
      const monthYear = formatMonthYear(year, month);

      const bodyHtml = `
        <p style="margin:0 0 16px 0;">Hi ${c.contact_person || 'there'},</p>
        <p style="margin:0 0 16px 0;">Your <strong>${monthYear} campaign performance report</strong> is ready!</p>
        <p style="margin:0 0 16px 0;">This month's campaigns reached thousands of people. See the full breakdown in the attached PDF.</p>
        <div style="background:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;font-size:14px;"><strong style="color:#a764e6;">📊 Your Report Includes:</strong></p>
          <ul style="margin:8px 0 0 0;padding:0 0 0 20px;color:#475569;">
            <li style="margin:4px 0;">Campaigns sent this month</li>
            <li style="margin:4px 0;">Email open rates & engagement</li>
            <li style="margin:4px 0;">Performance trends</li>
          </ul>
        </div>
        <p style="margin:0 0 16px 0;"><a href="https://app.marketingio.co.za/client-portal" style="color:#a764e6;text-decoration:underline;">View detailed analytics in your portal →</a></p>
        <p style="margin:0;">Questions? Reply to this email or <a href="https://app.marketingio.co.za/client-portal" style="color:#a764e6;">message your team</a>.</p>`;

      await resend.emails.send({
        from: 'Marketing iO Reports <reports@marketingio.co.za>',
        to: c.email,
        subject: `Your ${monthYear} Campaign Report 📊`,
        html: wrapEmailHTML(bodyHtml),
        attachments: [
          {
            filename: `Campaign_Report_${monthYear.replace(' ', '_')}.pdf`,
            content: Buffer.from(pdfBuffer).toString('base64'),
            encoding: 'base64',
            content_type: 'application/pdf'
          }
        ]
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[generate-campaign-report]', err);
    return Response.json({ success: true });
  }
});