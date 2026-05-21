/**
 * Email Template Seed Data — 15 branded Marketing iO templates
 * All use dark navy (#0a0a14) + purple-to-pink gradient styling
 * Logo: https://media.base44.com/images/public/69f52863b2b733d922d90b62/7e2eae647_marketingiomainlogo.png
 */

const htmlWrapper = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; margin: 0; padding: 0; background: #0a0a14; }
    .wrapper { background: #0a0a14; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1c1c30; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
    .header-bar { background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); height: 4px; }
    .content { padding: 40px 30px; color: #f4f4fa; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo img { max-width: 200px; height: auto; }
    h1 { font-size: 24px; font-weight: 700; margin: 20px 0 10px; color: #f4f4fa; }
    p { font-size: 14px; line-height: 1.6; margin: 15px 0; color: #f4f4fa; }
    .otp-code { font-size: 36px; font-weight: 700; letter-spacing: 8px; text-align: center; color: #a764e6; margin: 20px 0; font-family: 'Courier New', monospace; background: rgba(167,100,230,0.1); padding: 20px; border-radius: 8px; }
    .button { display: inline-block; background: linear-gradient(135deg, #a764e6 0%, #ec4899 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 15px 0; text-align: center; }
    .button-wrapper { text-align: center; }
    .details { background: rgba(255,255,255,0.05); padding: 15px; border-radius: 6px; margin: 15px 0; font-size: 13px; }
    .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 13px; }
    .footer { background: rgba(0,0,0,0.3); padding: 30px; text-align: center; font-size: 12px; color: #a8a8c0; }
    .footer-link { color: #a764e6; text-decoration: none; }
    .badge { display: inline-block; background: rgba(167,100,230,0.2); color: #a764e6; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; margin-right: 8px; }
    @media (max-width: 600px) { .content { padding: 24px 16px; } h1 { font-size: 20px; } .otp-code { font-size: 28px; letter-spacing: 4px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header-bar"></div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/7e2eae647_marketingiomainlogo.png" style="max-width: 150px; height: auto; margin-bottom: 15px;" alt="Marketing iO">
        <p style="margin: 10px 0;">Johannesburg, South Africa | info@marketingio.co.za | marketingio.co.za</p>
        <p style="margin: 10px 0;"><a href="{{unsubscribe_link}}" class="footer-link">Manage email preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const EMAIL_TEMPLATES = [
  {
    code: 'signup_email_verification',
    name: 'Sign-up Email Verification',
    category: 'authentication',
    subject: 'Verify your email — Marketing iO',
    preheader: 'Your verification code expires in 10 minutes',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO',
    variables_used: JSON.stringify(['full_name', 'otp_code', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Welcome to Marketing iO!</h1>
      <p>Hi {{full_name}},</p>
      <p>Please verify your email address with this code:</p>
      <div class="otp-code">{{otp_code}}</div>
      <p>This code expires in 10 minutes. If you didn't create an account, you can safely ignore this email.</p>
      <div class="signature">— The Marketing iO Team</div>
    `),
    plain_text_body: `Welcome to Marketing iO!

Hi {{full_name}},

Please verify your email address with this code:

{{otp_code}}

This code expires in 10 minutes. If you didn't create an account, you can safely ignore this email.

— The Marketing iO Team
info@marketingio.co.za | marketingio.co.za`
  },
  {
    code: 'login_otp_code',
    name: 'Login OTP Code',
    category: 'authentication',
    subject: 'Your Marketing iO login code: {{otp_code}}',
    preheader: 'Use this code to complete your login',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Security',
    variables_used: JSON.stringify(['full_name', 'otp_code', 'ip_address', 'location', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Your Login Code</h1>
      <p>Hi {{full_name}},</p>
      <p>Your login code:</p>
      <div class="otp-code">{{otp_code}}</div>
      <p>This code expires in 10 minutes.</p>
      <div class="details">
        <strong>Login attempt details:</strong><br>
        IP address: {{ip_address}}<br>
        Location: {{location}}
      </div>
      <p>If you didn't try to log in, secure your account immediately by changing your password and contact <a href="mailto:info@marketingio.co.za" style="color: #a764e6;">info@marketingio.co.za</a>.</p>
      <div class="signature">— The Marketing iO Team</div>
    `),
    plain_text_body: `Your Login Code

Hi {{full_name}},

Your login code:

{{otp_code}}

This code expires in 10 minutes.

Login attempt details:
- IP address: {{ip_address}}
- Location: {{location}}

If you didn't try to log in, secure your account immediately by changing your password and contact info@marketingio.co.za.

— The Marketing iO Team`
  },
  {
    code: 'password_reset_request',
    name: 'Password Reset Request',
    category: 'authentication',
    subject: 'Reset your Marketing iO password',
    preheader: 'Click the link to set a new password',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Security',
    variables_used: JSON.stringify(['full_name', 'reset_link', 'expiry_time', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Reset Your Password</h1>
      <p>Hi {{full_name}},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <div class="button-wrapper"><a href="{{reset_link}}" class="button">Reset My Password</a></div>
      <p style="text-align: center; font-size: 12px; color: #a8a8c0;">Or copy this link: <a href="{{reset_link}}" style="color: #a764e6; word-break: break-all;">{{reset_link}}</a></p>
      <p>This link expires at {{expiry_time}} (1 hour from now).</p>
      <p>If you didn't request this reset, you can safely ignore this email — your password won't change.</p>
      <div class="signature">— The Marketing iO Team</div>
    `),
    plain_text_body: `Reset Your Password

Hi {{full_name}},

We received a request to reset your password. Copy and visit this link:

{{reset_link}}

This link expires at {{expiry_time}} (1 hour from now).

If you didn't request this reset, you can safely ignore this email — your password won't change.

— The Marketing iO Team`
  },
  {
    code: 'password_changed_confirmation',
    name: 'Password Changed Confirmation',
    category: 'authentication',
    subject: 'Your password was changed',
    preheader: 'Confirmation of recent password change',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Security',
    variables_used: JSON.stringify(['full_name', 'change_date', 'ip_address', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Password Changed</h1>
      <p>Hi {{full_name}},</p>
      <p>Your Marketing iO password was successfully changed on <strong>{{change_date}}</strong>.</p>
      <p>If this was you, no action needed.</p>
      <p><strong>If this WASN'T you</strong>, your account may be compromised. Contact us immediately at <a href="mailto:info@marketingio.co.za" style="color: #a764e6;">info@marketingio.co.za</a> and we'll secure your account.</p>
      <div class="signature">— The Marketing iO Team</div>
    `),
    plain_text_body: `Password Changed

Hi {{full_name}},

Your Marketing iO password was successfully changed on {{change_date}}.

If this was you, no action needed.

If this WASN'T you, your account may be compromised. Contact us immediately at info@marketingio.co.za and we'll secure your account.

— The Marketing iO Team`
  },
  {
    code: 'suspicious_login_alert',
    name: 'Suspicious Login Alert',
    category: 'authentication',
    subject: 'New login from {{location}} — Was this you?',
    preheader: 'We detected a login from a new location',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Security',
    variables_used: JSON.stringify(['full_name', 'location', 'ip_address', 'device', 'login_time', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>New Login Detected</h1>
      <p>Hi {{full_name}},</p>
      <p>We noticed a login to your Marketing iO account from a new location:</p>
      <div class="details">
        Time: {{login_time}}<br>
        Location: {{location}}<br>
        IP: {{ip_address}}<br>
        Device: {{device}}
      </div>
      <p>If this was you, no action needed.</p>
      <p><strong>If this WASN'T you:</strong></p>
      <ol style="color: #f4f4fa;">
        <li>Change your password immediately</li>
        <li>Contact us at <a href="mailto:info@marketingio.co.za" style="color: #a764e6;">info@marketingio.co.za</a></li>
        <li>We'll lock the account and investigate</li>
      </ol>
      <div class="signature">— The Marketing iO Team</div>
    `),
    plain_text_body: `New Login Detected

Hi {{full_name}},

We noticed a login to your Marketing iO account from a new location:

- Time: {{login_time}}
- Location: {{location}}
- IP: {{ip_address}}
- Device: {{device}}

If this was you, no action needed.

If this WASN'T you:
1. Change your password immediately
2. Contact us at info@marketingio.co.za
3. We'll lock the account and investigate

— The Marketing iO Team`
  },
  {
    code: 'welcome_pack_sent',
    name: 'Welcome Pack Sent',
    category: 'sales',
    subject: 'Welcome to Marketing iO, {{business_name}}! 🎉',
    preheader: 'Your journey with Marketing iO starts here',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'The Marketing iO Team',
    variables_used: JSON.stringify(['primary_contact_name', 'business_name', 'package_name', 'setup_fee', 'monthly_retainer', 'welcome_pack_pdf_url', 'onboarding_form_link', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Welcome to Marketing iO! 🎉</h1>
      <p>Hi {{primary_contact_name}},</p>
      <p>Welcome to the Marketing iO family! We're genuinely excited to be working with {{business_name}}.</p>
      <p>You've signed up for our <strong>{{package_name}}</strong> — and that means we're rolling up our sleeves to make {{business_name}} too good to stay hidden.</p>
      <p><strong>Here's what happens next:</strong></p>
      <div class="details">
        ✓ Setup fee invoice for {{setup_fee}} attached<br>
        ✓ <a href="{{welcome_pack_pdf_url}}" style="color: #a764e6;">Welcome Pack</a> with timeline, team intros, and what to expect<br>
        ✓ <a href="{{onboarding_form_link}}" style="color: #a764e6;">Quick onboarding form</a> (15 minutes)<br>
        ✓ Monthly retainer of {{monthly_retainer}} kicks in once we go live
      </div>
      <p>Have questions? Reply to this email — we read every one.</p>
      <p style="margin-top: 30px;">Looking forward to building something great together,</p>
      <div class="signature">
        The Marketing iO Team<br>
        <a href="mailto:info@marketingio.co.za" style="color: #a764e6;">info@marketingio.co.za</a> | marketingio.co.za
      </div>
    `),
    plain_text_body: `Welcome to Marketing iO! 🎉

Hi {{primary_contact_name}},

Welcome to the Marketing iO family! We're genuinely excited to be working with {{business_name}}.

You've signed up for our {{package_name}} — and that means we're rolling up our sleeves to make {{business_name}} too good to stay hidden.

Here's what happens next:

✓ Setup fee invoice for {{setup_fee}} attached
✓ Welcome Pack with timeline, team intros, and what to expect — {{welcome_pack_pdf_url}}
✓ Quick onboarding form (15 minutes) — {{onboarding_form_link}}
✓ Monthly retainer of {{monthly_retainer}} kicks in once we go live

Have questions? Reply to this email — I read every one personally.

Looking forward to building something great together,

— The Marketing iO Team
info@marketingio.co.za | marketingio.co.za`
  },
  {
    code: 'setup_invoice_issued',
    name: 'Setup Invoice Issued',
    category: 'legal',
    subject: 'Marketing iO Invoice {{invoice_number}} — {{business_name}}',
    preheader: 'Setup fee invoice ready for payment',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Accounts',
    variables_used: JSON.stringify(['business_name', 'invoice_number', 'amount', 'due_date', 'invoice_pdf_url', 'payment_link', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Invoice {{invoice_number}}</h1>
      <p>Dear {{business_name}},</p>
      <p>Please find your invoice for setup fees as agreed in your Master Service Agreement.</p>
      <div class="details">
        <strong>Invoice details:</strong><br>
        Number: {{invoice_number}}<br>
        Amount: {{amount}}<br>
        Due date: {{due_date}}
      </div>
      <p><strong>Payment options:</strong></p>
      <div style="margin: 15px 0;">
        <p>1. <a href="{{payment_link}}" class="button">Pay Online Now</a> — instant via Yoco</p>
        <p style="margin-top: 10px;">2. EFT to: Marketing iO (Pty) Ltd — reference: {{invoice_number}}</p>
        <p style="margin-top: 10px;"><a href="{{invoice_pdf_url}}" style="color: #a764e6;">Download full invoice</a></p>
      </div>
      <p>Per clause 4.3 of the Master Service Agreement, services commence upon clearance of the Setup Fee.</p>
      <div class="signature">
        Kind regards,<br>
        Marketing iO Accounts<br>
        <a href="mailto:accounts@marketingio.co.za" style="color: #a764e6;">accounts@marketingio.co.za</a>
      </div>
    `),
    plain_text_body: `Invoice {{invoice_number}}

Dear {{business_name}},

Please find your invoice for setup fees as agreed in your Master Service Agreement.

Invoice details:
- Number: {{invoice_number}}
- Amount: {{amount}}
- Due date: {{due_date}}

Payment options:
1. Pay online (instant): {{payment_link}}
2. EFT to: Marketing iO (Pty) Ltd, reference: {{invoice_number}}
3. Download invoice: {{invoice_pdf_url}}

Per clause 4.3 of the Master Service Agreement, services commence upon clearance of the Setup Fee.

Kind regards,
Marketing iO Accounts
accounts@marketingio.co.za`
  },
  {
    code: 'setup_payment_received',
    name: 'Setup Payment Received',
    category: 'sales',
    subject: 'Payment received — let\'s get to work, {{business_name}}!',
    preheader: 'Your setup fee has cleared. Onboarding begins.',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'The Marketing iO Team',
    variables_used: JSON.stringify(['primary_contact_name', 'business_name', 'package_name', 'onboarding_form_link', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Payment Received! 🚀</h1>
      <p>Hi {{primary_contact_name}},</p>
      <p>Just confirming — payment for your {{package_name}} setup has cleared. Welcome aboard!</p>
      <p><strong>Here's what happens next:</strong></p>
      <div class="details">
        <span class="badge">✓ DONE</span> Setup payment received<br><br>
        <span class="badge">⏳ NEXT</span> <a href="{{onboarding_form_link}}" style="color: #a764e6;">Onboarding form</a> (5 mins)<br><br>
        <span class="badge">⏳</span> Debit order mandate signed<br><br>
        <span class="badge">⏳</span> Brand assets shared
      </div>
      <p>Once those four are green, we begin building your marketing for real.</p>
      <p>Reach out anytime — we're in your inbox.</p>
      <div class="signature">
        The Marketing iO Team
      </div>
    `),
    plain_text_body: `Payment Received!

Hi {{primary_contact_name}},

Just confirming — payment for your {{package_name}} setup has cleared. Welcome aboard!

Here's what happens next:

✓ Setup payment received
⏳ Onboarding form (5 mins) — {{onboarding_form_link}}
⏳ Debit order mandate signed
⏳ Brand assets shared

Once those four are green, we begin building your marketing for real.

Reach out anytime — we're in your inbox.

— The Marketing iO Team`
  },
  {
    code: 'onboarding_form_reminder',
    name: 'Onboarding Form Reminder',
    category: 'onboarding',
    subject: 'Quick reminder — your Marketing iO onboarding form',
    preheader: '5 minutes to complete, helps us serve you better',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Onboarding',
    variables_used: JSON.stringify(['primary_contact_name', 'business_name', 'onboarding_form_link', 'days_outstanding', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Quick Reminder</h1>
      <p>Hi {{primary_contact_name}},</p>
      <p>Just a friendly nudge — your onboarding form for {{business_name}} is still outstanding (<strong>{{days_outstanding}} days</strong> now).</p>
      <p>This 5-minute form helps us:</p>
      <ul style="color: #f4f4fa; margin: 15px 0;">
        <li>Understand your business goals</li>
        <li>Get your brand assets right</li>
        <li>Set up your accounts properly</li>
        <li>Avoid back-and-forth later</li>
      </ul>
      <div class="button-wrapper"><a href="{{onboarding_form_link}}" class="button">Complete Onboarding Form</a></div>
      <p>The sooner this is in, the sooner we go live.</p>
      <p>Need help? Reply to this email.</p>
      <div class="signature">— The Marketing iO Team</div>
    `),
    plain_text_body: `Quick Reminder

Hi {{primary_contact_name}},

Just a friendly nudge — your onboarding form for {{business_name}} is still outstanding ({{days_outstanding}} days now).

This 5-minute form helps us:
- Understand your business goals
- Get your brand assets right
- Set up your accounts properly
- Avoid back-and-forth later

Complete now: {{onboarding_form_link}}

The sooner this is in, the sooner we go live.

Need help? Reply to this email.

— The Marketing iO Team`
  },
  {
    code: 'all_triggers_green',
    name: 'All Triggers Green (Ready to Launch)',
    category: 'onboarding',
    subject: '🚀 We\'re cleared for launch, {{business_name}}!',
    preheader: 'All systems green. Your campaign begins.',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'The Marketing iO Team',
    variables_used: JSON.stringify(['primary_contact_name', 'business_name', 'package_name', 'target_go_live_date', 'first_deliverable_summary', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>🚀 Ready for Launch!</h1>
      <p>Hi {{primary_contact_name}},</p>
      <p>Excellent news — all four onboarding triggers are <strong>green</strong>:</p>
      <div class="details">
        ✅ Setup fee paid<br>
        ✅ Onboarding form completed<br>
        ✅ Debit mandate signed<br>
        ✅ Brand assets received
      </div>
      <p>We're now building your <strong>{{package_name}}</strong> delivery.</p>
      <p><strong>Target go-live:</strong> {{target_go_live_date}}</p>
      <p><strong>What you'll see first:</strong></p>
      <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 6px; margin: 15px 0; font-size: 14px;">{{first_deliverable_summary}}</div>
      <p>We'll keep you in the loop every step of the way.</p>
      <p>Excited to make {{business_name}} too good to stay hidden,</p>
      <div class="signature">
        The Marketing iO Team
      </div>
    `),
    plain_text_body: `Ready for Launch!

Hi {{primary_contact_name}},

Excellent news — all four onboarding triggers are green:

✅ Setup fee paid
✅ Onboarding form completed
✅ Debit mandate signed
✅ Brand assets received

We're now building your {{package_name}} delivery.

Target go-live: {{target_go_live_date}}

What you'll see first:
{{first_deliverable_summary}}

We'll keep you in the loop every step of the way.

Excited to make {{business_name}} too good to stay hidden,

— The Marketing iO Team`
  },
  {
    code: 'failed_debit_order',
    name: 'Failed Debit Order Notice',
    category: 'legal',
    subject: 'Payment notice — {{business_name}} {{invoice_number}}',
    preheader: 'A debit order didn\'t go through',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Accounts',
    variables_used: JSON.stringify(['business_name', 'invoice_number', 'amount', 'retry_date', 'payment_link', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Payment Notice</h1>
      <p>Dear {{business_name}},</p>
      <p>We're writing to let you know that your monthly retainer debit order of <strong>{{amount}}</strong> ({{invoice_number}}) didn't process successfully.</p>
      <p>This can happen for several reasons — insufficient funds, bank holds, or technical issues.</p>
      <p><strong>What happens next:</strong></p>
      <ul style="color: #f4f4fa; margin: 15px 0;">
        <li>We'll retry on {{retry_date}}</li>
        <li>Please ensure funds are available</li>
      </ul>
      <div class="button-wrapper"><a href="{{payment_link}}" class="button">Pay Online Now</a></div>
      <p style="margin-top: 20px; font-size: 13px; color: #a8a8c0;">Per clause 4.7 of your Master Service Agreement, three failed debit orders within a 12-month period trigger acceleration of the full remaining retainer balance.</p>
      <p>Questions? Reply to this email or contact accounts@marketingio.co.za.</p>
      <div class="signature">
        Kind regards,<br>
        Marketing iO Accounts
      </div>
    `),
    plain_text_body: `Payment Notice

Dear {{business_name}},

We're writing to let you know that your monthly retainer debit order of {{amount}} ({{invoice_number}}) didn't process successfully.

This can happen for several reasons — insufficient funds, bank holds, or technical issues.

What happens next:
- We'll retry on {{retry_date}}
- Please ensure funds are available

Pay now: {{payment_link}}

Per clause 4.7 of your Master Service Agreement, three failed debit orders within a 12-month period trigger acceleration of the full remaining retainer balance.

Questions? Reply to this email or contact accounts@marketingio.co.za.

Kind regards,
Marketing iO Accounts`
  },
  {
    code: 'monthly_report_ready',
    name: 'Monthly Report Ready',
    category: 'operations',
    subject: 'Your {{month_year}} Marketing iO report is ready',
    preheader: 'This month\'s performance, deliverables and next steps',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Reports',
    variables_used: JSON.stringify(['primary_contact_name', 'business_name', 'month_year', 'report_pdf_url', 'key_highlight_1', 'key_highlight_2', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Your {{month_year}} Report</h1>
      <p>Hi {{primary_contact_name}},</p>
      <p>Your {{month_year}} report for {{business_name}} is ready.</p>
      <p><strong>This month's highlights:</strong></p>
      <div class="details">
        • {{key_highlight_1}}<br>
        • {{key_highlight_2}}
      </div>
      <div class="button-wrapper"><a href="{{report_pdf_url}}" class="button">Download Full Report</a></div>
      <p>Anything you'd like to discuss? Reply to this email.</p>
      <div class="signature">— The Marketing iO Team</div>
    `),
    plain_text_body: `Your {{month_year}} Report

Hi {{primary_contact_name}},

Your {{month_year}} report for {{business_name}} is ready.

This month's highlights:
- {{key_highlight_1}}
- {{key_highlight_2}}

Download: {{report_pdf_url}}

Anything you'd like to discuss? Reply to this email.

— The Marketing iO Team`
  },
  {
    code: 'deliverable_for_review',
    name: 'Deliverable for Review',
    category: 'operations',
    subject: 'For your review: {{deliverable_title}}',
    preheader: 'Please review and approve within 5 business days',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Production',
    variables_used: JSON.stringify(['primary_contact_name', 'business_name', 'deliverable_title', 'deliverable_description', 'review_link', 'deadline_date', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>For Your Review</h1>
      <p>Hi {{primary_contact_name}},</p>
      <p>Ready for your review:</p>
      <p style="font-size: 16px; font-weight: 600; color: #a764e6;">{{deliverable_title}}</p>
      <p>{{deliverable_description}}</p>
      <div class="button-wrapper"><a href="{{review_link}}" class="button">Review & Approve</a></div>
      <p>Per your Master Service Agreement, please review by <strong>{{deadline_date}}</strong> (5 business days from delivery).</p>
      <p style="font-size: 13px; color: #a8a8c0;">If we don't hear from you by then, the deliverable is automatically approved (deemed acceptance — clause 6.4).</p>
      <p>Need changes? Just reply with what you'd like adjusted.</p>
      <div class="signature">— The Marketing iO Production Team</div>
    `),
    plain_text_body: `For Your Review

Hi {{primary_contact_name}},

Ready for your review:

{{deliverable_title}}

{{deliverable_description}}

Review & approve: {{review_link}}

Per your Master Service Agreement, please review by {{deadline_date}} (5 business days from delivery).

If we don't hear from you by then, the deliverable is automatically approved (deemed acceptance — clause 6.4).

Need changes? Just reply with what you'd like adjusted.

— The Marketing iO Production Team`
  },
  {
    code: 'approval_window_expiring',
    name: 'Approval Window Expiring Soon',
    category: 'operations',
    subject: '⏰ 1 day left to review — {{deliverable_title}}',
    preheader: 'Approval window closes tomorrow',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Production',
    variables_used: JSON.stringify(['primary_contact_name', 'deliverable_title', 'review_link', 'auto_approve_date', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Approval Window Closing</h1>
      <p>Hi {{primary_contact_name}},</p>
      <p>Quick reminder — the review window for <strong>{{deliverable_title}}</strong> closes <strong>tomorrow ({{auto_approve_date}})</strong>.</p>
      <div class="button-wrapper"><a href="{{review_link}}" class="button">Review Now</a></div>
      <p>If we don't hear from you, the deliverable is automatically approved per your Master Service Agreement (clause 6.4 — deemed acceptance).</p>
      <p style="font-size: 13px;">Reply or click the button — either works.</p>
      <div class="signature">— The Marketing iO Production Team</div>
    `),
    plain_text_body: `Approval Window Closing

Hi {{primary_contact_name}},

Quick reminder — the review window for {{deliverable_title}} closes tomorrow ({{auto_approve_date}}).

Review now: {{review_link}}

If we don't hear from you, the deliverable is automatically approved per your Master Service Agreement (clause 6.4 — deemed acceptance).

Reply or click the button — either works.

— The Marketing iO Production Team`
  },
  {
    code: 'renewal_reminder',
    name: 'Contract Renewal Reminder',
    category: 'legal',
    subject: 'Your Marketing iO contract renews in 30 days',
    preheader: 'Auto-renewal notice for {{business_name}}',
    sender_email: 'info@marketingio.co.za',
    sender_name: 'Marketing iO Accounts',
    variables_used: JSON.stringify(['business_name', 'contract_end_date', 'renewal_term', 'cancellation_email', 'unsubscribe_link']),
    html_body: htmlWrapper(`
      <h1>Contract Renewal Notice</h1>
      <p>Dear {{business_name}},</p>
      <p>This is a courtesy reminder that your Marketing iO Master Service Agreement is approaching auto-renewal.</p>
      <div class="details">
        <strong>Contract details:</strong><br>
        Current term ends: {{contract_end_date}}<br>
        Renewal term: {{renewal_term}}<br>
        Same package and pricing applies (subject to clause 3.2)
      </div>
      <p>Per clause 3.2 of your agreement, the contract automatically renews unless you provide 30 days written notice of non-renewal.</p>
      <p><strong>Want to renew automatically?</strong> No action needed — we'll keep things running smoothly.</p>
      <p><strong>Want to make changes or not renew?</strong> Reply to this email or write to {{cancellation_email}} before {{contract_end_date}}.</p>
      <p><strong>Want to upgrade to a higher tier?</strong> We'd love to chat.</p>
      <div class="signature">
        Kind regards,<br>
        Marketing iO Accounts<br>
        <a href="mailto:accounts@marketingio.co.za" style="color: #a764e6;">accounts@marketingio.co.za</a>
      </div>
    `),
    plain_text_body: `Contract Renewal Notice

Dear {{business_name}},

This is a courtesy reminder that your Marketing iO Master Service Agreement is approaching auto-renewal.

Contract details:
- Current term ends: {{contract_end_date}}
- Renewal term: {{renewal_term}}
- Same package and pricing applies (subject to clause 3.2)

Per clause 3.2 of your agreement, the contract automatically renews unless you provide 30 days written notice of non-renewal.

Want to renew automatically? No action needed — we'll keep things running smoothly.

Want to make changes or not renew? Reply to this email or write to {{cancellation_email}} before {{contract_end_date}}.

Want to upgrade to a higher tier? We'd love to chat.

Kind regards,
Marketing iO Accounts
accounts@marketingio.co.za`
  }
];