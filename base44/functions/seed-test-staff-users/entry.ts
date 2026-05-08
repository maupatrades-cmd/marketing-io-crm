/**
 * seed-test-staff-users
 *
 * SECURITY NOTE — TESTING ONLY:
 *   The shared password "Test123456!" is for development/testing purposes only.
 *   Before going live with real clients on launch day:
 *     1. Reset all 5 test passwords to strong unique values, OR
 *     2. Delete the test users that won't be used in production.
 *   DO NOT ship to production with Test123456! credentials live.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import bcrypt from 'npm:bcryptjs@2.4.3';

const TEST_USERS = [
  { email: 'cpc1@marketingio.co.za',    role: 'cpc',         full_name: 'CPC Test 1'         },
  { email: 'cpc2@marketingio.co.za',    role: 'cpc',         full_name: 'CPC Test 2'         },
  { email: 'field1@marketingio.co.za',  role: 'field_agent', full_name: 'Field Agent Test 1' },
  { email: 'field2@marketingio.co.za',  role: 'field_agent', full_name: 'Field Agent Test 2' },
  { email: 'admin@marketingio.co.za',   role: 'admin',       full_name: 'Admin Test'         },
];

const SHARED_PASSWORD = 'Test123456!';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Step 1: Validate session token
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Owner-only
    if (user.role !== 'owner') {
      return Response.json({ error: 'Forbidden: owner role required' }, { status: 403 });
    }

    // Step 3: Hash shared password once
    let passwordHash;
    try {
      passwordHash = await bcrypt.hash(SHARED_PASSWORD, 10);
    } catch (err) {
      console.error('[seed-test-staff-users] bcrypt failed:', err);
      return Response.json({ error: 'password_hash_failed' }, { status: 500 });
    }

    const created = [];
    const skipped = [];

    // Step 4: Process each user
    for (const u of TEST_USERS) {
      const email = u.email.toLowerCase();
      const nameParts = u.full_name.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      // 4a: Idempotency check — skip if AppUser already exists
      let existing = [];
      try {
        existing = await base44.asServiceRole.entities.AppUser.filter({ email });
      } catch (err) {
        console.error(`[seed-test-staff-users] AppUser lookup failed for ${email}:`, err);
      }

      if (existing && existing.length > 0) {
        skipped.push({ email, reason: 'already_exists' });
        continue;
      }

      // 4b: Create AppUser
      let appUser = null;
      try {
        appUser = await base44.asServiceRole.entities.AppUser.create({
          email,
          full_name: u.full_name,
          first_name: firstName,
          last_name: lastName,
          role: u.role,
          password_hash: passwordHash,
          pending_verification: false,
          email_verified: true,
          mobile_number: '',
        });
      } catch (err) {
        console.error(`[seed-test-staff-users] AppUser.create failed for ${email}:`, err);
        skipped.push({ email, reason: 'app_user_create_failed' });
        continue;
      }

      // 4c: Create legacy User row (non-fatal if it fails)
      let legacyUser = null;
      try {
        legacyUser = await base44.asServiceRole.entities.User.create({
          email,
          full_name: u.full_name,
          role: u.role,
          password_hash: passwordHash,
          email_verified: true,
          pending_verification: false,
          phone: '',
        });
      } catch (err) {
        console.error(`[seed-test-staff-users] Legacy User.create failed for ${email} (non-fatal):`, err);
      }

      // 4d: Record success
      created.push({
        email,
        role: u.role,
        app_user_id: appUser?.id || null,
        legacy_user_id: legacyUser?.id || null,
      });
    }

    // Step 5: Return summary
    return Response.json({
      created,
      skipped,
      password: SHARED_PASSWORD,
      note: 'Reset these passwords or delete these users before launching to real clients.',
    });

  } catch (error) {
    console.error('[seed-test-staff-users] Unhandled error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});