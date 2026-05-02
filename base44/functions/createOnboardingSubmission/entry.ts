import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// Generate random 32-char alphanumeric token
function generateToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { dealId } = await req.json();

    if (!dealId) {
      return Response.json({ error: "dealId required" }, { status: 400 });
    }

    // Fetch the deal
    const deals = await base44.entities.Deal.filter({ id: dealId });
    const deal = Array.isArray(deals) ? deals[0] : deals;

    if (!deal) {
      return Response.json({ error: "Deal not found" }, { status: 404 });
    }

    // Check if submission already exists
    const existing = await base44.entities.ClientOnboardingSubmission.filter({ deal_id: dealId });
    if (existing && existing.length > 0) {
      return Response.json({ success: true, message: "Submission already exists", token: existing[0].submission_token });
    }

    // Fetch client
    const clients = await base44.entities.Client.filter({ id: deal.client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;

    if (!client || !client.email) {
      return Response.json({ error: "Client or client email not found" }, { status: 404 });
    }

    // Generate token
    const token = generateToken();

    // Create submission
    const submission = await base44.entities.ClientOnboardingSubmission.create({
      client_id: deal.client_id,
      deal_id: dealId,
      submission_token: token,
      submission_status: "not_started",
    });

    // Construct URL - using window.location.origin is not available in backend
    // Instead, we'll use a generic app URL format
    const appUrl = `https://app.base44.com`; // This should be dynamically set based on app
    const formUrl = `${appUrl}/client-onboarding/${token}`;

    // Send email to client
    const emailBody = `Hi ${client.contact_person?.split(" ")[0] || "there"},

We're excited to get you set up! To get started with Marketing iO, we need you to complete a quick onboarding form.

📋 Complete Your Onboarding Form:
${formUrl}

This form takes just 15-20 minutes and helps us understand your business, brand, and goals.

⏱️ Please complete this within 5 business days so we can keep your onboarding on track.

If you have any questions, reply to this email or WhatsApp your team lead.

Looking forward to working with you!

Best regards,
Marketing iO Team`;

    await base44.integrations.Core.SendEmail({
      to: client.email,
      subject: `Action Required — Complete Your Marketing iO Onboarding`,
      body: emailBody,
      from_name: "Marketing iO"
    });

    // Log activity
    await base44.entities.ClientActivityLog.create({
      client_id: deal.client_id,
      client_name: client.business_name,
      event_type: "communication_sent",
      event_label: "Onboarding form link sent",
      logged_by: "system",
      logged_by_name: "Automation"
    });

    return Response.json({
      success: true,
      message: "Onboarding submission created and email sent",
      token,
      formUrl,
      client: client.email
    });

  } catch (error) {
    console.error("Error creating onboarding submission:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});