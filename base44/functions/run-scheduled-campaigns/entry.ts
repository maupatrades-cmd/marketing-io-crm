import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Admin-only
  const user = await base44.auth.me();
  if (user?.role !== 'admin' && user?.role !== 'owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: [] };
  const now = new Date();

  // Helper: days since a date
  function daysSince(dateStr) {
    if (!dateStr) return Infinity;
    return Math.floor((now - new Date(dateStr)) / (1000 * 60 * 60 * 24));
  }

  // Load active campaigns
  const allCampaigns = await base44.asServiceRole.entities.MarketingCampaign.filter({ active: true });

  // Load all users
  const allUsers = await base44.asServiceRole.entities.User.list();

  for (const campaign of allCampaigns) {
    if (campaign.trigger_type === 'scheduled' || campaign.trigger_type === 'manual') continue;

    for (const user of allUsers) {
      results.processed++;

      try {
        let shouldSend = false;

        if (campaign.trigger_type === 'after_signup_verified') {
          if (!user.email_verified || !user.updated_date) continue;
          const daysSinceVerified = daysSince(user.updated_date);
          if (daysSinceVerified !== (campaign.trigger_offset_days || 0)) continue;
          shouldSend = true;
        }

        if (campaign.trigger_type === 'after_login_inactivity') {
          if (!user.last_login_at) continue;
          const daysSinceLogin = daysSince(user.last_login_at);
          if (daysSinceLogin < 30) continue;
          shouldSend = true;
        }

        if (campaign.trigger_type === 'after_anniversary') {
          if (!user.created_date) continue;
          const daysSinceSignup = daysSince(user.created_date);
          if (daysSinceSignup !== 365) continue;
          shouldSend = true;
        }

        if (!shouldSend) { results.skipped++; continue; }

        // Check not already sent
        const existingSends = await base44.asServiceRole.entities.CampaignSend.filter({
          campaign_id: campaign.id,
          user_id: user.id
        });

        if (campaign.trigger_type === 'after_login_inactivity') {
          const recentSend = existingSends?.find(s => {
            return daysSince(s.sent_at) < 30;
          });
          if (recentSend) { results.skipped++; continue; }
        } else {
          if (existingSends && existingSends.length > 0) { results.skipped++; continue; }
        }

        // Fire campaign
        await base44.asServiceRole.functions.invoke('send-campaign', {
          campaign_slug: campaign.slug,
          user_id: user.id
        });

        results.sent++;
      } catch (err) {
        results.errors.push({ user_id: user.id, campaign_slug: campaign.slug, error: err.message });
      }
    }
  }

  return Response.json({ success: true, ...results });
});