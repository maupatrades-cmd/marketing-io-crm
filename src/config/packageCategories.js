// Package → category mapping used by /payment-success and /payment-cancelled
// to render the correct "what happens next" copy for the buyer.
//
// Mirrors PACKAGE_CATEGORY in base44/functions/payfast-send-receipt/entry.ts.
// Keep these two in sync — the receipt email and the success page must show
// the same promise to the buyer. Both go away when the catalogue moves to
// a DB table.

const PACKAGE_CATEGORY = {
  // Core engagement packages.
  'ignite':                  'core',
  'accelerate':              'core',
  'dominate':                'core',
  'street-pulse':            'core',
  // Township Pulse has its own deployment timeline.
  'township-pulse':          'township',
  // Once-off deliverables.
  'google-business-profile': 'once_off',
  'marketing-audit':         'once_off',
  'competitor-analysis':     'once_off',
  'crm-training':            'once_off',
  // Recurring add-ons (setup fee + monthly retainer).
  'ai-chatbot':              'recurring_addon',
  'whatsapp-automation':     'recurring_addon',
  'sms-marketing':           'recurring_addon',
  // Sandbox.
  'ignite-test':             'test',
};

export function getPackageCategory(packageId) {
  return PACKAGE_CATEGORY[packageId] || 'core';
}

export function getNextStepsCopy(packageId) {
  switch (getPackageCategory(packageId)) {
    case 'core':
      return "We'll be in touch within 24 hours to schedule your onboarding call.";
    case 'township':
      return 'Your campaign deployment will be scheduled within 14 days. Photo report delivered by day 15.';
    case 'once_off':
      return 'Your deliverable will be ready within 5 business days.';
    case 'recurring_addon':
      return "We'll start setup within 2 business days.";
    case 'test':
      return 'This was a test transaction — no action needed.';
    default:
      return "We'll be in touch shortly.";
  }
}
