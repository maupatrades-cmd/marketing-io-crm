import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'owner') {
      return Response.json({ error: 'Forbidden: Owner only' }, { status: 403 });
    }

    const playbooks = [
      {
        code: "cold_call_open", title: "5-Step Cold Call — Open", category: "cold_outreach", content_type: "script",
        short_description: "Open with curiosity, not a pitch",
        full_content: `Step 1 — OPEN with curiosity, not a pitch\n\n"Hi, is this the owner? I'm [Name] from Marketing iO — quick question: when someone in [City] searches for [their type of business] on Google, do you come up?"`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "cold_call_qualify", title: "5-Step Cold Call — Qualify", category: "cold_outreach", content_type: "script",
        short_description: "Qualify the pain after opening",
        full_content: `Step 2 — QUALIFY the pain\n\nLet them respond. If they say no or aren't sure:\n\n"That's exactly what we help with — most businesses in Limpopo are invisible online and don't even know it."`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "cold_call_present", title: "5-Step Cold Call — Present Value", category: "cold_outreach", content_type: "script",
        short_description: "Present value, not features",
        full_content: `Step 3 — PRESENT the value (not features)\n\n"We set up your full online presence — website, social media, ads — and we do it all for one low monthly fee."`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "cold_call_handle", title: "5-Step Cold Call — Handle Objections", category: "cold_outreach", content_type: "script",
        short_description: "Feel/Felt/Found framework",
        full_content: `Step 4 — HANDLE objections with FEEL/FELT/FOUND\n\n"I understand — a lot of our clients felt exactly the same way before they started."`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "cold_call_close", title: "5-Step Cold Call — Close for Meeting", category: "cold_outreach", content_type: "script",
        short_description: "Close for the meeting, not the sale",
        full_content: `Step 5 — CLOSE for the MEETING, not the sale\n\n"Are you available Tuesday or Wednesday for a 20-minute visit?"`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "obj_no_money", title: "Objection: No money for marketing", category: "objection_handler", content_type: "script",
        short_description: "Handle 'I don't have budget' objection",
        related_objection: "I don't have money for marketing",
        full_content: `That's exactly why you need it. Businesses invisible online lose customers every day.\n\nOur starter package is less than R600/month — less than a tank of petrol.\n\n**Follow-up:** "If it brings you just 2 extra customers a month, does it pay for itself?"`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "obj_facebook", title: "Objection: Already on Facebook", category: "objection_handler", content_type: "script",
        short_description: "Handle 'I'm already on Facebook' objection",
        related_objection: "I'm already on Facebook",
        full_content: `Having a Facebook page is a start — but is it generating leads?\n\nWe manage the page, run paid ads, and track every result.\n\n**Follow-up:** "How many leads came from your page last month — do you know?"`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "obj_think_about", title: "Objection: I'll think about it", category: "objection_handler", content_type: "script",
        short_description: "Handle stalling / thinking about it",
        related_objection: "I'll think about it",
        full_content: `Of course — what specific concerns can I address now?\n\nMost clients say the biggest concern was results — let me show you what we did for a similar business.\n\n**Follow-up:** "What would need to be true for you to feel confident moving forward?"`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "obj_tried_before", title: "Objection: Tried marketing before", category: "objection_handler", content_type: "script",
        short_description: "Handle bad past experiences",
        related_objection: "I tried marketing before and it didn't work",
        full_content: `That's common with agencies that disappear. We're based here in Polokwane — you can call me, visit me, or WhatsApp me any time.\n\n**Follow-up:** "What specifically didn't work? Help me understand what you tried so I can show you exactly what we'd do differently."`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "obj_diy", title: "Objection: We'll do it ourselves", category: "objection_handler", content_type: "script",
        short_description: "Handle DIY marketing objection",
        related_objection: "We'll do it ourselves",
        full_content: `Absolutely — and if you find you don't have time to stay consistent, we're here.\n\nCan I at least show you a free audit of your current online presence?\n\n**Follow-up:** "How many hours a week do you currently spend on marketing?"`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "close_trial", title: "Trial Close Framework", category: "closing", content_type: "framework",
        short_description: "Assume interest, choose between packages",
        full_content: `**Trial Close:**\n"Based on what we've discussed, does Ignite or Accelerate make more sense for [business_name]?"\n\n**Assumed Close:**\n"Let me get the contract started — what's your business registration number?"\n\n**Urgency Close:**\n"We have 2 setup slots left this month. If we get the deposit by Friday, you're live by next month-end."\n\n**Risk-Reversal Close:**\n"If you're not getting results in month 1, we'll keep working at no extra cost until you are."`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      },
      {
        code: "discovery_7_questions", title: "7 Discovery Questions", category: "discovery", content_type: "checklist",
        short_description: "The 7 questions to always ask on a discovery visit",
        full_content: `**Ask these 7 questions on every discovery visit:**\n\n1. How long has [business_name] been operating?\n2. Where do most of your customers come from today?\n3. What's the biggest challenge in growing [business_name] right now?\n4. How are people finding you online today — are they?\n5. What does success look like for the next 6 months?\n6. What's your monthly marketing budget right now?\n7. If we got you 5 quality leads a week starting next month, what would that mean for the business?`,
        visible_to_roles: ["field_agent", "cpc", "admin"], is_favorite_eligible: true
      }
    ];

    // Check for existing playbooks
    const existing = await base44.asServiceRole.entities.Playbook.filter({});
    if (existing && Array.isArray(existing) && existing.length > 0) {
      return Response.json({ 
        message: "Playbooks already seeded",
        count: existing.length
      });
    }

    // Create all playbooks
    const created = await base44.asServiceRole.entities.Playbook.bulkCreate(playbooks);
    
    return Response.json({ 
      message: "Playbooks seeded successfully",
      count: Array.isArray(created) ? created.length : 1
    });
  } catch (error) {
    console.error('[seedPlaybooks] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});