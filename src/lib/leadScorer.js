/**
 * Lead Scoring Engine
 * Combines warm-lead criteria with portal/onboarding engagement signals.
 * Max score = 100.
 */

// ── Scoring weights ──────────────────────────────────────────────
const WARM_CRITERIA_WEIGHT = 35;  // 7 criteria × 5pts each = 35pts max
const PORTAL_ACTIVITY_WEIGHT = 25; // portal login recency + frequency
const ONBOARDING_WEIGHT = 25;      // onboarding form completeness
const SOURCE_WEIGHT = 15;          // lead source quality

const SOURCE_SCORES = {
  inbound:            15,  // they came to us
  fnc_referral:       12,
  referral:           10,
  field_agent_direct:  8,
  cpc_outbound:        5,
  other:               3,
};

/**
 * Compute a 0–100 score for a lead, enriched with optional context data.
 * @param {object} lead - Lead entity record
 * @param {object|null} client - Matched Client record (if converted / known)
 * @param {object|null} onboardingSub - ClientOnboardingSubmission record
 * @param {Array} activityLogs - ClientActivityLog records for this client
 * @returns {{ score: number, tier: string, breakdown: object }}
 */
export function scoreLead(lead, client = null, onboardingSub = null, activityLogs = []) {
  let score = 0;
  const breakdown = {
    warmCriteria: 0,
    portalActivity: 0,
    onboarding: 0,
    source: 0,
  };

  // 1. Warm criteria (35pts)
  const criteria = lead.warm_lead_criteria || {};
  const criteriaCount = Object.values(criteria).filter(Boolean).length;
  breakdown.warmCriteria = Math.round((criteriaCount / 7) * WARM_CRITERIA_WEIGHT);
  score += breakdown.warmCriteria;

  // 2. Source quality (15pts)
  breakdown.source = SOURCE_SCORES[lead.source] ?? 3;
  score += breakdown.source;

  // 3. Portal activity (25pts) — based on client record if they're a portal user
  if (client) {
    let portalPts = 0;
    // Has ever logged into portal
    if (client.first_portal_login_at) portalPts += 8;
    // Recent activity (within 7 days)
    if (client.portal_last_active_at) {
      const daysSinceActive = (Date.now() - new Date(client.portal_last_active_at)) / (1000 * 60 * 60 * 24);
      if (daysSinceActive <= 1)  portalPts += 10;
      else if (daysSinceActive <= 7)  portalPts += 7;
      else if (daysSinceActive <= 30) portalPts += 4;
    }
    // Activity log depth (engagement breadth)
    const logCount = activityLogs.length;
    if (logCount >= 20) portalPts += 7;
    else if (logCount >= 10) portalPts += 5;
    else if (logCount >= 3) portalPts += 3;

    breakdown.portalActivity = Math.min(portalPts, PORTAL_ACTIVITY_WEIGHT);
  }
  score += breakdown.portalActivity;

  // 4. Onboarding engagement (25pts)
  if (onboardingSub) {
    let obPts = 0;
    const status = onboardingSub.submission_status;
    if (status === "submitted" || status === "reviewed") obPts += 15;
    else if (status === "in_progress") obPts += 8;
    else if (status === "not_started") obPts += 2; // at least started

    // Count filled sections (proxy for engagement depth)
    const sectionKeys = [
      "section_business_overview", "section_brand_assets_status",
      "section_existing_marketing", "section_competitors",
      "section_goals_12_months", "section_pain_points",
      "section_unique_selling_points",
    ];
    const filledSections = sectionKeys.filter(k => !!onboardingSub[k]).length;
    obPts += Math.round((filledSections / sectionKeys.length) * 10);

    breakdown.onboarding = Math.min(obPts, ONBOARDING_WEIGHT);
  }
  score += breakdown.onboarding;

  const finalScore = Math.min(Math.round(score), 100);

  const tier =
    finalScore >= 80 ? "high_value" :
    finalScore >= 60 ? "hot" :
    finalScore >= 35 ? "warm" :
    "cold";

  return { score: finalScore, tier, breakdown };
}

export function tierConfig(tier) {
  return {
    high_value: { label: "High Value",  color: "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/40",  dot: "bg-[#f59e0b]",  flag: true },
    hot:        { label: "Hot",         color: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive", flag: true },
    warm:       { label: "Warm",        color: "bg-primary/15 text-primary border-primary/30",           dot: "bg-primary",     flag: false },
    cold:       { label: "Cold",        color: "bg-muted/40 text-muted-foreground border-border/40",     dot: "bg-muted-foreground", flag: false },
  }[tier] || { label: tier, color: "bg-muted/40 text-muted-foreground border-border/40", dot: "bg-muted-foreground", flag: false };
}

export function outreachTemplate(lead, tier) {
  const name = lead.contact_person?.split(" ")[0] || "there";
  const biz  = lead.business_name;
  if (tier === "high_value") {
    return `Hi ${name}, I've been looking at ${biz}'s growth trajectory and I believe we can help you scale significantly. I'd love 15 minutes to walk you through a tailored Marketing iO strategy — would this week work?`;
  }
  if (tier === "hot") {
    return `Hi ${name}, following up on ${biz} — we have a few ideas that could make a real difference for your business right now. Can we connect this week?`;
  }
  if (tier === "warm") {
    return `Hi ${name}, just wanted to touch base on ${biz}. We've helped similar businesses grow their online presence — happy to share some quick wins if you have 10 minutes?`;
  }
  return `Hi ${name}, checking in on ${biz}. Let me know if you'd like to explore how Marketing iO can help.`;
}