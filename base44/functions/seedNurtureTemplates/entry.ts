import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const NURTURE_TEMPLATES = [
  {
    code: 'signup_thank_you',
    name: 'Welcome to Marketing iO',
    category: 'sales',
    subject: 'Welcome to Marketing iO, {{full_name}} — let\'s make your business too good to stay hidden',
    preheader: 'See our packages and pricing',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Thapelo Maupa, Marketing iO',
    variables_used: JSON.stringify(['full_name', 'packages_link']),
    html_body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); padding: 40px 20px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
    .content { padding: 40px 20px; color: #333; line-height: 1.6; }
    .content h2 { color: #a764e6; font-size: 20px; margin: 20px 0 15px 0; }
    .content p { margin: 0 0 15px 0; }
    .content ul { margin: 15px 0; padding-left: 20px; }
    .content li { margin: 10px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #0a0a14; color: #f4f4fa; padding: 30px 20px; text-align: center; font-size: 12px; }
    .footer p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Marketing iO</h1>
    </div>
    <div class="content">
      <p>Hi {{full_name}},</p>
      <p>Thank you for signing up to Marketing iO. I read every signup notification — and yours just landed in my inbox.</p>
      <p>Whether you're growing your bakery in Polokwane, your law firm in Sandton, or your salon in Mokopane, you have one thing in common with every business we work with: <strong>you're too good to stay hidden.</strong></p>
      <p>I'd love to show you exactly how Marketing iO makes that happen.</p>
      <a href="{{packages_link}}" class="cta-button">See Our Packages</a>
      <h2>Here's what makes us different:</h2>
      <ul>
        <li>✓ South African owned, Limpopo built</li>
        <li>✓ Real humans, not AI chatbots</li>
        <li>✓ Field agents who visit you in person</li>
        <li>✓ Monthly performance reports you'll actually read</li>
        <li>✓ Contracts that respect your business (no sneaky auto-renewals without notice)</li>
      </ul>
      <p>Pick a package that fits your stage — Ignite for getting started, Accelerate for serious growth, Dominate for going all-in. Or message me directly and I'll help you choose.</p>
      <p>Looking forward to working together,</p>
      <p><strong>Thapelo Maupa</strong><br>Founder, Marketing iO<br>info@marketingio.co.za</p>
    </div>
    <div class="footer">
      <p>Marketing iO (Pty) Ltd | info@marketingio.co.za</p>
      <p>123 Main Street, Polokwane, Limpopo, South Africa</p>
    </div>
  </div>
</body>
</html>`,
    plain_text_body: `Welcome to Marketing iO

Hi {{full_name}},

Thank you for signing up to Marketing iO. I read every signup notification — and yours just landed in my inbox.

Whether you're growing your bakery in Polokwane, your law firm in Sandton, or your salon in Mokopane, you have one thing in common with every business we work with: you're too good to stay hidden.

I'd love to show you exactly how Marketing iO makes that happen.

See Our Packages: {{packages_link}}

Here's what makes us different:
✓ South African owned, Limpopo built
✓ Real humans, not AI chatbots
✓ Field agents who visit you in person
✓ Monthly performance reports you'll actually read
✓ Contracts that respect your business (no sneaky auto-renewals without notice)

Pick a package that fits your stage — Ignite for getting started, Accelerate for serious growth, Dominate for going all-in. Or message me directly and I'll help you choose.

Looking forward to working together,

Thapelo Maupa
Founder, Marketing iO
info@marketingio.co.za`,
    is_active: true
  },
  {
    code: 'choose_package_nurture',
    name: 'Which Marketing iO package fits you?',
    category: 'sales',
    subject: 'Which Marketing iO package fits {{full_name}}?',
    preheader: 'Ignite, Accelerate, or Dominate — pick your stage',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Thapelo Maupa, Marketing iO',
    variables_used: JSON.stringify(['full_name', 'packages_link', 'contact_link']),
    html_body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); padding: 40px 20px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 20px; color: #333; line-height: 1.6; }
    .package { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; margin: 20px 0; }
    .package-title { color: #a764e6; font-weight: 600; font-size: 16px; margin: 0 0 10px 0; }
    .package-price { font-size: 18px; font-weight: 700; color: #333; margin: 10px 0; }
    .package-desc { font-size: 13px; color: #666; margin: 10px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #0a0a14; color: #f4f4fa; padding: 30px 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Which package fits {{full_name}}?</h1>
    </div>
    <div class="content">
      <p>Hi {{full_name}},</p>
      <p>Quick follow-up — you signed up yesterday but haven't picked a package yet. That's totally fine, and I want to make this easy.</p>
      <p>Here's the simple version:</p>
      
      <div class="package">
        <div class="package-title">🚀 IGNITE</div>
        <div class="package-price">R3,980 setup + R490/month</div>
        <div class="package-desc"><strong>Perfect for:</strong> businesses just getting serious about marketing<br><strong>You get:</strong> GBP setup, basic social, monthly reporting<br><strong>Best for:</strong> under 12 months in business</div>
      </div>

      <div class="package">
        <div class="package-title">⚡ ACCELERATE</div>
        <div class="package-price">R6,500 setup + R890/month</div>
        <div class="package-desc"><strong>Perfect for:</strong> established businesses ready to scale<br><strong>You get:</strong> Full social media + content + ad management<br><strong>Best for:</strong> 12+ months operating, ready to grow faster</div>
      </div>

      <div class="package">
        <div class="package-title">👑 DOMINATE</div>
        <div class="package-price">R9,800 setup + R1,490/month</div>
        <div class="package-desc"><strong>Perfect for:</strong> businesses going all-in on growth<br><strong>You get:</strong> Everything + video content + dedicated account management<br><strong>Best for:</strong> serious players who want to be the obvious choice in their market</div>
      </div>

      <p>Plus we have STREET PULSE (flyer distribution) and TOWNSHIP PULSE (poster placement) for community-focused brands.</p>

      <a href="{{packages_link}}" class="cta-button">View All Packages</a>

      <p>Honestly unsure? <a href="{{contact_link}}">Reply to this email</a> and I'll spend 10 minutes on a call helping you pick. No pressure, no sales pitch.</p>

      <p>Talk soon,<br><strong>Thapelo</strong><br>Founder, Marketing iO</p>
    </div>
    <div class="footer">
      <p>Marketing iO (Pty) Ltd | info@marketingio.co.za</p>
    </div>
  </div>
</body>
</html>`,
    plain_text_body: `Which package fits you?

Hi {{full_name}},

Quick follow-up — you signed up yesterday but haven't picked a package yet. That's totally fine, and I want to make this easy.

🚀 IGNITE — R3,980 setup + R490/month
Perfect for: businesses just getting serious about marketing
You get: GBP setup, basic social, monthly reporting
Best for: under 12 months in business

⚡ ACCELERATE — R6,500 setup + R890/month
Perfect for: established businesses ready to scale
You get: Full social media + content + ad management
Best for: 12+ months operating, ready to grow faster

👑 DOMINATE — R9,800 setup + R1,490/month
Perfect for: businesses going all-in on growth
You get: Everything + video content + dedicated account management
Best for: serious players who want to be the obvious choice in their market

Plus we have STREET PULSE (flyer distribution) and TOWNSHIP PULSE (poster placement) for community-focused brands.

View All Packages: {{packages_link}}

Honestly unsure? Reply to this email and I'll spend 10 minutes on a call helping you pick. No pressure, no sales pitch.

Talk soon,
Thapelo
Founder, Marketing iO`,
    is_active: true
  },
  {
    code: 'still_deciding_nurture',
    name: 'What\'s holding you back?',
    category: 'sales',
    subject: '{{full_name}}, what\'s holding you back?',
    preheader: 'Let\'s figure this out together',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Thapelo Maupa, Marketing iO',
    variables_used: JSON.stringify(['full_name', 'contact_link']),
    html_body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); padding: 40px 20px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 20px; color: #333; line-height: 1.6; }
    .concern { background: #f9f9f9; border-left: 4px solid #a764e6; padding: 15px; margin: 20px 0; }
    .concern-title { color: #a764e6; font-weight: 600; margin: 0 0 10px 0; }
    .concern p { margin: 0; font-size: 14px; color: #666; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #0a0a14; color: #f4f4fa; padding: 30px 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>What's holding you back?</h1>
    </div>
    <div class="content">
      <p>Hi {{full_name}},</p>
      <p>I noticed you signed up about a week ago but haven't picked a package yet. No pressure — I'm not here to push.</p>
      <p>I just want to ask: <strong>what's holding you back?</strong></p>
      <p>Most people I talk to have one of three concerns:</p>

      <div class="concern">
        <div class="concern-title">1. "I'm not sure I can afford it."</div>
        <p>Honestly? Our Ignite package at R490/month is less than what most businesses spend on coffee for the team. If a few extra customers a month wouldn't pay for it, I'll tell you that on a call.</p>
      </div>

      <div class="concern">
        <div class="concern-title">2. "I'm not sure marketing will work for my business."</div>
        <p>Fair. But every business needs to be findable, and 95% of South Africans search Google before buying. If you're invisible there, you're invisible.</p>
      </div>

      <div class="concern">
        <div class="concern-title">3. "I'm not sure WHICH package."</div>
        <p>That's the easiest one to fix. Reply to this email with two sentences about your business and I'll tell you exactly which one to pick.</p>
      </div>

      <a href="{{contact_link}}" class="cta-button">Reply to This Email</a>

      <p>Whatever the reason, I'd genuinely like to know. Even if you decide Marketing iO isn't right for you, your honest reason helps me serve other businesses like yours better.</p>

      <p><strong>Thapelo</strong><br>Founder, Marketing iO</p>
    </div>
    <div class="footer">
      <p>Marketing iO (Pty) Ltd | info@marketingio.co.za</p>
    </div>
  </div>
</body>
</html>`,
    plain_text_body: `What's holding you back?

Hi {{full_name}},

I noticed you signed up about a week ago but haven't picked a package yet. No pressure — I'm not here to push.

I just want to ask: what's holding you back?

Most people I talk to have one of three concerns:

1. "I'm not sure I can afford it."
Honestly? Our Ignite package at R490/month is less than what most businesses spend on coffee for the team. If a few extra customers a month wouldn't pay for it, I'll tell you that on a call.

2. "I'm not sure marketing will work for my business."
Fair. But every business needs to be findable, and 95% of South Africans search Google before buying. If you're invisible there, you're invisible.

3. "I'm not sure WHICH package."
That's the easiest one to fix. Reply to this email with two sentences about your business and I'll tell you exactly which one to pick.

Whatever the reason, I'd genuinely like to know. Even if you decide Marketing iO isn't right for you, your honest reason helps me serve other businesses like yours better.

Thapelo
Founder, Marketing iO`,
    is_active: true
  },
  {
    code: 'final_nurture_offer',
    name: 'Last note from me',
    category: 'sales',
    subject: '{{full_name}}, last note from me',
    preheader: 'The door is always open',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Thapelo Maupa, Marketing iO',
    variables_used: JSON.stringify(['full_name', 'packages_link']),
    html_body: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); padding: 40px 20px; text-align: center; color: white; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .content { padding: 40px 20px; color: #333; line-height: 1.6; text-align: center; }
    .content p { margin: 15px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { background: #0a0a14; color: #f4f4fa; padding: 30px 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Last note from me</h1>
    </div>
    <div class="content">
      <p>Hi {{full_name}},</p>
      <p>This will be my last email about choosing a package — I respect your inbox.</p>
      <p>If Marketing iO is right for you, you'll know it. If it isn't, that's also okay.</p>

      <a href="{{packages_link}}" class="cta-button">See Packages One More Time</a>

      <p>If you're not ready right now, no problem. The packages will be here when you are. I'll keep your account active and you can come back anytime.</p>
      <p>If something specific is blocking you and I can help — reply to this email. Real human reading.</p>
      <p>Either way, thanks for considering Marketing iO. I hope our paths cross again.</p>

      <p><strong>Thapelo</strong><br>Founder, Marketing iO</p>
    </div>
    <div class="footer">
      <p>Marketing iO (Pty) Ltd | info@marketingio.co.za</p>
    </div>
  </div>
</body>
</html>`,
    plain_text_body: `Last note from me

Hi {{full_name}},

This will be my last email about choosing a package — I respect your inbox.

If Marketing iO is right for you, you'll know it. If it isn't, that's also okay.

See Packages One More Time: {{packages_link}}

If you're not ready right now, no problem. The packages will be here when you are. I'll keep your account active and you can come back anytime.

If something specific is blocking you and I can help — reply to this email. Real human reading.

Either way, thanks for considering Marketing iO. I hope our paths cross again.

Thapelo
Founder, Marketing iO`,
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

    for (const template of NURTURE_TEMPLATES) {
      try {
        // Check if template already exists
        const existing = await base44.entities.EmailTemplate.filter({
          code: template.code
        });

        if (existing && existing.length > 0) {
          console.log(`Template ${template.code} already exists, skipping`);
          continue;
        }

        await base44.entities.EmailTemplate.create({
          ...template,
          last_updated: new Date().toISOString()
        });
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
      message: 'Nurture templates seeded',
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});