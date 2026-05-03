import bcrypt from 'bcryptjs';
import { base44 } from '@/api/base44Client';

const SESSION_KEY = 'mio_session_token';
const SESSION_HOURS = 8;

export function hashPassword(plaintext) {
  return bcrypt.hashSync(plaintext, 10);
}

export function verifyPassword(plaintext, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(plaintext, hash);
}

export function generateSessionToken() {
  return crypto.randomUUID();
}

export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createSession(userId) {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await base44.entities.User.update(userId, {
    session_token: token,
    session_expires_at: expiresAt,
    last_login_at: new Date().toISOString()
  });
  localStorage.setItem(SESSION_KEY, token);
  return token;
}

export async function destroySession(userId) {
  localStorage.removeItem(SESSION_KEY);
  if (userId) {
    await base44.entities.User.update(userId, {
      session_token: null,
      session_expires_at: null
    });
  }
}

export async function getCurrentUser() {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;
  const users = await base44.entities.User.filter({ session_token: token });
  if (!users || users.length === 0) return null;
  const user = users[0];
  if (!user.session_expires_at) return null;
  if (new Date(user.session_expires_at) < new Date()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return user;
}

export async function requireRole(allowedRoles) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  if (!allowedRoles.includes(user.role)) throw new Error('Insufficient permissions');
  return user;
}