import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { clientId, clientName } = await req.json();

    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }

    // Fetch admin/owner users
    const users = await base44.asServiceRole.entities.User.list();
    const admins = users.filter(u => u.role === "admin" || u.role === "owner");

    // Send notification to all admins
    for (const admin of admins) {
      try {
        await base44.integrations.Core.SendEmail({
          to: admin.email,
          subject: `New Onboarding Form Submission — ${clientName}`,
          body: `Hi ${admin.full_name},

${clientName} has submitted their onboarding form. Please review it at your earliest convenience.

🔗 Review submissions: https://app.base44.com/onboarding-submissions

Best regards,
Marketing iO Automation`,
          from_name: "Marketing iO"
        });
      } catch (err) {
        console.error(`Failed to notify ${admin.email}:`, err);
      }
    }

    return Response.json({
      success: true,
      message: `Notification sent to ${admins.length} admin(s)`
    });

  } catch (error) {
    console.error("Error notifying admin:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});