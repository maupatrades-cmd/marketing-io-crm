import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HIGH_REVENUE = ['150k_to_500k', '500k_plus'];
const MID_REVENUE = ['50k_to_150k'];
const HIGH_BUDGET = ['3000_to_7000', '7000_plus'];
const MID_BUDGET = ['1500_to_3000'];
const HIGH_URGENCY = ['yesterday', 'within_1_month'];

function pickScore(client: any): string {
  const completedSteps = client.signup_completed_steps || 1;
  if (completedSteps < 2) return 'unqualified';

  const highRev = HIGH_REVENUE.includes(client.monthly_revenue_range);
  const midRev = MID_REVENUE.includes(client.monthly_revenue_range);
  const highBudget = HIGH_BUDGET.includes(client.monthly_marketing_budget);
  const midBudget = MID_BUDGET.includes(client.monthly_marketing_budget);
  const highUrg = HIGH_URGENCY.includes(client.urgency_level);
  const wantsCall = !!client.wants_consultation_call;

  if (highRev && highBudget && highUrg && wantsCall) return 'hot';
  if ((highRev || midRev) && (highBudget || midBudget)) return 'warm';
  if (completedSteps >= 5) return 'nurture';
  return 'cold';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { client_id } = await req.json();

  if (!client_id) {
    return Response.json({ error: 'client_id required' }, { status: 400 });
  }

  let client: any = null;
  try {
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    client = Array.isArray(clients) ? clients[0] : clients;
  } catch (err) {
    console.error('[calculate-lead-score] client lookup failed:', err);
    return Response.json({ error: 'client_lookup_failed' }, { status: 500 });
  }

  if (!client) {
    return Response.json({ error: 'client_not_found' }, { status: 404 });
  }

  const score = pickScore(client);
  const calculatedAt = new Date().toISOString();

  try {
    await base44.asServiceRole.entities.Client.update(client.id, {
      lead_score: score,
      lead_score_calculated_at: calculatedAt
    });
  } catch (err) {
    console.error('[calculate-lead-score] client update failed:', err);
    return Response.json({ error: 'client_update_failed' }, { status: 500 });
  }

  return Response.json({
    success: true,
    client_id: client.id,
    lead_score: score,
    lead_score_calculated_at: calculatedAt
  });
});
