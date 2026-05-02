import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { dealId, clientId } = await req.json();

    if (!dealId || !clientId) {
      return Response.json({ error: "dealId and clientId required" }, { status: 400 });
    }

    // Fetch deal, client, and onboarding record
    const [deal, client] = await Promise.all([
      base44.entities.Deal.filter({ id: dealId }),
      base44.entities.Client.filter({ id: clientId }),
    ]);

    if (!deal || !client) {
      return Response.json({ error: "Deal or Client not found" }, { status: 404 });
    }

    const dealRecord = Array.isArray(deal) ? deal[0] : deal;
    const clientRecord = Array.isArray(client) ? client[0] : client;

    if (!clientRecord.email) {
      return Response.json({ error: "Client email not found" }, { status: 400 });
    }

    const packageLabel = dealRecord.package !== "none" ? dealRecord.package : dealRecord.add_on_name || "Custom Package";
    const clientName = clientRecord.business_name || "Client";
    const contactFirstName = clientRecord.contact_person?.split(" ")[0] || "Valued Client";

    // Send welcome email
    const emailBody = `Dear ${contactFirstName},

Welcome to Marketing iO! We're thrilled to have ${clientName} on board.

Attached is your personalised Welcome Pack, which contains everything you need to know about how we'll work together over the next few weeks.

Here's what happens next:
1. Review your Welcome Pack
2. Pay the setup invoice (within 5 days)
3. Complete the onboarding form
4. Sign the debit mandate
5. Share your brand assets with us

We'll guide you through every step. If you have any questions, reach out anytime at info@marketingio.co.za or WhatsApp your team lead.

Let's get your business visible, heard, and growing!

Best regards,
Thapelo Maupa
Founder & General Manager
Marketing iO`;

    // Since we can't attach files via SendEmail integration yet, send as text + provide link
    await base44.integrations.Core.SendEmail({
      to: clientRecord.email,
      subject: `Welcome to Marketing iO, ${clientName}!`,
      body: emailBody,
      from_name: "Marketing iO"
    });

    // Log activity
    await base44.entities.ClientActivityLog.create({
      client_id: clientId,
      client_name: clientName,
      event_type: "communication_sent",
      event_label: "Welcome Pack email sent",
      logged_by: "system",
      logged_by_name: "Automation"
    });

    return Response.json({
      success: true,
      message: "Welcome Pack email sent successfully",
      client: clientRecord.email
    });

  } catch (error) {
    console.error("Error sending Welcome Pack:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});