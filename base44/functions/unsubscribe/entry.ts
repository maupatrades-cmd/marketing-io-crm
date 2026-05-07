import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// unsubscribe — POPIA section 69 right-to-be-forgotten endpoint.
//
// Two callers:
//
//   1. Logged-in users managing newsletter / marketing / spotlight prefs via
//      /email-preferences. Token is EmailPreferences.unsubscribe_token.
//
//   2. Anonymous buyers clicking the Unsubscribe link in an abandoned-cart
//      email. Token is AbandonedCartSequence.unsubscribe_token (new field
//      added in Step 8 cleanup — distinct from the row id so links can't be
//      guessed by id enumeration).
//
// Protocol (preserved from the existing logged-in flow):
//
//   POST { token } with no `preferences` field    → "GET" mode, returns the
//                                                   record so the SPA can
//                                                   render appropriately.
//   POST { token, preferences: {...} }            → save EmailPreferences
//   POST { token, confirm_unsubscribe: true }     → flip
//                                                   AbandonedCartSequence
//                                                   `unsubscribed: true`
//
// On every successful AbandonedCartSequence flip we write a SecurityEvent
// row of type `email_unsubscribed` for the POPIA audit trail.
// =============================================================================

function unwrapList(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function clientIpFrom(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('cf-connecting-ip')?.trim() ||
    'unknown';
}

async function findEmailPreferences(base44: any, token: string) {
  try {
    const list = await base44.asServiceRole.entities.EmailPreferences.filter({
      unsubscribe_token: token,
    });
    return unwrapList(list)[0] || null;
  } catch (err) {
    console.error('[unsubscribe] EmailPreferences lookup failed:', err);
    return null;
  }
}

async function findAbandonedCartSequence(base44: any, token: string) {
  try {
    const list = await base44.asServiceRole.entities.AbandonedCartSequence.filter({
      unsubscribe_token: token,
    });
    return unwrapList(list)[0] || null;
  } catch (err) {
    console.error('[unsubscribe] AbandonedCartSequence lookup failed:', err);
    return null;
  }
}

Deno.serve(async (req) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = String(body?.token ?? '').trim();
  if (!token) {
    return Response.json({ error: 'Token is required' }, { status: 400 });
  }

  const base44    = createClientFromRequest(req);
  const ipAddress = clientIpFrom(req);
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 500);

  // ---------------------------------------------------------------------------
  // Existing flow: logged-in EmailPreferences.
  // ---------------------------------------------------------------------------
  const pref = await findEmailPreferences(base44, token);
  if (pref) {
    if (!body.preferences) {
      return Response.json({
        kind:                  'email_preferences',
        email:                 pref.email,
        marketing_opted_in:    pref.marketing_opted_in    !== false,
        newsletter_opted_in:   pref.newsletter_opted_in   !== false,
        spotlight_opted_in:    pref.spotlight_opted_in    !== false,
        anniversary_opted_in:  pref.anniversary_opted_in  !== false,
        reengagement_opted_in: pref.reengagement_opted_in !== false,
      });
    }

    await base44.asServiceRole.entities.EmailPreferences.update(pref.id, {
      marketing_opted_in:    body.preferences.marketing_opted_in    !== false,
      newsletter_opted_in:   body.preferences.newsletter_opted_in   !== false,
      spotlight_opted_in:    body.preferences.spotlight_opted_in    !== false,
      anniversary_opted_in:  body.preferences.anniversary_opted_in  !== false,
      reengagement_opted_in: body.preferences.reengagement_opted_in !== false,
      updated_at: new Date().toISOString(),
    });

    return Response.json({ success: true, message: 'Preferences updated' });
  }

  // ---------------------------------------------------------------------------
  // New flow: AbandonedCartSequence token.
  // ---------------------------------------------------------------------------
  const seq = await findAbandonedCartSequence(base44, token);
  if (seq) {
    // Already unsubscribed: return the same friendly success payload so the
    // UI doesn't show an error if the buyer clicks the link a second time.
    if (seq.unsubscribed) {
      return Response.json({
        kind:                 'abandoned_cart',
        email:                seq.email,
        package_id:           seq.package_id,
        unsubscribed:         true,
        already_unsubscribed: true,
      });
    }

    // GET mode: return what we have so the SPA renders the confirm step.
    if (!body.confirm_unsubscribe) {
      return Response.json({
        kind:       'abandoned_cart',
        email:      seq.email,
        package_id: seq.package_id,
      });
    }

    // Confirm mode: flip unsubscribed + write the audit row.
    const now = new Date().toISOString();
    try {
      await base44.asServiceRole.entities.AbandonedCartSequence.update(seq.id, {
        unsubscribed:    true,
        unsubscribed_at: now,
      });
    } catch (err) {
      console.error('[unsubscribe] AbandonedCartSequence.update failed:', err);
      return Response.json({ error: 'update_failed' }, { status: 500 });
    }

    try {
      await base44.asServiceRole.entities.SecurityEvent.create({
        event_type: 'email_unsubscribed',
        email:      seq.email,
        ip_address: ipAddress,
        user_agent: userAgent,
        details:    JSON.stringify({
          source:      'abandoned_cart',
          sequence_id: seq.id,
          package_id:  seq.package_id,
        }),
        created_at: now,
      });
    } catch (err) {
      // Non-fatal — the unsubscribe still succeeded; we just lost the audit row.
      console.error('[unsubscribe] SecurityEvent.create failed:', err);
    }

    console.log(
      `[unsubscribe] abandoned_cart unsubscribed — sequence_id=${seq.id}, ` +
      `email=${seq.email}, package_id=${seq.package_id}`
    );

    return Response.json({
      kind:         'abandoned_cart',
      email:        seq.email,
      package_id:   seq.package_id,
      success:      true,
      unsubscribed: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Token belongs to neither.
  // ---------------------------------------------------------------------------
  return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
});
