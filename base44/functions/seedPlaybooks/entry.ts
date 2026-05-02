import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PLAYBOOKS = [
  // FIELD AGENT SCRIPTS (8 entries)
  {
    code: "cold_door_to_door",
    title: "Cold outreach opener — door-to-door / walk-in",
    category: "cold_outreach",
    visible_to_roles: ["field_agent"],
    content_type: "script",
    short_description: "Opening line for door-to-door prospecting in new areas",
    full_content: "Hi, my name is [Name] from Marketing iO. We're a Polokwane-based digital marketing agency. I'm visiting businesses in [area] this morning — would you have 5 minutes for a quick chat about your online presence? No obligation, just want to understand if there's a fit.",
    usage_notes: "Use when cold-calling on foot. Keep it conversational. Smile. If they say no, thank them and move on to the next business. No follow-up needed if they decline the 5-minute chat."
  },
  {
    code: "cold_phone_opener",
    title: "Cold phone opener",
    category: "cold_outreach",
    visible_to_roles: ["field_agent", "cpc"],
    content_type: "script",
    short_description: "Professional phone opening for cold prospects",
    full_content: "Hi [Owner Name], this is [Name] from Marketing iO in Polokwane. The reason for my call — we help local businesses become more visible online. I'm not selling anything on this call. Could I ask you 2 quick questions to see if there's a reason for me to come visit you in person?",
    usage_notes: "Use for first phone contact. Be brief. If they're busy, ask for a callback time. Don't launch into a pitch — permission first."
  },
  {
    code: "discovery_5_phases",
    title: "Discovery visit framework — 5 phases (20 minutes)",
    category: "discovery",
    visible_to_roles: ["field_agent"],
    content_type: "framework",
    short_description: "Structured discovery conversation to diagnose prospect needs",
    full_content: "Phase 1 — Permission (1 min):\n'Can I ask you a few questions about your business before we get into anything?'\n\nPhase 2 — Current state (5 min):\nWhat's working, what's not. How they currently get customers.\n\nPhase 3 — Goals (5 min):\nWhere they want to be in 12 months. Specific revenue or volume goal.\n\nPhase 4 — Gap (5 min):\nWhat's blocking them from reaching the goal.\n\nPhase 5 — Fit (4 min):\nMatch a Marketing iO package to their gap. Don't pitch — diagnose.",
    usage_notes: "Strict 20-minute time box. Listen 80% of the time. Take notes. Never talk about Marketing iO until Phase 5. If they say 'no' at any point, thank them and document why."
  },
  {
    code: "closing_3_approaches",
    title: "3 closing approaches",
    category: "closing",
    visible_to_roles: ["field_agent", "cpc"],
    content_type: "script",
    short_description: "Three proven methods to ask for the sale",
    full_content: "SOFT CLOSE:\n'Based on what you've told me, I think Ignite is the right fit. Should we get the contract going?'\n\nASSUMPTIVE CLOSE:\n'Let me send you the contract today. We can start onboarding this week. What email should I use?'\n\nCALENDAR CLOSE:\n'I want to lock in time to onboard you. Looking at this week — does Tuesday or Thursday work better for you?'",
    usage_notes: "Pick ONE approach based on the prospect's personality. Soft close for cautious buyers. Assumptive for confident decision-makers. Calendar close for those who need a hard deadline."
  },
  {
    code: "followup_3_touches",
    title: "Post-proposal follow-up sequence",
    category: "follow_up",
    visible_to_roles: ["field_agent", "cpc"],
    content_type: "framework",
    short_description: "Three-touch follow-up to move silent prospects to decision",
    full_content: "24 HOURS LATER (WhatsApp):\n'Hi [Name], just confirming you received the proposal I sent. Any questions I can clear up?'\n\n3 DAYS LATER (if silent):\n'Hi [Name], following up on the proposal. Want to make sure I'm not chasing you at a bad time. Should I follow up next week instead?'\n\n7 DAYS LATER (if still silent):\n'Hi [Name], not wanting to be a nuisance. If now isn't the right time, just say the word and I'll back off until you're ready. No hard feelings.'",
    usage_notes: "Use WhatsApp for all touches. If no response by day 7, move to 'lost' in CRM and note reason. Don't send more than 3 touches."
  },
  {
    code: "objection_no_money",
    title: "Objection: 'I don't have money for marketing'",
    category: "objection_handler",
    visible_to_roles: ["field_agent", "cpc"],
    content_type: "objection_handler",
    related_objection: "I don't have money for marketing",
    short_description: "Handle budget concerns and reframe value",
    full_content: "Understood. Most clients say that until they realise their competitors are taking customers because they ARE marketing. Our entry package (Ignite at R3,980 setup + R490/month) is less than what most businesses spend on coffee for the team. The question isn't whether you can afford to market — it's whether you can afford to keep being invisible.",
    usage_notes: "Don't argue. Empathise first. Reframe cost as investment. If they still say no, offer to send them the Ignite package info for when their budget opens up."
  },
  {
    code: "objection_busy_not_interested",
    title: "Objection: 'I'm busy / not interested'",
    category: "objection_handler",
    visible_to_roles: ["field_agent", "cpc"],
    content_type: "objection_handler",
    related_objection: "I'm busy / not interested",
    short_description: "Overcome time objections and stay in touch",
    full_content: "Totally understand. Just one quick thing — would you spare 30 seconds for me to send you our package list via WhatsApp so you have it on file? Then you can decide if you want a call back when you're less busy.",
    usage_notes: "Don't push for a meeting. Get permission to send WhatsApp. Follow up in 2 weeks with a light 'just checking in' message. Busy means 'not now', not 'never'."
  },
  {
    code: "objection_things_are_fine",
    title: "Objection: 'Things are fine / we don't need this'",
    category: "objection_handler",
    visible_to_roles: ["field_agent", "cpc"],
    content_type: "objection_handler",
    related_objection: "Things are fine",
    short_description: "Reframe as opportunity, not problem",
    full_content: "Glad to hear it. My job is to make sure you know about all the things that could work even better. Should I just send you a quick WhatsApp on the [add-on] option so you have it on file? No commitment.",
    usage_notes: "Acknowledge their success. Pivot to upsell opportunity. Keep it light. Don't oversell — just plant the seed."
  },
  // CPC SCRIPTS (4 entries)
  {
    code: "cpc_cold_call_opener",
    title: "CPC cold call opener",
    category: "cold_outreach",
    visible_to_roles: ["cpc"],
    content_type: "script",
    short_description: "Opening line for CPC outbound calling",
    full_content: "Hi, am I speaking to [Name]? My name is [CPC Name] from Marketing iO in Polokwane. The reason I'm calling — we help local businesses become more findable online. Quick question to see if there's any reason to send our team to come see you: when someone in your area searches Google for [their business type], does your business show up?",
    usage_notes: "Lead with a question, not a pitch. The Google search question is disarming — most will say 'I'm not sure' or 'No'. That's your entry point."
  },
  {
    code: "cpc_7_criteria_qualification",
    title: "The 7-criteria qualification script",
    category: "discovery",
    visible_to_roles: ["cpc", "admin"],
    content_type: "framework",
    short_description: "Structured qualification to separate hot leads from duds",
    full_content: "'Thanks for taking my call. Let me ask you a few quick questions just to make sure we're a fit before I take more of your time.'\n\n1. How long has your business been operating? (Need ≥ 6 months)\n2. Are you the owner / decision-maker, or is there someone else I should be speaking to? (Need decision-maker)\n3. What does your current online presence look like — website, social media? (Identify gap)\n4. Are you currently working with any marketing agency? (Need No)\n5. Are you open to a 20-minute visit from one of our agents this week? (Need Yes)\n\nPLUS 2 MORE:\n6. Is your business CIPC-registered? (Need Yes)\n7. Are you in financial stability? (Need Yes — phrase tactfully)",
    usage_notes: "Log ALL 7 criteria in CRM. Only proceed to field visit if ALL 7 are Yes. If any is No, disqualify politely and move on. No exceptions."
  },
  {
    code: "cpc_existing_client_upsell",
    title: "Existing client upsell call",
    category: "upsell",
    visible_to_roles: ["cpc"],
    content_type: "script",
    short_description: "Call existing clients to introduce add-on services",
    full_content: "Hi [Name], it's [CPC Name] from Marketing iO. Quick check-in — your [current package] has been live for [X months]. Don't want to keep you long, but I noticed [observation about their performance OR upcoming opportunity]. Have you thought about [add-on suggestion] for your business?\n\nPIVOT THE ADD-ON BASED ON SITUATION:\n• Lots of repeat customer questions → AI Chatbot or WhatsApp Automation\n• Good customer database → Email Newsletter or SMS Marketing\n• Struggling with reviews → Reputation Management\n• Need more reach → Paid Ads Management or Short Form Video",
    usage_notes: "DO NOT cold-pitch add-ons. Reference their actual performance or an observed need. Keep call to 5 minutes max. If interested, schedule a follow-up with the Head of Tech or Admin."
  },
  {
    code: "cpc_disqualification_polite",
    title: "Polite disqualification script",
    category: "closing",
    visible_to_roles: ["cpc"],
    content_type: "script",
    short_description: "Professional way to end conversation with poor fit",
    full_content: "Thanks for being honest with me. Based on what you've shared, Marketing iO might not be the right fit right now. If anything changes — you start your business, you scale up, or you change direction — just keep us in mind. Have a good day.",
    usage_notes: "Use when a prospect fails 2+ criteria or is clearly not ready. End on good terms. You never know — they might refer someone or become a client in 12 months."
  },
  // ADMIN SCRIPTS (3 entries)
  {
    code: "admin_welcome_call",
    title: "Welcome call template — within 24h of contract signed",
    category: "follow_up",
    visible_to_roles: ["admin", "founder"],
    content_type: "framework",
    short_description: "First call with new client to set onboarding expectations",
    full_content: "'Hi [Client Name], this is [Admin Name] from Marketing iO. Congratulations on signing — I wanted to be the first to welcome you! I'll be your main point of contact during onboarding.\n\nQuick overview of what happens next:\n• You'll receive a welcome pack by tomorrow (contract copy, invoices, next steps)\n• We'll send you our onboarding form — please return within 3 days so we can start planning\n• I'll schedule your onboarding call with the team for [day/time]\n\nDo you have any questions right now? Otherwise, I'll send that welcome pack in the next 30 minutes.'",
    usage_notes: "Warm, professional tone. Set clear expectations. Give them 3 days to return form — no longer. Document all details in CRM."
  },
  {
    code: "admin_failed_debit_followup",
    title: "Failed debit follow-up script",
    category: "follow_up",
    visible_to_roles: ["admin"],
    content_type: "script",
    short_description: "Handle payment processing failures professionally",
    full_content: "Hi [Name], I'm just calling to let you know your monthly debit didn't go through this morning. This happens sometimes — could be insufficient funds or a bank hold. We'll automatically retry on [retry date]. Is there anything I should know on your side, or should we just let the retry run?",
    usage_notes: "Always call same day as failure. Be matter-of-fact, not accusatory. Give them the retry date. If they say funds are an issue, offer a 2-day extension but document in CRM."
  },
  {
    code: "admin_renewal_call",
    title: "Renewal conversation — month 11 of contract",
    category: "follow_up",
    visible_to_roles: ["admin", "founder"],
    content_type: "framework",
    short_description: "Proactive renewal conversation to retain clients",
    full_content: "'Hi [Name], I wanted to touch base before your contract comes up for renewal next month. How's everything been going with your [package] so far?'\n\nIF POSITIVE:\n'That's great to hear. Would you like to continue with the same package, or would you like to explore adding anything on?'\n\nIF NEUTRAL:\n'I understand. Let me get feedback from the team and call you back in 2 days with some suggestions to improve things.'\n\nIF NEGATIVE:\n'I appreciate your honesty. Let me schedule a call with our head of tech to troubleshoot and see what we can do to turn this around.'",
    usage_notes: "Call in month 11, not month 12. Document outcome in CRM. If they want to cancel, escalate to Founder. If they want to continue, process renewal by month 13 go-live date."
  },
  // DAILY ROUTINES (3 entries)
  {
    code: "field_agent_daily_routine",
    title: "Field Agent daily routine (8am – 5pm)",
    category: "daily_routine",
    visible_to_roles: ["field_agent"],
    content_type: "checklist",
    short_description: "Hour-by-hour schedule and daily KPIs",
    full_content: "8:00-8:30 — Pipeline review in CRM\n□ Review assigned leads and callbacks\n□ Check today's priorities\n□ Prepare for first visit\n\n8:30-9:00 — WhatsApp catch-up\n□ Respond to messages from yesterday evening\n□ Send 2 callback reminders\n\n9:00-12:00 — Field block 1\n□ 3 discovery visits OR 8 prospect touchpoints\n□ Log activity in CRM in real-time\n\n12:00-13:00 — Lunch + admin\n□ Update CRM with all morning notes\n□ Log all interactions\n\n13:00-16:30 — Field block 2\n□ Follow-ups and callback visits\n□ Proposal presentations\n□ Walk-in prospecting\n\n16:30-17:00 — End-of-day close\n□ Make 2 final callbacks\n□ Update CRM with all activity\n□ Set tomorrow's priorities\n□ Confirm daily targets met (3 visits OR 8 touches, all logged by 17:00)\n\nDIARY DISCIPLINE:\nAll CRM entries by 17:00. All client/prospect messages answered within 4 business hours. No working after hours unless express approval.",
    usage_notes: "This is non-negotiable. Consistency is how you hit monthly targets. If you're behind on pipeline by mid-day, increase field hours."
  },
  {
    code: "cpc_daily_routine",
    title: "CPC daily routine",
    category: "daily_routine",
    visible_to_roles: ["cpc"],
    content_type: "checklist",
    short_description: "Daily schedule for CPC outbound calling",
    full_content: "8:00-8:30 — Morning prep\n□ Review CRM lead list (today's callback list)\n□ Check voicemail and WhatsApp\n□ Prepare 3-5 opening questions\n\n8:30-12:00 — Call block 1\n□ 30 outbound calls to new prospects (cold calls)\n□ Log all outcomes immediately (interested, not interested, callback time, disqualified)\n□ Aim for 3-5 qualified leads per day\n\n12:00-13:00 — Lunch\n\n13:00-16:00 — Call block 2\n□ 20 callback calls to hot prospects\n□ Answer inbound calls from field agents\n□ Log all outcomes\n□ Prepare brief notes for field visit scheduling\n\n16:00-16:30 — Handoff prep\n□ Email field agent list of hot leads for tomorrow's visits\n□ Update CRM with all pipeline moves\n□ Set tomorrow's callback list\n\nDIARY DISCIPLINE:\nEvery call logged immediately. No exceptions. 50 total touches per day minimum. Daily KPI tracking: ≥30 qualified leads per month.",
    usage_notes: "Call volume drives pipeline. Stay consistent with block times. If you're below target by mid-month, increase daily call volume."
  },
  {
    code: "admin_daily_routine",
    title: "Admin daily routine",
    category: "daily_routine",
    visible_to_roles: ["admin"],
    content_type: "checklist",
    short_description: "Daily operations checklist",
    full_content: "8:00-8:30 — Email & message triage\n□ Read all overnight emails\n□ Answer urgent client messages\n□ Check CRM for new deals closed yesterday\n\n8:30-9:30 — Contract & invoice processing\n□ Generate contracts for all deals closed yesterday\n□ Issue setup invoices\n□ Send contracts + invoices to clients\n□ Update contract status in CRM\n\n9:30-10:30 — Onboarding tracking\n□ Review all onboarding clients in each phase\n□ Send reminders for outstanding forms\n□ Schedule onboarding calls\n□ Follow up with failed debit orders\n\n10:30-11:30 — Team support\n□ Answer field agent / CPC questions\n□ Troubleshoot client issues\n□ Escalate critical issues to founder\n\n11:30-12:30 — Lunch\n\n12:30-15:00 — Client operations\n□ Process payments\n□ Send monthly reports\n□ Handle churn / cancellations\n□ Log client activity in CRM\n\n15:00-16:00 — Deliverables & handoff\n□ Review deliverable statuses\n□ Assign new deliverables to teams\n□ Confirm all SLAs are on track\n\n16:00-16:30 — End-of-day close\n□ Update all CRM records\n□ Prepare tomorrow's priority list\n□ Send summary email to founder if critical issues\n\nKEY METRICS:\n• Contracts sent same day as deal close (target: 100%)\n• Invoices issued same day (target: 100%)\n• Client response time: 4 business hours max\n• Forms returned within 3 days (target: 90%)",
    usage_notes: "Admin is the spine of the operation. Delays in your work cascade to everyone. Automate where possible, but never skip manual follow-ups."
  }
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'founder') {
      return Response.json({ error: 'Only founder can seed playbooks' }, { status: 403 });
    }

    // Clear existing playbooks
    const existing = await base44.asServiceRole.entities.Playbook.list();
    for (const pb of existing) {
      await base44.asServiceRole.entities.Playbook.delete(pb.id);
    }

    // Seed all playbooks
    const created = await base44.asServiceRole.entities.Playbook.bulkCreate(PLAYBOOKS);

    return Response.json({
      success: true,
      message: `Seeded ${created.length} playbooks`,
      count: created.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});