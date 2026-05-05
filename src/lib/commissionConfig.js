// Marketing iO Commission Structure — per Working System v1.0 (locked).
// All rates and amounts in ZAR. This file is the single source of truth for
// the commission engine; do not duplicate these constants elsewhere.

// CORE PACKAGES — 7% setup commission immediately + retainer at 5-deal milestone.
export const PACKAGE_COMMISSIONS = {
  ignite: {
    setup_rate: 0.07,
    retainer_rate: 0.07,
    retainer_term_months: 12,
    retainer_milestone_required: true,
    flat_amount: null
  },
  accelerate: {
    setup_rate: 0.07,
    retainer_rate: 0.07,
    retainer_term_months: 12,
    retainer_milestone_required: true,
    flat_amount: null
  },
  dominate: {
    setup_rate: 0.07,
    retainer_rate: 0.075,
    retainer_term_months: 12,
    retainer_milestone_required: true,
    flat_amount: null
  },
  street_pulse: {
    setup_rate: 0,
    retainer_rate: 0.12,
    retainer_term_months: 1,
    retainer_milestone_required: false,
    flat_amount: 444,
    flat_trigger: 'first_retainer_clears'
  },
  township_pulse: {
    setup_rate: 0,
    retainer_rate: 0,
    retainer_term_months: 0,
    retainer_milestone_required: false,
    flat_amount: 130,
    flat_trigger: 'setup_clears'
  }
};

// ADD-ON BUCKETS.
export const ADDON_BUCKET_RATES = {
  A: { type: 'once_off', rate: 0.07, milestone_required: false },
  B: {
    type: 'setup_plus_recurring',
    setup_rate: 0.07,
    retainer_rate: 0.07,
    milestone_required: true
  },
  C: {
    type: 'pure_recurring',
    annual_rate: 0.07,
    milestone_required: true
  },
  D: { type: 'paid_ads', monthly_rate: 0.10, milestone_required: false },
  E: { type: 'passive', rate: 0, milestone_required: false }
};

// Map each add-on product_id to its commission bucket.
export const ADDON_BUCKET_MAP = {
  // Bucket A — Once-off
  google_business_profile: 'A',
  marketing_audit: 'A',
  competitor_analysis: 'A',
  crm_training: 'A',
  staff_training: 'A',

  // Bucket B — Setup + Recurring
  ai_chatbot: 'B',
  whatsapp_automation: 'B',
  sms_marketing: 'B',

  // Bucket C — Pure Recurring
  reputation_management: 'C',
  email_newsletter: 'C',
  short_form_video: 'C',
  ai_content_writing: 'C',
  website_maintenance: 'C',

  // Bucket D — Paid Ads
  paid_ads_management: 'D',

  // Bucket E — Passive
  print_signage: 'E',
  hosting_reselling: 'E'
};

// CPC earning streams (lead sourcer rewards — separate from closer commission).
export const CPC_RATES = {
  qualified_lead_fee: 87,
  closure_bonus: 250
};

// ADMIN per-contract loaded.
export const ADMIN_RATES = {
  per_contract_loaded: 25
};

// FNC reverse-referral funding deal closure.
export const FNC_REFERRAL_RATES = {
  flat: 800
};

// Part-time deployment agents earn day rate only — no commission.
export const PART_TIME_RATES = {
  per_day: 170,
  earns_commission: false
};

// 5-deal milestone unlock threshold.
export const RETAINER_MILESTONE_DEAL_COUNT = 5;

// Payroll cycle.
export const PAYROLL = {
  monthly_cutoff_day: 6,
  payout_day: 25,
  clawback_window_days: 30
};
