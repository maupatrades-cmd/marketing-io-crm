import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

// Local copy of the validator in src/lib/passwordValidator.js so the backend
// enforces the same rules even if a caller bypasses the UI.
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!password || password.length < 10) errors.push('Password must be at least 10 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least 1 uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least 1 lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least 1 number');
  return { valid: errors.length === 0, errors };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { user_id, current_password, new_password } = body || {};
  if (!user_id || !current_password || !new_password) {
    return Response.json({ error: 'user_id, current_password, new_password required' }, { status: 400 });
  }

  const validation = validatePassword(new_password);
  if (!validation.valid) {
    return Response.json({ error: 'invalid_new_password', detail: validation.errors }, { status: 400 });
  }

  // Look up the user — try AppUser (client portal) first, then User (staff).
  let user: any = null;
  let userEntity: 'AppUser' | 'User' | null = null;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ id: user_id });
    if (Array.isArray(appUsers) ? appUsers[0] : appUsers) {
      user = Array.isArray(appUsers) ? appUsers[0] : appUsers;
      userEntity = 'AppUser';
    }
  } catch (err) {
    console.error('[change-password] AppUser lookup failed:', err);
  }
  if (!user) {
    try {
      const legacy = await base44.asServiceRole.entities.User.filter({ id: user_id });
      if (Array.isArray(legacy) ? legacy[0] : legacy) {
        user = Array.isArray(legacy) ? legacy[0] : legacy;
        userEntity = 'User';
      }
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

  let matches = false;
  try {
    matches = await bcrypt.compare(current_password, user.password_hash);
  } catch (err) {
    console.error('[change-password] bcrypt compare failed:', err);
    return Response.json({ error: 'compare_failed' }, { status: 500 });
  }
  if (!matches) {
    return Response.json({ error: 'wrong_current_password' }, { status: 401 });
  }

  // Disallow trivial reuse.
  let sameAsOld = false;
  try {
    sameAsOld = await bcrypt.compare(new_password, user.password_hash);
  } catch {}
  if (sameAsOld) {
    return Response.json({ error: 'same_as_old' }, { status: 400 });
  }

  let newHash: string;
  try {
    newHash = await bcrypt.hash(new_password, 10);
  } catch (err) {
    console.error('[change-password] hash failed:', err);
    return Response.json({ error: 'hash_failed' }, { status: 500 });
  }

  try {
    await base44.asServiceRole.entities[userEntity].update(user.id, {
      password_hash: newHash,
      failed_login_count: 0,
      lockout_until: null
    });
  } catch (err: any) {
    console.error('[change-password] update failed:', err);
    return Response.json({ error: 'update_failed', detail: err?.message }, { status: 500 });
  }

  // Activity audit (Client Portal PR A).
  try {
    const clientList = await base44.asServiceRole.entities.Client.filter({ client_user_id: user.id });
    const client = (Array.isArray(clientList) ? clientList : clientList?.data ?? [])[0];
    if (client?.id) {
      const ip =
        (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
        req.headers.get('x-real-ip') || '';
      await base44.asServiceRole.entities.ClientActivityLog.create({
        client_id:      client.id,
        client_name:    String(client.business_name || client.contact_person || '').trim(),
        actor_id:       user.id,
        actor_role:     String(user.role || 'client'),
        event_type:     'password_changed',
        event_category: 'auth',
        event_summary:  'Password changed',
        event_metadata: {},
        event_label:    'Password changed',
        logged_by:      user.id,
        logged_by_name: String(user.full_name || user.email || ''),
        ip_address:     ip.slice(0, 64),
        user_agent:     (req.headers.get('user-agent') || '').slice(0, 500),
      });
    }
  } catch (logErr: any) {
    console.error('[change-password] activity log failed (non-fatal):', logErr?.message);
  }

  return Response.json({ success: true });
});
