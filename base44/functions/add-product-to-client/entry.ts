import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Upsell WORKSPACE action — add an add-on product to an active client:
//   1. Create a ClientAddOn row (attaches the add-on)
//   2. Create an Invoice via the existing create-invoice function
//      (closer_id = caller → commission attributes correctly on payment)
//   3. (Commission row intentionally NOT created here — see PR notes)
//   4. Create an InteractionNote with the sale note (only if note_text given)
// Base44 has no DB transactions: each step is best-effort and a mid-sequence
// failure returns the partial state honestly — it does not pretend success.
// Access: owner / admin / cpc / field_agent only.

const ALLOWED_ROLES = ['owner', 'admin', 'cpc', 'field_agent'];

// The 12 add-on products addable here — ids match the ClientAddOn.add_on enum
// exactly. Mirrors src/data/ProductCatalog.js — KEEP IN SYNC if prices change.
const ADDON_CATALOG = {
  ai_chatbot:              { name: 'AI Chatbot',                   setup_price: 6500, monthly_price: 350  },
  whatsapp_automation:     { name: 'WhatsApp Business Automation', setup_price: 3500, monthly_price: 200  },
  reputation_management:   { name: 'Reputation Management',        setup_price: 0,    monthly_price: 1800 },
  google_business_profile: { name: 'Google Business Profile',      setup_price: 800,  monthly_price: 0    },
  email_newsletter:        { name: 'Email Newsletter Management',  setup_price: 0,    monthly_price: 900  },
  short_form_video:        { name: 'Short-Form Video Pack',        setup_price: 0,    monthly_price: 1500 },
  sms_marketing:           { name: 'SMS Marketing Campaigns',      setup_price: 500,  monthly_price: 500  },
  marketing_audit:         { name: 'Marketing Audit & Report',     setup_price: 2000, monthly_price: 0    },
  competitor_analysis:     { name: 'Competitor Analysis Report',   setup_price: 1500, monthly_price: 0    },
  ai_content_writing:      { name: 'AI Content Writing Service',   setup_price: 0,    monthly_price: 800  },
  website_maintenance:     { name: 'Website Maintenance Retainer', setup_price: 0,    monthly_price: 550  },
  paid_ads_management:     { name: 'Paid Ads Management',          setup_price: 0,    monthly_price: 0    },
};

function unwrap(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  return [];
}

async function validateActor(base44, token) {
  if (!token) return null;
  try {
    const authRes = await base44.asServiceRole.functions.invoke('auth-me', { token });
    const authData = authRes?.data ?? authRes;
    if (authData?.user) {
      return {
        userId: String(authData.user.id || ''),
        role: String(authData.user.role || 'client'),
        name: String(authData.user.full_name || ''),
        email: String(authData.user.email || ''),
      };
    }
  } catch (err) {
    console.error('[add-product-to-client] auth-me validation failed:', err?.message);
  }
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { token, client_id, product_id, note_text } = body || {};

  const actor = await validateActor(base44, token);
  if (!actor) return Response.json({ error: 'invalid_session' }, { status: 401 });
  if (!ALLOWED_ROLES.includes(actor.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  if (!client_id) return Response.json({ error: 'client_id required' }, { status: 400 });
  if (!product_id) return Response.json({ error: 'product_id required' }, { status: 400 });

  const product = ADDON_CATALOG[product_id];
  if (!product) {
    return Response.json({ error: 'invalid_product', detail: 'Not an Upsell add-on product.' }, { status: 400 });
  }

  // Resolve + validate the client.
  let client = null;
  try {
    client = unwrap(await base44.asServiceRole.entities.Client.filter({ id: client_id }))[0] || null;
  } catch (err) {
    console.error('[add-product-to-client] client lookup failed:', err);
    return Response.json({ error: 'client_lookup_failed' }, { status: 500 });
  }
  if (!client) return Response.json({ error: 'client_not_found' }, { status: 400 });
  if (client.lifecycle_stage !== 'active' && client.status !== 'active') {
    return Response.json({ error: 'client_not_active', detail: 'Products can only be added to active clients.' }, { status: 400 });
  }

  // Idempotency — does the client already own this add-on (non-cancelled)?
  try {
    const existing = unwrap(await base44.asServiceRole.entities.ClientAddOn.filter({ client_id, add_on: product_id }));
    if (existing.some(a => a.status !== 'cancelled')) {
      return Response.json({
        error: 'already_owned',
        detail: `${client.business_name || 'This client'} already has ${product.name}.`,
      }, { status: 400 });
    }
  } catch (err) {
    console.error('[add-product-to-client] addon dup check failed:', err);
    return Response.json({ error: 'addon_check_failed' }, { status: 500 });
  }

  // Invoice amount: setup fee if there is one, else first month. Add-ons with
  // no fixed price (e.g. paid_ads_management, priced per ad spend) can't be
  // auto-invoiced.
  const useSetup = product.setup_price > 0;
  const invoiceAmount = useSetup ? product.setup_price : product.monthly_price;
  const invoiceType = useSetup ? 'add_on_setup' : 'add_on_monthly';
  if (invoiceAmount <= 0) {
    return Response.json({
      error: 'product_not_priced',
      detail: `${product.name} has no fixed price and cannot be invoiced automatically. Add it manually.`,
    }, { status: 400 });
  }

  const todayDate = new Date().toISOString().slice(0, 10);

  // ── STEP 1: ClientAddOn ──────────────────────────────────────────────────
  let addOnId = null;
  try {
    const addOn = await base44.asServiceRole.entities.ClientAddOn.create({
      client_id,
      client_name: client.business_name || '',
      add_on: product_id,
      setup_fee: product.setup_price,
      monthly_fee: product.monthly_price,
      status: 'setup_pending',
      start_date: todayDate,
      notes: `Added via Upsell workspace by ${actor.name || actor.email || actor.userId}`,
    });
    addOnId = addOn?.id || addOn?.data?.id || null;
  } catch (err) {
    console.error('[add-product-to-client] STEP 1 (ClientAddOn create) FAILED:', err?.message);
    return Response.json({ error: 'addon_create_failed', step: 1, detail: err?.message }, { status: 500 });
  }

  // ── STEP 2: Invoice (via the existing create-invoice function) ───────────
  let invoiceId = null;
  try {
    const invRes = await base44.asServiceRole.functions.invoke('create-invoice', {
      client_id,
      type: invoiceType,
      closer_id: actor.userId,
      send_email: false,
      line_items: [{
        product_id,
        product_name: product.name,
        description: product.name,
        amount: invoiceAmount,
        quantity: 1,
      }],
    });
    const invData = invRes?.data ?? invRes;
    invoiceId = invData?.invoice?.id || invData?.invoice_id || invData?.id || null;
    if (!invoiceId) throw new Error('create-invoice returned no invoice id');
  } catch (err) {
    console.error('[add-product-to-client] STEP 2 (create-invoice) FAILED — ClientAddOn', addOnId, 'is now orphaned, manual cleanup needed:', err?.message);
    return Response.json({
      error: 'invoice_create_failed',
      step: 2,
      detail: err?.message,
      partial_state: { client_addon_id: addOnId },
    }, { status: 500 });
  }

  // ── STEP 3: Commission — intentionally NOT created here. ─────────────────
  // Attribution flows through Invoice.closer_id → calculate-commission, which
  // fires with the correct rate when the invoice is paid. See PR notes.

  // ── STEP 4: InteractionNote (only when a note was written) ───────────────
  let noteId = null;
  let noteError = null;
  if (note_text && String(note_text).trim()) {
    try {
      const note = await base44.asServiceRole.entities.InteractionNote.create({
        client_id,
        content: String(note_text).trim(),
        category: 'closing_note',
        author_name: actor.name || actor.email || 'Staff',
        author_email: actor.email || '',
      });
      noteId = note?.id || note?.data?.id || null;
    } catch (err) {
      // Non-fatal: the sale (add-on + invoice) succeeded; only the note failed.
      console.error('[add-product-to-client] STEP 4 (InteractionNote) FAILED — addon', addOnId, 'invoice', invoiceId, 'succeeded:', err?.message);
      noteError = err?.message || 'note_create_failed';
    }
  }

  return Response.json({
    success: true,
    client_addon_id: addOnId,
    invoice_id: invoiceId,
    commission_id: null,
    note_id: noteId,
    ...(noteError ? { note_error: noteError } : {}),
  });
});
