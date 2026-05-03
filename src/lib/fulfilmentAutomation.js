import { base44 } from '@/api/base44Client';
import { notifyClient } from '@/lib/clientNotifier';

/**
 * When a deal closes (stage = closed_won), auto-create deliverables
 * based on the matching FulfilmentTemplate
 */
export async function autoCreateDeliverables(deal, client, contract) {
  try {
    // Determine which FulfilmentTemplate to use
    let templateCode = null;

    if (deal.deal_type === 'core_package') {
      // Map package names to template codes
      const packageMap = {
        ignite: 'ignite_core_package',
        accelerate: 'accelerate_core_package',
        dominate: 'dominate_core_package',
        street_pulse: 'street_pulse_core_package',
        township_pulse: 'township_pulse_core_package'
      };
      templateCode = packageMap[deal.package];
    } else if (deal.deal_type === 'add_on') {
      // For add-ons, use the add_on_name directly (should match template code)
      templateCode = deal.add_on_name;
    }

    if (!templateCode) {
      console.error(`[FulfilmentAutomation] No template found for deal ${deal.id} package ${deal.package || deal.add_on_name}`);
      // Create a generic task for manual setup
      await base44.entities.Task.create({
        title: `Manual deliverable setup needed`,
        description: `No FulfilmentTemplate found for ${deal.deal_type} - ${deal.package || deal.add_on_name}`,
        client_id: deal.client_id,
        client_name: deal.client_name,
        deal_id: deal.id,
        status: 'open',
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0],
        auto_generated: true
      });
      return { success: false, error: 'No template found' };
    }

    // Load the FulfilmentTemplate
    const templates = await base44.entities.FulfilmentTemplate.filter({
      code: templateCode
    });

    if (!templates || templates.length === 0) {
      console.error(`[FulfilmentAutomation] Template ${templateCode} not found in database`);
      await base44.entities.Task.create({
        title: `Manual deliverable setup needed`,
        description: `FulfilmentTemplate ${templateCode} not seeded for ${deal.client_name}`,
        client_id: deal.client_id,
        client_name: deal.client_name,
        deal_id: deal.id,
        status: 'open',
        priority: 'high',
        due_date: new Date().toISOString().split('T')[0],
        auto_generated: true
      });
      return { success: false, error: 'Template not seeded' };
    }

    const template = templates[0];

    // Parse deliverables arrays
    let setupDeliverables = [];
    let recurringDeliverables = [];

    try {
      setupDeliverables = template.setup_deliverables ? JSON.parse(template.setup_deliverables) : [];
      recurringDeliverables = template.recurring_deliverables ? JSON.parse(template.recurring_deliverables) : [];
    } catch (err) {
      console.error('[FulfilmentAutomation] Failed to parse deliverables JSON:', err);
      setupDeliverables = [];
      recurringDeliverables = [];
    }

    // Create setup deliverables
    const createdDeliverables = [];
    for (const deliverableTitle of setupDeliverables) {
      try {
        const deliverable = await base44.entities.Deliverable.create({
          client_id: deal.client_id,
          client_name: deal.client_name,
          deal_id: deal.id,
          title: deliverableTitle,
          phase: 'setup',
          product: template.code,
          assigned_to: null, // Admin will assign specific person later
          owner_role: template.internal_owner_role,
          status: 'not_started',
          due_date: new Date(Date.now() + template.soft_sla_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: `Auto-created from FulfilmentTemplate ${template.code}`
        });
        createdDeliverables.push(deliverable.id);
        // Notify client when deliverable moves to pending review (status set later by staff)
        // Hook: notify when status updated to pending_client_review is handled in Deliverables page
      } catch (err) {
        console.error(`[FulfilmentAutomation] Failed to create deliverable "${deliverableTitle}":`, err);
      }
    }

    // Create recurring deliverables (scheduled for first of next month)
    if (recurringDeliverables.length > 0) {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);

      for (const deliverableTitle of recurringDeliverables) {
        try {
          await base44.entities.Deliverable.create({
            client_id: deal.client_id,
            client_name: deal.client_name,
            deal_id: deal.id,
            title: deliverableTitle,
            phase: 'monthly_recurring',
            product: template.code,
            assigned_to: null,
            owner_role: template.internal_owner_role,
            status: 'not_started',
            month_year: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`,
            due_date: nextMonth.toISOString().split('T')[0],
            notes: `Auto-created recurring from FulfilmentTemplate ${template.code}`
          });
        } catch (err) {
          console.error(`[FulfilmentAutomation] Failed to create recurring deliverable:`, err);
        }
      }
    }

    // Create admin task for assignment
    try {
      await base44.entities.Task.create({
        title: `Review and assign owners for ${client.business_name || client.client_name} ${template.name}`,
        description: `${setupDeliverables.length} setup deliverables created. Assign to appropriate staff members.\n\nTemplate: ${template.code}\nOwner Role: ${template.internal_owner_role}\nSoft SLA: ${template.soft_sla_days} days\nHard SLA: ${template.hard_sla_days} days`,
        client_id: deal.client_id,
        client_name: deal.client_name,
        deal_id: deal.id,
        status: 'open',
        priority: 'high',
        due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        auto_generated: true,
        notes: JSON.stringify({
          type: 'deliverable_assignment',
          template_code: template.code,
          created_deliverable_ids: createdDeliverables
        })
      });
    } catch (err) {
      console.error('[FulfilmentAutomation] Failed to create assignment task:', err);
    }

    console.log(`[FulfilmentAutomation] Created ${createdDeliverables.length} deliverables for deal ${deal.id}`);
    return { success: true, deliverables_created: createdDeliverables.length };
  } catch (err) {
    console.error('[FulfilmentAutomation] Failed to auto-create deliverables:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Lookup template code for add-on by name
 */
export const ADD_ON_TO_TEMPLATE_CODE = {
  'ai_chatbot': 'ai_chatbot',
  'whatsapp_automation': 'whatsapp_automation',
  'reputation_management': 'reputation_management',
  'google_business_profile': 'gbp_optimisation',
  'email_newsletter': 'email_newsletter',
  'short_form_video': 'short_form_video',
  'sms_marketing': 'sms_marketing',
  'staff_training_workshop': 'workshops',
  'marketing_audit': 'marketing_audit',
  'competitor_analysis': 'competitor_analysis',
  'ai_content_writing': 'ai_content_writing',
  'crm_training_setup': 'crm_training',
  'print_signage': 'print_signage_coordination',
  'domain_hosting_email': 'domain_hosting_reselling',
  'website_maintenance': 'website_maintenance',
  'paid_ads_management': 'paid_ads_management',
  'ecommerce_setup': 'ecommerce_setup',
  'business_plan': 'business_plan',
  'website_design_only': 'website_design_only',
  'business_plan_website_bundle': 'plan_website_bundle'
};