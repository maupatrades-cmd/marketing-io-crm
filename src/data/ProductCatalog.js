export const PRODUCT_CATALOG = [
  // CORE PACKAGES
  {
    id: 'ignite',
    type: 'package',
    name: 'Ignite',
    emoji: '🚀',
    headline: 'Look professional online — fast.',
    pain_point: 'Customers judge your business in 3 seconds. A weak online presence means they choose someone else.',
    benefit: 'Logo, website, social setup. The minimum your business needs to stop losing customers to competitors who look more polished.',
    setup_price: 3980,
    monthly_price: 490,
    term_months: 12,
    cta_text: 'Upgrade to Ignite',
    upgrade_path: ['accelerate', 'dominate']
  },
  {
    id: 'accelerate',
    type: 'package',
    name: 'Accelerate',
    emoji: '📈',
    headline: 'Stop coasting. Start growing.',
    pain_point: 'You\'re established but stuck. Same revenue, same customers, no growth. You need momentum.',
    benefit: 'Full content production, ongoing social management, the systems that turn one-time buyers into loyal customers.',
    setup_price: 6500,
    monthly_price: 890,
    term_months: 12,
    cta_text: 'Upgrade to Accelerate',
    upgrade_path: ['dominate']
  },
  {
    id: 'dominate',
    type: 'package',
    name: 'Dominate',
    emoji: '🏆',
    headline: 'Own your market.',
    pain_point: 'Your biggest competitor is winning the customers you should be getting. They\'re not better — they\'re just louder.',
    benefit: 'Full brand build, paid ads management, strategic content. This is what your biggest competitor is paying for.',
    setup_price: 9800,
    monthly_price: 1490,
    term_months: 12,
    cta_text: 'Upgrade to Dominate',
    upgrade_path: []
  },
  {
    id: 'street_pulse',
    type: 'physical',
    name: 'Street Pulse',
    emoji: '📍',
    headline: 'Be impossible to miss.',
    pain_point: 'Your business is invisible to the people walking past it every day. No signage, no presence, no recognition.',
    benefit: 'Physical visibility, signage, on-the-ground brand presence. Customers see you, remember you, choose you.',
    setup_price: 700,
    monthly_price: 3700,
    term_months: 3,
    cta_text: 'Add Street Pulse'
  },
  {
    id: 'township_pulse',
    type: 'physical',
    name: 'Township Pulse',
    emoji: '🏪',
    headline: 'Win in your community.',
    pain_point: 'Your customers are right outside your door but they\'re going to your competitor instead because your shop is forgettable.',
    benefit: 'Branding designed for spaza shops, taxi-rank-adjacent businesses, and high-foot-traffic locations.',
    setup_price: 1300,
    monthly_price: 0,
    term_months: 0,
    cta_text: 'Add Township Pulse'
  },
  {
    id: 'ai_chatbot',
    type: 'addon',
    name: 'AI Chatbot',
    emoji: '🤖',
    headline: 'Never miss a customer — even at 3am.',
    pain_point: 'Your competitors lose 70% of after-hours leads. Customers don\'t wait — they go to whoever replies first.',
    benefit: 'Reply in 2 seconds, 24/7. Even while you sleep. Every late-night enquiry becomes tomorrow\'s sale.',
    setup_price: 6500,
    monthly_price: 350
  },
  {
    id: 'whatsapp_automation',
    type: 'addon',
    name: 'WhatsApp Business Automation',
    emoji: '📱',
    headline: 'Be where 73% of South Africans actually are.',
    pain_point: 'Your customers don\'t want to email. They don\'t want to call. They want to WhatsApp. And you\'re not there.',
    benefit: 'Auto-replies, lead capture, broadcast campaigns. Run your sales motion through the channel customers prefer.',
    setup_price: 3500,
    monthly_price: 200
  },
  {
    id: 'reputation_management',
    type: 'addon',
    name: 'Reputation Management',
    emoji: '⭐',
    headline: 'One bad review costs 30 customers.',
    pain_point: 'Anyone can leave a review at any time. One angry customer can destroy years of work in an afternoon.',
    benefit: 'We monitor every mention. Respond fast. Generate positive reviews. Protect your name 24/7.',
    setup_price: 0,
    monthly_price: 1800
  },
  {
    id: 'google_business_profile',
    type: 'addon',
    name: 'Google Business Profile',
    emoji: '📍',
    headline: 'Show up when customers search for you.',
    pain_point: 'When someone Googles your service in your area, you don\'t appear. The customer becomes your competitor\'s.',
    benefit: 'Optimised Google profile with photos, hours, reviews, and local SEO. Be the first result people see.',
    setup_price: 800,
    monthly_price: 0
  },
  {
    id: 'email_newsletter',
    type: 'addon',
    name: 'Email Newsletter Management',
    emoji: '📧',
    headline: 'Stay top-of-mind every month.',
    pain_point: 'Past customers forget you exist within 90 days. Without contact, they\'ll buy from whoever advertises next.',
    benefit: 'Monthly branded newsletter that keeps your customers engaged, informed, and ready to buy again.',
    setup_price: 0,
    monthly_price: 900
  },
  {
    id: 'short_form_video',
    type: 'addon',
    name: 'Short-Form Video Pack',
    emoji: '🎬',
    headline: 'TikTok and Reels are eating Google.',
    pain_point: 'Your audience watches video. You\'re publishing static images from 2018. Every day you\'re less relevant.',
    benefit: '4 viral-ready short videos every month. Edited, captioned, ready to publish. We script, you grow.',
    setup_price: 0,
    monthly_price: 1500
  },
  {
    id: 'sms_marketing',
    type: 'addon',
    name: 'SMS Marketing Campaigns',
    emoji: '💬',
    headline: '98% open rate. No filters. No algorithms.',
    pain_point: 'Email goes to spam. Social posts get hidden by algorithms. SMS gets read within 90 seconds.',
    benefit: 'Targeted SMS campaigns that reach every customer instantly. Promotions, reminders, flash sales.',
    setup_price: 500,
    monthly_price: 500
  },
  {
    id: 'staff_training',
    type: 'addon',
    name: 'Staff Training Workshops',
    emoji: '🎓',
    headline: 'Your team is your brand.',
    pain_point: 'Customers leave because of bad staff experiences. One untrained employee can cost you thousands.',
    benefit: 'Half-day or full-day training. Sales, customer service, brand standards.',
    setup_price: 3500,
    monthly_price: 0,
    notes: 'Half-day from R3,500 · Full-day from R5,500 · +R500 per attendee'
  },
  {
    id: 'marketing_audit',
    type: 'addon',
    name: 'Marketing Audit & Report',
    emoji: '🔍',
    headline: 'Know exactly where you\'re losing money.',
    pain_point: 'You\'re spending on marketing but you can\'t tell what\'s working. Half your budget is probably wasted.',
    benefit: 'Comprehensive audit of every marketing channel. Clear report. Specific recommendations. Once-off R2,000.',
    setup_price: 2000,
    monthly_price: 0
  },
  {
    id: 'competitor_analysis',
    type: 'addon',
    name: 'Competitor Analysis Report',
    emoji: '🎯',
    headline: 'See exactly what they\'re doing.',
    pain_point: 'Your competitors are stealing customers and you don\'t even know what they\'re saying or offering.',
    benefit: 'Detailed analysis of your top 3 competitors. Pricing, channels, tactics. Find their weak spots.',
    setup_price: 1500,
    monthly_price: 0
  },
  {
    id: 'ai_content_writing',
    type: 'addon',
    name: 'AI Content Writing Service',
    emoji: '✍️',
    headline: 'Never run out of content again.',
    pain_point: 'Your social media goes silent for weeks because you don\'t have time to write posts.',
    benefit: 'Endless on-brand blog posts, captions, ads, emails. Always fresh, always your voice.',
    setup_price: 0,
    monthly_price: 800
  },
  {
    id: 'crm_training',
    type: 'addon',
    name: 'CRM Training & Setup',
    emoji: '⚙️',
    headline: 'Stop managing customers in your head.',
    pain_point: 'You\'re losing leads because they\'re sitting in WhatsApp screenshots and notebook scribbles.',
    benefit: 'HubSpot/Zoho setup, training, integration with your existing tools. Once-off R3,000.',
    setup_price: 3000,
    monthly_price: 0
  },
  {
    id: 'website_maintenance',
    type: 'addon',
    name: 'Website Maintenance Retainer',
    emoji: '🛠️',
    headline: 'Your website breaks. We fix it before you notice.',
    pain_point: 'A broken website means lost sales every hour it\'s down. Updates, security patches, plugin issues — all your problem.',
    benefit: 'Monthly maintenance, updates, security, content tweaks. We handle everything.',
    setup_price: 0,
    monthly_price: 550
  },
  {
    id: 'paid_ads_management',
    type: 'addon',
    name: 'Paid Ads Management',
    emoji: '🎯',
    headline: 'Stop wasting money on ads that don\'t convert.',
    pain_point: 'You boosted a Facebook post and got nothing. R2,000 in Google Ads with no leads. Sound familiar?',
    benefit: 'Professional Google Ads + Meta Ads management. Campaign setup, optimization, weekly reporting.',
    setup_price: 0,
    monthly_price: 0,
    notes: 'Management fee: 15-20% of monthly ad spend'
  }
];

export function getProductById(id) {
  return PRODUCT_CATALOG.find(p => p.id === id);
}

export function getProductsByType(type) {
  return PRODUCT_CATALOG.filter(p => p.type === type);
}