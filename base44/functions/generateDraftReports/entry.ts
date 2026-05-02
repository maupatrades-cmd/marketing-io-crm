import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all active clients
    const clients = await base44.asServiceRole.entities.Client.list("-created_date", 500);
    const activeClients = clients.filter(c => c.status === "active" || c.status === "onboarding");

    // Get previous month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    const month = (lastMonth.getMonth() + 1).toString().padStart(2, "0");
    const year = lastMonth.getFullYear();
    const monthStr = `${year}-${month}`;

    let reportsCreated = 0;
    let tasksCreated = 0;

    for (const client of activeClients) {
      try {
        // Check if report already exists for this month
        const existing = await base44.entities.MonthlyReport.filter({
          client_id: client.id,
          report_month: monthStr
        });

        if (existing && existing.length > 0) {
          continue; // Skip if already created
        }

        // Get deliverables for this client for the previous month
        const deliverables = await base44.entities.Deliverable.filter({
          client_id: client.id
        });

        const monthDeliverables = deliverables.filter(d => {
          if (!d.approved_date) return false;
          const dDate = new Date(d.approved_date);
          return dDate.getMonth() === lastMonth.getMonth() && dDate.getFullYear() === lastMonth.getFullYear();
        });

        // Create draft report
        const report = await base44.entities.MonthlyReport.create({
          client_id: client.id,
          client_name: client.business_name,
          report_month: monthStr,
          report_type: client.package || "combined",
          status: "draft",
          due_date: `${year}-${month}-05`
        });

        reportsCreated++;

        // Create task for owner
        await base44.entities.Task.create({
          title: `Review monthly report — ${client.business_name} (${monthStr})`,
          client_id: client.id,
          client_name: client.business_name,
          priority: "high",
          status: "open",
          due_date: `${year}-${month}-05`,
          description: "Review and approve the auto-generated monthly report before sending to client.",
          auto_generated: true
        });

        tasksCreated++;
      } catch (err) {
        console.error(`Failed to generate report for ${client.business_name}:`, err);
      }
    }

    return Response.json({
      success: true,
      reportsCreated,
      tasksCreated,
      month: monthStr
    });

  } catch (error) {
    console.error("Error generating draft reports:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});