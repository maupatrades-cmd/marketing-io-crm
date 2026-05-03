import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PRODUCT_CATALOG = [
  { id: 'ignite', name: 'Ignite', headline: 'Look professional online — fast.', benefit: 'Logo, website, social setup.' },
  { id: 'accelerate', name: 'Accelerate', headline: 'Stop coasting. Start growing.', benefit: 'Full content production, ongoing social management.' },
  { id: 'dominate', name: 'Dominate', headline: 'Own your market.', benefit: 'Full brand build, paid ads management, strategic content.' },
  { id: 'street_pulse', name: 'Street Pulse', headline: 'Be impossible to miss.', benefit: 'Physical visibility, signage, on-the-ground brand presence.' },
  { id: 'township_pulse', name: 'Township Pulse', headline: 'Win in your community.', benefit: 'Branding designed for spaza shops, taxi-rank-adjacent businesses.' },
  { id: 'ai_chatbot', name: 'AI Chatbot', headline: 'Never miss a customer — even at 3am.', benefit: 'Reply in 2 seconds, 24/7. Every late-night enquiry becomes tomorrow\'s sale.' },
  { id: 'whatsapp_automation', name: 'WhatsApp Business Automation', headline: 'Be where 73% of South Africans actually are.', benefit: 'Auto-replies, lead capture, broadcast campaigns.' },
  { id: 'reputation_management', name: 'Reputation Management', headline: 'One bad review costs 30 customers.', benefit: 'We monitor every mention. Respond fast. Generate positive reviews.' },
  { id: 'google_business_profile', name: 'Google Business Profile', headline: 'Show up when customers search for you.', benefit: 'Optimised Google profile with photos, hours, reviews, and local SEO.' },
  { id: 'email_newsletter', name: 'Email Newsletter Management', headline: 'Stay top-of-mind every month.', benefit: 'Monthly branded newsletter that keeps your customers engaged.' },
  { id: 'short_form_video', name: 'Short-Form Video Pack', headline: 'TikTok and Reels are eating Google.', benefit: '4 viral-ready short videos every month. Edited, captioned, ready to publish.' },
  { id: 'sms_marketing', name: 'SMS Marketing Campaigns', headline: '98% open rate. No filters. No algorithms.', benefit: 'Targeted SMS campaigns that reach every customer instantly.' },
  { id: 'staff_training', name: 'Staff Training Workshops', headline: 'Your team is your brand.', benefit: 'Half-day or full-day training. Sales, customer service, brand standards.' },
  { id: 'marketing_audit', name: 'Marketing Audit & Report', headline: 'Know exactly where you\'re losing money.', benefit: 'Comprehensive audit of every marketing channel. Clear report.' },
  { id: 'competitor_analysis', name: 'Competitor Analysis Report', headline: 'See exactly what they\'re doing.', benefit: 'Detailed analysis of your top 3 competitors. Pricing, channels, tactics.' },
  { id: 'ai_content_writing', name: 'AI Content Writing Service', headline: 'Never run out of content again.', benefit: 'Endless on-brand blog posts, captions, ads, emails.' },
  { id: 'crm_training', name: 'CRM Training & Setup', headline: 'Stop managing customers in your head.', benefit: 'HubSpot/Zoho setup, training, integration with your existing tools.' },
  { id: 'website_maintenance', name: 'Website Maintenance Retainer', headline: 'Your website breaks. We fix it before you notice.', benefit: 'Monthly maintenance, updates, security, content tweaks.' },
  { id: 'paid_ads_management', name: 'Paid Ads Management', headline: 'Stop wasting money on ads that don\'t convert.', benefit: 'Professional Google Ads + Meta Ads management. Campaign setup, optimization.' }
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.role !== 'owner') {
    return Response.json({ error: 'Forbidden: Owner access required' }, { status: 403 });
  }

  console.log('[seed-product-images] Starting image generation for', PRODUCT_CATALOG.length, 'products');

  let generated = 0;
  let skipped = 0;
  const results = {};

  for (const product of PRODUCT_CATALOG) {
    const key = `product_image_${product.id}`;
    
    // Check if already exists
    const existing = await base44.asServiceRole.entities.SystemSettings.filter({ id: key });
    if (existing?.length > 0) {
      console.log(`[seed-product-images] Skipping ${product.id} — already cached`);
      skipped++;
      results[product.id] = existing[0].fallback_marketing_image_url || null;
      continue;
    }

    try {
      console.log(`[seed-product-images] Generating image for ${product.id}`);
      
      const prompt = `Premium marketing mockup for "${product.name}": ${product.headline} — ${product.benefit}. 
        Professional South African small business context. Marketing iO brand colors: deep purple #a764e6 and pink #ec4899 ambient lighting. 
        Cinematic, hopeful, aspirational. Premium stock photo quality. No text overlays. 16:9 aspect ratio.`;

      const imageResult = await base44.integrations.Core.GenerateImage({ prompt });
      
      if (imageResult?.url) {
        results[product.id] = imageResult.url;
        console.log(`[seed-product-images] Generated ${product.id}: ${imageResult.url}`);
        generated++;
      } else {
        console.error(`[seed-product-images] No URL in response for ${product.id}`);
        skipped++;
      }

      // Rate limiting: wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error(`[seed-product-images] Error generating image for ${product.id}:`, err.message);
      skipped++;
    }
  }

  // Store all results in SystemSettings as a JSON blob
  try {
    const settings = await base44.asServiceRole.entities.SystemSettings.filter({});
    const settingsRecord = Array.isArray(settings) ? settings[0] : settings;

    if (settingsRecord) {
      // Update existing record with new product images as a JSON field
      await base44.asServiceRole.entities.SystemSettings.update(settingsRecord.id, {
        product_images_json: JSON.stringify(results)
      });
    } else {
      // Create new SystemSettings record
      await base44.asServiceRole.entities.SystemSettings.create({
        product_images_json: JSON.stringify(results)
      });
    }
  } catch (err) {
    console.error('[seed-product-images] Error saving to SystemSettings:', err.message);
  }

  console.log('[seed-product-images] Complete:', { generated, skipped, total: PRODUCT_CATALOG.length });
  return Response.json({ generated, skipped, total: PRODUCT_CATALOG.length, results }, { status: 200 });
});