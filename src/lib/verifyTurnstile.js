/**
 * verifyTurnstile.js — Reference documentation only.
 *
 * Deno backend functions are deployed independently and cannot import local
 * files at runtime. The actual implementation is inlined directly into
 * functions/auth-login and functions/auth-register.
 *
 * Canonical server-side pattern (runs in Deno, not in the browser):
 *
 *   async function verifyTurnstileToken(token, userIP) {
 *     const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
 *     if (!secret) return { success: false, error: 'configuration_error' };
 *     try {
 *       const body = new URLSearchParams({ secret, response: token });
 *       if (userIP) body.append('remoteip', userIP);
 *       const res = await fetch(
 *         'https://challenges.cloudflare.com/turnstile/v0/siteverify',
 *         { method: 'POST', body }
 *       );
 *       const data = await res.json();
 *       return data.success
 *         ? { success: true }
 *         : { success: false, error: (data['error-codes'] || [])[0] || 'invalid_token' };
 *     } catch (_) {
 *       return { success: false, error: 'verification_unavailable' };
 *     }
 *   }
 *
 * Usage in each function (before any DB/bcrypt work):
 *
 *   if (!turnstile_token) {
 *     return Response.json({ error: 'captcha_required', message: 'Security check required.' }, { status: 400 });
 *   }
 *   const result = await verifyTurnstileToken(turnstile_token, userIP);
 *   if (!result.success) {
 *     return Response.json({ error: 'captcha_failed', message: 'Please complete the security check and try again.' }, { status: 400 });
 *   }
 */