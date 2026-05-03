import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ONBOARDING_STEPS = [
  {
    step_number: 1,
    title: 'Upload Logo',
    description: 'Provide your business logo in square format (PNG or SVG preferred). We\'ll use this across all marketing materials.',
    category: 'brand_assets',
    required: true
  },
  {
    step_number: 2,
    title: 'Brand Guidelines',
    description: 'Upload any existing brand guidelines, color palette, or font information. If you don\'t have these, we can create them.',
    category: 'brand_assets',
    required: false
  },
  {
    step_number: 3,
    title: 'Business Information',
    description: 'Confirm your business description, target audience, and unique selling points.',
    category: 'business_info',
    required: true
  },
  {
    step_number: 4,
    title: 'Social Media Audit',
    description: 'Share links to your existing social media profiles so we can audit and optimize them.',
    category: 'business_info',
    required: false
  },
  {
    step_number: 5,
    title: 'Business Photos',
    description: 'Upload photos of your products, team, or location. These will be used in your website and marketing.',
    category: 'brand_assets',
    required: false
  },
  {
    step_number: 6,
    title: 'Website Access',
    description: 'If you have an existing website, provide login credentials so we can integrate and optimize.',
    category: 'access_credentials',
    required: false
  },
  {
    step_number: 7,
    title: 'Content Calendar Review',
    description: 'Review and approve the content calendar we\'ll create for your first month.',
    category: 'content_plan',
    required: true
  },
  {
    step_number: 8,
    title: 'Launch Checklist',
    description: 'Final review of all setup items before your package goes live.',
    category: 'approval',
    required: true
  }
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { deal_id } = await req.json();

  if (!deal_id) {
    return Response.json({ error: 'deal_id required' }, { status: 400 });
  }

  try {
    // Get deal
    const deal = await base44.asServiceRole.entities.Deal.filter({ id: deal_id });
    if (!deal?.[0]) {
      return Response.json({ error: 'Deal not found' }, { status: 404 });
    }

    const dealRecord = Array.isArray(deal) ? deal[0] : deal;
    const client_id = dealRecord.client_id;

    // Check if onboarding already started for this deal
    const existing = await base44.asServiceRole.entities.ClientOnboardingProgress.filter({
      deal_id: deal_id
    });
    if (existing?.length > 0) {
      return Response.json({ success: false, message: 'Onboarding already initiated for this deal' }, { status: 200 });
    }

    // Create OnboardingProgress record
    const progress = await base44.asServiceRole.entities.ClientOnboardingProgress.create({
      client_id: client_id,
      deal_id: deal_id,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      total_steps: ONBOARDING_STEPS.length,
      completed_steps: 0,
      progress_percentage: 0
    });

    // Create OnboardingStep records for each step
    const steps = [];
    for (const stepDef of ONBOARDING_STEPS) {
      const step = await base44.asServiceRole.entities.OnboardingStep.create({
        client_id: client_id,
        deal_id: deal_id,
        step_number: stepDef.step_number,
        title: stepDef.title,
        description: stepDef.description,
        category: stepDef.category,
        required: stepDef.required,
        is_completed: false
      });
      steps.push(step);
    }

    console.log('[initiate-onboarding] Created progress and steps for deal:', deal_id);

    return Response.json({
      success: true,
      progress_id: progress.id,
      steps_created: steps.length
    }, { status: 200 });
  } catch (err) {
    console.error('[initiate-onboarding] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});