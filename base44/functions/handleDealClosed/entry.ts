import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

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

    // Only process closed_won deals
    if (deal.stage !== "closed_won") {
      return Response.json({ success: true, message: "Deal not closed_won, skipping" });
    }

    // Fetch client
    const clients = await base44.entities.Client.filter({ id: deal.client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;

    if (!client || !client.email) {
      return Response.json({ error: "Client or client email not found" }, { status: 404 });
    }

    // Send welcome email via function
    await base44.functions.invoke("sendWelcomePack", {
      dealId: deal.id,
      clientId: deal.client_id
    });

    // Create onboarding submission
    await base44.functions.invoke("createOnboardingSubmission", {
      dealId: deal.id
    });

    return Response.json({
      success: true,
      message: "Deal closed — Welcome Pack and onboarding form sent",
      client: client.email
    });

  } catch (error) {
    console.error("Error handling deal closed:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});