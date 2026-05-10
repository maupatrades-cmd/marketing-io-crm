import React from 'react';
import { Linkedin, Instagram, Facebook } from 'lucide-react';

/**
 * EmailFooter — Marketing iO "Neon Horizon" footer.
 *
 * Visual rhyme with the V2 header in `public/email-header.svg`:
 *   • inverted background gradient so the two stack into a mirror
 *   • same red→pink→yellow accent strip — header has it on the bottom,
 *     footer has it on the top
 *   • white radial halo behind the centred logo
 *   • thin pink horizon line + 3 cyan vanishing-point lines as a quiet
 *     callback to the header's perspective grid (no sun, no mountains)
 *
 * Email-compatibility notes:
 *   • Table-based layout. No flex/grid, no CSS variables.
 *   • Inline gradients with a `backgroundColor` solid fallback (#0a0a2e)
 *     for clients that strip linear-gradient (Outlook desktop).
 *   • The decorative SVG layer is `position:absolute` over the cell —
 *     Outlook will silently drop it, leaving the gradient + content in
 *     place. Any client that respects positioning gets the full layout.
 *   • Logo halo is an inline SVG positioned behind an <img> with the
 *     same trick the V2 header uses, so the bitmap brand mark stays
 *     crisp while the white glow makes it pop.
 *   • Every <img> has explicit width/height + alt. Every social link
 *     carries an aria-label.
 */

const LOGO_URL =
  'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Helvetica, Arial, sans-serif';

const ACCENT_GRADIENT =
  'linear-gradient(90deg, #dc2626 0%, #ec4899 50%, #fbbf24 100%)';

const BG_GRADIENT =
  'linear-gradient(180deg, #000010 0%, #0a0a2e 50%, #1a0533 100%)';

export interface EmailFooterProps {
  width?: number;
  year?: number;
  unsubscribeUrl?: string;
  privacyUrl?: string;
  preferencesUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  address?: string;
}

export default function EmailFooter({
  width = 1024,
  year = new Date().getFullYear(),
  unsubscribeUrl = 'https://app.marketingio.africa/unsubscribe',
  privacyUrl = 'https://marketingio.africa/privacy',
  preferencesUrl = 'https://app.marketingio.africa/preferences',
  linkedinUrl = 'https://linkedin.com/company/marketingio',
  instagramUrl = 'https://instagram.com/marketingio',
  facebookUrl = 'https://facebook.com/marketingio',
  contactEmail = 'hello@marketingio.africa',
  contactPhone = '010 102 0534',
  websiteUrl = 'https://marketingio.africa',
  address = '75 Marshall Street, Polokwane, 0699, South Africa',
}: EmailFooterProps) {
  const websiteLabel = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const phoneHref = `tel:${contactPhone.replace(/\s+/g, '')}`;

  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      width="100%"
      style={{
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderCollapse: 'collapse',
        fontFamily: FONT_STACK,
      }}
    >
      <tbody>
        {/* Top accent strip — bookends the header's bottom strip */}
        <tr>
          <td
            height={8}
            style={{
              height: 8,
              fontSize: 0,
              lineHeight: 0,
              backgroundColor: '#ec4899',
              backgroundImage: ACCENT_GRADIENT,
            }}
          >
            &nbsp;
          </td>
        </tr>

        {/* Body cell */}
        <tr>
          <td
            style={{
              position: 'relative',
              backgroundColor: '#0a0a2e',
              backgroundImage: BG_GRADIENT,
              padding: '36px 24px 28px',
              color: '#ffffff',
              textAlign: 'center',
            }}
          >
            {/* Decorative SVG — quiet callback to the header's grid + stars.
                Outlook desktop strips abs-positioning and falls back to the
                gradient bg cleanly. */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                pointerEvents: 'none',
              }}
            >
              <svg
                viewBox="0 0 1024 280"
                preserveAspectRatio="xMidYMid slice"
                width="100%"
                height="100%"
                style={{ display: 'block', width: '100%', height: '100%' }}
              >
                {/* Mini horizon, top quarter */}
                <line
                  x1="0"
                  y1="60"
                  x2="1024"
                  y2="60"
                  stroke="#ec4899"
                  strokeWidth="1"
                  opacity="0.5"
                />
                {/* 3 short cyan perspective lines fading down from centre */}
                <g opacity="0.3" stroke="#06b6d4" strokeWidth="0.7" fill="none">
                  <line x1="512" y1="60" x2="380" y2="280" />
                  <line x1="512" y1="60" x2="512" y2="280" />
                  <line x1="512" y1="60" x2="644" y2="280" />
                </g>
                {/* Stars in the lower third (y > 190) */}
                <g fill="#ffffff">
                  <circle cx="120" cy="220" r="1.0" opacity="0.65" />
                  <circle cx="280" cy="245" r="1.2" opacity="0.7" />
                  <circle cx="420" cy="210" r="0.9" opacity="0.55" />
                  <circle cx="640" cy="240" r="1.1" opacity="0.7" />
                  <circle cx="800" cy="215" r="1.0" opacity="0.6" />
                  <circle cx="930" cy="250" r="1.2" opacity="0.75" />
                </g>
              </svg>
            </div>

            {/* Content table — sits on top of the decorative layer */}
            <table
              role="presentation"
              cellPadding={0}
              cellSpacing={0}
              border={0}
              width="100%"
              style={{
                position: 'relative',
                maxWidth: 600,
                margin: '0 auto',
                borderCollapse: 'collapse',
              }}
            >
              <tbody>
                {/* Logo + halo */}
                <tr>
                  <td align="center" style={{ padding: '0 0 12px 0' }}>
                    <div
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: 220,
                        height: 120,
                        lineHeight: 0,
                      }}
                    >
                      <svg
                        width="220"
                        height="120"
                        viewBox="0 0 220 120"
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: 220,
                          height: 120,
                          pointerEvents: 'none',
                        }}
                      >
                        <defs>
                          <radialGradient id="emailFooterHalo" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                          </radialGradient>
                        </defs>
                        <ellipse cx="110" cy="60" rx="100" ry="55" fill="url(#emailFooterHalo)" />
                      </svg>
                      <img
                        src={LOGO_URL}
                        alt="Marketing iO"
                        width={140}
                        height={80}
                        style={{
                          position: 'relative',
                          display: 'inline-block',
                          width: 140,
                          height: 80,
                          objectFit: 'contain',
                          margin: '20px 40px',
                          border: 0,
                        }}
                      />
                    </div>
                  </td>
                </tr>

                {/* Slogan */}
                <tr>
                  <td align="center" style={{ padding: '0 0 24px 0' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontStyle: 'italic',
                        color: '#ffffff',
                        opacity: 0.85,
                      }}
                    >
                      Too good to stay hidden.
                    </div>
                  </td>
                </tr>

                {/* Contact row */}
                <tr>
                  <td align="center" style={{ padding: '0 0 6px 0' }}>
                    <div style={{ fontSize: 12, color: '#ffffff', lineHeight: 1.7 }}>
                      <span aria-hidden="true">📧</span>{' '}
                      <a
                        href={`mailto:${contactEmail}`}
                        style={{ color: '#ffffff', textDecoration: 'none' }}
                      >
                        {contactEmail}
                      </a>
                      &nbsp;&nbsp;|&nbsp;&nbsp;
                      <span aria-hidden="true">📞</span>{' '}
                      <a
                        href={phoneHref}
                        style={{ color: '#ffffff', textDecoration: 'none' }}
                      >
                        {contactPhone}
                      </a>
                      &nbsp;&nbsp;|&nbsp;&nbsp;
                      <span aria-hidden="true">🌐</span>{' '}
                      <a
                        href={websiteUrl}
                        style={{ color: '#ffffff', textDecoration: 'none' }}
                      >
                        {websiteLabel}
                      </a>
                    </div>
                  </td>
                </tr>

                {/* Address */}
                <tr>
                  <td align="center" style={{ padding: '0 0 22px 0' }}>
                    <div style={{ fontSize: 11, color: '#ffffff', opacity: 0.7 }}>
                      {address}
                    </div>
                  </td>
                </tr>

                {/* Social icons */}
                <tr>
                  <td align="center" style={{ padding: '0 0 22px 0' }}>
                    <table
                      role="presentation"
                      cellPadding={0}
                      cellSpacing={0}
                      border={0}
                      style={{ margin: '0 auto', borderCollapse: 'collapse' }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ padding: '0 10px' }}>
                            <a
                              href={linkedinUrl}
                              aria-label="Marketing iO on LinkedIn"
                              style={{
                                color: '#ffffff',
                                opacity: 0.8,
                                textDecoration: 'none',
                                display: 'inline-block',
                                lineHeight: 0,
                              }}
                            >
                              <Linkedin size={24} strokeWidth={1.75} aria-hidden="true" />
                            </a>
                          </td>
                          <td style={{ padding: '0 10px' }}>
                            <a
                              href={instagramUrl}
                              aria-label="Marketing iO on Instagram"
                              style={{
                                color: '#ffffff',
                                opacity: 0.8,
                                textDecoration: 'none',
                                display: 'inline-block',
                                lineHeight: 0,
                              }}
                            >
                              <Instagram size={24} strokeWidth={1.75} aria-hidden="true" />
                            </a>
                          </td>
                          <td style={{ padding: '0 10px' }}>
                            <a
                              href={facebookUrl}
                              aria-label="Marketing iO on Facebook"
                              style={{
                                color: '#ffffff',
                                opacity: 0.8,
                                textDecoration: 'none',
                                display: 'inline-block',
                                lineHeight: 0,
                              }}
                            >
                              <Facebook size={24} strokeWidth={1.75} aria-hidden="true" />
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                {/* Legal */}
                <tr>
                  <td align="center" style={{ padding: '0 0 6px 0' }}>
                    <div style={{ fontSize: 10, color: '#ffffff', opacity: 0.6 }}>
                      © {year} Marketing iO. All rights reserved.
                    </div>
                  </td>
                </tr>

                {/* Footer links */}
                <tr>
                  <td align="center">
                    <div style={{ fontSize: 10, color: '#ffffff', opacity: 0.7 }}>
                      <a
                        href={unsubscribeUrl}
                        style={{ color: '#ffffff', textDecoration: 'underline' }}
                      >
                        Unsubscribe
                      </a>
                      &nbsp;&nbsp;|&nbsp;&nbsp;
                      <a
                        href={privacyUrl}
                        style={{ color: '#ffffff', textDecoration: 'underline' }}
                      >
                        Privacy Policy
                      </a>
                      &nbsp;&nbsp;|&nbsp;&nbsp;
                      <a
                        href={preferencesUrl}
                        style={{ color: '#ffffff', textDecoration: 'underline' }}
                      >
                        Manage Preferences
                      </a>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
