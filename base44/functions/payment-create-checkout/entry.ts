import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

// PayFast URL-encoding: encodeURIComponent then convert %20 to +.
function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function generatePayfastSignature(data: Record<string, string>, passphrase: string): string {
  // 1. Sort keys alphabetically.
  const sortedKeys = Object.keys(data).sort();

  // 2. Build query string with PayFast-style URL encoding.
  const queryString = sortedKeys
    .filter(key => data[key] !== undefined && data[key] !== null && data[key] !== '')
    .map(key => `${key}=${pfEncode(String(data[key]).trim())}`)
    .join('&');

  // 3. Append passphrase if set.
  const stringToHash = passphrase
    ? `${queryString}&passphrase=${pfEncode(passphrase)}`
    : queryString;

  // 4. MD5 hex, lowercase.
  return createHash('md5').update(stringToHash).digest('hex');
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { invoice_id } = body;
  if (!invoice_id) {
    return Response.json({ error: 'invoice_id required' }, { status: 400 });
  }

  // Read PayFast secrets — EXACT names as stored in Base44 (no underscores).
  const merchantId = Deno.env.get('MerchantID');
  const merchantKey = Deno.env.get('Merchantkey');
  const passphrase = Deno.env.get('SaltPassphrase') || '';
  const sandboxUrlValue = Deno.env.get('SandboxURL') || '';

  if (!merchantId || !merchantKey) {
    console.error('[payment-create-checkout] Missing PayFast credentials');
    return Response.json({ error: 'Payment gateway not configured' }, { status: 500 });
  }

  const isSandbox = sandboxUrlValue.toLowerCase() === 'true' || sandboxUrlValue.includes('sandbox');
  const PAYFAST_PROCESS_URL = isSandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';

  try {
    // Fetch invoice.
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id });
    const invoice = Array.isArray(invoices) ? invoices[0] : invoices;
    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoiceTotal = Number(invoice.total ?? invoice.total_amount ?? invoice.amount);
    if (!invoiceTotal || invoiceTotal <= 0) {
      return Response.json({ error: 'Invalid invoice total' }, { status: 400 });
    }

    if (!['issued', 'pending_payment', 'sent'].includes(invoice.status)) {
      return Response.json({ error: `Invoice status is ${invoice.status}, cannot pay` }, { status: 400 });
    }

    // Fetch client.
    const clients = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
    const client = Array.isArray(clients) ? clients[0] : clients;
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    const m_payment_id = crypto.randomUUID();

    // Normalise invoice type → valid Payment.type enum. Invoice.invoice_type
    // accepts ~13 values (monthly_retainer, add_on_monthly, per_sms, etc.) but
    // Payment.type only accepts 6. Older test invoices default to
    // 'monthly_retainer', which would reject Payment.create with 500.
    // Fall back to 'setup_fee' for any unmapped value.
    const PAYMENT_TYPE_ENUM = new Set([
      'setup_fee', 'addon_setup', 'once_off_product',
      'combined', 'monthly_subscription', 'recurring_addon'
    ]);
    const INVOICE_TO_PAYMENT_TYPE: Record<string, string> = {
      // Direct passthroughs (already valid).
      setup_fee: 'setup_fee',
      addon_setup: 'addon_setup',
      once_off_product: 'once_off_product',
      combined: 'combined',
      monthly_subscription: 'monthly_subscription',
      recurring_addon: 'recurring_addon',
      // Legacy / Invoice-only values mapped to the closest Payment value.
      add_on_setup: 'addon_setup',
      add_on_monthly: 'recurring_addon',
      monthly_retainer: 'monthly_subscription',
      once_off: 'once_off_product',
      // Anything else (per_sms, cancellation_fee, acceleration_amount) falls
      // through to setup_fee below — they shouldn't be PayFast-payable anyway.
    };
    const rawType = String(invoice.type || invoice.invoice_type || 'setup_fee');
    const invoiceType = INVOICE_TO_PAYMENT_TYPE[rawType]
      || (PAYMENT_TYPE_ENUM.has(rawType) ? rawType : 'setup_fee');

    // Create Payment record. Snapshot closer + lead-source attribution from
    // the invoice so the commission engine has frozen identifiers even if the
    // invoice is later edited. Build payload conditionally so we don't pass
    // `null` for typed string fields — some Base44 schema validators reject
    // that and surface as a 500 from the catch block.
    const paymentPayload: Record<string, any> = {
      client_id: invoice.client_id,
      client_name: client.business_name || '',
      invoice_id: invoice.id,
      amount: invoiceTotal,
      currency: 'ZAR',
      type: invoiceType,
      status: 'pending',
      gateway: 'payfast',
      gateway_reference: m_payment_id,
      commission_calculated: false
    };
    if (invoice.closer_id) paymentPayload.closer_id = invoice.closer_id;
    if (invoice.lead_source_user_id) paymentPayload.lead_source_user_id = invoice.lead_source_user_id;

    const payment = await base44.asServiceRole.entities.Payment.create(paymentPayload);

    // Move invoice to pending_payment + link payment.
    await base44.asServiceRole.entities.Invoice.update(invoice.id, {
      status: 'pending_payment',
      payment_id: payment.id
    });

    // Buyer name split.
    const fullName = client.contact_person || '';
    const nameParts = fullName.split(' ').filter(Boolean);
    const nameFirst = nameParts[0] || '';
    const nameLast = nameParts.slice(1).join(' ') || '';

    // Item description from line items (max 255 chars).
    const itemDescription = ((invoice.line_items || []) as any[])
      .map(li => `${li.product_name || li.description || 'Item'} x${li.quantity || 1}`)
      .join(', ')
      .slice(0, 255);

    const itemName = `Invoice ${invoice.invoice_number || invoice.id} - ${client.business_name}`.slice(0, 100);

    const payfastData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `https://app.marketingio.co.za/payment-success?ref=${m_payment_id}`,
      cancel_url: `https://app.marketingio.co.za/payment-cancelled?ref=${m_payment_id}`,
      notify_url: `https://app.marketingio.co.za/api/payment-webhook-payfast`,
      name_first: nameFirst,
      name_last: nameLast,
      email_address: client.email || '',
      m_payment_id,
      amount: invoiceTotal.toFixed(2),
      item_name: itemName,
      item_description: itemDescription || itemName,
      custom_str1: invoice.client_id,
      custom_str2: invoice.id
    };

    if (client.phone) {
      payfastData.cell_number = String(client.phone);
    }

    const signature = generatePayfastSignature(payfastData, passphrase);
    payfastData.signature = signature;

    const queryString = Object.entries(payfastData)
      .map(([k, v]) => `${k}=${pfEncode(String(v))}`)
      .join('&');

    const checkoutUrl = `${PAYFAST_PROCESS_URL}?${queryString}`;

    return Response.json({
      success: true,
      checkout_url: checkoutUrl,
      payment_id: payment.id,
      m_payment_id,
      sandbox: isSandbox
    });
  } catch (err: any) {
    console.error('[payment-create-checkout] Error:', err);
    return Response.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
});
