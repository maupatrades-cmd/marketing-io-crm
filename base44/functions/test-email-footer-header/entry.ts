import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { recipient_email } = await req.json();

    if (!recipient_email) {
      return Response.json({ error: 'recipient_email required' }, { status: 400 });
    }

    // Send test email with footer/header
    await base44.integrations.Core.SendEmail({
      to: recipient_email,
      subject: 'Email Footer & Header Test',
      body: `
        <div style="font-family: Inter, sans-serif; color: #f4f4fa; background: #0a0a14; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #1c1c30; border-radius: 12px; padding: 32px; border: 1px solid rgba(255,255,255,0.08);">
            
            <!-- HEADER -->
            <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" alt="Marketing iO" style="max-width: 200px; height: auto;" />
            </div>

            <!-- CONTENT -->
            <div style="margin-bottom: 32px;">
              <h2 style="color: #f4f4fa; font-size: 20px; font-weight: 600; margin-bottom: 16px;">Test Email</h2>
              <p style="color: #a8a8c0; font-size: 14px; line-height: 1.6; margin: 0;">
                This is a test email to verify your updated footer and header styling. If you're seeing this with proper formatting, the changes are working correctly!
              </p>
            </div>

            <!-- FOOTER -->
            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px; margin-top: 32px;">
              <p style="color: #6b6b85; font-size: 12px; margin: 0 0 8px 0;">
                © 2026 Marketing iO. All rights reserved.
              </p>
              <p style="color: #6b6b85; font-size: 12px; margin: 0;">
                You're receiving this because you requested a test email.
              </p>
            </div>

          </div>
        </div>
      `
    });

    return Response.json({ success: true, message: `Test email sent to ${recipient_email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});