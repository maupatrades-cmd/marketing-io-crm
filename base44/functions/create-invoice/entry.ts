import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Minimal product price lookup. Mirrors src/data/ProductCatalog.js — keep in
// sync when prices change. Used only when the caller doesn't pass an explicit
// `amount` per line item.
const PRODUCT_PRICES: Record<string, { name: string; setup_price: number; monthly_price: number }> = {
  ignite:        { name: 'Ignite',        setup_price: 3980,  monthly_price: 490  },
  accelerate:    { name: 'Accelerate',    setup_price: 6500,  monthly_price: 890  },
  dominate:      { name: 'Dominate',      setup_price: 9800,  monthly_price: 1490 },
  street_pulse:  { name: 'Street Pulse',  setup_price: 700,   monthly_price: 3700 },
  township_pulse:{ name: 'Township Pulse',setup_price: 700,   monthly_price: 3700 }
};

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const {
    client_id,
    line_items,
    type,
    due_date,
    contract_id,
    deal_id,
    closer_id,
    lead_source_user_id,
    lead_source_type,
    send_email
  } = body || {};

  if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 });
  if (!Array.isArray(line_items) || line_items.length === 0) {
    return Response.json({ error: 'line_items array required' }, { status: 400 });
  }
  if (!type) return Response.json({ error: 'type required' }, { status: 400 });

  // Resolve client.
  const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
  const client = Array.isArray(clients) ? clients[0] : clients;
  if (!client) {
    return Response.json({ error: 'Client not found' }, { status: 404 });
  }

  // Orphan-handling: every invoice must have a closer_id so the commission
  // engine can attribute it. If the caller didn't supply one, fall back to
  // the owner User. This keeps direct/inbound/self-signup deals attributable.
  let resolvedCloserId = closer_id || null;
  if (!resolvedCloserId) {
    try {
      const owners = await base44.asServiceRole.entities.User.filter({ role: 'owner' });
      const owner = Array.isArray(owners) ? owners[0] : owners;
      if (owner?.id) {
        resolvedCloserId = owner.id;
        console.log('[create-invoice] orphan invoice auto-assigned to owner', { client_id, owner_id: owner.id });
      }
    } catch (err) {
      console.error('[create-invoice] owner lookup failed:', err);
    }
  }

  // Build line items with resolved prices.
  const resolved = line_items.map((li: any) => {
    const qty = Math.max(1, Number(li.quantity || 1));
    let amount = Number(li.amount);
    let productName = li.product_name || '';
    if ((!amount || amount <= 0) && li.product_id && PRODUCT_PRICES[li.product_id]) {
      amount = PRODUCT_PRICES[li.product_id].setup_price;
      productName = productName || PRODUCT_PRICES[li.product_id].name;
    }
    return {
      product_id: li.product_id || '',
      product_name: productName,
      description: li.description || productName,
      amount: Number(amount || 0),
      quantity: qty
    };
  });

  const subtotal = resolved.reduce((sum, li) => sum + (li.amount * li.quantity), 0);
  const total = subtotal; // V1: no VAT.

  if (total <= 0) {
    return Response.json({ error: 'Invoice total must be positive' }, { status: 400 });
  }

  // Generate invoice number INV-YYYY-NNNN.
  const year = new Date().getFullYear();
  let counter = 1;
  try {
    const all = await base44.asServiceRole.entities.Invoice.filter({}, '-created_date', 1000);
    const list = Array.isArray(all) ? all : [];
    const prefix = `INV-${year}-`;
    const used = list
      .map((inv: any) => inv.invoice_number || '')
      .filter((n: string) => n.startsWith(prefix))
      .map((n: string) => parseInt(n.slice(prefix.length), 10))
      .filter((n: number) => !isNaN(n));
    counter = (used.length > 0 ? Math.max(...used) : 0) + 1;
  } catch (err) {
    console.error('[create-invoice] counter lookup failed, defaulting to 1:', err);
  }
  const invoice_number = `INV-${year}-${pad(counter, 4)}`;

  const nowIso = new Date().toISOString();

  const invoice = await base44.asServiceRole.entities.Invoice.create({
    invoice_number,
    client_id,
    client_name: client.business_name || '',
    invoice_type: type,
    type,
    description: resolved.map(li => li.product_name).filter(Boolean).join(', ').slice(0, 255),
    line_items: resolved,
    amount: total,
    subtotal,
    total_amount: total,
    total,
    currency: 'ZAR',
    vat_amount: 0,
    issue_date: nowIso.slice(0, 10),
    issued_at: nowIso,
    due_date: due_date || null,
    // Invoice.jsonc enum is [draft, sent, paid, overdue, failed, cancelled, partial].
    // 'issued' was historical and not in the enum — every row written before
    // this fix has an out-of-enum status. A backfill (status='issued' →
    // status='sent') must run alongside this change.
    status: 'sent',
    contract_id: contract_id || null,
    deal_id: deal_id || null,
    closer_id: resolvedCloserId,
    lead_source_user_id: lead_source_user_id || null,
    lead_source_type: lead_source_type || 'self_signup'
  });

  if (send_email) {
    base44.functions.invoke('send-invoice-email', { invoice_id: invoice.id })
      .catch((err: any) => console.error('[create-invoice] send-invoice-email failed:', err));
  }

  // Portal activity feed entry — non-blocking, fire-and-forget.
  base44.functions.invoke('log-client-activity', {
    client_id,
    user_id: client.client_user_id || client.app_user_id || '',
    client_name: client.business_name || '',
    title: `Invoice ${invoice_number} issued`,
    body: `R${Number(total).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due${due_date ? ' by ' + due_date : ''}.`,
    icon: 'FileText',
    category: 'info',
    source: 'invoice',
    link: '/client/invoices'
  }).catch((err: any) => {
    console.error('[create-invoice] log-client-activity failed (non-fatal):', err?.message);
  });

  return Response.json({
    success: true,
    invoice_id: invoice.id,
    invoice_number,
    total,
    subtotal
  });
});
