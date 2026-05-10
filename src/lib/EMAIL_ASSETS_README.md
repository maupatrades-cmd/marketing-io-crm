# Email Shell — Synthwave V3

Single source of truth for the new transactional email look:
`emailHeaderSynthwave.js` (synthwave hero + white logo badge),
`emailFooterSynthwave.js` (rainbow signal waves + white logo badge),
`emailWrapper.js` (composes header + body + footer into a complete email-safe HTML document).

## Files

| File | What it is |
|---|---|
| `emailHeaderSynthwave.js` | 600×240 header. Inline SVG decoration + table-centered white logo badge. |
| `emailFooterSynthwave.js` | 600×~340 footer. Rainbow waves + table-centered white badge + contact / address / socials / legal. |
| `emailWrapper.js` | Composes the above with body content into a full email document. |
| `emailHeaderDecoration.svg` | Standalone SVG of the header artwork (no badge, no logo). For PNG rasterisation. |
| `emailFooterDecoration.svg` | Standalone SVG of the rainbow waves footer (no badge, no logo). For PNG rasterisation. |
| `emailPreviewSynthwave.html` | Static preview combining header + dummy body + footer. Open in a browser. |

## Usage in code

```js
import { wrapEmail, ctaButton, h1, p } from '@/lib/emailWrapper';

const html = wrapEmail(
  `${h1('Hi Thapelo,')}${p('Your invoice is ready.')}${ctaButton('View invoice', 'https://…')}`,
  { preheader: 'Your monthly invoice is ready to view.' }
);
```

The wrapper accepts overrides for every footer field (`contactEmail`, `phone`, `address`, social URLs, etc.) and accepts hosted PNG fallback URLs for full Outlook desktop parity (see next section).

## Email-client behaviour

| Client | What renders |
|---|---|
| Apple Mail / iOS Mail | Full visual — gradients, inline SVG decoration, white logo badge, glow shadows. |
| Gmail (web + mobile) | Full visual — gradients, inline SVG, badge. |
| Outlook 365 web / Outlook 2019+ | Gradients + inline SVG + badge (no `box-shadow`, no `border-radius`). |
| Outlook desktop (older) | Solid `#0a0a2e` bgcolor + white badge (square corners, no glow). Decoration stripped unless a hosted PNG is supplied. |

The white logo badge is the contractual core: it always renders cleanly on a navy block, on every client. Everything else is decoration that gracefully degrades.

## Outlook desktop parity — optional PNG fallback

To get the full synthwave artwork in Outlook desktop too, you need to host PNG versions of the two decoration SVGs and pass their URLs to the wrapper:

1. Convert `emailHeaderDecoration.svg` → PNG at **1200 × 480** (2× retina).
2. Convert `emailFooterDecoration.svg` → PNG at **1200 × 680** (2× retina).
3. Host both somewhere public (Cloudinary / `media.base44.com` / `app.marketingio.africa/static/…`).
4. Pass the URLs:

   ```js
   wrapEmail(bodyHtml, {
     headerDecorationPngUrl: 'https://app.marketingio.africa/static/email-header.png',
     footerDecorationPngUrl: 'https://app.marketingio.africa/static/email-footer.png',
   });
   ```

Behind the scenes that switches the cell from inline-SVG to a `background` attribute + a VML `<v:rect>` block (Outlook-only conditional comment), giving every client the same artwork.

### Rasterisation commands

If you have ImageMagick / `rsvg-convert` locally:

```sh
# Linux / macOS via librsvg
rsvg-convert -w 1200 -h 480 src/lib/emailHeaderDecoration.svg -o /tmp/email-header.png
rsvg-convert -w 1200 -h 680 src/lib/emailFooterDecoration.svg -o /tmp/email-footer.png

# OR ImageMagick
magick -density 300 -background none src/lib/emailHeaderDecoration.svg -resize 1200x480 /tmp/email-header.png
magick -density 300 -background none src/lib/emailFooterDecoration.svg -resize 1200x680 /tmp/email-footer.png
```

If you're using Cloudinary, you can also just upload the SVG and request a PNG transformation:

```
https://res.cloudinary.com/<cloud>/image/upload/w_1200,h_480,c_fill,f_png/<header-asset>.svg
```

## Out of scope for this PR

The 32 `wrapEmail()` definitions copy-pasted across `base44/functions/*/entry.ts` are still using the old navy-block header. A follow-up PR will replace each with a self-contained version of this synthwave shell so OTPs, invoices, welcome emails, password resets, etc. all share the new look.
