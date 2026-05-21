// Server-side Cloudflare Turnstile token verification.
// Backend-only — must never be imported by frontend code (no site key needed here,
// and the secret key must not leak into the bundle).

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token, userIP) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('[verifyTurnstile] TURNSTILE_SECRET_KEY missing');
    return { success: false, error: 'verification_unavailable' };
  }
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'missing_token' };
  }

  const body = { secret, response: token };
  if (userIP) body.remoteip = userIP;

  let res;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[verifyTurnstile] network error:', err?.message);
    return { success: false, error: 'verification_unavailable' };
  }

  if (!res.ok) {
    console.error('[verifyTurnstile] siteverify HTTP', res.status);
    return { success: false, error: 'verification_unavailable' };
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error('[verifyTurnstile] siteverify JSON parse failed:', err?.message);
    return { success: false, error: 'verification_unavailable' };
  }

  if (data?.success === true) {
    return { success: true };
  }

  const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'].join(',') : 'unknown';
  return { success: false, error: codes };
}
