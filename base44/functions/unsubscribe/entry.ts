import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { token, preferences } = await req.json();

  if (!token) {
    return Response.json({ error: 'Token is required' }, { status: 400 });
  }

  // GET: look up preferences by token
  if (!preferences) {
    const prefs = await base44.asServiceRole.entities.EmailPreferences.filter({ unsubscribe_token: token });
    const pref = prefs?.[0];
    if (!pref) {
      return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
    }
    return Response.json({
      email: pref.email,
      marketing_opted_in: pref.marketing_opted_in !== false,
      newsletter_opted_in: pref.newsletter_opted_in !== false,
      spotlight_opted_in: pref.spotlight_opted_in !== false,
      anniversary_opted_in: pref.anniversary_opted_in !== false,
      reengagement_opted_in: pref.reengagement_opted_in !== false
    });
  }

  // POST: update preferences
  const prefs = await base44.asServiceRole.entities.EmailPreferences.filter({ unsubscribe_token: token });
  const pref = prefs?.[0];
  if (!pref) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 404 });
  }

  await base44.asServiceRole.entities.EmailPreferences.update(pref.id, {
    marketing_opted_in: preferences.marketing_opted_in !== false,
    newsletter_opted_in: preferences.newsletter_opted_in !== false,
    spotlight_opted_in: preferences.spotlight_opted_in !== false,
    anniversary_opted_in: preferences.anniversary_opted_in !== false,
    reengagement_opted_in: preferences.reengagement_opted_in !== false,
    updated_at: new Date().toISOString()
  });

  return Response.json({ success: true, message: 'Preferences updated' });
});