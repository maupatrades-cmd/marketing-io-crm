import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get current month
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const year = now.getFullYear();
    const currentMonth = `${year}-${month}`;

    // Find all draft/reviewed reports from previous month
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    const prevMonth = (lastMonth.getMonth() + 1).toString().padStart(2, "0");
    const prevYear = lastMonth.getFullYear();
    const previousMonth = `${prevYear}-${prevMonth}`;

    const unsentReports = await base44.entities.MonthlyReport.filter({
      report_month: previousMonth
    });

    const drafts = unsentReports.filter(r => r.status === "draft" || r.status === "reviewed");

    let tasksCreated = 0;

    for (const report of drafts) {
      try {
        // Create urgent task
        await base44.entities.Task.create({
          title: `URGENT: Send monthly report — ${report.client_name} (${report.report_month})`,
          client_id: report.client_id,
          client_name: report.client_name,
          priority: "urgent",
          status: "open",
          due_date: now.toISOString().split("T")[0],
          description: `This report was due on the 5th. Please send immediately to maintain client satisfaction.`,
          auto_generated: true
        });

        tasksCreated++;
      } catch (err) {
        console.error(`Failed to create task for ${report.client_name}:`, err);
      }
    }

    return Response.json({
      success: true,
      tasksCreated,
      reportsEscalated: drafts.length
    });

  } catch (error) {
    console.error("Error escalating reports:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});