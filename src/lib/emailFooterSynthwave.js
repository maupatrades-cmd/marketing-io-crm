/**
 * Marketing iO Email Footer — Synthwave Edition (rainbow signal waves).
 * 600px × ~340px, table-based, inline CSS only.
 *
 * Same email-safety choices as the header: white badge centered via cell
 * valign / align (no flex, no position:absolute), inline <svg> only for
 * decoration, hosted PNG fallback path available via `decorationPngUrl`.
 */

const LOGO_URL =
  'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';

const ACCENT_GRADIENT =
  'linear-gradient(90deg,#dc2626 0%,#ec4899 50%,#fbbf24 100%)';
const FOOTER_BG_GRADIENT =
  'linear-gradient(180deg,#000010 0%,#0a0a2e 50%,#1a0533 100%)';

function rainbowWavesSvg() {
  // 600 × 100 viewport, 8 layered sine paths with the requested rainbow stops.
  return `<svg width="552" height="100" viewBox="0 0 552 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block;width:100%;max-width:552px;height:auto;">
  <defs>
    <linearGradient id="fWave" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#7c3aed"/>
      <stop offset="20%"  stop-color="#ec4899"/>
      <stop offset="40%"  stop-color="#f59e0b"/>
      <stop offset="60%"  stop-color="#10b981"/>
      <stop offset="80%"  stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <g stroke="url(#fWave)" fill="none" stroke-width="1">
    <path d="M0 22 Q 69 8 138 22 T 276 22 T 414 22 T 552 22" opacity="0.55"/>
    <path d="M0 32 Q 69 18 138 32 T 276 32 T 414 32 T 552 32" opacity="0.7"/>
    <path d="M0 42 Q 69 28 138 42 T 276 42 T 414 42 T 552 42" opacity="0.85"/>
    <path d="M0 50 Q 69 36 138 50 T 276 50 T 414 50 T 552 50" opacity="0.9"/>
    <path d="M0 58 Q 69 44 138 58 T 276 58 T 414 58 T 552 58" opacity="0.85"/>
    <path d="M0 68 Q 69 54 138 68 T 276 68 T 414 68 T 552 68" opacity="0.7"/>
    <path d="M0 78 Q 69 64 138 78 T 276 78 T 414 78 T 552 78" opacity="0.6"/>
    <path d="M0 88 Q 69 74 138 88 T 276 88 T 414 88 T 552 88" opacity="0.5"/>
  </g>
</svg>`;
}

// Three small white inline SVGs for the social row. Inline SVG works in
// Apple Mail / iOS / Gmail; Outlook desktop will hide them but the link
// boxes remain in place. Pass `socialIconPngBase` to swap to hosted PNGs.
function socialIcon(name) {
  if (name === 'linkedin') {
    return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43A2.06 2.06 0 1 1 5.34 3.3a2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45C23.2 24 24 23.23 24 22.27V1.73C24 .77 23.2 0 22.22 0z"/></svg>`;
  }
  if (name === 'instagram') {
    return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="2"/><circle cx="17" cy="7" r="1.2" fill="#ffffff" fill-opacity="0.85"/></svg>`;
  }
  return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;" aria-hidden="true"><path fill="#ffffff" fill-opacity="0.85" d="M24 12.07C24 5.45 18.63.07 12 .07S0 5.45 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.39H7.08v-3.47h3.05V9.43c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95H15.83c-1.5 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.39C19.61 23.02 24 18.07 24 12.07z"/></svg>`;
}

export function emailFooterSynthwave({
  year = new Date().getFullYear(),
  logoUrl = LOGO_URL,
  decorationPngUrl = null,
  contactEmail = 'hello@marketingio.africa',
  contactPhone = '010 102 0534',
  websiteUrl = 'https://marketingio.africa',
  websiteLabel = 'marketingio.africa',
  address = '75 Marshall Street, Polokwane, 0699, South Africa',
  linkedinUrl = 'https://linkedin.com/company/marketingio',
  instagramUrl = 'https://instagram.com/marketingio',
  facebookUrl = 'https://facebook.com/marketingio',
  unsubscribeUrl = 'https://app.marketingio.africa/unsubscribe',
  privacyUrl = 'https://marketingio.africa/privacy',
  preferencesUrl = 'https://app.marketingio.africa/preferences',
} = {}) {
  const phoneHref = `tel:${contactPhone.replace(/\s+/g, '')}`;

  const bgAttr = decorationPngUrl ? ` background="${decorationPngUrl}"` : '';
  const bgImageStyle = decorationPngUrl
    ? `background-color:#0a0a2e;background-image:url('${decorationPngUrl}');background-position:center top;background-size:cover;background-repeat:no-repeat;`
    : `background-color:#0a0a2e;background-image:${FOOTER_BG_GRADIENT};`;

  const vmlOpen = decorationPngUrl
    ? `<!--[if gte mso 9]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="position:absolute;width:600px;height:340px;top:0;left:0;border:0;">
  <v:fill type="frame" src="${decorationPngUrl}" color="#0a0a2e"/>
  <v:textbox inset="0,0,0,0">
<![endif]-->`
    : '';
  const vmlClose = decorationPngUrl
    ? `<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->`
    : '';

  const wavesBlock = decorationPngUrl
    ? '' // PNG bg already has the waves baked in
    : `<!--[if !mso]><!-->
<table role="presentation" width="552" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
  <tr><td align="center" style="font-size:0;line-height:0;">${rainbowWavesSvg()}</td></tr>
</table>
<!--<![endif]-->`;

  return `<!-- SYNTHWAVE EMAIL FOOTER · 600 × ~340 -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${ACCENT_GRADIENT};">&nbsp;</td>
  </tr>
  <tr>
    <td width="600" align="center" valign="top"${bgAttr} style="width:600px;${bgImageStyle}padding:32px 24px;text-align:center;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
      ${vmlOpen}
      ${wavesBlock}

      <!-- White logo badge: 280 × 90, centred -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;border-collapse:collapse;">
        <tr>
          <td width="280" height="90" align="center" valign="middle" bgcolor="#ffffff" style="width:280px;height:90px;background-color:#ffffff;border-radius:16px;padding:10px 20px;text-align:center;vertical-align:middle;box-shadow:0 0 30px rgba(255,255,255,0.4),0 0 60px rgba(236,72,153,0.3);">
            <img src="${logoUrl}" width="240" height="70" alt="Marketing iO" style="display:block;width:240px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
          </td>
        </tr>
      </table>

      <!-- Slogan -->
      <p style="margin:0 0 18px;color:#ffffff;font-size:14px;font-style:italic;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;mso-line-height-rule:exactly;line-height:1.4;">Too good to stay hidden.</p>

      <!-- Contact row -->
      <p style="margin:0 0 6px;color:#ffffff;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
        <a href="mailto:${contactEmail}" style="color:#ffffff;text-decoration:none;">${contactEmail}</a>
        &nbsp;&bull;&nbsp;
        <a href="${phoneHref}" style="color:#ffffff;text-decoration:none;">${contactPhone}</a>
        &nbsp;&bull;&nbsp;
        <a href="${websiteUrl}" style="color:#ffffff;text-decoration:none;">${websiteLabel}</a>
      </p>

      <!-- Address -->
      <p style="margin:0 0 22px;color:#ffffff;font-size:11px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">${address}</p>

      <!-- Social icons -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 22px;border-collapse:collapse;">
        <tr>
          <td style="padding:0 8px;">
            <a href="${linkedinUrl}" aria-label="Marketing iO on LinkedIn" style="text-decoration:none;display:inline-block;line-height:0;">${socialIcon('linkedin')}</a>
          </td>
          <td style="padding:0 8px;">
            <a href="${instagramUrl}" aria-label="Marketing iO on Instagram" style="text-decoration:none;display:inline-block;line-height:0;">${socialIcon('instagram')}</a>
          </td>
          <td style="padding:0 8px;">
            <a href="${facebookUrl}" aria-label="Marketing iO on Facebook" style="text-decoration:none;display:inline-block;line-height:0;">${socialIcon('facebook')}</a>
          </td>
        </tr>
      </table>

      <!-- Legal -->
      <p style="margin:0 0 6px;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.6;">© ${year} Marketing iO. All rights reserved.</p>

      <!-- Footer links -->
      <p style="margin:0;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">
        <a href="${unsubscribeUrl}" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a>
        &nbsp;&bull;&nbsp;
        <a href="${privacyUrl}" style="color:#ffffff;text-decoration:underline;">Privacy Policy</a>
        &nbsp;&bull;&nbsp;
        <a href="${preferencesUrl}" style="color:#ffffff;text-decoration:underline;">Manage Preferences</a>
      </p>
      ${vmlClose}
    </td>
  </tr>
</table>
<!-- END SYNTHWAVE EMAIL FOOTER -->`;
}

export default emailFooterSynthwave;
