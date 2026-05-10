/**
 * Marketing iO Email Header — Synthwave Edition
 * Table-based, inline CSS, 600px × 240px
 * Designed for universal email client compatibility (Outlook, Gmail, Apple Mail, etc.)
 */

export function emailHeaderSynthwave() {
  return `<!-- SYNTHWAVE EMAIL HEADER: 600px × 240px -->
<table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;background-color:#1a0533;">
  <tr>
    <td width="600" height="240" align="center" valign="middle" 
      style="width:600px;height:240px;position:relative;background-color:#0a0a2e;
        background-image:linear-gradient(180deg,#1a0533 0%,#0a0a2e 50%,#000010 100%);
        padding:0;margin:0;overflow:hidden;">
      
      <!-- Stars (upper portion) -->
      <svg width="600" height="120" viewBox="0 0 600 120" style="position:absolute;top:0;left:0;width:100%;height:50%;pointer-events:none;margin:0;padding:0;" preserveAspectRatio="none" aria-hidden="true">
        <circle cx="80" cy="25" r="1" fill="#ffffff" opacity="0.7"/>
        <circle cx="150" cy="35" r="1.2" fill="#ffffff" opacity="0.85"/>
        <circle cx="280" cy="20" r="0.9" fill="#ffffff" opacity="0.6"/>
        <circle cx="420" cy="40" r="1.1" fill="#ffffff" opacity="0.75"/>
        <circle cx="520" cy="30" r="1" fill="#ffffff" opacity="0.65"/>
        <circle cx="570" cy="50" r="1.3" fill="#ffffff" opacity="0.9"/>
      </svg>

      <!-- Sun/Orb (centered, behind logo) -->
      <svg width="600" height="240" viewBox="0 0 600 240" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;margin:0;padding:0;" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="sunGradient" cx="50%" cy="35%">
            <stop offset="0%" style="stop-color:#fbbf24;stop-opacity:1" />
            <stop offset="40%" style="stop-color:#ec4899;stop-opacity:0.9" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:0.4" />
          </radialGradient>
        </defs>
        <!-- Sun circle -->
        <circle cx="300" cy="85" r="85" fill="url(#sunGradient)"/>
        <!-- Synthwave horizon slices -->
        <line x1="0" y1="120" x2="600" y2="120" stroke="#000010" stroke-width="8" opacity="0.6"/>
        <line x1="0" y1="135" x2="600" y2="135" stroke="#000010" stroke-width="6" opacity="0.4"/>
      </svg>

      <!-- Horizon line -->
      <svg width="600" height="240" viewBox="0 0 600 240" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;margin:0;padding:0;" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="horizonGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#ec4899;stop-opacity:0.8" />
            <stop offset="50%" style="stop-color:#ec4899;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:#ec4899;stop-opacity:0" />
          </linearGradient>
        </defs>
        <!-- Horizon line at ~65% height (156px) -->
        <line x1="0" y1="156" x2="600" y2="156" stroke="#ec4899" stroke-width="2" opacity="0.9"/>
        <!-- Glow effect below horizon -->
        <rect x="0" y="156" width="600" height="84" fill="url(#horizonGlow)"/>
      </svg>

      <!-- Perspective grid (mountains + vanishing lines) -->
      <svg width="600" height="240" viewBox="0 0 600 240" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;margin:0;padding:0;" preserveAspectRatio="none" aria-hidden="true">
        <!-- Distant mountains -->
        <polygon points="80,156 130,120 160,156" fill="#7c3aed" opacity="0.5"/>
        <polygon points="440,156 470,120 520,156" fill="#06b6d4" opacity="0.5"/>
        <!-- Horizontal perspective lines (pink, increasing spacing) -->
        <line x1="0" y1="170" x2="600" y2="170" stroke="#ec4899" stroke-width="1" opacity="0.4" filter="blur(1px)"/>
        <line x1="0" y1="190" x2="600" y2="190" stroke="#ec4899" stroke-width="1" opacity="0.3" filter="blur(1px)"/>
        <line x1="0" y1="215" x2="600" y2="215" stroke="#ec4899" stroke-width="1" opacity="0.2" filter="blur(1px)"/>
        <!-- Cyan perspective lines (radiating from center) -->
        <g stroke="#06b6d4" stroke-width="0.8" opacity="0.35" filter="blur(0.5px)">
          <line x1="300" y1="156" x2="150" y2="240"/>
          <line x1="300" y1="156" x2="300" y2="240"/>
          <line x1="300" y1="156" x2="450" y2="240"/>
          <line x1="300" y1="156" x2="100" y2="240"/>
          <line x1="300" y1="156" x2="500" y2="240"/>
        </g>
      </svg>

      <!-- WHITE LOGO BADGE — SOLID, centered, with glow -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:420px;height:130px;background-color:#ffffff;border-radius:20px;box-shadow:0 0 40px rgba(255,255,255,0.4),0 0 80px rgba(236,72,153,0.3);display:flex;align-items:center;justify-content:center;z-index:10;">
        <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
          alt="Marketing iO"
          width="360" height="100"
          style="display:block;width:360px;height:100px;object-fit:contain;margin:0;padding:0;border:0;"/>
      </div>

    </td>
  </tr>
  <!-- BOTTOM ACCENT GRADIENT STRIP -->
  <tr>
    <td width="600" height="6" style="width:600px;height:6px;padding:0;margin:0;background-color:#dc2626;background-image:linear-gradient(90deg,#dc2626 0%,#ec4899 50%,#fbbf24 100%);font-size:0;line-height:0;">
      &nbsp;
    </td>
  </tr>
</table>
<!-- END SYNTHWAVE EMAIL HEADER -->`;
}