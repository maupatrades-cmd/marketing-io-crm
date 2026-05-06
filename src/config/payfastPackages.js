// Marketing iO PayFast catalogue — Step 5 of 10.
//
// IMPORTANT: this exact array is mirrored in
// base44/functions/payfast-sign/entry.ts (PACKAGES constant). Any change
// here must be made in both places. The duplicate exists because Base44
// Deno functions cannot import from the React src/ tree, and we must NEVER
// trust a browser-supplied amount — the function looks up the price itself.
// The catalogue moves to a DB table in a later step and the duplicate goes
// away.
//
// Pricing locked from signed Master Service Agreement v2.0.
//
// Field meanings:
//   id               — slug used in /checkout/:packageId routes and as
//                      custom_str1 on PayFast.
//   category         — "core" | "addon" | "test"; used to badge the page.
//   name             — public-facing product name.
//   description      — public-facing description (also goes into PayFast's
//                      item_description field).
//   amount           — once-off setup fee, formatted as "1234.56" (string,
//                      2dp, no symbol — that's PayFast's required format).
//   monthly_retainer — recurring fee billed separately (NOT through this
//                      checkout). "0.00" = no retainer.
//   contract_months  — locked-in retainer term. 0 = once-off, no retainer.
//   active           — false hides the package and redirects /checkout/:id
//                      to the default.

export const PAYFAST_PACKAGES = [
  // ============ CORE PACKAGES ============
  {
    id: 'ignite',
    category: 'core',
    name: 'Ignite Setup',
    description: 'Marketing iO Ignite package - one-time setup fee. R490/month retainer billed separately on debit order for 12 months.',
    amount: '3980.00',
    monthly_retainer: '490.00',
    contract_months: 12,
    active: true,
  },
  {
    id: 'accelerate',
    category: 'core',
    name: 'Accelerate Setup',
    description: 'Marketing iO Accelerate package - one-time setup fee. R890/month retainer billed separately on debit order for 12 months.',
    amount: '6500.00',
    monthly_retainer: '890.00',
    contract_months: 12,
    active: true,
  },
  {
    id: 'dominate',
    category: 'core',
    name: 'Dominate Setup',
    description: 'Marketing iO Dominate package - one-time setup fee. R1,490/month retainer billed separately on debit order for 12 months.',
    amount: '9800.00',
    monthly_retainer: '1490.00',
    contract_months: 12,
    active: true,
  },
  {
    id: 'street-pulse',
    category: 'core',
    name: 'Street Pulse Setup',
    description: 'Marketing iO Street Pulse - flyer deployment campaign setup. R4,000/month retainer billed separately for the 3-month locked term.',
    amount: '700.00',
    monthly_retainer: '4000.00',
    contract_months: 3,
    active: true,
  },
  {
    id: 'township-pulse',
    category: 'core',
    name: 'Township Pulse',
    description: 'Marketing iO Township Pulse - once-off township activation campaign. No monthly retainer.',
    amount: '2200.00',
    monthly_retainer: '0.00',
    contract_months: 0,
    active: true,
  },

  // ============ ADD-ONS WITH SETUP FEES ============
  {
    id: 'ai-chatbot',
    category: 'addon',
    name: 'AI Chatbot Setup',
    description: 'AI-powered chatbot for your website. Setup fee includes configuration, training, and integration. R350/month maintenance billed separately.',
    amount: '6500.00',
    monthly_retainer: '350.00',
    contract_months: 12,
    active: true,
  },
  {
    id: 'whatsapp-automation',
    category: 'addon',
    name: 'WhatsApp Business Automation',
    description: 'Automated WhatsApp Business setup with response flows and lead capture. R200/month maintenance billed separately.',
    amount: '3500.00',
    monthly_retainer: '200.00',
    contract_months: 12,
    active: true,
  },
  {
    id: 'google-business-profile',
    category: 'addon',
    name: 'Google Business Profile Setup',
    description: 'Google Business Profile creation, verification, photos, and category setup. Once-off, no monthly fees.',
    amount: '800.00',
    monthly_retainer: '0.00',
    contract_months: 0,
    active: true,
  },
  {
    id: 'sms-marketing',
    category: 'addon',
    name: 'SMS Marketing Setup',
    description: 'SMS marketing platform setup and integration. R500/month base + per-SMS rate billed separately.',
    amount: '500.00',
    monthly_retainer: '500.00',
    contract_months: 12,
    active: true,
  },
  {
    id: 'marketing-audit',
    category: 'addon',
    name: 'Marketing Audit & Report',
    description: 'Comprehensive marketing audit with detailed report and recommendations. Once-off deliverable.',
    amount: '2000.00',
    monthly_retainer: '0.00',
    contract_months: 0,
    active: true,
  },
  {
    id: 'competitor-analysis',
    category: 'addon',
    name: 'Competitor Analysis Report',
    description: 'Detailed competitor analysis with market positioning insights. Once-off deliverable.',
    amount: '1500.00',
    monthly_retainer: '0.00',
    contract_months: 0,
    active: true,
  },
  {
    id: 'crm-training',
    category: 'addon',
    name: 'CRM Training & Setup',
    description: 'CRM platform training and initial setup for your team. Once-off deliverable.',
    amount: '3000.00',
    monthly_retainer: '0.00',
    contract_months: 0,
    active: true,
  },

  // ============ TESTING ============
  {
    id: 'ignite-test',
    category: 'test',
    name: 'Sandbox Test',
    description: 'R10 sandbox test transaction (DO NOT use in production).',
    amount: '10.00',
    monthly_retainer: '0.00',
    contract_months: 0,
    active: true,
  },
];

// Default fallback for unknown / inactive package_id in /checkout/:packageId.
export const DEFAULT_PACKAGE_ID = 'ignite';

// Smaller subset surfaced on the legacy /payfast-test debug page so it stays
// quick to use without showing every product. Picked to cover the three
// shapes: cheap once-off, real once-off, real with retainer.
export const TEST_PAGE_PACKAGE_IDS = ['ignite-test', 'google-business-profile', 'ignite'];

export function findPackage(id) {
  return PAYFAST_PACKAGES.find((p) => p.id === id);
}

export function isActivePackage(id) {
  const pkg = findPackage(id);
  return Boolean(pkg && pkg.active !== false);
}
