import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

function validatePassword(password) {
  const errors = [];
  if (!password || password.length < 10) errors.push('Password must be at least 10 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least 1 uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least 1 lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least 1 number');
  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { user_id, current_password, new_password, token } = body || {};
  if (!user_id || !current_password || !new_password) {
    return Response.json({ error: 'user_id, current_password, new_password required' }, { status: 400 });
  }
  if (!token) return Response.json({ error: 'token required' }, { status: 401 });

  // LB-030: bind the password change to an authenticated session. Previously
  // only current_password was checked, which meant anyone who knew (or
  // brute-forced over time) a user's password could change it from anywhere
  // with no active login. Now caller must hold a valid session AND know the
  // current password AND target their own user_id. No admin bypass — admins
  // reset passwords via the password_reset flow, not this endpoint.
  let caller = null;
  try {
    const callerList = await base44.asServiceRole.entities.AppUser.filter({ session_token: token });
    caller = (Array.isArray(callerList) ? callerList[0] : null) || null;
  } catch (err) {
    console.error('[change-password] caller lookup failed:', err);
  }
  if (!caller) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!caller.session_expires_at || new Date(caller.session_expires_at) < new Date()) {
    return Response.json({ error: 'session_expired' }, { status: 401 });
  }
  if (String(caller.id) !== String(user_id)) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const validation = validatePassword(new_password);
  if (!validation.valid) {
    return Response.json({ error: 'invalid_new_password', detail: validation.errors }, { status: 400 });
  }

  // Look up user
  let user = null;
  let userEntity = null;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ id: user_id });
    const found = Array.isArray(appUsers) ? appUsers[0] : appUsers;
    if (found) { user = found; userEntity = 'AppUser'; }
  } catch (err) {
    console.error('[change-password] AppUser lookup failed:', err);
  }
  if (!user) {
    try {
      const legacy = await base44.asServiceRole.entities.User.filter({ id: user_id });
      const found = Array.isArray(legacy) ? legacy[0] : legacy;
      if (found) { user = found; userEntity = 'User'; }
    } catch (err) {
      console.error('[change-password] User lookup failed:', err);
    }
  }
  if (!user || !userEntity) {
    return Response.json({ error: 'user_not_found' }, { status: 404 });
  }
  if (!user.password_hash) {
    return Response.json({ error: 'no_password_on_record' }, { status: 400 });
  }

  // Verify current password
  let matches = false;
  try { matches = await bcrypt.compare(current_password, user.password_hash); }
  catch (err) {
    console.error('[change-password] bcrypt compare failed:', err);
    return Response.json({ error: 'compare_failed' }, { status: 500 });
  }
  if (!matches) {
    return Response.json({ error: 'wrong_current_password' }, { status: 401 });
  }

  // Check password history (current hash + up to last 9 stored)
  const history = Array.isArray(user.password_history) ? user.password_history : [];
  const allHashes = [user.password_hash, ...history];

  for (const oldHash of allHashes) {
    let reused = false;
    try { reused = await bcrypt.compare(new_password, oldHash); } catch {}
    if (reused) {
      return Response.json({ error: 'password_previously_used', message: 'This password has been used before. Please choose a new one.' }, { status: 400 });
    }
  }

  // Hash new password
  let newHash;
  try { newHash = await bcrypt.hash(new_password, 10); }
  catch (err) {
    console.error('[change-password] hash failed:', err);
    return Response.json({ error: 'hash_failed' }, { status: 500 });
  }

  // Build new history (keep last 9, prepend current hash → max 10 total)
  const newHistory = [user.password_hash, ...history].slice(0, 9);

  // Set expiry: 90 days from now
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await base44.asServiceRole.entities[userEntity].update(user.id, {
      password_hash: newHash,
      password_history: newHistory,
      password_changed_at: now.toISOString(),
      password_expires_at: expiresAt,
      failed_login_count: 0,
      lockout_until: null
    });
  } catch (err) {
    console.error('[change-password] update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Activity audit
  try {
    const clientList = await base44.asServiceRole.entities.Client.filter({ client_user_id: user.id });
    const client = (Array.isArray(clientList) ? clientList : [])[0];
    if (client?.id) {
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '';
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id: client.id,
        client_name: String(client.business_name || client.contact_person || '').trim(),
        actor_id: user.id,
        actor_role: String(user.role || 'client'),
        event_type: 'password_changed',
        event_category: 'auth',
        event_summary: 'Password changed',
        event_metadata: {},
        event_label: 'Password changed',
        logged_by: user.id,
        logged_by_name: String(user.full_name || user.email || ''),
        ip_address: ip.slice(0, 64),
        user_agent: (req.headers.get('user-agent') || '').slice(0, 500),
      });
    }
  } catch (logErr) {
    console.error('[change-password] activity log failed (non-fatal):', logErr?.message);
  }

  return Response.json({ success: true, password_expires_at: expiresAt });
});