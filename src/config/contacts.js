// Marketing iO contact endpoints surfaced in user-facing pages
// (e.g. recovery CTAs on /payment-cancelled). Single source of truth
// so a number/email change is one edit, not a search-and-replace.

export const SUPPORT_WHATSAPP = {
  // Display form for humans to read.
  display: '+27 71 520 5334',
  // E.164 digits-only form for wa.me links (no leading + or spaces).
  digits: '27715205334',
};

export const SUPPORT_EMAIL = 'hello@marketingio.co.za';

export function whatsappLink(message) {
  const base = `https://wa.me/${SUPPORT_WHATSAPP.digits}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(opts) {
  const subject = opts && opts.subject;
  const body    = opts && opts.body;
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const qs = params.toString();
  return qs ? `mailto:${SUPPORT_EMAIL}?${qs}` : `mailto:${SUPPORT_EMAIL}`;
}
