import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// abandoned-cart-runner — Step 8 PR E.2.
//
// The engine. Scheduled to run every 15 minutes (configure in Base44
// Builder — this file is just the function body). One run does six phases
// in order:
//
//   1. tab_closed sweep — promote stuck-pending Payments to abandoned
//   2. form_abandoned sweep — promote stale CheckoutEngagement rows
//   3. send email_1  (sequence.abandoned_at >= 5 min ago)
//   4. send email_2  (email_1_sent_at >= 24h ago)
//   5. send email_3  (email_2_sent_at >= 72h ago)
//   6. recovery check — mark recovered_at when a successful Payment exists
//
// Defensive caps: max 50 sequences processed per phase per run. With a 15-
// minute interval that's 200/hour, well under Resend's 100/min and any
// reasonable Imagen quota. If a backlog ever builds, subsequent runs catch
// up.
//
// Idempotency: every send checks `email_N_sent_at IS NULL` before sending
// AND sets the timestamp immediately after a successful send. A crash
// between send and timestamp-write would result in a duplicate the next
// time around (rare, acceptable). Recovery check uses `recovered_at IS
// NULL` as its guard.
//
// Auth: function is service-internal — no auth gate. Base44's scheduler
// invokes it. If you want manual triggering for testing, gate behind a
// secret token like the security-test-harness does.
//
// Why the copy + prompts are inlined here rather than imported from
// src/config/abandonedCartCopy.js: Base44 packages each function as a
// self-contained Deno deployment with no path through to the React src/
// tree. The src/config file remains the documented source-of-truth and
// any future React-side feature (e.g. an admin preview UI) can import
// from it. Keep the two copies in sync.
// =============================================================================

// ---- copy table (mirrored from src/config/abandonedCartCopy.js) ------------

const ABANDONED_CART_COPY: Record<string, any> = {
  ignite: {
    email_1: {
      subject: '{first_name}, your Ignite setup is on pause',
      hook: 'Did the payment hiccup?',
      body_intro: 'We saw you started checking out our Ignite Setup but didn\'t finish. No drama — these things happen. Click below to pick up where you left off.',
      cta_text: 'Continue with Ignite Setup →',
    },
    email_2: {
      subject: 'Your branded website should be live in 30 days, {first_name}',
      hook: 'Here\'s what Ignite builds for you',
      benefits: [
        'A live one-page website on your own .co.za domain',
        'A professional @yourbusiness.co.za email address',
        'A verified Google Business Profile customers find on Maps',
        'Branded Facebook and Instagram pages with launch content',
        'Eight social posts per month, every month, for 12 months',
      ],
      body_intro: '30 days from now, you could have all of this running. Or you could still be looking the same as last week.',
      cta_text: 'Start my Ignite setup →',
    },
    email_3: {
      subject: '{first_name}, your competitors are still online today',
      hook: 'What you\'re losing every day you wait',
      body_intro: 'Every day without a website is a day customers Google your business name and find nothing. The "near me" searches happening today in your area are going to competitors who already have what you\'re about to buy.',
      loss_points: [
        'First-mover advantage in your local market',
        'Compounding Google Business reviews and visibility',
        'Social media followers building before you even start',
      ],
      cta_text: 'I\'m ready — start Ignite →',
    },
  },
  accelerate: {
    email_1: {
      subject: '{first_name}, your Accelerate package is paused',
      hook: 'Need help finishing checkout?',
      body_intro: 'Looks like the Accelerate signup didn\'t go through. We\'ve held your spot — finish below when you\'re ready.',
      cta_text: 'Continue with Accelerate →',
    },
    email_2: {
      subject: '{first_name}, this is what Accelerate builds for you',
      hook: 'Multi-channel marketing infrastructure',
      benefits: [
        'A multi-page website with up to 20 product or service listings',
        'A Google Ads account fully configured with conversion tracking',
        'Branded business cards designed and ready',
        'Three social media profiles: Facebook, Instagram, LinkedIn',
        'Twelve social posts per month plus quarterly strategy calls',
      ],
      body_intro: 'Accelerate is for businesses ready to compete on multiple fronts at once. Within 40 days you have what most agencies take 6 months to build.',
      cta_text: 'Start my Accelerate setup →',
    },
    email_3: {
      subject: '{first_name}, businesses that hesitate get overtaken',
      hook: 'The cost of waiting',
      body_intro: 'Mid-sized SA businesses that signed up for Accelerate this month already have leads coming in. The longer the gap, the harder it is to catch up to a competitor who started today.',
      loss_points: [
        'Months of compounding ad-account learning data',
        'Brand consistency across all channels customers check',
        'First-page Google rankings that take time to build',
      ],
      cta_text: 'I\'m in — start Accelerate →',
    },
  },
  dominate: {
    email_1: {
      subject: '{first_name}, your Dominate setup is waiting',
      hook: 'Let\'s finish this together',
      body_intro: 'You started the Dominate setup and stopped. No problem — pick up exactly where you left off.',
      cta_text: 'Continue with Dominate →',
    },
    email_2: {
      subject: '{first_name}, Dominate is full-spectrum dominance',
      hook: 'What R9,800 unlocks',
      benefits: [
        'A 10-page premium website with full SEO architecture',
        'Two SEO-optimised blog articles every month for 12 months',
        'Live Google Ads + Meta Ads campaigns',
        'Lead capture forms with 5-email automated welcome sequence',
        'Branded business cards (printed + delivered)',
        'Monthly strategy calls with the Marketing iO Founder',
      ],
      body_intro: 'Mid-sized professional services don\'t dominate by accident. Dominate is the playbook.',
      cta_text: 'Start my Dominate setup →',
    },
    email_3: {
      subject: '{first_name}, mid-sized businesses don\'t dominate by accident',
      hook: 'The compounding cost of waiting',
      body_intro: 'Search rankings compound. Every week you wait, your industry\'s search rankings get harder to climb because someone else is doing the work today. The Dominate clients we onboarded last month are already ranking for keywords their competitors gave up on.',
      loss_points: [
        'Compounding SEO that takes 6+ months to build',
        'Ad-account historical data that improves performance over time',
        'Strategic positioning that owns category mindshare',
      ],
      cta_text: 'I\'m ready — start Dominate →',
    },
  },
  'street-pulse': {
    email_1: {
      subject: '{first_name}, Street Pulse is locked and ready',
      hook: 'Just one click left',
      body_intro: 'Your Street Pulse activation is queued — just need the setup payment to clear and we deploy.',
      cta_text: 'Continue with Street Pulse →',
    },
    email_2: {
      subject: '{first_name}, picture 3,000 hands holding your flyer',
      hook: 'What 3 months of Street Pulse looks like',
      benefits: [
        'Two branded deployment agents in your colours',
        'Four deployment days every month, three months locked',
        '1,000 flyers in customer hands per month — 3,000 total',
        'Branded transport vehicle to deployment zones',
        'Same-day photo evidence sent via WhatsApp',
      ],
      body_intro: 'Street Pulse is direct foot-traffic awareness — the kind that builds local recognition fast.',
      cta_text: 'Start my Street Pulse →',
    },
    email_3: {
      subject: '{first_name}, foot traffic doesn\'t wait',
      hook: 'What you lose every week',
      body_intro: 'Every week you delay Street Pulse is 250 fewer hands holding your brand. Multiply that by your conversion rate and the math gets uncomfortable.',
      loss_points: [
        'This weekend\'s foot traffic at your target zones',
        'First-mover positioning in high-traffic areas',
        'Brand familiarity that builds with repeat exposure',
      ],
      cta_text: 'I\'m in — deploy Street Pulse →',
    },
  },
  'township-pulse': {
    email_1: {
      subject: '{first_name}, your Township Pulse activation is paused',
      hook: 'Almost there',
      body_intro: 'You started booking your township activation — let\'s finish so we can schedule your deployment.',
      cta_text: 'Continue with Township Pulse →',
    },
    email_2: {
      subject: '{first_name}, here\'s where your business shows up',
      hook: 'One day. Maximum impact.',
      benefits: [
        'A branded agent at the busiest taxi rank or spaza cluster in your township',
        '300 flyers handed directly to customers',
        '5 A2 posters mounted at high-foot zones',
        'Photo evidence delivered within 7 days',
      ],
      body_intro: 'Township Pulse is one focused day of maximum awareness in the area you choose. Customers remember the brand they saw at the taxi rank Monday morning.',
      cta_text: 'Book my Township Pulse →',
    },
    email_3: {
      subject: '{first_name}, township awareness is a one-shot opportunity',
      hook: 'First brand wins',
      body_intro: 'The first brand to activate a township area owns the awareness. Once a competitor runs the same campaign in the same zone, your impact halves and the budget you spend works harder for them than for you.',
      loss_points: [
        'Being first in your township',
        'Owning the visual landscape before competitors copy',
        'The novelty factor that drives word-of-mouth',
      ],
      cta_text: 'I\'m in — book Township Pulse →',
    },
  },
  'ai-chatbot': {
    email_1: {
      subject: '{first_name}, your AI Chatbot setup is paused',
      hook: 'One step away from 24/7 customer service',
      body_intro: 'You started the AI Chatbot setup — just need to finalise the payment and we begin training.',
      cta_text: 'Continue with AI Chatbot →',
    },
    email_2: {
      subject: '{first_name}, your chatbot answers customers while you sleep',
      hook: 'What "always-on" looks like',
      benefits: [
        'Configured to your business and trained on your service info',
        'Captures and qualifies leads at 2am while competitors are closed',
        'Books qualified prospects directly into your calendar',
        'Integrates with WhatsApp, your website, and Facebook Messenger',
        'Hands off to you when human conversation is needed',
      ],
      body_intro: 'Your competitors close at 5pm. Your chatbot doesn\'t.',
      cta_text: 'Start my AI Chatbot →',
    },
    email_3: {
      subject: '{first_name}, every "we\'re closed" message you send loses a customer',
      hook: 'After-hours customers go to whoever responds',
      body_intro: 'While you read this, customers in your industry are messaging businesses at 9pm and getting instant replies from chatbots. Without one, you\'re losing every after-hours enquiry to a competitor that automated this 6 months ago.',
      loss_points: [
        'After-hours leads (often the most motivated buyers)',
        'Instant-response advantage in your category',
        'Sales bookings while you\'re with family',
      ],
      cta_text: 'Set up my chatbot →',
    },
  },
  'whatsapp-automation': {
    email_1: {
      subject: '{first_name}, your WhatsApp setup is on hold',
      hook: 'Almost done',
      body_intro: 'You started the WhatsApp Business Automation setup but didn\'t finish. Click below to wrap it up.',
      cta_text: 'Continue with WhatsApp Automation →',
    },
    email_2: {
      subject: '{first_name}, every WhatsApp message converts 3x better than email',
      hook: 'WhatsApp is SA\'s #1 sales channel',
      benefits: [
        'WhatsApp Business profile fully configured and verified',
        'Automated welcome message and out-of-hours auto-reply',
        'Lead capture flows that ask qualifying questions',
        'Broadcast list capability for promotions and updates',
        'Quick-reply templates for the questions you answer 100 times',
      ],
      body_intro: 'South Africans message businesses on WhatsApp 5x more than they call. The setup is done in days — the impact lasts years.',
      cta_text: 'Start my WhatsApp setup →',
    },
    email_3: {
      subject: '{first_name}, your customers are already on WhatsApp',
      hook: 'The question isn\'t whether — it\'s when',
      body_intro: 'Customers are already trying to WhatsApp businesses in your industry. The only question is whether you\'ll be set up to capture them or whether they\'ll bounce to a competitor who automated theirs last quarter.',
      loss_points: [
        'Inbound WhatsApp enquiries you\'ll never see',
        'Speed-of-response advantage in your category',
        'Broadcast-list reach when you launch promotions',
      ],
      cta_text: 'Set up my WhatsApp →',
    },
  },
  'google-business-profile': {
    email_1: {
      subject: '{first_name}, your Google Business Profile is almost live',
      hook: 'Click below to finish',
      body_intro: 'You started setting up your Google Business Profile — just need to confirm payment and we get you verified on Google.',
      cta_text: 'Continue setup →',
    },
    email_2: {
      subject: '{first_name}, this is the difference between findable and invisible',
      hook: 'What R800 unlocks',
      benefits: [
        'Verified Google Business Profile with the blue tick',
        'Your business name, photos, hours, and phone number on Google Maps',
        'Customer reviews collection enabled',
        'Local SEO foundation that helps you appear in "near me" searches',
        'One-time setup, lifetime visibility',
      ],
      body_intro: 'This is the cheapest, highest-leverage marketing investment for any local business. Set up once. Found forever.',
      cta_text: 'Set up my Google Business Profile →',
    },
    email_3: {
      subject: '{first_name}, "near me" searches happen every minute',
      hook: 'Customers searching now are buying now',
      body_intro: 'Right now, somewhere in your area, a customer is Googling "your service near me". They\'re a buyer, not a browser. Without a Google Business Profile, that customer goes to a competitor — every single search, every single day.',
      loss_points: [
        'Every "near me" search you don\'t appear in',
        'Reviews you could be collecting starting today',
        'Google Maps visibility competitors have',
      ],
      cta_text: 'Get me verified →',
    },
  },
  'sms-marketing': {
    email_1: {
      subject: '{first_name}, your SMS Marketing is ready to launch',
      hook: 'One more step',
      body_intro: 'The SMS Marketing platform is set up and waiting — just need to finalise payment to activate it for your campaigns.',
      cta_text: 'Continue setup →',
    },
    email_2: {
      subject: '{first_name}, SMS gets a 98% open rate',
      hook: 'The channel customers can\'t ignore',
      benefits: [
        'SMS sending platform configured for your business',
        'Contact list management and segmentation',
        'Promotional, reminder, and flash-sale message templates',
        'Personalisation tokens (first name, last visit, etc.)',
        'Analytics dashboard for delivery and engagement',
      ],
      body_intro: 'Email open rates: 20%. SMS open rates: 98%. Which channel would you rather send your next sale through?',
      cta_text: 'Activate my SMS Marketing →',
    },
    email_3: {
      subject: '{first_name}, the channel your customers can\'t ignore',
      hook: 'What you\'re missing',
      body_intro: 'Every promotional email you send is competing with 100 others. SMS lands in the only inbox they always check. The brands using SMS in your category are reaching customers you can\'t, and you\'re paying for that gap in lost sales.',
      loss_points: [
        '98% read-rate visibility for your promotions',
        'Direct line to your most valuable repeat customers',
        'Same-day flash-sale capability',
      ],
      cta_text: 'Set up SMS for me →',
    },
  },
  'marketing-audit': {
    email_1: {
      subject: '{first_name}, your Marketing Audit is paused',
      hook: 'Need any help?',
      body_intro: 'You started ordering a Marketing Audit but didn\'t complete checkout. Click below if you\'d like to pick it up.',
      cta_text: 'Continue with my Audit →',
    },
    email_2: {
      subject: '{first_name}, this audit shows you exactly where you\'re leaking money',
      hook: 'What R2,000 reveals',
      benefits: [
        'Comprehensive audit of your website, social media, and search visibility',
        'Ad spend efficiency analysis (where the money is and isn\'t working)',
        'Competitor positioning summary for your top 3 rivals',
        'Prioritised recommendations — what to fix first, second, third',
        'Written report you can act on or share with your team',
      ],
      body_intro: 'Audits pay for themselves on the first fix. The R2,000 you don\'t spend now is the R20,000 of leaked ad spend you\'ll pay this year.',
      cta_text: 'Order my Marketing Audit →',
    },
    email_3: {
      subject: '{first_name}, you can\'t fix what you can\'t see',
      hook: 'Every week of guessing is expensive',
      body_intro: 'Every week you spend on marketing without a clear audit is money spent guessing. Most SMEs are leaking 30-50% of their marketing budget on channels that don\'t work for them — and they don\'t know which 30-50% it is.',
      loss_points: [
        'Months of inefficient ad spend',
        'Strategic clarity your competitors paid to get',
        'Cumulative cost of unfixed leaks',
      ],
      cta_text: 'Get my audit done →',
    },
  },
  'competitor-analysis': {
    email_1: {
      subject: '{first_name}, your Competitor Analysis is paused',
      hook: 'Just one click',
      body_intro: 'You started ordering a Competitor Analysis Report. Click below to finish — the report is delivered within 5 business days.',
      cta_text: 'Continue with my Analysis →',
    },
    email_2: {
      subject: '{first_name}, know exactly what your top 3 competitors are doing',
      hook: 'What\'s in the report',
      benefits: [
        'Pricing analysis: what they charge, how they package, where they discount',
        'Marketing channel breakdown: where they spend, what works',
        'Content and positioning audit: how they sell their value',
        'Ad-spend signals: which campaigns are working for them',
        'Strategic recommendations on how to position against them',
      ],
      body_intro: 'You can\'t outsmart competitors you don\'t understand. R1,500 buys you a clearer view of your market than most of them have of their own.',
      cta_text: 'Order my Analysis →',
    },
    email_3: {
      subject: '{first_name}, fighting blind is an expensive way to compete',
      hook: 'Information advantage compounds',
      body_intro: 'Your competitors are pricing, positioning, and advertising sharper than you because they\'ve done the analysis you haven\'t. Every quote you lose to a smarter competitor is the cost of skipping this.',
      loss_points: [
        'Strategic blind spots competitors are exploiting',
        'Pricing power you could be claiming',
        'Positioning gaps you could be owning',
      ],
      cta_text: 'Get my report →',
    },
  },
  'crm-training': {
    email_1: {
      subject: '{first_name}, your CRM Training is paused',
      hook: 'We\'re ready when you are',
      body_intro: 'You started booking CRM Training & Setup but didn\'t finish checkout. Click below to schedule your team session.',
      cta_text: 'Continue setup →',
    },
    email_2: {
      subject: '{first_name}, this is the system that turns leads into closed deals',
      hook: 'What CRM Training & Setup includes',
      benefits: [
        'CRM platform configured around your sales process',
        'Contact and deal pipelines tailored to your business',
        'Team training session walking everyone through daily use',
        'Reporting dashboards so you see what\'s actually working',
        'Email and SMS templates loaded and ready',
      ],
      body_intro: 'A CRM isn\'t software — it\'s a system. The system that makes sure no lead falls through the cracks, ever.',
      cta_text: 'Set up my CRM →',
    },
    email_3: {
      subject: '{first_name}, leads in spreadsheets get forgotten',
      hook: 'Every uncaptured lead is paid traffic wasted',
      body_intro: 'Every week without a CRM is leads slipping through cracks. The deals you don\'t close because you didn\'t follow up pay for the CRM training ten times over within the first quarter.',
      loss_points: [
        'Forgotten follow-ups that lose deals',
        'Lead-source attribution you can\'t measure',
        'Sales pipeline visibility your competitors already have',
      ],
      cta_text: 'Get my CRM done →',
    },
  },
};

const ABANDONED_CART_PACKAGE_IDS = Object.keys(ABANDONED_CART_COPY);
const RECOVERABLE_PACKAGE_IDS = new Set(ABANDONED_CART_PACKAGE_IDS);

// Imagen prompt templates per stage. Verbatim from the brief.
const EMAIL_1_PROMPT = (packageName: string) =>
  `Photorealistic close-up portrait of a young South African professional looking confused at a laptop screen, soft natural lighting, professional setting. Subtle disappointed expression. The screen shows a ${packageName} signup page. Cinematic, high-detail, 4K.`;

const EMAIL_2_PROMPTS_BY_PACKAGE: Record<string, string> = {
  ignite:                  'Photorealistic image of a successful South African small business owner smiling at a laptop showing analytics dashboard with growing numbers, warm natural lighting, hopeful uplifting mood, modern office setting. 4K cinematic.',
  accelerate:              'Photorealistic image of a successful South African small business owner smiling at a laptop showing analytics dashboard with growing numbers, warm natural lighting, hopeful uplifting mood, modern office setting. 4K cinematic.',
  dominate:                'Photorealistic image of a successful South African small business owner smiling at a laptop showing analytics dashboard with growing numbers, warm natural lighting, hopeful uplifting mood, modern office setting. 4K cinematic.',
  'street-pulse':          'Photorealistic image of a busy South African shopping street, well-dressed brand agents in branded shirts handing flyers to enthusiastic pedestrians, mid-day natural light. Documentary photography style. 4K.',
  'township-pulse':        'Photorealistic image of a vibrant South African township taxi rank during peak hours, branded posters visible at high-traffic spots, brand agent engaging with locals, golden afternoon light. 4K cinematic.',
  'ai-chatbot':            'Photorealistic image of a phone screen showing a friendly chatbot conversation at 2am, glowing softly in a dark room, customer\'s hand visible. 4K cinematic, modern.',
  'whatsapp-automation':   'Photorealistic image of a smartphone with WhatsApp open showing multiple business conversations and quick auto-replies, natural lighting on a desk with coffee cup. 4K.',
  'google-business-profile': 'Photorealistic image of a Google Maps result on a phone showing a verified business with photos and 5-star reviews, person about to tap to navigate. 4K cinematic.',
  'sms-marketing':         'Photorealistic image of multiple phones showing the same SMS notification from a brand, bird\'s-eye-view, soft studio lighting, modern composition. 4K.',
  'marketing-audit':       'Photorealistic image of a printed business report on a desk with charts and highlighted insights, magnifying glass on top, warm office lighting. 4K cinematic.',
  'competitor-analysis':   'Photorealistic image of a printed business report on a desk with charts and highlighted insights, magnifying glass on top, warm office lighting. 4K cinematic.',
  'crm-training':          'Photorealistic image of a small business team gathered around a laptop learning a CRM dashboard, engaged and smiling, modern office. 4K.',
};

const EMAIL_3_PROMPT = (packageName: string) =>
  `Photorealistic image of an hourglass with sand running out, dramatic side lighting, the package name '${packageName}' subtly visible on a document beneath it, urgent business setting. 4K cinematic, high-contrast.`;

// Display name lookup for Imagen prompts. Slugs like "street-pulse" don't
// render well in image generation; the model needs the human-readable name.
const PACKAGE_DISPLAY_NAME: Record<string, string> = {
  ignite:                    'Ignite Setup',
  accelerate:                'Accelerate Setup',
  dominate:                  'Dominate Setup',
  'street-pulse':            'Street Pulse',
  'township-pulse':          'Township Pulse',
  'ai-chatbot':              'AI Chatbot',
  'whatsapp-automation':     'WhatsApp Automation',
  'google-business-profile': 'Google Business Profile',
  'sms-marketing':           'SMS Marketing',
  'marketing-audit':         'Marketing Audit',
  'competitor-analysis':     'Competitor Analysis',
  'crm-training':            'CRM Training',
};

// ---- tunables (top of file so they're easy to find) ------------------------
const TAB_CLOSED_AGE_MS       = 30 * 60 * 1000;       // 30 min
const FORM_ABANDONED_AGE_MS   = 60 * 60 * 1000;       //  1 hour
const EMAIL_1_DELAY_MS        =  5 * 60 * 1000;       //  5 min after abandoned_at
const EMAIL_2_DELAY_MS        = 24 * 60 * 60 * 1000;  // 24h after email_1_sent_at
const EMAIL_3_DELAY_MS        = 72 * 60 * 60 * 1000;  // 72h after email_2_sent_at
const PER_PHASE_CAP           = 50;
const RESEND_RATE_LIMIT_MS    = 700;                  // ~85/min, under Resend's 100/min cap

// ---- helpers ----------------------------------------------------------------

function unwrapList(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function unwrapOne(result) {
  const list = unwrapList(result);
  return list[0] ?? null;
}

function lowerTrim(value) {
  return String(value ?? '').trim().toLowerCase();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fillFirstName(template, firstName) {
  return String(template).replace(/\{first_name\}/g, firstName || 'there');
}

// 32-byte URL-safe random token for the email unsubscribe link. Mirrors
// generateUnsubscribeToken() in abandoned-cart-trigger so sequences created
// by either path get an equivalent token.
function generateUnsubscribeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Used to build /checkout?email=… deep-links and unsubscribe links.
function appBase() {
  return Deno.env.get('PAYFAST_RETURN_URL')?.replace(/\/payment-success.*$/, '')
    || 'https://app.marketingio.co.za';
}

// =============================================================================
// Image cache — lazy. First send for (package, email_stage) generates via
// generate-marketing-image, stores in PackageEmailImage. Subsequent sends
// for the same combo reuse the cached URL.
// =============================================================================
function imagePromptFor(stage: string, packageId: string): string {
  const displayName = PACKAGE_DISPLAY_NAME[packageId] || packageId;
  if (stage === 'email_1') return EMAIL_1_PROMPT(displayName);
  if (stage === 'email_2') return EMAIL_2_PROMPTS_BY_PACKAGE[packageId] || EMAIL_1_PROMPT(displayName);
  if (stage === 'email_3') return EMAIL_3_PROMPT(displayName);
  return EMAIL_1_PROMPT(displayName);
}

async function getOrGenerateImage(base44, packageId, stage) {
  // Cache hit?
  let cached;
  try {
    const found = await base44.asServiceRole.entities.PackageEmailImage.filter({
      package_id: packageId,
      email_stage: stage,
    });
    cached = unwrapOne(found);
  } catch (err) {
    console.error(`[abandoned-cart-runner] PackageEmailImage lookup failed:`, err);
  }
  if (cached?.image_url) return cached.image_url;

  // Cache miss — generate. The generate-marketing-image function returns a
  // fallback URL if Imagen is unavailable; we still cache that so we don't
  // re-call on every send. is_fallback flags it for any future re-gen sweep.
  const prompt = imagePromptFor(stage, packageId);
  let imageUrl = '';
  let isFallback = false;
  try {
    const res = await base44.functions.invoke('generate-marketing-image', {
      prompt,
      aspect_ratio: '4:5',
    });
    const data = res?.data ?? res;
    imageUrl   = String(data?.image_url || '');
    isFallback = Boolean(data?.fallback);
  } catch (err) {
    console.error(`[abandoned-cart-runner] generate-marketing-image failed:`, err);
    return '';
  }
  if (!imageUrl) return '';

  try {
    await base44.asServiceRole.entities.PackageEmailImage.create({
      package_id:  packageId,
      email_stage: stage,
      image_url:   imageUrl,
      prompt_used: prompt,
      generated_at: new Date().toISOString(),
      is_fallback: isFallback,
    });
  } catch (err) {
    console.error(`[abandoned-cart-runner] PackageEmailImage.create failed:`, err);
    // Non-fatal — we still have a usable image_url for this send.
  }

  return imageUrl;
}

// =============================================================================
// Email rendering — branded HTML + plain-text fallback.
// =============================================================================
function wrapEmail(bodyHtml, unsubscribeUrl) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr><td style="background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);padding:24px 32px;">
          <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png" alt="Marketing iO" height="32" style="display:block;height:32px;">
        </td></tr>
        <tr><td style="padding:32px;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="background:#0f172a;padding:24px 32px;border-top:1px solid #334155;font-size:11px;color:#64748b;line-height:1.6;text-align:center;">
          <p style="margin:0 0 8px 0;">Marketing iO — Too good to stay hidden.</p>
          <p style="margin:0;">Don't want these emails? <a href="${escapeHtml(unsubscribeUrl)}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderHeroImage(imageUrl) {
  if (!imageUrl) return '';
  return `<img src="${escapeHtml(imageUrl)}" alt="" style="display:block;width:100%;max-width:536px;height:auto;border-radius:12px;margin:0 0 24px 0;">`;
}

function renderCta(ctaText, ctaUrl) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="border-radius:12px;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);">
      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(ctaText)}</a>
    </td></tr>
  </table>`;
}

function renderEmail(stage, copyForStage, ctx) {
  const { imageUrl, ctaUrl, firstName } = ctx;
  const subject = fillFirstName(copyForStage.subject, firstName);
  const hook    = copyForStage.hook || '';
  const intro   = fillFirstName(copyForStage.body_intro || '', firstName);
  const cta     = copyForStage.cta_text || 'Continue →';

  let listHtml = '';
  let listText = '';
  if (Array.isArray(copyForStage.benefits) && copyForStage.benefits.length) {
    listHtml = `<ul style="padding:0 0 0 20px;margin:16px 0;color:#cbd5e1;font-size:15px;line-height:1.8;">${
      copyForStage.benefits.map((b) => `<li style="margin:0 0 6px 0;">${escapeHtml(b)}</li>`).join('')
    }</ul>`;
    listText = '\n' + copyForStage.benefits.map((b) => `  • ${b}`).join('\n');
  } else if (Array.isArray(copyForStage.loss_points) && copyForStage.loss_points.length) {
    listHtml = `<ul style="padding:0 0 0 20px;margin:16px 0;color:#cbd5e1;font-size:15px;line-height:1.8;">${
      copyForStage.loss_points.map((b) => `<li style="margin:0 0 6px 0;">${escapeHtml(b)}</li>`).join('')
    }</ul>`;
    listText = '\n' + copyForStage.loss_points.map((b) => `  • ${b}`).join('\n');
  }

  const bodyHtml = `
    ${renderHeroImage(imageUrl)}
    ${hook ? `<p style="margin:0 0 8px 0;font-size:13px;color:#a78bfa;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${escapeHtml(hook)}</p>` : ''}
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#fff;line-height:1.3;">${escapeHtml(subject)}</h1>
    <p style="margin:0 0 16px 0;color:#cbd5e1;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
    ${listHtml}
    ${renderCta(cta, ctaUrl)}
    <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">
      Need help? Just reply to this email — we're happy to chat.
    </p>
  `;

  const text = [
    hook ? hook.toUpperCase() : '',
    subject,
    '',
    intro,
    listText,
    '',
    `${cta}: ${ctaUrl}`,
    '',
    `Need help? Reply to this email.`,
    `Marketing iO — Too good to stay hidden.`,
  ].filter(Boolean).join('\n');

  return { subject, html: bodyHtml, text };
}

// =============================================================================
// Send-side guard: has this buyer already paid for this package?
// If yes, return the successful Payment so the caller can mark
// recovered_at and skip the send.
// =============================================================================
async function findSuccessfulPaymentForBuyer(base44, email, packageId) {
  // Resolve possible client_ids by email — buyers may have a Client row
  // from previous purchases. We use lowercase exact match; the
  // payfast-checkout-init flow normalises emails to lowercase.
  let clientIds = [];
  try {
    const found = await base44.asServiceRole.entities.Client.filter({ email });
    clientIds = unwrapList(found).map((c) => c?.id).filter(Boolean);
  } catch (err) {
    console.error('[abandoned-cart-runner] Client lookup failed:', err);
  }
  if (!clientIds.length) return null;

  for (const clientId of clientIds) {
    let payments = [];
    try {
      const found = await base44.asServiceRole.entities.Payment.filter({
        client_id: clientId,
        status:    'successful',
        package_id: packageId,
      });
      payments = unwrapList(found);
    } catch (err) {
      console.error('[abandoned-cart-runner] Payment lookup failed:', err);
    }
    if (payments.length) return payments[0];
  }
  return null;
}

// =============================================================================
// Phase 1: tab_closed sweep
// Promote Payments stuck at status='pending' for >30min with no
// gateway_pf_payment_id (= never received an ITN) into abandoned-cart.
// =============================================================================
async function sweepTabClosed(base44) {
  let pending = [];
  try {
    const found = await base44.asServiceRole.entities.Payment.filter({ status: 'pending' });
    pending = unwrapList(found);
  } catch (err) {
    console.error('[abandoned-cart-runner] Payment.filter(pending) failed:', err);
    return { promoted: 0, scanned: 0 };
  }

  const cutoff = Date.now() - TAB_CLOSED_AGE_MS;
  let promoted = 0;
  let scanned = 0;

  for (const payment of pending) {
    if (promoted >= PER_PHASE_CAP) break;
    scanned++;
    const createdAt = payment?.created_date ? new Date(payment.created_date).getTime() : 0;
    if (createdAt > cutoff) continue;
    if (payment?.gateway_pf_payment_id) continue;
    if (!RECOVERABLE_PACKAGE_IDS.has(payment?.package_id)) continue;

    // Skip if a sequence already exists for this Payment (idempotent
    // against the runner being re-run).
    let existing = [];
    try {
      const found = await base44.asServiceRole.entities.AbandonedCartSequence.filter({
        payment_id: payment.id,
      });
      existing = unwrapList(found);
    } catch (err) { console.error('[abandoned-cart-runner] dedup query failed:', err); }
    if (existing.length) continue;

    // Look up the buyer's email + name. Prefer Client; fall back to nothing.
    let buyerEmail = '';
    let buyerFirst = '';
    try {
      const found = await base44.asServiceRole.entities.Client.filter({ id: payment.client_id });
      const client = unwrapOne(found);
      buyerEmail = lowerTrim(client?.email);
      buyerFirst = String(client?.contact_person || '').split(/\s+/)[0] || '';
    } catch (err) { /* ignore */ }
    if (!buyerEmail) continue;

    try {
      await base44.asServiceRole.entities.AbandonedCartSequence.create({
        email:             buyerEmail,
        name_first:        buyerFirst,
        package_id:        payment.package_id,
        abandonment_type:  'tab_closed',
        abandoned_at:      new Date().toISOString(),
        unsubscribed:      false,
        unsubscribe_token: generateUnsubscribeToken(),
        client_id:         payment.client_id || '',
        m_payment_id:      payment.gateway_reference || '',
        payment_id:        payment.id,
      });
      promoted++;
      console.log(
        `[abandoned-cart-runner] tab_closed promoted — payment_id=${payment.id}, ` +
        `email=${buyerEmail}, package_id=${payment.package_id}`
      );
    } catch (err) {
      console.error('[abandoned-cart-runner] AbandonedCartSequence.create (tab_closed) failed:', err);
    }
  }

  return { promoted, scanned };
}

// =============================================================================
// Phase 2: form_abandoned sweep
// Promote CheckoutEngagement rows older than 1h that never converted.
// =============================================================================
async function sweepFormAbandoned(base44) {
  let engagements = [];
  try {
    const found = await base44.asServiceRole.entities.CheckoutEngagement.filter({
      converted_to_payment: false,
    });
    engagements = unwrapList(found);
  } catch (err) {
    console.error('[abandoned-cart-runner] CheckoutEngagement.filter failed:', err);
    return { promoted: 0, scanned: 0 };
  }

  const cutoff = Date.now() - FORM_ABANDONED_AGE_MS;
  let promoted = 0;
  let scanned = 0;

  for (const eng of engagements) {
    if (promoted >= PER_PHASE_CAP) break;
    scanned++;
    const at = eng?.engagement_at ? new Date(eng.engagement_at).getTime() : 0;
    if (at > cutoff) continue;
    if (!RECOVERABLE_PACKAGE_IDS.has(eng?.package_id)) continue;
    const email = lowerTrim(eng?.email);
    if (!email) continue;
    if (!String(eng?.name_first || '').trim()) continue; // brief: only trigger if we have email AND first name

    // Skip if a sequence already exists for this email + package.
    let existing = [];
    try {
      const found = await base44.asServiceRole.entities.AbandonedCartSequence.filter({
        email,
        package_id: eng.package_id,
      });
      existing = unwrapList(found).filter((s) => !s?.recovered_at);
    } catch (err) { /* ignore */ }
    if (existing.length) continue;

    // Skip if a Payment already exists for this email + package — they
    // either paid or are already in flight.
    const successfulPayment = await findSuccessfulPaymentForBuyer(base44, email, eng.package_id);
    if (successfulPayment) continue;

    try {
      await base44.asServiceRole.entities.AbandonedCartSequence.create({
        email,
        name_first:        String(eng.name_first || '').trim(),
        package_id:        eng.package_id,
        abandonment_type:  'form_abandoned',
        abandoned_at:      new Date().toISOString(),
        unsubscribed:      false,
        unsubscribe_token: generateUnsubscribeToken(),
      });
      promoted++;
      console.log(
        `[abandoned-cart-runner] form_abandoned promoted — engagement_id=${eng.id}, ` +
        `email=${email}, package_id=${eng.package_id}`
      );
    } catch (err) {
      console.error('[abandoned-cart-runner] AbandonedCartSequence.create (form_abandoned) failed:', err);
    }
  }

  return { promoted, scanned };
}

// =============================================================================
// Phases 3-5: send email_N for sequences whose timing window has elapsed.
// =============================================================================
async function sendEmailN(base44, resend, fromAddress, stage) {
  // stage: 'email_1' | 'email_2' | 'email_3'
  const sentField  = `${stage}_sent_at`;
  const prevField  = stage === 'email_1' ? 'abandoned_at'
                   : stage === 'email_2' ? 'email_1_sent_at'
                   : 'email_2_sent_at';
  const delayMs    = stage === 'email_1' ? EMAIL_1_DELAY_MS
                   : stage === 'email_2' ? EMAIL_2_DELAY_MS
                   : EMAIL_3_DELAY_MS;

  // Pull sequences that haven't sent this stage yet AND aren't unsubscribed
  // AND aren't already recovered. Filter further in JS by timing + dedup
  // (Base44 SDK filter doesn't natively support comparison operators).
  let candidates = [];
  try {
    const found = await base44.asServiceRole.entities.AbandonedCartSequence.filter({
      unsubscribed: false,
    });
    candidates = unwrapList(found);
  } catch (err) {
    console.error(`[abandoned-cart-runner] sequences fetch (${stage}) failed:`, err);
    return { sent: 0, skipped: 0 };
  }

  const now = Date.now();
  const eligible = [];
  for (const seq of candidates) {
    if (seq?.[sentField]) continue;            // already sent
    if (seq?.recovered_at) continue;            // already recovered
    const prev = seq?.[prevField] ? new Date(seq[prevField]).getTime() : 0;
    if (!prev || (now - prev) < delayMs) continue;
    if (!RECOVERABLE_PACKAGE_IDS.has(seq?.package_id)) continue;
    if (!ABANDONED_CART_COPY[seq.package_id]?.[stage]) continue;
    eligible.push(seq);
    if (eligible.length >= PER_PHASE_CAP) break;
  }

  let sent = 0;
  let skipped = 0;

  for (const seq of eligible) {
    // Last-mile recovery check: if the buyer has paid since the previous
    // step, skip and mark recovered_at.
    const successfulPayment = await findSuccessfulPaymentForBuyer(base44, seq.email, seq.package_id);
    if (successfulPayment) {
      try {
        await base44.asServiceRole.entities.AbandonedCartSequence.update(seq.id, {
          recovered_at: new Date().toISOString(),
        });
        console.log(
          `[abandoned-cart-runner] recovered before ${stage} — sequence_id=${seq.id}, ` +
          `email=${seq.email}, package_id=${seq.package_id}`
        );
      } catch (err) {
        console.error('[abandoned-cart-runner] mark recovered_at failed:', err);
      }
      skipped++;
      continue;
    }

    // Back-fill unsubscribe_token for sequences that pre-date the field
    // landing in the schema. New rows always have one (set at create time).
    let unsubToken = String(seq.unsubscribe_token || '').trim();
    if (!unsubToken) {
      unsubToken = generateUnsubscribeToken();
      try {
        await base44.asServiceRole.entities.AbandonedCartSequence.update(seq.id, {
          unsubscribe_token: unsubToken,
        });
      } catch (err) {
        console.error('[abandoned-cart-runner] back-fill unsubscribe_token failed:', err);
        // Non-fatal — we still send with the generated token; if the
        // buyer clicks unsubscribe and the token isn't persisted, the
        // function returns a friendly fallback.
      }
    }

    // Lazy image fetch (cached after first hit).
    const imageUrl = await getOrGenerateImage(base44, seq.package_id, stage);

    // Render email.
    const copy   = ABANDONED_CART_COPY[seq.package_id][stage];
    const ctaUrl = `${appBase()}/checkout/${seq.package_id}?email=${encodeURIComponent(seq.email)}`;
    const unsubUrl = `${appBase()}/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
    const { subject, html, text } = renderEmail(stage, copy, {
      imageUrl,
      ctaUrl,
      firstName: seq.name_first,
    });

    // Send via Resend.
    let resendResult;
    try {
      resendResult = await resend.emails.send({
        from:    fromAddress,
        to:      seq.email,
        subject,
        html:    wrapEmail(html, unsubUrl),
        text,
      });
    } catch (err) {
      console.error(`[abandoned-cart-runner] Resend send threw (${stage}):`, err);
      skipped++;
      continue;
    }
    if (resendResult?.error) {
      console.error(`[abandoned-cart-runner] Resend rejected (${stage}):`, resendResult.error);
      skipped++;
      continue;
    }

    // Mark sent.
    try {
      await base44.asServiceRole.entities.AbandonedCartSequence.update(seq.id, {
        [sentField]: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[abandoned-cart-runner] mark ${sentField} failed:`, err);
      // Send already happened; don't double-count by retrying. Worst case
      // a duplicate next run, which is rare.
    }

    sent++;
    console.log(
      `[abandoned-cart-runner] ${stage} sent — sequence_id=${seq.id}, ` +
      `email=${seq.email}, package_id=${seq.package_id}, ` +
      `resend_id=${resendResult?.data?.id || '?'}`
    );

    // Rate-limit — pace sends so a big batch doesn't exceed Resend's limit.
    await sleep(RESEND_RATE_LIMIT_MS);
  }

  return { sent, skipped };
}

// =============================================================================
// Phase 6: recovery check
// Mark recovered_at on any sequence whose buyer has now paid.
// =============================================================================
async function recoverySweep(base44) {
  let active = [];
  try {
    const found = await base44.asServiceRole.entities.AbandonedCartSequence.filter({
      unsubscribed: false,
    });
    active = unwrapList(found).filter((s) => !s?.recovered_at);
  } catch (err) {
    console.error('[abandoned-cart-runner] recovery sweep fetch failed:', err);
    return { recovered: 0, scanned: 0 };
  }

  let recovered = 0;
  let scanned = 0;

  for (const seq of active) {
    if (recovered >= PER_PHASE_CAP) break;
    scanned++;
    const success = await findSuccessfulPaymentForBuyer(base44, seq.email, seq.package_id);
    if (!success) continue;
    try {
      await base44.asServiceRole.entities.AbandonedCartSequence.update(seq.id, {
        recovered_at: new Date().toISOString(),
      });
      recovered++;
      console.log(
        `[abandoned-cart-runner] recovered — sequence_id=${seq.id}, ` +
        `email=${seq.email}, package_id=${seq.package_id}, ` +
        `payment_id=${success.id}`
      );
    } catch (err) {
      console.error('[abandoned-cart-runner] mark recovered_at failed:', err);
    }
  }

  return { recovered, scanned };
}

// =============================================================================
// HTTP entry point.
// =============================================================================
Deno.serve(async (req) => {
  const startedAt = Date.now();

  // No auth gate — Base44's scheduler invokes this. If you want manual
  // testing, hit it from a logged-in browser console:
  //   await base44.functions.invoke('abandoned-cart-runner', {})
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    console.error('[abandoned-cart-runner] RESEND_API_KEY missing');
    return Response.json({ error: 'email_not_configured' }, { status: 500 });
  }
  const fromAddress =
    Deno.env.get('RESEND_FROM_EMAIL') || 'Marketing iO Team <hello@marketingio.co.za>';

  const base44 = createClientFromRequest(req);
  const resend = new Resend(apiKey);

  console.log('[abandoned-cart-runner] starting');

  const tabClosed     = await sweepTabClosed(base44);
  const formAbandoned = await sweepFormAbandoned(base44);
  const email1        = await sendEmailN(base44, resend, fromAddress, 'email_1');
  const email2        = await sendEmailN(base44, resend, fromAddress, 'email_2');
  const email3        = await sendEmailN(base44, resend, fromAddress, 'email_3');
  const recovery      = await recoverySweep(base44);

  const summary = {
    elapsed_ms:  Date.now() - startedAt,
    tab_closed:  tabClosed,
    form_abandoned: formAbandoned,
    email_1:     email1,
    email_2:     email2,
    email_3:     email3,
    recovery,
  };
  console.log('[abandoned-cart-runner] complete', summary);
  return Response.json(summary);
});
