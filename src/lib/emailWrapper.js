/**
 * Marketing iO Branded Email Wrapper.
 * Composes the synthwave header + body + rainbow-waves footer into a single
 * email-safe HTML document.
 *
 * Use:
 *   import { wrapEmail } from '@/lib/emailWrapper';
 *   const html = wrapEmail(bodyHtml, { preheader, decorationPngUrl });
 */

import { emailHeaderSynthwave } from './emailHeaderSynthwave';
import { emailFooterSynthwave } from './emailFooterSynthwave';

export function wrapEmail(bodyHtml, options = {}) {
  const {
    preheader = '',
    headerDecorationPngUrl = null,
    footerDecorationPngUrl = null,
    logoUrl,
    year,
    contactEmail,
    contactPhone,
    websiteUrl,
    websiteLabel,
    address,
    linkedinUrl,
    instagramUrl,
    facebookUrl,
    unsubscribeUrl,
    privacyUrl,
    preferencesUrl,
  } = options;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ffffff;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : '';

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
      .mio-container { width:100% !important; }
      .mio-content   { padding:24px 16px !important; }
    }
    a { color:#a764e6; text-decoration:none; }
    a:hover { text-decoration:underline; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" class="mio-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:collapse;background-color:#ffffff;">
        <tr>
          <td style="padding:0;">
            ${emailHeaderSynthwave({ logoUrl, decorationPngUrl: headerDecorationPngUrl })}
          </td>
        </tr>
        <tr>
          <td class="mio-content" style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0;">
            ${emailFooterSynthwave({
              year, logoUrl, decorationPngUrl: footerDecorationPngUrl,
              contactEmail, contactPhone, websiteUrl, websiteLabel, address,
              linkedinUrl, instagramUrl, facebookUrl,
              unsubscribeUrl, privacyUrl, preferencesUrl,
            })}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** CTA button — gradient pill, table-based for Outlook. */
export function ctaButton(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;">
  <tr>
    <td bgcolor="#ec4899" style="background-color:#ec4899;background-image:linear-gradient(135deg,#a764e6 0%,#ec4899 100%);border-radius:8px;">
      <a href="${url}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${text}</a>
    </td>
  </tr>
</table>`;
}

/** OTP code block — high contrast, monospace. */
export function otpBlock(code) {
  return `<div style="font-size:32px;font-weight:700;letter-spacing:10px;text-align:center;color:#a764e6;margin:24px 0;font-family:Courier New,Courier,monospace;background:#f5f3ff;border:2px solid rgba(167,100,230,0.25);padding:20px;border-radius:10px;">${code}</div>`;
}

export function h1(text) {
  return `<h1 style="font-size:24px;font-weight:700;color:#a764e6;margin:0 0 16px 0;line-height:1.3;font-family:Arial,Helvetica,sans-serif;">${text}</h1>`;
}

export function p(text) {
  return `<p style="font-size:16px;line-height:1.6;color:#1e293b;margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;">${text}</p>`;
}

export default wrapEmail;
