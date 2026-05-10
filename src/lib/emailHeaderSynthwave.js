/**
 * Marketing iO Email Header — Synthwave Edition
 * 600px × 240px, table-based, inline CSS only.
 *
 * Email-safety choices:
 *   - White logo badge centered via table align="center" + cell valign="middle"
 *     (NOT position:absolute / flex, both of which Outlook strips).
 *   - Synthwave decoration is inline <svg> — renders in Apple Mail / iOS Mail
 *     / Gmail / Outlook 365 web. Outlook desktop strips it but the gradient
 *     + bgcolor fallback keeps the white badge sitting on a clean navy block.
 *   - Optional hosted PNG fallback: pass `decorationPngUrl` to also use a
 *     <td background="..."> + VML <v:rect> path for full Outlook desktop
 *     parity. See src/lib/EMAIL_ASSETS_README.md for how to generate it.
 *   - All <img> have width / height / alt; layout uses bgcolor everywhere.
 */

const LOGO_URL =
  'https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png';

const ACCENT_GRADIENT =
  'linear-gradient(90deg,#dc2626 0%,#ec4899 50%,#fbbf24 100%)';
const HEADER_BG_GRADIENT =
  'linear-gradient(180deg,#1a0533 0%,#0a0a2e 50%,#000010 100%)';

function decorationSvg() {
  return `<svg width="600" height="240" viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="display:block;width:600px;height:240px;">
  <defs>
    <linearGradient id="hBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a0533"/>
      <stop offset="50%" stop-color="#0a0a2e"/>
      <stop offset="100%" stop-color="#000010"/>
    </linearGradient>
    <radialGradient id="hSun" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="55%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </radialGradient>
    <linearGradient id="hHorizonGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
    </linearGradient>
    <filter id="hGridGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="0.6"/>
    </filter>
    <mask id="hSunSlices">
      <circle cx="300" cy="156" r="85" fill="white"/>
      <rect x="232" y="170" width="136" height="3" fill="black"/>
      <rect x="245" y="184" width="110" height="4" fill="black"/>
      <rect x="262" y="200" width="76"  height="4" fill="black"/>
      <rect x="278" y="216" width="44"  height="5" fill="black"/>
    </mask>
  </defs>
  <rect width="600" height="240" fill="url(#hBg)"/>
  <g fill="#ffffff">
    <circle cx="50"  cy="22" r="1.2" opacity="0.85"/>
    <circle cx="120" cy="48" r="1.0" opacity="0.6"/>
    <circle cx="200" cy="18" r="1.5" opacity="0.9"/>
    <circle cx="290" cy="55" r="1.0" opacity="0.7"/>
    <circle cx="380" cy="28" r="1.2" opacity="0.8"/>
    <circle cx="470" cy="48" r="1.0" opacity="0.65"/>
    <circle cx="540" cy="20" r="1.3" opacity="0.85"/>
  </g>
  <circle cx="300" cy="156" r="85" fill="url(#hSun)" mask="url(#hSunSlices)"/>
  <rect x="0" y="156" width="600" height="50" fill="url(#hHorizonGlow)"/>
  <line x1="0" y1="156" x2="600" y2="156" stroke="#ec4899" stroke-width="1.5"/>
  <g opacity="0.6">
    <polygon points="40,156  100,118 160,156" fill="#7c3aed"/>
    <polygon points="120,156 175,108 230,156" fill="#a855f7"/>
    <polygon points="370,156 430,118 490,156" fill="#06b6d4"/>
    <polygon points="450,156 510,108 570,156" fill="#7c3aed"/>
  </g>
  <g filter="url(#hGridGlow)">
    <g stroke="#ec4899" stroke-width="0.8" fill="none" opacity="0.85">
      <line x1="0" y1="170" x2="600" y2="170"/>
      <line x1="0" y1="186" x2="600" y2="186"/>
      <line x1="0" y1="208" x2="600" y2="208"/>
      <line x1="0" y1="234" x2="600" y2="234"/>
    </g>
    <g stroke="#06b6d4" stroke-width="0.7" fill="none" opacity="0.8">
      <line x1="300" y1="156" x2="0"   y2="240"/>
      <line x1="300" y1="156" x2="100" y2="240"/>
      <line x1="300" y1="156" x2="200" y2="240"/>
      <line x1="300" y1="156" x2="300" y2="240"/>
      <line x1="300" y1="156" x2="400" y2="240"/>
      <line x1="300" y1="156" x2="500" y2="240"/>
      <line x1="300" y1="156" x2="600" y2="240"/>
    </g>
  </g>
</svg>`;
}

export function emailHeaderSynthwave({ decorationPngUrl = null, logoUrl = LOGO_URL } = {}) {
  const bgAttr = decorationPngUrl ? ` background="${decorationPngUrl}"` : '';
  const bgImageStyle = decorationPngUrl
    ? `background-color:#0a0a2e;background-image:url('${decorationPngUrl}');background-position:center;background-size:cover;background-repeat:no-repeat;`
    : `background-color:#0a0a2e;background-image:${HEADER_BG_GRADIENT};`;

  // VML fallback for Outlook desktop, only if a hosted PNG is provided.
  const vmlOpen = decorationPngUrl
    ? `<!--[if gte mso 9]>
<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="position:absolute;width:600px;height:240px;top:0;left:0;border:0;">
  <v:fill type="frame" src="${decorationPngUrl}" color="#0a0a2e"/>
  <v:textbox inset="0,0,0,0">
<![endif]-->`
    : '';
  const vmlClose = decorationPngUrl
    ? `<!--[if gte mso 9]></v:textbox></v:rect><![endif]-->`
    : '';

  // Inline SVG only renders in modern clients. Skip it when a hosted PNG is
  // provided (the PNG already carries the same visuals everywhere).
  const inlineDecoration = decorationPngUrl
    ? ''
    : `<!--[if !mso]><!-->
<div style="font-size:0;line-height:0;height:0;overflow:visible;">${decorationSvg()}</div>
<!--<![endif]-->`;

  return `<!-- SYNTHWAVE EMAIL HEADER · 600 × 240 -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td width="600" height="240" align="center" valign="middle"${bgAttr} style="width:600px;height:240px;${bgImageStyle}padding:0;text-align:center;vertical-align:middle;">
      ${vmlOpen}
      ${inlineDecoration}
      <!-- White logo badge: centered via align="center" + valign="middle" (no flex / no position:absolute, so Outlook still centres it). -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;border-collapse:collapse;">
        <tr>
          <td width="420" height="130" align="center" valign="middle" bgcolor="#ffffff" style="width:420px;height:130px;background-color:#ffffff;border-radius:20px;padding:15px 30px;text-align:center;vertical-align:middle;box-shadow:0 0 40px rgba(255,255,255,0.4),0 0 80px rgba(236,72,153,0.3);">
            <img src="${logoUrl}" width="360" height="100" alt="Marketing iO" style="display:block;width:360px;max-width:100%;height:auto;border:0;margin:0 auto;outline:none;text-decoration:none;"/>
          </td>
        </tr>
      </table>
      ${vmlClose}
    </td>
  </tr>
  <tr>
    <td width="600" height="6" style="width:600px;height:6px;line-height:6px;font-size:0;padding:0;background-color:#ec4899;background-image:${ACCENT_GRADIENT};">&nbsp;</td>
  </tr>
</table>
<!-- END SYNTHWAVE EMAIL HEADER -->`;
}

export default emailHeaderSynthwave;
