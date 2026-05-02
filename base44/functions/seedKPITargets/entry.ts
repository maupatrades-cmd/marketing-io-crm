import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete existing targets to avoid duplicates
    const existing = await base44.asServiceRole.entities.KPITarget.list();
    for (const target of existing) {
      try {
        await base44.asServiceRole.entities.KPITarget.delete(target.id);
      } catch (e) {
        // ignore deletion errors
      }
    }

    const targets = [
      // FIELD AGENT (8 targets)
      { role: 'field_agent', metric_code: 'new_deals_closed', metric_name: 'New Deals Closed', target_value: 3, target_period: 'monthly', direction: 'minimum', unit: 'deals' },
      { role: 'field_agent', metric_code: 'discovery_visits', metric_name: 'Discovery Visits', target_value: 60, target_period: 'monthly', direction: 'minimum', unit: 'visits' },
      { role: 'field_agent', metric_code: 'pipeline_value_zar', metric_name: 'Pipeline Value', target_value: 30000, target_period: 'monthly', direction: 'minimum', unit: 'ZAR' },
      { role: 'field_agent', metric_code: 'crm_data_quality_pct', metric_name: 'CRM Data Quality', target_value: 100, target_period: 'monthly', direction: 'minimum', unit: '%' },
      { role: 'field_agent', metric_code: 'addon_upsells_existing', metric_name: 'Add-on Upsells', target_value: 2, target_period: 'monthly', direction: 'minimum', unit: 'upsells' },
      { role: 'field_agent', metric_code: 'response_time_hours', metric_name: 'Response Time', target_value: 24, target_period: 'daily', direction: 'maximum', unit: 'hours' },
      { role: 'field_agent', metric_code: 'daily_visits_or_touchpoints', metric_name: 'Daily Visits/Touchpoints', target_value: 3, target_period: 'daily', direction: 'minimum', unit: 'visits' },
      { role: 'field_agent', metric_code: 'weekly_proposals_sent', metric_name: 'Weekly Proposals', target_value: 5, target_period: 'weekly', direction: 'minimum', unit: 'proposals' },

      // CPC (8 targets)
      { role: 'cpc', metric_code: 'qualified_leads_per_month', metric_name: 'Qualified Leads', target_value: 30, target_period: 'monthly', direction: 'minimum', unit: 'leads' },
      { role: 'cpc', metric_code: 'closure_conversion_rate_pct', metric_name: 'Closure Conversion Rate', target_value: 25, target_period: 'monthly', direction: 'minimum', unit: '%' },
      { role: 'cpc', metric_code: 'daily_call_volume', metric_name: 'Daily Calls', target_value: 30, target_period: 'daily', direction: 'minimum', unit: 'calls' },
      { role: 'cpc', metric_code: 'existing_client_check_ins', metric_name: 'Client Check-ins', target_value: 10, target_period: 'monthly', direction: 'minimum', unit: 'calls' },
      { role: 'cpc', metric_code: 'upsells_to_existing', metric_name: 'Upsells to Existing', target_value: 3, target_period: 'monthly', direction: 'minimum', unit: 'upsells' },
      { role: 'cpc', metric_code: 'cpc_response_time_hours', metric_name: 'Response Time', target_value: 4, target_period: 'daily', direction: 'maximum', unit: 'hours' },
      { role: 'cpc', metric_code: 'cpc_crm_data_quality_pct', metric_name: 'CRM Data Quality', target_value: 100, target_period: 'monthly', direction: 'minimum', unit: '%' },
      { role: 'cpc', metric_code: 'criteria_qualification_pct', metric_name: '7-Criteria Qualification', target_value: 100, target_period: 'monthly', direction: 'minimum', unit: '%' },

      // ADMIN (6 targets)
      { role: 'admin', metric_code: 'contracts_loaded_per_week', metric_name: 'Contracts Loaded', target_value: 5, target_period: 'weekly', direction: 'minimum', unit: 'contracts' },
      { role: 'admin', metric_code: 'onboarding_form_followup_within_days', metric_name: 'Onboarding Form Follow-up', target_value: 3, target_period: 'monthly', direction: 'maximum', unit: 'days' },
      { role: 'admin', metric_code: 'monthly_invoice_dispatch_by', metric_name: 'Invoice Dispatch by 1st', target_value: 1, target_period: 'monthly', direction: 'maximum', unit: 'day' },
      { role: 'admin', metric_code: 'failed_debit_followup_within_hours', metric_name: 'Debit Failure Follow-up', target_value: 24, target_period: 'daily', direction: 'maximum', unit: 'hours' },
      { role: 'admin', metric_code: 'monthly_report_dispatch_by', metric_name: 'Monthly Reports by 5th', target_value: 5, target_period: 'monthly', direction: 'maximum', unit: 'day' },
      { role: 'admin', metric_code: 'onboarding_form_completion_rate_pct', metric_name: 'Form Completion Rate', target_value: 90, target_period: 'monthly', direction: 'minimum', unit: '%' },

      // OWNER/FOUNDER (5 targets)
      { role: 'founder', metric_code: 'monthly_revenue_zar', metric_name: 'Monthly Revenue (MRR)', target_value: 100000, target_period: 'monthly', direction: 'minimum', unit: 'ZAR' },
      { role: 'founder', metric_code: 'new_clients_signed_per_month', metric_name: 'New Clients Signed', target_value: 10, target_period: 'monthly', direction: 'minimum', unit: 'clients' },
      { role: 'founder', metric_code: 'overall_retention_rate_pct', metric_name: 'Client Retention', target_value: 90, target_period: 'quarterly', direction: 'minimum', unit: '%' },
      { role: 'founder', metric_code: 'staff_satisfaction_score', metric_name: 'Staff Satisfaction', target_value: 8, target_period: 'quarterly', direction: 'minimum', unit: 'out of 10' },
      { role: 'founder', metric_code: 'pipeline_health_zar', metric_name: 'Pipeline Health', target_value: 250000, target_period: 'monthly', direction: 'minimum', unit: 'ZAR' },

      // HEAD OF TECH (5 targets)
      { role: 'head_of_tech', metric_code: 'bucket_b_setup_within_sla_pct', metric_name: 'Bucket B Setup SLA', target_value: 95, target_period: 'monthly', direction: 'minimum', unit: '%' },
      { role: 'head_of_tech', metric_code: 'website_uptime_pct', metric_name: 'Website Uptime', target_value: 99, target_period: 'monthly', direction: 'minimum', unit: '%' },
      { role: 'head_of_tech', metric_code: 'avg_setup_time_days', metric_name: 'Avg Setup Time', target_value: 25, target_period: 'monthly', direction: 'maximum', unit: 'days' },
      { role: 'head_of_tech', metric_code: 'bug_tickets_resolved_within_days', metric_name: 'Bug Resolution Time', target_value: 3, target_period: 'monthly', direction: 'maximum', unit: 'days' },
      { role: 'head_of_tech', metric_code: 'ai_chatbot_active_clients', metric_name: 'AI Chatbot Active Clients', target_value: 0, target_period: 'monthly', direction: 'minimum', unit: 'clients', notes: 'Tracked for insights, not a performance target' },

      // DRIVER/PHOTO-EVIDENCE (3 targets)
      { role: 'driver', metric_code: 'photo_evidence_upload_rate_pct', metric_name: 'Photo Evidence Upload Rate', target_value: 100, target_period: 'monthly', direction: 'minimum', unit: '%' },
      { role: 'driver', metric_code: 'on_time_arrival_rate_pct', metric_name: 'On-time Arrival Rate', target_value: 95, target_period: 'monthly', direction: 'minimum', unit: '%' },
    ];

    await base44.asServiceRole.entities.KPITarget.bulkCreate(targets);

    return Response.json({
      success: true,
      message: `Seeded ${targets.length} KPI targets across all roles`,
      count: targets.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});