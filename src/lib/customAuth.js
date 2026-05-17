import { base44 } from '@/api/base44Client';

const SESSION_KEY = 'mio_session_token';
const SESSION_USER_KEY = 'mio_session_user';

export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function destroySession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_USER_KEY);
}

/**
 * Returns the current user.
 * Fast path: reads from localStorage cache.
 * If no cache, calls auth-me backend function to validate token server-side.
 */
export async function getCurrentUser() {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;

  // Always verify server-side — ensures the session is valid across domains/tabs
  try {
    const res = await base44.functions.invoke('auth-me', { token });
    const user = res.data?.user;
    if (user) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      base44.auth.setToken(token);
      return user;
    }
  } catch (_) {
    // Token invalid or expired — clear session
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
  }
  return null;
}

export async function requireRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  if (!allowedRoles.includes(user.role)) throw new Error('Insufficient permissions');
  return user;
}

// Legacy stubs — kept for backwards compatibility, logic moved server-side
export function hashPassword() { throw new Error('hashPassword is server-side only. Use auth-register function.'); }
export function verifyPassword() { throw new Error('verifyPassword is server-side only. Use auth-login function.'); }
export function generateSessionToken() { return crypto.randomUUID(); }
export async function createSession() { throw new Error('createSession is server-side only. Use auth-verify-otp function.'); }