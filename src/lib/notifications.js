import { base44 } from "@/api/base44Client";

const STAGE_MESSAGES = {
  discovery_visit: {
    subject: "Marketing iO — Discovery Visit Confirmed",
    body: (name) => `Hi ${name},\n\nGreat news! Your discovery visit with Marketing iO has been scheduled. Our team will be in touch shortly to confirm the date and time.\n\nWarm regards,\nMarketing iO Team\ninfo@marketingio.co.za`,
  },
  proposal_sent: {
    subject: "Marketing iO — Your Proposal is Ready",
    body: (name) => `Hi ${name},\n\nYour personalised marketing proposal from Marketing iO has been prepared and sent. Please review it at your earliest convenience.\n\nWarm regards,\nMarketing iO Team\ninfo@marketingio.co.za`,
  },
  negotiation: {
    subject: "Marketing iO — Proposal Under Review",
    body: (name) => `Hi ${name},\n\nThank you for reviewing our proposal. We're currently in the final stages of customising the best package for your business.\n\nWarm regards,\nMarketing iO Team\ninfo@marketingio.co.za`,
  },
  closed_won: {
    subject: "Welcome to Marketing iO — Let's Build Your Brand!",
    body: (name) => `Hi ${name},\n\n🎉 Welcome to the Marketing iO family! We're thrilled to have you on board.\n\nYour onboarding process will begin shortly. Here's what to expect next:\n• You'll receive your onboarding form within 24 hours\n• Our team will contact you to collect brand assets\n• We'll schedule your go-live within the agreed timeframe\n\nWarm regards,\nMarketing iO Team\ninfo@marketingio.co.za`,
  },
  onboarding: {
    subject: "Marketing iO — Your Onboarding Has Started",
    body: (name) => `Hi ${name},\n\nExciting news — your Marketing iO onboarding is officially underway!\n\nWarm regards,\nMarketing iO Team\ninfo@marketingio.co.za`,
  },
};

const ONBOARDING_MESSAGES = {
  onboarding_form_returned: {
    subject: "Marketing iO — Onboarding Form Received ✓",
    body: (name) => `Hi ${name},\n\nWe've received your completed onboarding form — thank you! Our team will now begin processing your account setup.\n\nWarm regards,\nMarketing iO Team`,
  },
  debit_mandate_signed: {
    subject: "Marketing iO — Debit Mandate Confirmed ✓",
    body: (name) => `Hi ${name},\n\nYour debit order mandate has been successfully signed and recorded.\n\nWarm regards,\nMarketing iO Team`,
  },
  brand_assets_received: {
    subject: "Marketing iO — Brand Assets Received ✓",
    body: (name) => `Hi ${name},\n\nWe've received your brand assets. Our creative team will now begin building your online presence!\n\nWarm regards,\nMarketing iO Team`,
  },
  setup_fee_paid: {
    subject: "Marketing iO — Setup Fee Confirmed ✓",
    body: (name) => `Hi ${name},\n\nYour setup fee payment has been confirmed. Your account is now fully active.\n\nWarm regards,\nMarketing iO Team`,
  },
  go_live_acknowledged: {
    subject: "Marketing iO — You're LIVE! 🚀",
    body: (name) => `Hi ${name},\n\n🚀 Your Marketing iO services are now LIVE! Your online presence is up and running.\n\nWarm regards,\nMarketing iO Team\ninfo@marketingio.co.za`,
  },
};

export async function notifyDealStageChange(client, newStage) {
  const msg = STAGE_MESSAGES[newStage];
  if (!msg || !client?.email) return;
  const name = client.contact_person || client.business_name || "Valued Client";
  await base44.integrations.Core.SendEmail({
    to: client.email,
    subject: msg.subject,
    body: msg.body(name),
    from_name: "Marketing iO",
  });
}

export async function notifyOnboardingMilestone(client, field) {
  const msg = ONBOARDING_MESSAGES[field];
  if (!msg || !client?.email) return;
  const name = client.contact_person || client.business_name || "Valued Client";
  await base44.integrations.Core.SendEmail({
    to: client.email,
    subject: msg.subject,
    body: msg.body(name),
    from_name: "Marketing iO",
  });
}