import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CAMPAIGNS = [
  {
    name: 'Welcome – Day 0',
    slug: 'welcome_day_0',
    subject_line: 'You showed up. Most business owners never do.',
    preheader: 'Welcome to Marketing iO. Let\'s grow this thing.',
    trigger_type: 'after_signup_verified',
    trigger_offset_days: 0,
    active: true,
    image_prompt: 'A young South African entrepreneur standing confidently in front of a brightly-lit modern shop window at golden hour, looking up at illuminated signage with their business logo. Cinematic photography, warm tones, hopeful and aspirational mood, shallow depth of field.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">You just did something most business owners never do.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">You looked at your business and thought: <em>"This could be bigger. Better. Seen by more people."</em></p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">And then you actually did something about it.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">That's rare. Most owners stay stuck — same Instagram page, same outdated website, same flyer they made two years ago — and wonder why nothing changes.</p>
<p style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 16px 0;">You're not them.</p>
<p style="font-size:16px;font-weight:700;color:#a764e6;margin:0 0 12px 0;">Here's what we do at Marketing iO:</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px 0;">
  <tr><td style="padding:8px 0;font-size:15px;color:#1e293b;line-height:1.5;">🚀 <strong>Ignite, Accelerate, Dominate</strong> — three growth packages, one for every stage of business</td></tr>
  <tr><td style="padding:8px 0;font-size:15px;color:#1e293b;line-height:1.5;">📱 <strong>Social media management</strong> that actually drives leads, not just likes</td></tr>
  <tr><td style="padding:8px 0;font-size:15px;color:#1e293b;line-height:1.5;">🎯 <strong>Paid advertising</strong> on Google and Meta — setup, management, results</td></tr>
  <tr><td style="padding:8px 0;font-size:15px;color:#1e293b;line-height:1.5;">🤖 <strong>AI Chatbot &amp; WhatsApp automation</strong> — let customers reach you 24/7</td></tr>
  <tr><td style="padding:8px 0;font-size:15px;color:#1e293b;line-height:1.5;">📍 <strong>Street Pulse &amp; Township Pulse</strong> — for businesses that win on the ground</td></tr>
  <tr><td style="padding:8px 0;font-size:15px;color:#1e293b;line-height:1.5;">🖨️ <strong>Print, signage, and brand identity</strong> — through our trusted partner network</td></tr>
</table>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">You don't need all of it. You need the right starting point.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 24px 0;"><strong>Reply to this email</strong> and tell us where you're stuck. We'll tell you exactly which package is right — no upsell games.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td><a href="https://app.marketingio.co.za/client-portal" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Visit Your Portal →</a></td></tr></table>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:24px;">— The Marketing iO Team</p>`
  },
  {
    name: 'Welcome – Day 3',
    slug: 'welcome_day_3',
    subject_line: 'Three reasons your business isn\'t growing (be honest)',
    preheader: 'Most businesses fail at one of these. Which one is yours?',
    trigger_type: 'after_signup_verified',
    trigger_offset_days: 3,
    active: true,
    image_prompt: 'A split-screen image: left side shows a dim, empty small business storefront at dusk with no signage; right side shows the same storefront transformed with vibrant illuminated branding, customers walking in, warm interior glow. Documentary photography style, dramatic before/after contrast.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">Let's be honest with each other for a second.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px 0;">If your business isn't growing, it's almost always one of these three things:</p>
<div style="background:#fafafa;border-left:4px solid #a764e6;border-radius:8px;padding:20px 24px;margin:0 0 16px 0;">
<p style="font-size:16px;font-weight:700;color:#a764e6;margin:0 0 8px 0;">1. People can't find you.</p>
<p style="font-size:15px;line-height:1.6;color:#475569;margin:0;">No website. Or a website built five years ago. Or you're "on Instagram" but you post once a month. Customers are searching for what you offer right now — and finding your competitors instead.</p>
</div>
<div style="background:#fafafa;border-left:4px solid #ec4899;border-radius:8px;padding:20px 24px;margin:0 0 16px 0;">
<p style="font-size:16px;font-weight:700;color:#ec4899;margin:0 0 8px 0;">2. People find you, but aren't convinced.</p>
<p style="font-size:15px;line-height:1.6;color:#475569;margin:0;">Your branding looks DIY. Your photos are blurry. Your copy says "passionate about quality" like every other business. Nothing about you screams "trust me with your money."</p>
</div>
<div style="background:#fafafa;border-left:4px solid #a764e6;border-radius:8px;padding:20px 24px;margin:0 0 24px 0;">
<p style="font-size:16px;font-weight:700;color:#a764e6;margin:0 0 8px 0;">3. You're invisible offline.</p>
<p style="font-size:15px;line-height:1.6;color:#475569;margin:0;">No flyers in the right places. No vehicle branding. No signage at your premises. The customers within 5km of you have no idea you exist.</p>
</div>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">Each one is fixable. Most agencies will sell you all three at once and charge R50,000.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">We don't work like that. We fix the one that's hurting you most, prove it works, then move to the next.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 24px 0;">Want us to look at your business and tell you which one is your bottleneck? Reply with your business name and website (or Instagram handle if you don't have a site yet). We'll send you a free 5-point assessment within 48 hours.</p>
<p style="font-size:15px;font-style:italic;color:#64748b;margin:0 0 24px 0;">No sales pitch. Just the truth.</p>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:8px;">— The Marketing iO Team</p>`
  },
  {
    name: 'Welcome – Day 7 (Package Push)',
    slug: 'welcome_day_7',
    subject_line: 'R3,980. That\'s all it takes to start.',
    preheader: 'Pick one. We\'ll handle the rest.',
    trigger_type: 'after_signup_verified',
    trigger_offset_days: 7,
    active: true,
    image_prompt: 'A focused South African business owner at their desk, illuminated by a laptop screen showing a sleek modern dashboard. Their face shows determination and ambition. Cinematic, moody, aspirational. Soft purple and pink screen glow.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">A week ago, you signed up.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">You haven't started a package yet. We get it — life is busy. But here's something you need to hear:</p>
<p style="font-size:18px;font-weight:700;color:#a764e6;margin:0 0 24px 0;">Every week you wait, your competitors get further ahead.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px 0;">We made it simple. Three packages. One decision.</p>
<div style="background:linear-gradient(135deg,#faf5ff 0%,#fff1f7 100%);border-radius:10px;padding:20px;margin:0 0 12px 0;">
<p style="font-size:16px;font-weight:700;color:#a764e6;margin:0 0 6px 0;">🚀 Ignite — R3,980 setup &amp; R490/month</p>
<p style="font-size:14px;color:#475569;margin:0;line-height:1.5;">For small businesses that need to look professional online — fast. The minimum it takes to stop losing customers to better-looking competitors.</p>
</div>
<div style="background:linear-gradient(135deg,#faf5ff 0%,#fff1f7 100%);border-radius:10px;padding:20px;margin:0 0 12px 0;">
<p style="font-size:16px;font-weight:700;color:#a764e6;margin:0 0 6px 0;">📈 Accelerate — R6,500 setup &amp; R890/month</p>
<p style="font-size:14px;color:#475569;margin:0;line-height:1.5;">For established businesses ready to grow. Everything in Ignite plus content production, ongoing social management, and the systems that keep customers coming back.</p>
</div>
<div style="background:linear-gradient(135deg,#faf5ff 0%,#fff1f7 100%);border-radius:10px;padding:20px;margin:0 0 20px 0;">
<p style="font-size:16px;font-weight:700;color:#a764e6;margin:0 0 6px 0;">🏆 Dominate — R9,800 setup &amp; R1,490/month</p>
<p style="font-size:14px;color:#475569;margin:0;line-height:1.5;">For businesses that want to own their market. Full brand build, strategic content, paid ads management, the works. This is what your biggest competitor is paying for.</p>
</div>
<p style="font-size:15px;font-weight:600;color:#1e293b;margin:0 0 12px 0;">Plus — for businesses that operate in the real world:</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
<tr><td style="padding:6px 0;font-size:15px;color:#1e293b;">📍 <strong>Street Pulse</strong> — R700 setup + R3,700/mo (3 months locked) — physical presence, signage, on-the-ground visibility</td></tr>
<tr><td style="padding:6px 0;font-size:15px;color:#1e293b;">📍 <strong>Township Pulse</strong> — R1,300 once-off — for spaza shops and high-foot-traffic businesses</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr><td><a href="https://app.marketingio.co.za/client/order-addons" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Pick Your Package →</a></td></tr></table>
<p style="font-size:15px;line-height:1.6;color:#64748b;margin:0 0 16px 0;">Not sure which fits? <strong>Reply to this email</strong> with your business name and what you sell. We'll tell you exactly which one is right — no upsell games.</p>
<p style="font-size:14px;color:#94a3b8;margin:0 0 24px 0;font-style:italic;">P.S. The setup fees are once-off. The monthly fees give you ongoing work — fresh content, monitoring, optimisation — every single month. That's how real growth happens.</p>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:8px;">— The Marketing iO Team</p>`
  },
  {
    name: 'Monthly Newsletter',
    slug: 'monthly_newsletter',
    subject_line: 'The {{month}} growth playbook (3 things that work right now)',
    preheader: 'What we built last month — and what we\'d build for you.',
    trigger_type: 'scheduled',
    trigger_offset_days: 0,
    active: true,
    image_prompt: 'A vibrant flat-lay of marketing tools on a deep purple desk: a fresh notepad with handwritten goals, a laptop showing a colourful analytics dashboard, a smartphone displaying social media metrics climbing upward, branded materials, coffee cup. Top-down view, cinematic lighting, bold and energetic.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">It's {{month}}. Most businesses are coasting. The smart ones are doubling down.</p>
<p style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 16px 0;">Here's what's working right now in 2026:</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
<tr><td style="padding:10px 0;font-size:15px;color:#1e293b;line-height:1.5;border-bottom:1px solid #f1f5f9;">🎯 <strong>Trend #1:</strong> Short-form video continues to dominate lead generation — businesses posting 4+ short videos per month see 3x more enquiries than those that don't.</td></tr>
<tr><td style="padding:10px 0;font-size:15px;color:#1e293b;line-height:1.5;border-bottom:1px solid #f1f5f9;">🎯 <strong>Trend #2:</strong> WhatsApp Business automation is converting walk-in foot traffic into loyal returning customers — businesses using it report 40% higher repeat visits.</td></tr>
<tr><td style="padding:10px 0;font-size:15px;color:#1e293b;line-height:1.5;">🎯 <strong>Trend #3:</strong> Google Business Profile optimisation is the single highest-ROI activity for local SMEs — and most businesses haven't touched theirs in over a year.</td></tr>
</table>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">If you're sitting on the fence about something for your business — a package upgrade, a new add-on, social media you've been putting off — this is your sign.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td><a href="https://app.marketingio.co.za/client/order-addons" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">See What We Can Build For You →</a></td></tr></table>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:8px;">— The Marketing iO Team</p>`
  },
  {
    name: 'Service Spotlight',
    slug: 'service_spotlight',
    subject_line: 'The one tool your competitors are using that you\'re not',
    preheader: 'The truth about what it really costs to skip it.',
    trigger_type: 'scheduled',
    trigger_offset_days: 0,
    active: true,
    image_prompt: 'A close-up of a business owner reviewing beautiful digital marketing analytics on a premium laptop in a modern office, intense focus, warm cinematic lighting, deep purple and pink ambient glow from screens, professional and aspirational mood.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">Let's talk about <strong>AI Chatbot &amp; WhatsApp Automation</strong>.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px 0;">Most business owners think they can do without it. They're wrong — and here's why:</p>
<div style="background:#fff5f5;border-left:4px solid #ef4444;border-radius:8px;padding:16px 20px;margin:0 0 20px 0;">
<p style="font-size:15px;font-weight:700;color:#dc2626;margin:0 0 10px 0;">Without it:</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="padding:4px 0;font-size:14px;color:#475569;">❌ Customers message you at 11pm and get no reply — they move to your competitor by morning</td></tr>
<tr><td style="padding:4px 0;font-size:14px;color:#475569;">❌ You spend hours answering the same 5 questions instead of growing your business</td></tr>
<tr><td style="padding:4px 0;font-size:14px;color:#475569;">❌ Leads that visit your profile during off-hours are lost forever</td></tr>
</table>
</div>
<div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:8px;padding:16px 20px;margin:0 0 24px 0;">
<p style="font-size:15px;font-weight:700;color:#059669;margin:0 0 10px 0;">With it (the Marketing iO way):</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="padding:4px 0;font-size:14px;color:#475569;">✅ 24/7 instant response to every enquiry — while you sleep</td></tr>
<tr><td style="padding:4px 0;font-size:14px;color:#475569;">✅ Automated lead capture, qualification, and follow-up</td></tr>
<tr><td style="padding:4px 0;font-size:14px;color:#475569;">✅ Broadcast messages to your entire customer database with one click</td></tr>
</table>
</div>
<div style="background:linear-gradient(135deg,#faf5ff 0%,#fff1f7 100%);border-radius:10px;padding:20px;margin:0 0 24px 0;text-align:center;">
<p style="font-size:14px;color:#64748b;margin:0 0 4px 0;">Starting from</p>
<p style="font-size:32px;font-weight:700;color:#a764e6;margin:0 0 4px 0;">R3,500</p>
<p style="font-size:14px;color:#64748b;margin:0;">setup + R200/month ongoing</p>
</div>
<p style="font-size:15px;color:#1e293b;margin:0 0 24px 0;">That's less than most businesses spend on inventory that doesn't sell, ads that don't convert, or staff time wasted answering WhatsApp messages manually.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr><td><a href="https://app.marketingio.co.za/client/order-addons" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Order WhatsApp Automation →</a></td></tr></table>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:8px;">— The Marketing iO Team</p>`
  },
  {
    name: 'Anniversary – 1 Year',
    slug: 'anniversary',
    subject_line: 'One year. Look how far you\'ve come.',
    preheader: '365 days ago you took a chance on us. Let\'s keep going.',
    trigger_type: 'after_anniversary',
    trigger_offset_days: 365,
    active: true,
    image_prompt: 'A confident business owner standing at the entrance of their now-thriving business with customers visible inside, golden hour lighting, signage gleaming. Cinematic, emotional, aspirational. Documentary realism with cinematic colour grading.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">A year ago today, you signed up with Marketing iO.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">You took a chance on us. We don't forget that.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">Here's the truth: most businesses that started when you did are gone. Closed. Quiet. Forgotten.</p>
<p style="font-size:20px;font-weight:700;color:#a764e6;margin:0 0 20px 0;">You're still standing. That's not luck — that's effort. Yours and ours.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">But here's the thing about year two: it's harder than year one.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 24px 0;">Year one is about getting noticed. Year two is about getting chosen — over and over — while your competitors copy what worked for you.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px 0;">We've got ideas for what's next.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr><td><a href="https://app.marketingio.co.za/client/order-addons" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Book a Free 30-Minute Strategy Call →</a></td></tr></table>
<p style="font-size:15px;color:#64748b;margin:0 0 24px 0;">No pitch. Just a real conversation about where your business goes from here.</p>
<p style="font-size:16px;color:#1e293b;margin:0 0 24px 0;">Thank you for trusting us with year one. Let's make year two unmissable.</p>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:8px;">— The Marketing iO Team</p>`
  },
  {
    name: 'Re-engagement (30-day inactivity)',
    slug: 'reengagement',
    subject_line: 'Did your business stop growing? (Be honest with yourself.)',
    preheader: 'It\'s been a month. Your competitors haven\'t slowed down.',
    trigger_type: 'after_login_inactivity',
    trigger_offset_days: 30,
    active: true,
    image_prompt: 'A dimly lit, empty business interior at night with dust on the counter and an unanswered phone — contrasted with the same business\'s competitor across the street, brightly lit and bustling with customers. Documentary photojournalism style, melancholy but motivating mood. Subtle Marketing iO purple light bleeding in from a single window.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">It's been over 30 days since you logged in.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">We're not chasing you for money. We're checking in because we've seen this story before:</p>
<p style="font-size:16px;line-height:1.6;color:#64748b;font-style:italic;margin:0 0 20px 0;padding:16px;background:#f8f6ff;border-radius:8px;">A business owner gets busy. Marketing falls to the bottom of the list. Three months pass. Six months. A year. Then they wonder why the leads dried up, why the phone stopped ringing, why their best month is now their worst.</p>
<p style="font-size:18px;font-weight:700;color:#a764e6;margin:0 0 20px 0;">Don't let that be your story.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">While you've been away, your competitors:</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
<tr><td style="padding:6px 0;font-size:15px;color:#1e293b;">— Posted 30+ times on social media</td></tr>
<tr><td style="padding:6px 0;font-size:15px;color:#1e293b;">— Ran new ads to the customers who could've been yours</td></tr>
<tr><td style="padding:6px 0;font-size:15px;color:#1e293b;">— Updated their websites, launched promotions, built loyalty</td></tr>
</table>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 20px 0;">You don't need to do everything. You need to do <strong>one thing this week.</strong></p>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;">
<tr><td style="padding:8px 0;font-size:15px;color:#1e293b;">🎯 <strong>Restart with Ignite</strong> — R3,980 setup, R490/mo</td></tr>
<tr><td style="padding:8px 0;font-size:15px;color:#1e293b;">🤖 <strong>Add WhatsApp automation</strong> — R3,500 setup, R200/mo</td></tr>
<tr><td style="padding:8px 0;font-size:15px;color:#1e293b;">📱 <strong>Run a Street Pulse activation</strong> — R700 setup + R3,700/mo</td></tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;"><tr><td><a href="https://app.marketingio.co.za/client/order-addons" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Pick One. Get Back In The Game →</a></td></tr></table>
<p style="font-size:14px;color:#94a3b8;font-style:italic;margin:0 0 24px 0;">P.S. If you're winding the business down, just reply and let us know — we'll close your account respectfully and wish you well.</p>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:8px;">— The Marketing iO Team</p>`
  },
  {
    name: 'Forgot Password',
    slug: 'forgot_password',
    subject_line: 'Reset your Marketing iO password',
    preheader: 'Click below to set a new password securely.',
    trigger_type: 'manual',
    trigger_offset_days: 0,
    active: true,
    image_prompt: 'A secure padlock icon rendered as soft 3D illustration with Marketing iO purple and pink gradient lighting, professional and trustworthy mood, minimal clean composition.',
    body_template: `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;">Hi {{full_name}},</h1>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">We received a request to reset your Marketing iO password.</p>
<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 24px 0;">Click the button below to set a new password. The link expires in 30 minutes for your security.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;"><tr><td><a href="{{reset_url}}" style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;">Reset Password →</a></td></tr></table>
<p style="font-size:15px;line-height:1.6;color:#64748b;margin:0 0 16px 0;">If the button doesn't work, copy and paste this link: <a href="{{reset_url}}" style="color:#a764e6;word-break:break-all;">{{reset_url}}</a></p>
<p style="font-size:15px;line-height:1.6;color:#64748b;margin:0 0 24px 0;">If you didn't request this, ignore this email — your account is safe and your password remains unchanged.</p>
<p style="font-size:14px;color:#94a3b8;margin:0 0 24px 0;">For help, contact <a href="mailto:info@marketingio.co.za" style="color:#a764e6;">info@marketingio.co.za</a>.</p>
<p style="font-size:14px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:20px;margin-top:8px;">— The Marketing iO Team</p>`
  }
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results = { created: 0, skipped: 0, errors: [] };

  for (const campaign of CAMPAIGNS) {
    try {
      const existing = await base44.asServiceRole.entities.MarketingCampaign.filter({ slug: campaign.slug });
      if (existing && existing.length > 0) {
        // Update body/prompt but preserve active state
        await base44.asServiceRole.entities.MarketingCampaign.update(existing[0].id, {
          subject_line: campaign.subject_line,
          preheader: campaign.preheader,
          body_template: campaign.body_template,
          image_prompt: campaign.image_prompt,
          trigger_type: campaign.trigger_type,
          trigger_offset_days: campaign.trigger_offset_days
        });
        results.skipped++;
        continue;
      }
      await base44.asServiceRole.entities.MarketingCampaign.create(campaign);
      results.created++;
    } catch (err) {
      results.errors.push({ slug: campaign.slug, error: err.message });
    }
  }

  return Response.json({ success: true, ...results, total: CAMPAIGNS.length });
});