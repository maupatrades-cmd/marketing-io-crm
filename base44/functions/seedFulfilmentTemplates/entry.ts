import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FULFILMENT_TEMPLATES = [
  // BUCKET B — Setup + Recurring (5)
  {
    code: 'ai_chatbot',
    name: 'AI Chatbot Setup',
    bucket: 'bucket_b_setup_recurring',
    pricing_setup_zar: 6500,
    pricing_recurring_zar: 350,
    term_months: 0,
    soft_sla_days: 21,
    hard_sla_days: 30,
    internal_owner_role: 'head_of_tech',
    setup_deliverables: JSON.stringify([
      'Discovery call: top 20 customer questions, escalation paths, business hours',
      'Platform selection (Tidio or ManyChat)',
      'Bot script written: greeting + FAQ tree (top 20 questions) + handoff trigger',
      'Bot branding: avatar, brand colours, tone matched',
      'Website chat widget integration',
      '10 test scenarios run before go-live',
      'Client training: 30-min dashboard walkthrough'
    ]),
    recurring_deliverables: JSON.stringify([
      'Bot conversation review across past 30 days',
      'New FAQ additions from real customer questions',
      'Performance report: conversations, escalation rate, common topics',
      'Bot rule refinements'
    ]),
    client_obligations: 'Provide top 20 customer questions, brand assets, website access',
    scope_exclusions: 'Premium tiers, custom integrations beyond standard API',
    tools_used: 'Tidio or ManyChat',
    sign_off_criteria: 'Bot live on website, 10 test scenarios passed, client trained',
    exit_fee_zar: 1500,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'whatsapp_automation',
    name: 'WhatsApp Business Automation',
    bucket: 'bucket_b_setup_recurring',
    pricing_setup_zar: 3500,
    pricing_recurring_zar: 200,
    term_months: 0,
    soft_sla_days: 18,
    hard_sla_days: 30,
    internal_owner_role: 'head_of_tech',
    setup_deliverables: JSON.stringify([
      'WhatsApp Business API connection (ManyChat or 360dialog)',
      'Auto-greeting message',
      'After-hours away message',
      'Quick-reply menu (top 5 customer requests)',
      'Catalog setup (up to 20 products with name, price, photo, description)',
      'Broadcast list seeded (up to 256 contacts)',
      'Full conversation flow testing'
    ]),
    recurring_deliverables: JSON.stringify([
      'One broadcast campaign per month (client supplies offer)',
      'Auto-reply rule refinements',
      'New broadcast list contact additions',
      'Performance report: messages sent, response rate, broadcast opens, opt-outs'
    ]),
    client_obligations: 'Provide 20 product details, top 5 customer request categories, initial contact list',
    scope_exclusions: 'Broadcast list management beyond 256 contacts, custom integrations',
    tools_used: 'ManyChat or 360dialog',
    sign_off_criteria: 'API connected, test messages sent, catalog live, broadcast working',
    exit_fee_zar: 600,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'sms_marketing',
    name: 'SMS Marketing',
    bucket: 'bucket_b_setup_recurring',
    pricing_setup_zar: 500,
    pricing_recurring_zar: 500,
    term_months: 0,
    soft_sla_days: 14,
    hard_sla_days: 21,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([
      'SMS gateway account (Bulk SMS / Clickatell)',
      'Sender ID registered',
      'Opt-in/opt-out POPIA-compliant flows',
      'Initial subscriber list import (client provides)',
      'Template message library (5 standard templates)',
      'Test send to 5 numbers'
    ]),
    recurring_deliverables: JSON.stringify([
      'Up to 4 SMS campaigns per month (client supplies offer)',
      'Send-time optimisation',
      'POPIA-compliant unsubscribe handling',
      'Performance report: deliverability, opt-outs, click-through'
    ]),
    client_obligations: 'Provide subscriber list in CSV format, POPIA-compliant consent records, campaign offers',
    scope_exclusions: 'Per-SMS costs billed separately at R0.15-R0.40 per SMS. Subscriber list management beyond initial import.',
    tools_used: 'Bulk SMS or Clickatell',
    sign_off_criteria: 'Account active, sender ID approved, test sends successful, POPIA flows validated',
    exit_fee_zar: 300,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'website_design_only',
    name: 'Website Design Only',
    bucket: 'bucket_b_setup_recurring',
    pricing_setup_zar: 2000,
    pricing_recurring_zar: 430,
    term_months: 0,
    soft_sla_days: 22,
    hard_sla_days: 30,
    internal_owner_role: 'founder',
    setup_deliverables: JSON.stringify([
      'Discovery: brand, content, structure',
      'Wireframes (3-5 pages)',
      'Design mockups for client review',
      'Build on WordPress or static HTML',
      'Content population from client',
      'Mobile responsive testing',
      'Domain + hosting setup',
      'SSL certificate',
      'Go-live deployment'
    ]),
    recurring_deliverables: JSON.stringify([
      'Hosting + domain maintenance',
      'Uptime monitoring + daily backups',
      'Security updates',
      'Email deliverability checks',
      'Up to one minor content change per month'
    ]),
    client_obligations: 'Provide content (copy, images, business info), brand assets, domain registrar access if existing',
    scope_exclusions: 'Custom e-commerce (see E-commerce Setup), more than 5 pages, stock photography license fees',
    tools_used: 'WordPress or static HTML/CSS',
    sign_off_criteria: 'Mobile-responsive, SSL active, test order placed, client sign-off received',
    exit_fee_zar: 1000,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'plan_website_bundle',
    name: 'Business Plan + Website Bundle',
    bucket: 'bucket_b_setup_recurring',
    pricing_setup_zar: 2600,
    pricing_recurring_zar: 430,
    term_months: 0,
    soft_sla_days: 25,
    hard_sla_days: 35,
    internal_owner_role: 'founder',
    setup_deliverables: JSON.stringify([
      'Business plan: 2-hour discovery, market research, competitive analysis, marketing strategy, 12-month financials, 30-page document, 60-min review call',
      'Discovery: brand, content, structure',
      'Wireframes (3-5 pages)',
      'Design mockups for client review',
      'Build on WordPress or static HTML',
      'Content population from client',
      'Mobile responsive testing',
      'Domain + hosting setup',
      'SSL certificate',
      'Go-live deployment'
    ]),
    recurring_deliverables: JSON.stringify([
      'Hosting + domain maintenance',
      'Uptime monitoring + daily backups',
      'Security updates',
      'Email deliverability checks',
      'Up to one minor content change per month'
    ]),
    client_obligations: 'Provide content, brand assets, financial data, domain access',
    scope_exclusions: 'Custom e-commerce, more than 5 pages',
    tools_used: 'WordPress or static HTML/CSS',
    sign_off_criteria: 'Business plan presented, website live, SSL active, client sign-off',
    exit_fee_zar: 1500,
    exit_fee_window_months: 6,
    is_active: true
  },
  // BUCKET C — Pure Recurring (5)
  {
    code: 'reputation_management',
    name: 'Reputation Management',
    bucket: 'bucket_c_pure_recurring',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 1800,
    term_months: 0,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      'Monitor Google, Facebook, TripAdvisor reviews daily',
      'Respond to every review within 24 hours (positive: thank-you / negative: empathetic per client tone)',
      'Flag fake/abusive reviews to platforms',
      'Monthly review summary: total reviews, average rating, response time, sentiment trend',
      'Quarterly review-acquisition campaign suggestion'
    ]),
    client_obligations: 'Approve tone/templates for responses, escalate complex issues',
    scope_exclusions: 'Paid review removal services, reputation on external forums',
    tools_used: 'Google My Business, Meta Business Suite, TripAdvisor',
    sign_off_criteria: 'All reviews tracked and responded to within 24 hours',
    exit_fee_zar: 1800,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'email_newsletter',
    name: 'Email Newsletter',
    bucket: 'bucket_c_pure_recurring',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 900,
    term_months: 0,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      '1 newsletter per month (max 1,500 subscribers)',
      'Content writing + design',
      'List hygiene (bounces, unsubscribes)',
      'Send via Mailchimp or Brevo',
      'Performance report: open rate, click rate, unsubscribes'
    ]),
    client_obligations: 'Provide newsletter content ideas or copy, subscriber list',
    scope_exclusions: 'Subscriber list management beyond list hygiene, custom integrations',
    tools_used: 'Mailchimp or Brevo',
    sign_off_criteria: '1 newsletter sent per month minimum',
    exit_fee_zar: 900,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'short_form_video',
    name: 'Short-Form Video',
    bucket: 'bucket_c_pure_recurring',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 1500,
    term_months: 0,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      '4 video concepts agreed monthly (client OR Marketing iO suggests)',
      'Filming coordination (1 day/month)',
      'Editing: 4 videos cut + captioned + music added',
      'Posted to client\'s TikTok/Instagram/YouTube Shorts',
      'Performance report: views, engagement'
    ]),
    client_obligations: 'Confirm filming date and location, approve final videos, provide raw footage if client-filmed',
    scope_exclusions: 'Professional cinematography crew, location permits, actor fees',
    tools_used: 'Adobe Premiere, TikTok, Instagram, YouTube',
    sign_off_criteria: '4 videos posted per month minimum',
    exit_fee_zar: 1500,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'ai_content_writing',
    name: 'AI Content Writing',
    bucket: 'bucket_c_pure_recurring',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 800,
    term_months: 0,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      '8 social media posts per month (mixed: graphic + caption + hashtags)',
      '2 blog articles per month (800-1,200 words SEO-optimised)',
      'AI-assisted draft + human edit + brand voice check',
      'Performance report'
    ]),
    client_obligations: 'Approve posting schedule, provide industry/topic guidance, review drafts',
    scope_exclusions: 'Custom graphics design, professional photography, paid distribution',
    tools_used: 'ChatGPT/Claude, Canva (basic), WordPress',
    sign_off_criteria: 'Min 8 posts + 2 articles per month, brand voice maintained',
    exit_fee_zar: 800,
    exit_fee_window_months: 6,
    is_active: true
  },
  {
    code: 'website_maintenance',
    name: 'Website Maintenance',
    bucket: 'bucket_c_pure_recurring',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 550,
    term_months: 0,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'head_of_tech',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      'Hosting + domain maintenance',
      'Daily backups',
      'Security updates + plugin updates',
      'Uptime monitoring (99% target)',
      'Up to one minor content change per month'
    ]),
    client_obligations: 'Report bugs/issues promptly, provide credentials if needed',
    scope_exclusions: 'Major redesigns, custom development, SSL certificate renewals on client-owned domain',
    tools_used: 'WordPress, cPanel, Xneelo',
    sign_off_criteria: '99% uptime maintained, daily backups confirmed',
    exit_fee_zar: 550,
    exit_fee_window_months: 6,
    is_active: true
  },
  // BUCKET A — Once-Off (7)
  {
    code: 'gbp_optimisation',
    name: 'GBP Optimisation',
    bucket: 'bucket_a_once_off',
    pricing_setup_zar: 800,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 7,
    hard_sla_days: 14,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([
      'Google Business Profile claim + verify',
      'Complete profile: hours, services, photos, attributes',
      '10 location-based keywords researched + added',
      'Initial Q&A seeded (5 questions client typically gets)',
      'First post created',
      'Client training: how to add posts + photos going forward'
    ]),
    recurring_deliverables: JSON.stringify([]),
    client_obligations: 'Provide verified business email, authorised ownership/manager info, photos, location hours',
    scope_exclusions: 'Ongoing post management, paid GBP advertising',
    tools_used: 'Google Business Profile',
    sign_off_criteria: 'Profile fully optimised, live, verified, 5 Q&A + 1 post live',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  {
    code: 'marketing_audit',
    name: 'Marketing Audit',
    bucket: 'bucket_a_once_off',
    pricing_setup_zar: 2000,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 14,
    hard_sla_days: 21,
    internal_owner_role: 'founder',
    setup_deliverables: JSON.stringify([
      'Brand audit (logo, identity, voice)',
      'Online presence audit (website, GBP, social, reviews)',
      'Competitor benchmarking (3 competitors)',
      '10-page report with strengths/weaknesses/3 opportunities',
      '60-min presentation call',
      'Recommendations matrix: what to fix vs invest in'
    ]),
    recurring_deliverables: JSON.stringify([]),
    client_obligations: 'Provide website admin access, brand guidelines, historical marketing data, 1 hour for discovery call',
    scope_exclusions: 'Implementation of recommendations, ongoing strategy',
    tools_used: 'Google Analytics, SEMrush, competitive research tools',
    sign_off_criteria: '10-page report delivered, presentation call completed',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  {
    code: 'competitor_analysis',
    name: 'Competitor Analysis',
    bucket: 'bucket_a_once_off',
    pricing_setup_zar: 1500,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 10,
    hard_sla_days: 14,
    internal_owner_role: 'founder',
    setup_deliverables: JSON.stringify([
      'Identify 5 competitors',
      'Pricing comparison',
      'Online presence comparison',
      'Strengths/weaknesses analysis per competitor',
      '8-page report',
      '30-min walkthrough call'
    ]),
    recurring_deliverables: JSON.stringify([]),
    client_obligations: 'Identify 3-5 known competitors, 30 min for walkthrough',
    scope_exclusions: 'Ongoing competitive intelligence, price monitoring',
    tools_used: 'SEMrush, competitive research tools',
    sign_off_criteria: '8-page report delivered, walkthrough call completed',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  {
    code: 'crm_training',
    name: 'CRM Training + Setup',
    bucket: 'bucket_a_once_off',
    pricing_setup_zar: 3000,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 7,
    hard_sla_days: 14,
    internal_owner_role: 'head_of_tech',
    setup_deliverables: JSON.stringify([
      '1-hour discovery: client\'s current system + needs',
      'HubSpot Free or Zoho CRM setup',
      'Pipeline configuration',
      'Custom fields for client\'s industry',
      'Email templates loaded',
      '2-hour training session for up to 3 users',
      '30-day post-training email support'
    ]),
    recurring_deliverables: JSON.stringify([]),
    client_obligations: 'Provide 3 user seats, current customer data/CRM export, 2 hours for training',
    scope_exclusions: 'Data migration from complex legacy systems, advanced custom development',
    tools_used: 'HubSpot Free or Zoho CRM',
    sign_off_criteria: 'CRM live, pipeline configured, users trained, support email active',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  {
    code: 'workshops',
    name: 'Workshops (90 min or Half-Day)',
    bucket: 'bucket_a_once_off',
    pricing_setup_zar: 3500,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 14,
    hard_sla_days: 21,
    internal_owner_role: 'founder',
    setup_deliverables: JSON.stringify([
      'Topic agreed with client (digital basics, social, GBP, content)',
      'Custom slides for client\'s industry',
      'Workshop materials (handouts)',
      'Venue coordination (or virtual)',
      'Live workshop delivery',
      'Attendance signatures collected',
      'Follow-up email with recording + materials'
    ]),
    recurring_deliverables: JSON.stringify([]),
    client_obligations: 'Confirm topic, provide attendee list, venue (or virtual link), 90 min to 4 hours',
    scope_exclusions: 'Multiple locations same day, external catering, travel beyond Limpopo',
    tools_used: 'Google Slides, Zoom or in-person',
    sign_off_criteria: 'Workshop delivered, attendance sheet signed, materials emailed',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  {
    code: 'business_plan',
    name: 'Business Plan Standalone',
    bucket: 'bucket_a_once_off',
    pricing_setup_zar: 1600,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 19,
    hard_sla_days: 28,
    internal_owner_role: 'founder',
    setup_deliverables: JSON.stringify([
      '2-hour discovery call: vision, goals, market, financials',
      'Market research',
      'Competitive analysis',
      'Marketing strategy section',
      'Financial projections (12 months)',
      '30-page document delivered',
      '60-min review call'
    ]),
    recurring_deliverables: JSON.stringify([]),
    client_obligations: 'Provide 2 hours for discovery, financial data, business details, 1 hour for review call',
    scope_exclusions: 'Bank loan application preparation, legal entity setup',
    tools_used: 'Word, Excel, market research databases',
    sign_off_criteria: '30-page plan delivered, review call completed, client sign-off',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  {
    code: 'ecommerce_setup',
    name: 'E-commerce Setup',
    bucket: 'bucket_a_once_off',
    pricing_setup_zar: 3500,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 21,
    hard_sla_days: 30,
    internal_owner_role: 'head_of_tech',
    setup_deliverables: JSON.stringify([
      'Platform: Shopify or WooCommerce',
      'Up to 30 products loaded with photos + descriptions',
      'Payment gateway (Yoco / PayFast / PayGate)',
      'Shipping rules configured',
      'Tax/VAT setup',
      'Test orders run',
      'Client training: 1 hour'
    ]),
    recurring_deliverables: JSON.stringify([]),
    client_obligations: 'Provide 30+ product details, photos, prices, VAT/tax info, payment provider account',
    scope_exclusions: 'Product data migration from legacy system, custom shipping integrations, stock sync',
    tools_used: 'Shopify or WooCommerce, Yoco/PayFast/PayGate',
    sign_off_criteria: 'Store live, 30 products live, test order successful, client trained',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  // BUCKET D — Paid Ads (1)
  {
    code: 'paid_ads_management',
    name: 'Paid Ads Management',
    bucket: 'bucket_d_paid_ads',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 750,
    term_months: 0,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      'Campaign creation (Google Ads, Meta Ads)',
      'Audience targeting',
      'Ad copy + creative',
      'Daily monitoring + optimisation',
      'Weekly performance check-in',
      'Monthly performance report',
      'Trickle commission: 10% to closer monthly'
    ]),
    client_obligations: 'Provide ad budget (min R3,000/month), brand assets, conversion goal',
    scope_exclusions: 'Creative design (outsourced to freelancer at cost), website setup',
    tools_used: 'Google Ads, Meta Ads Manager',
    sign_off_criteria: 'First campaign live, performance tracked',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  // BUCKET E — Passive (2)
  {
    code: 'print_signage_coordination',
    name: 'Print/Signage Coordination',
    bucket: 'bucket_e_passive',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 0,
    term_months: 0,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      'Receive client design need',
      'Get 3 quotes from Polokwane print suppliers',
      'Apply 10-15% markup',
      'Quote client',
      'On approval: place order with supplier',
      'Coordinate delivery'
    ]),
    client_obligations: 'Provide design or brief, approve supplier quote, arrange pickup/delivery',
    scope_exclusions: 'Design creation, warranty on print quality',
    tools_used: 'Email, supplier contacts',
    sign_off_criteria: 'Order placed and delivered',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  },
  {
    code: 'domain_hosting_reselling',
    name: 'Domain/Hosting Reselling',
    bucket: 'bucket_e_passive',
    pricing_setup_zar: 0,
    pricing_recurring_zar: 150,
    term_months: 12,
    soft_sla_days: 0,
    hard_sla_days: 0,
    internal_owner_role: 'admin',
    setup_deliverables: JSON.stringify([]),
    recurring_deliverables: JSON.stringify([
      'Domain + hosting + email via Xneelo reseller account',
      'Annual renewal management',
      'DNS/email support'
    ]),
    client_obligations: 'Confirm domain name, provide contact/billing info',
    scope_exclusions: 'SSL certificate premium tier, DDoS protection, backup services',
    tools_used: 'Xneelo cPanel reseller account',
    sign_off_criteria: 'Domain registered, hosting active, DNS configured',
    exit_fee_zar: 0,
    exit_fee_window_months: 0,
    is_active: true
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'owner') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results = { created: 0, failed: 0, errors: [] };

    for (const template of FULFILMENT_TEMPLATES) {
      try {
        // Check if template already exists
        const existing = await base44.entities.FulfilmentTemplate.filter({
          code: template.code
        });

        if (existing && existing.length > 0) {
          console.log(`Template ${template.code} already exists, skipping`);
          continue;
        }

        await base44.entities.FulfilmentTemplate.create(template);
        results.created++;
        console.log(`Created template: ${template.code}`);
      } catch (err) {
        results.failed++;
        results.errors.push(`${template.code}: ${err.message}`);
        console.error(`Failed to create template ${template.code}:`, err);
      }
    }

    return Response.json({
      success: true,
      message: 'Fulfilment templates seeded',
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});