/**
 * Marketing iO Branded Email Wrapper
 * Table-based HTML for maximum email client compatibility
 */

export function wrapEmail(bodyHtml, options = {}) {
  const {
    heroImageUrl = null,
    dataCards = null,
    unsubscribeToken = 'UNSUBSCRIBE_TOKEN',
    preheader = ''
  } = options;

  const unsubscribeUrl = `https://app.marketingio.co.za/unsubscribe?token=${unsubscribeToken}`;
  const preferencesUrl = `https://app.marketingio.co.za/client/profile?tab=email-preferences`;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ffffff;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : '';

  const heroImageHtml = heroImageUrl ? `
    <tr>
      <td align="center" style="padding: 0 0 24px 0;">
        <img src="${heroImageUrl}" width="600" alt="Marketing iO"
          style="display:block;width:100%;max-width:600px;height:auto;max-height:750px;object-fit:cover;border-radius:8px;" />
      </td>
    </tr>
  ` : '';

  const dataCardsHtml = dataCards && dataCards.length > 0 ? `
    <tr>
      <td style="padding: 0 0 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            ${dataCards.map(card => `
              <td style="padding: 0 8px 0 0; vertical-align: top; width: ${Math.floor(100 / dataCards.length)}%;">
                <div style="background: linear-gradient(135deg, #f5f3ff 0%, #fdf2f8 100%); border-left: 4px solid #a764e6; border-radius: 8px; padding: 16px 20px;">
                  <div style="font-size: 32px; font-weight: 700; color: #a764e6; line-height: 1;">${card.value}</div>
                  <div style="font-size: 14px; color: #64748b; margin-top: 4px;">${card.label}</div>
                </div>
              </td>
            `).join('')}
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Marketing iO</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .content-cell { padding: 24px 16px !important; }
      .data-card-cell { display: block !important; width: 100% !important; padding: 0 0 12px 0 !important; }
      .cta-button { padding: 12px 24px !important; font-size: 15px !important; }
    }
    a.cta-button:hover { opacity: 0.9; }
    a { color: #a764e6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8f6ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  ${preheaderHtml}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f6ff;">
    <tr>
      <td align="center" style="padding: 24px 16px;">

        <!-- CONTAINER -->
        <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0"
          style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="padding:0;margin:0;background:#080c1a;">
              <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/6236093dc_header.jpg"
                width="600" alt="Marketing iO"
                style="display:block;width:100%;max-width:600px;height:auto;" />
            </td>
          </tr>

          <!-- GRADIENT DIVIDER -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #a764e6 0%, #ec4899 100%); font-size:0; line-height:0;">&nbsp;</td>
          </tr>

          <!-- BODY -->
          <tr>
            <td class="content-cell" style="padding: 32px 24px; background-color: #ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${heroImageHtml}
                ${dataCardsHtml}
                <tr>
                  <td style="font-size:16px;line-height:1.6;color:#1e293b;">
                    ${bodyHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER GRADIENT DIVIDER -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #a764e6 0%, #ec4899 100%); font-size:0; line-height:0;">&nbsp;</td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="background-color:#0f172a; padding: 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px; padding-top: 8px;">
                    <div style="display:inline-block;padding:10px 20px;border-radius:12px;box-shadow:0 0 18px 4px rgba(167,100,230,0.55), 0 0 40px 8px rgba(236,72,153,0.25);background:rgba(167,100,230,0.08);">
                      <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
                        height="32" alt="Marketing iO"
                        style="display:block;height:32px;width:auto;filter:invert(1) brightness(10);mix-blend-mode:screen;margin:0 auto;" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <div style="font-size:14px;font-weight:600;color:#f8fafc;">The Marketing iO Team</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <div style="font-size:12px;color:#94a3b8;line-height:1.8;">
                      Marketing iO (Pty) Ltd &middot; CIPC 2026303502<br>
                      75 Marshall Street, Polokwane 0699<br>
                      ☎ 010 102 0534 &nbsp;&bull;&nbsp; ✉ <a href="mailto:info@marketingio.co.za" style="color:#a764e6;text-decoration:none;">info@marketingio.co.za</a><br>
                      🌐 <a href="https://marketingio.co.za" style="color:#a764e6;text-decoration:none;">marketingio.co.za</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <div style="font-size:12px;font-style:italic;color:#64748b;letter-spacing:0.5px;">Too good to stay hidden.</div>
                  </td>
                </tr>
                <!-- DIVIDER -->
                <tr>
                  <td style="padding-bottom: 16px;">
                    <div style="height:1px;background:linear-gradient(90deg,transparent,#a764e6,#ec4899,transparent);"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <div style="font-size:11px;color:#475569;line-height:1.6;">
                      You're receiving this because you have an account with Marketing iO.<br>
                      <a href="${preferencesUrl}" style="color:#a764e6;text-decoration:none;">Update preferences</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${unsubscribeUrl}" style="color:#a764e6;text-decoration:none;">Unsubscribe</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- END CONTAINER -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Helper: render a CTA button
 */
export function ctaButton(text, url) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
    <tr>
      <td align="center">
        <a href="${url}" class="cta-button"
          style="display:inline-block;background:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          ${text}
        </a>
      </td>
    </tr>
  </table>`;
}

/**
 * Helper: OTP code display block
 */
export function otpBlock(code) {
  return `<div style="font-size:32px;font-weight:700;letter-spacing:10px;text-align:center;color:#a764e6;margin:24px 0;font-family:'Courier New',Courier,monospace;background:linear-gradient(135deg,rgba(167,100,230,0.08) 0%,rgba(236,72,153,0.06) 100%);border:2px solid rgba(167,100,230,0.2);padding:20px;border-radius:10px;">
    ${code}
  </div>`;
}

/**
 * Helper: heading
 */
export function h1(text) {
  return `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;line-height:1.3;">${text}</h1>`;
}

/**
 * Helper: paragraph
 */
export function p(text) {
  return `<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;">${text}</p>`;
}