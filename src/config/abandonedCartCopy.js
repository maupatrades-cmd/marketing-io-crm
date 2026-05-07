// Marketing iO abandoned-cart email copy — Step 8 PR E.1
//
// 12 products × 3 emails = 36 templates. Wording is taken verbatim from the
// brief; do not edit casually — copy was tuned for tone and conversion.
//
// Placeholders:
//   {first_name}  — substituted at send-time. Falls back to "there" when
//                   we don't have one.
//
// Template shape per email:
//   {
//     subject:    string                       // {first_name} ok
//     hook:       string                       // pre-headline / preheader
//     body_intro: string                       // main paragraph
//     benefits:   string[]                     // optional bullet list
//     loss_points: string[]                    // optional "what you're losing"
//     cta_text:   string                       // button label
//   }
//
// Sandbox `ignite-test` is intentionally ABSENT — the runner skips it
// (test transactions don't need recovery emails).

export const ABANDONED_CART_COPY = {
  // ===========================================================================
  // 1. ignite — Ignite Setup R3,980
  // ===========================================================================
  ignite: {
    email_1: {
      subject:    '{first_name}, your Ignite setup is on pause',
      hook:       'Did the payment hiccup?',
      body_intro:
        'We saw you started checking out our Ignite Setup but didn\'t finish. ' +
        'No drama — these things happen. Click below to pick up where you left off.',
      cta_text:   'Continue with Ignite Setup →',
    },
    email_2: {
      subject:    'Your branded website should be live in 30 days, {first_name}',
      hook:       'Here\'s what Ignite builds for you',
      benefits: [
        'A live one-page website on your own .co.za domain',
        'A professional @yourbusiness.co.za email address',
        'A verified Google Business Profile customers find on Maps',
        'Branded Facebook and Instagram pages with launch content',
        'Eight social posts per month, every month, for 12 months',
      ],
      body_intro:
        '30 days from now, you could have all of this running. Or you could ' +
        'still be looking the same as last week.',
      cta_text:   'Start my Ignite setup →',
    },
    email_3: {
      subject:    '{first_name}, your competitors are still online today',
      hook:       'What you\'re losing every day you wait',
      body_intro:
        'Every day without a website is a day customers Google your business ' +
        'name and find nothing. The "near me" searches happening today in your ' +
        'area are going to competitors who already have what you\'re about to buy.',
      loss_points: [
        'First-mover advantage in your local market',
        'Compounding Google Business reviews and visibility',
        'Social media followers building before you even start',
      ],
      cta_text:   'I\'m ready — start Ignite →',
    },
  },

  // ===========================================================================
  // 2. accelerate — Accelerate Setup R6,500
  // ===========================================================================
  accelerate: {
    email_1: {
      subject:    '{first_name}, your Accelerate package is paused',
      hook:       'Need help finishing checkout?',
      body_intro:
        'Looks like the Accelerate signup didn\'t go through. We\'ve held your ' +
        'spot — finish below when you\'re ready.',
      cta_text:   'Continue with Accelerate →',
    },
    email_2: {
      subject:    '{first_name}, this is what Accelerate builds for you',
      hook:       'Multi-channel marketing infrastructure',
      benefits: [
        'A multi-page website with up to 20 product or service listings',
        'A Google Ads account fully configured with conversion tracking',
        'Branded business cards designed and ready',
        'Three social media profiles: Facebook, Instagram, LinkedIn',
        'Twelve social posts per month plus quarterly strategy calls',
      ],
      body_intro:
        'Accelerate is for businesses ready to compete on multiple fronts at ' +
        'once. Within 40 days you have what most agencies take 6 months to build.',
      cta_text:   'Start my Accelerate setup →',
    },
    email_3: {
      subject:    '{first_name}, businesses that hesitate get overtaken',
      hook:       'The cost of waiting',
      body_intro:
        'Mid-sized SA businesses that signed up for Accelerate this month ' +
        'already have leads coming in. The longer the gap, the harder it is ' +
        'to catch up to a competitor who started today.',
      loss_points: [
        'Months of compounding ad-account learning data',
        'Brand consistency across all channels customers check',
        'First-page Google rankings that take time to build',
      ],
      cta_text:   'I\'m in — start Accelerate →',
    },
  },

  // ===========================================================================
  // 3. dominate — Dominate Setup R9,800
  // ===========================================================================
  dominate: {
    email_1: {
      subject:    '{first_name}, your Dominate setup is waiting',
      hook:       'Let\'s finish this together',
      body_intro:
        'You started the Dominate setup and stopped. No problem — pick up ' +
        'exactly where you left off.',
      cta_text:   'Continue with Dominate →',
    },
    email_2: {
      subject:    '{first_name}, Dominate is full-spectrum dominance',
      hook:       'What R9,800 unlocks',
      benefits: [
        'A 10-page premium website with full SEO architecture',
        'Two SEO-optimised blog articles every month for 12 months',
        'Live Google Ads + Meta Ads campaigns',
        'Lead capture forms with 5-email automated welcome sequence',
        'Branded business cards (printed + delivered)',
        'Monthly strategy calls with the Marketing iO Founder',
      ],
      body_intro:
        'Mid-sized professional services don\'t dominate by accident. ' +
        'Dominate is the playbook.',
      cta_text:   'Start my Dominate setup →',
    },
    email_3: {
      subject:    '{first_name}, mid-sized businesses don\'t dominate by accident',
      hook:       'The compounding cost of waiting',
      body_intro:
        'Search rankings compound. Every week you wait, your industry\'s search ' +
        'rankings get harder to climb because someone else is doing the work ' +
        'today. The Dominate clients we onboarded last month are already ' +
        'ranking for keywords their competitors gave up on.',
      loss_points: [
        'Compounding SEO that takes 6+ months to build',
        'Ad-account historical data that improves performance over time',
        'Strategic positioning that owns category mindshare',
      ],
      cta_text:   'I\'m ready — start Dominate →',
    },
  },

  // ===========================================================================
  // 4. street-pulse — Street Pulse Setup R700 + R4,000/m
  // ===========================================================================
  'street-pulse': {
    email_1: {
      subject:    '{first_name}, Street Pulse is locked and ready',
      hook:       'Just one click left',
      body_intro:
        'Your Street Pulse activation is queued — just need the setup payment ' +
        'to clear and we deploy.',
      cta_text:   'Continue with Street Pulse →',
    },
    email_2: {
      subject:    '{first_name}, picture 3,000 hands holding your flyer',
      hook:       'What 3 months of Street Pulse looks like',
      benefits: [
        'Two branded deployment agents in your colours',
        'Four deployment days every month, three months locked',
        '1,000 flyers in customer hands per month — 3,000 total',
        'Branded transport vehicle to deployment zones',
        'Same-day photo evidence sent via WhatsApp',
      ],
      body_intro:
        'Street Pulse is direct foot-traffic awareness — the kind that builds ' +
        'local recognition fast.',
      cta_text:   'Start my Street Pulse →',
    },
    email_3: {
      subject:    '{first_name}, foot traffic doesn\'t wait',
      hook:       'What you lose every week',
      body_intro:
        'Every week you delay Street Pulse is 250 fewer hands holding your ' +
        'brand. Multiply that by your conversion rate and the math gets ' +
        'uncomfortable.',
      loss_points: [
        'This weekend\'s foot traffic at your target zones',
        'First-mover positioning in high-traffic areas',
        'Brand familiarity that builds with repeat exposure',
      ],
      cta_text:   'I\'m in — deploy Street Pulse →',
    },
  },

  // ===========================================================================
  // 5. township-pulse — Township Pulse R2,200
  // ===========================================================================
  'township-pulse': {
    email_1: {
      subject:    '{first_name}, your Township Pulse activation is paused',
      hook:       'Almost there',
      body_intro:
        'You started booking your township activation — let\'s finish so we ' +
        'can schedule your deployment.',
      cta_text:   'Continue with Township Pulse →',
    },
    email_2: {
      subject:    '{first_name}, here\'s where your business shows up',
      hook:       'One day. Maximum impact.',
      benefits: [
        'A branded agent at the busiest taxi rank or spaza cluster in your township',
        '300 flyers handed directly to customers',
        '5 A2 posters mounted at high-foot zones',
        'Photo evidence delivered within 7 days',
      ],
      body_intro:
        'Township Pulse is one focused day of maximum awareness in the area ' +
        'you choose. Customers remember the brand they saw at the taxi rank ' +
        'Monday morning.',
      cta_text:   'Book my Township Pulse →',
    },
    email_3: {
      subject:    '{first_name}, township awareness is a one-shot opportunity',
      hook:       'First brand wins',
      body_intro:
        'The first brand to activate a township area owns the awareness. ' +
        'Once a competitor runs the same campaign in the same zone, your ' +
        'impact halves and the budget you spend works harder for them than ' +
        'for you.',
      loss_points: [
        'Being first in your township',
        'Owning the visual landscape before competitors copy',
        'The novelty factor that drives word-of-mouth',
      ],
      cta_text:   'I\'m in — book Township Pulse →',
    },
  },

  // ===========================================================================
  // 6. ai-chatbot — AI Chatbot Setup R6,500
  // ===========================================================================
  'ai-chatbot': {
    email_1: {
      subject:    '{first_name}, your AI Chatbot setup is paused',
      hook:       'One step away from 24/7 customer service',
      body_intro:
        'You started the AI Chatbot setup — just need to finalise the payment ' +
        'and we begin training.',
      cta_text:   'Continue with AI Chatbot →',
    },
    email_2: {
      subject:    '{first_name}, your chatbot answers customers while you sleep',
      hook:       'What "always-on" looks like',
      benefits: [
        'Configured to your business and trained on your service info',
        'Captures and qualifies leads at 2am while competitors are closed',
        'Books qualified prospects directly into your calendar',
        'Integrates with WhatsApp, your website, and Facebook Messenger',
        'Hands off to you when human conversation is needed',
      ],
      body_intro:
        'Your competitors close at 5pm. Your chatbot doesn\'t.',
      cta_text:   'Start my AI Chatbot →',
    },
    email_3: {
      subject:    '{first_name}, every "we\'re closed" message you send loses a customer',
      hook:       'After-hours customers go to whoever responds',
      body_intro:
        'While you read this, customers in your industry are messaging ' +
        'businesses at 9pm and getting instant replies from chatbots. ' +
        'Without one, you\'re losing every after-hours enquiry to a ' +
        'competitor that automated this 6 months ago.',
      loss_points: [
        'After-hours leads (often the most motivated buyers)',
        'Instant-response advantage in your category',
        'Sales bookings while you\'re with family',
      ],
      cta_text:   'Set up my chatbot →',
    },
  },

  // ===========================================================================
  // 7. whatsapp-automation — WhatsApp Business Automation R3,500
  // ===========================================================================
  'whatsapp-automation': {
    email_1: {
      subject:    '{first_name}, your WhatsApp setup is on hold',
      hook:       'Almost done',
      body_intro:
        'You started the WhatsApp Business Automation setup but didn\'t ' +
        'finish. Click below to wrap it up.',
      cta_text:   'Continue with WhatsApp Automation →',
    },
    email_2: {
      subject:    '{first_name}, every WhatsApp message converts 3x better than email',
      hook:       'WhatsApp is SA\'s #1 sales channel',
      benefits: [
        'WhatsApp Business profile fully configured and verified',
        'Automated welcome message and out-of-hours auto-reply',
        'Lead capture flows that ask qualifying questions',
        'Broadcast list capability for promotions and updates',
        'Quick-reply templates for the questions you answer 100 times',
      ],
      body_intro:
        'South Africans message businesses on WhatsApp 5x more than they ' +
        'call. The setup is done in days — the impact lasts years.',
      cta_text:   'Start my WhatsApp setup →',
    },
    email_3: {
      subject:    '{first_name}, your customers are already on WhatsApp',
      hook:       'The question isn\'t whether — it\'s when',
      body_intro:
        'Customers are already trying to WhatsApp businesses in your industry. ' +
        'The only question is whether you\'ll be set up to capture them or ' +
        'whether they\'ll bounce to a competitor who automated theirs last ' +
        'quarter.',
      loss_points: [
        'Inbound WhatsApp enquiries you\'ll never see',
        'Speed-of-response advantage in your category',
        'Broadcast-list reach when you launch promotions',
      ],
      cta_text:   'Set up my WhatsApp →',
    },
  },

  // ===========================================================================
  // 8. google-business-profile — Google Business Profile Setup R800
  // ===========================================================================
  'google-business-profile': {
    email_1: {
      subject:    '{first_name}, your Google Business Profile is almost live',
      hook:       'Click below to finish',
      body_intro:
        'You started setting up your Google Business Profile — just need to ' +
        'confirm payment and we get you verified on Google.',
      cta_text:   'Continue setup →',
    },
    email_2: {
      subject:    '{first_name}, this is the difference between findable and invisible',
      hook:       'What R800 unlocks',
      benefits: [
        'Verified Google Business Profile with the blue tick',
        'Your business name, photos, hours, and phone number on Google Maps',
        'Customer reviews collection enabled',
        'Local SEO foundation that helps you appear in "near me" searches',
        'One-time setup, lifetime visibility',
      ],
      body_intro:
        'This is the cheapest, highest-leverage marketing investment for any ' +
        'local business. Set up once. Found forever.',
      cta_text:   'Set up my Google Business Profile →',
    },
    email_3: {
      subject:    '{first_name}, "near me" searches happen every minute',
      hook:       'Customers searching now are buying now',
      body_intro:
        'Right now, somewhere in your area, a customer is Googling "your ' +
        'service near me". They\'re a buyer, not a browser. Without a Google ' +
        'Business Profile, that customer goes to a competitor — every single ' +
        'search, every single day.',
      loss_points: [
        'Every "near me" search you don\'t appear in',
        'Reviews you could be collecting starting today',
        'Google Maps visibility competitors have',
      ],
      cta_text:   'Get me verified →',
    },
  },

  // ===========================================================================
  // 9. sms-marketing — SMS Marketing Setup R500
  // ===========================================================================
  'sms-marketing': {
    email_1: {
      subject:    '{first_name}, your SMS Marketing is ready to launch',
      hook:       'One more step',
      body_intro:
        'The SMS Marketing platform is set up and waiting — just need to ' +
        'finalise payment to activate it for your campaigns.',
      cta_text:   'Continue setup →',
    },
    email_2: {
      subject:    '{first_name}, SMS gets a 98% open rate',
      hook:       'The channel customers can\'t ignore',
      benefits: [
        'SMS sending platform configured for your business',
        'Contact list management and segmentation',
        'Promotional, reminder, and flash-sale message templates',
        'Personalisation tokens (first name, last visit, etc.)',
        'Analytics dashboard for delivery and engagement',
      ],
      body_intro:
        'Email open rates: 20%. SMS open rates: 98%. Which channel would you ' +
        'rather send your next sale through?',
      cta_text:   'Activate my SMS Marketing →',
    },
    email_3: {
      subject:    '{first_name}, the channel your customers can\'t ignore',
      hook:       'What you\'re missing',
      body_intro:
        'Every promotional email you send is competing with 100 others. SMS ' +
        'lands in the only inbox they always check. The brands using SMS in ' +
        'your category are reaching customers you can\'t, and you\'re paying ' +
        'for that gap in lost sales.',
      loss_points: [
        '98% read-rate visibility for your promotions',
        'Direct line to your most valuable repeat customers',
        'Same-day flash-sale capability',
      ],
      cta_text:   'Set up SMS for me →',
    },
  },

  // ===========================================================================
  // 10. marketing-audit — Marketing Audit & Report R2,000
  // ===========================================================================
  'marketing-audit': {
    email_1: {
      subject:    '{first_name}, your Marketing Audit is paused',
      hook:       'Need any help?',
      body_intro:
        'You started ordering a Marketing Audit but didn\'t complete checkout. ' +
        'Click below if you\'d like to pick it up.',
      cta_text:   'Continue with my Audit →',
    },
    email_2: {
      subject:    '{first_name}, this audit shows you exactly where you\'re leaking money',
      hook:       'What R2,000 reveals',
      benefits: [
        'Comprehensive audit of your website, social media, and search visibility',
        'Ad spend efficiency analysis (where the money is and isn\'t working)',
        'Competitor positioning summary for your top 3 rivals',
        'Prioritised recommendations — what to fix first, second, third',
        'Written report you can act on or share with your team',
      ],
      body_intro:
        'Audits pay for themselves on the first fix. The R2,000 you don\'t ' +
        'spend now is the R20,000 of leaked ad spend you\'ll pay this year.',
      cta_text:   'Order my Marketing Audit →',
    },
    email_3: {
      subject:    '{first_name}, you can\'t fix what you can\'t see',
      hook:       'Every week of guessing is expensive',
      body_intro:
        'Every week you spend on marketing without a clear audit is money ' +
        'spent guessing. Most SMEs are leaking 30-50% of their marketing ' +
        'budget on channels that don\'t work for them — and they don\'t know ' +
        'which 30-50% it is.',
      loss_points: [
        'Months of inefficient ad spend',
        'Strategic clarity your competitors paid to get',
        'Cumulative cost of unfixed leaks',
      ],
      cta_text:   'Get my audit done →',
    },
  },

  // ===========================================================================
  // 11. competitor-analysis — Competitor Analysis Report R1,500
  // ===========================================================================
  'competitor-analysis': {
    email_1: {
      subject:    '{first_name}, your Competitor Analysis is paused',
      hook:       'Just one click',
      body_intro:
        'You started ordering a Competitor Analysis Report. Click below to ' +
        'finish — the report is delivered within 5 business days.',
      cta_text:   'Continue with my Analysis →',
    },
    email_2: {
      subject:    '{first_name}, know exactly what your top 3 competitors are doing',
      hook:       'What\'s in the report',
      benefits: [
        'Pricing analysis: what they charge, how they package, where they discount',
        'Marketing channel breakdown: where they spend, what works',
        'Content and positioning audit: how they sell their value',
        'Ad-spend signals: which campaigns are working for them',
        'Strategic recommendations on how to position against them',
      ],
      body_intro:
        'You can\'t outsmart competitors you don\'t understand. R1,500 buys ' +
        'you a clearer view of your market than most of them have of their own.',
      cta_text:   'Order my Analysis →',
    },
    email_3: {
      subject:    '{first_name}, fighting blind is an expensive way to compete',
      hook:       'Information advantage compounds',
      body_intro:
        'Your competitors are pricing, positioning, and advertising sharper ' +
        'than you because they\'ve done the analysis you haven\'t. Every ' +
        'quote you lose to a smarter competitor is the cost of skipping this.',
      loss_points: [
        'Strategic blind spots competitors are exploiting',
        'Pricing power you could be claiming',
        'Positioning gaps you could be owning',
      ],
      cta_text:   'Get my report →',
    },
  },

  // ===========================================================================
  // 12. crm-training — CRM Training & Setup R3,000
  // ===========================================================================
  'crm-training': {
    email_1: {
      subject:    '{first_name}, your CRM Training is paused',
      hook:       'We\'re ready when you are',
      body_intro:
        'You started booking CRM Training & Setup but didn\'t finish ' +
        'checkout. Click below to schedule your team session.',
      cta_text:   'Continue setup →',
    },
    email_2: {
      subject:    '{first_name}, this is the system that turns leads into closed deals',
      hook:       'What CRM Training & Setup includes',
      benefits: [
        'CRM platform configured around your sales process',
        'Contact and deal pipelines tailored to your business',
        'Team training session walking everyone through daily use',
        'Reporting dashboards so you see what\'s actually working',
        'Email and SMS templates loaded and ready',
      ],
      body_intro:
        'A CRM isn\'t software — it\'s a system. The system that makes sure ' +
        'no lead falls through the cracks, ever.',
      cta_text:   'Set up my CRM →',
    },
    email_3: {
      subject:    '{first_name}, leads in spreadsheets get forgotten',
      hook:       'Every uncaptured lead is paid traffic wasted',
      body_intro:
        'Every week without a CRM is leads slipping through cracks. The ' +
        'deals you don\'t close because you didn\'t follow up pay for the ' +
        'CRM training ten times over within the first quarter.',
      loss_points: [
        'Forgotten follow-ups that lose deals',
        'Lead-source attribution you can\'t measure',
        'Sales pipeline visibility your competitors already have',
      ],
      cta_text:   'Get my CRM done →',
    },
  },
};

// Image prompts per email stage. Used by the runner when no PackageEmailImage
// exists for a given (package, stage). Verbatim from the brief.
//
// email_1 prompt always references the package by its display name. email_2
// has package-category-specific prompts. email_3 is a single template
// across all packages.

export const EMAIL_1_PROMPT = (packageName) =>
  `Photorealistic close-up portrait of a young South African professional looking confused at a laptop screen, soft natural lighting, professional setting. Subtle disappointed expression. The screen shows a ${packageName} signup page. Cinematic, high-detail, 4K.`;

export const EMAIL_2_PROMPTS_BY_PACKAGE = {
  // Core packages share the dashboard / hopeful imagery.
  ignite:
    'Photorealistic image of a successful South African small business owner smiling at a laptop showing analytics dashboard with growing numbers, warm natural lighting, hopeful uplifting mood, modern office setting. 4K cinematic.',
  accelerate:
    'Photorealistic image of a successful South African small business owner smiling at a laptop showing analytics dashboard with growing numbers, warm natural lighting, hopeful uplifting mood, modern office setting. 4K cinematic.',
  dominate:
    'Photorealistic image of a successful South African small business owner smiling at a laptop showing analytics dashboard with growing numbers, warm natural lighting, hopeful uplifting mood, modern office setting. 4K cinematic.',
  'street-pulse':
    'Photorealistic image of a busy South African shopping street, well-dressed brand agents in branded shirts handing flyers to enthusiastic pedestrians, mid-day natural light. Documentary photography style. 4K.',
  'township-pulse':
    'Photorealistic image of a vibrant South African township taxi rank during peak hours, branded posters visible at high-traffic spots, brand agent engaging with locals, golden afternoon light. 4K cinematic.',
  'ai-chatbot':
    'Photorealistic image of a phone screen showing a friendly chatbot conversation at 2am, glowing softly in a dark room, customer\'s hand visible. 4K cinematic, modern.',
  'whatsapp-automation':
    'Photorealistic image of a smartphone with WhatsApp open showing multiple business conversations and quick auto-replies, natural lighting on a desk with coffee cup. 4K.',
  'google-business-profile':
    'Photorealistic image of a Google Maps result on a phone showing a verified business with photos and 5-star reviews, person about to tap to navigate. 4K cinematic.',
  'sms-marketing':
    'Photorealistic image of multiple phones showing the same SMS notification from a brand, bird\'s-eye-view, soft studio lighting, modern composition. 4K.',
  'marketing-audit':
    'Photorealistic image of a printed business report on a desk with charts and highlighted insights, magnifying glass on top, warm office lighting. 4K cinematic.',
  'competitor-analysis':
    'Photorealistic image of a printed business report on a desk with charts and highlighted insights, magnifying glass on top, warm office lighting. 4K cinematic.',
  'crm-training':
    'Photorealistic image of a small business team gathered around a laptop learning a CRM dashboard, engaged and smiling, modern office. 4K.',
};

export const EMAIL_3_PROMPT = (packageName) =>
  `Photorealistic image of an hourglass with sand running out, dramatic side lighting, the package name '${packageName}' subtly visible on a document beneath it, urgent business setting. 4K cinematic, high-contrast.`;

// Packages this system covers. ignite-test is intentionally absent — the
// runner skips it.
export const ABANDONED_CART_PACKAGE_IDS = Object.keys(ABANDONED_CART_COPY);
