/**
 * Marketing iO Email Footer — Synthwave Edition
 * Table-based, inline CSS, 600px × ~340px
 * Rainbow waves, white logo badge, contact info, socials
 */

export function emailFooterSynthwave() {
  const year = new Date().getFullYear();
  return `<!-- SYNTHWAVE EMAIL FOOTER: 600px × ~340px -->
<table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;">
  
  <!-- TOP ACCENT GRADIENT STRIP -->
  <tr>
    <td width="600" height="6" style="width:600px;height:6px;padding:0;margin:0;background-color:#dc2626;background-image:linear-gradient(90deg,#dc2626 0%,#ec4899 50%,#fbbf24 100%);font-size:0;line-height:0;">
      &nbsp;
    </td>
  </tr>

  <!-- MAIN FOOTER BODY -->
  <tr>
    <td width="600" align="center" valign="top" 
      style="width:600px;position:relative;background-color:#0a0a2e;
        background-image:linear-gradient(180deg,#000010 0%,#0a0a2e 50%,#1a0533 100%);
        padding:32px 24px;margin:0;font-family:Arial,Helvetica,sans-serif;">

      <!-- RAINBOW SIGNAL WAVES (upper third) -->
      <svg width="552" height="100" viewBox="0 0 552 100" style="display:block;width:100%;max-width:552px;height:auto;margin:0 auto 20px;pointer-events:none;" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="rainbowWave1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:0.8"/>
            <stop offset="25%" style="stop-color:#ec4899;stop-opacity:0.8"/>
            <stop offset="50%" style="stop-color:#f59e0b;stop-opacity:0.8"/>
            <stop offset="75%" style="stop-color:#10b981;stop-opacity:0.8"/>
            <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:0.8"/>
          </linearGradient>
          <linearGradient id="rainbowWave2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#06b6d4;stop-opacity:0.6"/>
            <stop offset="33%" style="stop-color:#7c3aed;stop-opacity:0.6"/>
            <stop offset="66%" style="stop-color:#ec4899;stop-opacity:0.6"/>
            <stop offset="100%" style="stop-color:#f59e0b;stop-opacity:0.6"/>
          </linearGradient>
          <linearGradient id="rainbowWave3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#10b981;stop-opacity:0.7"/>
            <stop offset="40%" style="stop-color:#06b6d4;stop-opacity:0.7"/>
            <stop offset="80%" style="stop-color:#7c3aed;stop-opacity:0.7"/>
            <stop offset="100%" style="stop-color:#ec4899;stop-opacity:0.7"/>
          </linearGradient>
        </defs>
        <!-- Layered sine-wave curves -->
        <path d="M 0 50 Q 69 35 138 50 T 276 50 T 414 50 T 552 50" stroke="url(#rainbowWave1)" stroke-width="1" fill="none"/>
        <path d="M 0 40 Q 69 25 138 40 T 276 40 T 414 40 T 552 40" stroke="url(#rainbowWave2)" stroke-width="1" fill="none"/>
        <path d="M 0 60 Q 69 45 138 60 T 276 60 T 414 60 T 552 60" stroke="url(#rainbowWave3)" stroke-width="1" fill="none"/>
        <path d="M 0 30 Q 69 15 138 30 T 276 30 T 414 30 T 552 30" stroke="url(#rainbowWave1)" stroke-width="0.8" fill="none" opacity="0.5"/>
        <path d="M 0 70 Q 69 55 138 70 T 276 70 T 414 70 T 552 70" stroke="url(#rainbowWave2)" stroke-width="0.8" fill="none" opacity="0.5"/>
      </svg>

      <!-- WHITE LOGO BADGE -->
      <div style="display:inline-block;width:280px;height:90px;background-color:#ffffff;border-radius:16px;box-shadow:0 0 30px rgba(255,255,255,0.4),0 0 60px rgba(236,72,153,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
        <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
          alt="Marketing iO"
          width="240" height="70"
          style="display:block;width:240px;height:70px;object-fit:contain;margin:0;padding:0;border:0;"/>
      </div>

      <!-- SLOGAN -->
      <div style="font-size:14px;font-style:italic;color:#ffffff;opacity:0.85;text-align:center;margin:0 0 16px;letter-spacing:1px;font-family:Arial,Helvetica,sans-serif;">
        Too good to stay hidden.
      </div>

      <!-- CONTACT ROW -->
      <div style="font-size:13px;color:#ffffff;text-align:center;margin:0 0 12px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
        <a href="mailto:hello@marketingio.africa" style="color:#ffffff;text-decoration:none;">hello@marketingio.africa</a>
        &nbsp;&bull;&nbsp;
        <a href="tel:+27101020534" style="color:#ffffff;text-decoration:none;">010 102 0534</a>
        &nbsp;&bull;&nbsp;
        <a href="https://marketingio.africa" style="color:#ffffff;text-decoration:none;">marketingio.africa</a>
      </div>

      <!-- ADDRESS -->
      <div style="font-size:11px;color:#ffffff;opacity:0.7;text-align:center;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">
        75 Marshall Street, Polokwane, 0699, South Africa
      </div>

      <!-- SOCIAL ICONS (inline SVG) -->
      <div style="text-align:center;margin:0 0 16px;font-size:0;">
        <!-- LinkedIn -->
        <a href="https://linkedin.com/company/marketingio" style="display:inline-block;margin:0 8px;text-decoration:none;line-height:0;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" fill="#ffffff" opacity="0.8"/>
          </svg>
        </a>
        <!-- Instagram -->
        <a href="https://instagram.com/marketingio" style="display:inline-block;margin:0 8px;text-decoration:none;line-height:0;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;">
            <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.8"/>
            <circle cx="12" cy="12" r="4" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.8"/>
            <circle cx="17" cy="7" r="1" fill="#ffffff" opacity="0.8"/>
          </svg>
        </a>
        <!-- Facebook -->
        <a href="https://facebook.com/marketingio" style="display:inline-block;margin:0 8px;text-decoration:none;line-height:0;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;width:24px;height:24px;">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#ffffff" opacity="0.8"/>
          </svg>
        </a>
      </div>

      <!-- LEGAL -->
      <div style="font-size:10px;color:#ffffff;opacity:0.6;text-align:center;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">
        © ${year} Marketing iO. All rights reserved.
      </div>

      <!-- FOOTER LINKS -->
      <div style="font-size:10px;color:#ffffff;opacity:0.7;text-align:center;font-family:Arial,Helvetica,sans-serif;">
        <a href="https://app.marketingio.africa/unsubscribe" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a>
        &nbsp;&bull;&nbsp;
        <a href="https://marketingio.africa/privacy" style="color:#ffffff;text-decoration:underline;">Privacy Policy</a>
        &nbsp;&bull;&nbsp;
        <a href="https://app.marketingio.africa/preferences" style="color:#ffffff;text-decoration:underline;">Manage Preferences</a>
      </div>

    </td>
  </tr>
</table>
<!-- END SYNTHWAVE EMAIL FOOTER -->`;
}