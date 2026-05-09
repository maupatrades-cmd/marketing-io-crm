import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

// PayFast checkout init for an existing invoice.
// Accepts: { invoice_id, session_token }
// Returns: { fields, process_url, m_payment_id }

const FIELD_ORDER = [
  'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
  'name_first', 'name_last', 'email_address', 'cell_number',
  'm_payment_id', 'amount', 'item_name', 'item_description',
  'custom_str1', 'custom_str2', 'custom_str3',
];

const OPTIONAL_FIELDS = new Set([
  'name_first', 'name_last', 'email_address', 'cell_number',
  'item_description', 'custom_str1', 'custom_str2', 'custom_str3',
]);

function payfastUrlEncode(value) {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E');
}

function buildSignedSet(fields, passphrase) {
  const queryString = FIELD_ORDER
    .filter((key) => {
      const v = fields[key];
      return v !== undefined && v !== null && String(v).trim() !== '';
    })
    .map((key) => `${key}=${payfastUrlEncode(String(fields[key]).trim())}`)
    .join('&');
  const stringToHash = `${queryString}&passphrase=${payfastUrlEncode(passphrase)}`;
  const signature = createHash('md5').update(stringToHash).digest('hex');
  return { queryString, signature };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomToken(len) {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, b => ALPHABET[b % ALPHABET.length]).join('');
}

function generateMPaymentId() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  return `MIO-${stamp}-${randomToken(6)}`;
}

function appendRef(baseUrl, ref) {
  if (!baseUrl) return '';
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}ref=${encodeURIComponent(ref)}`;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }

  const { invoice_id, session_token } = body || {};
  if (!invoice_id) return Response.json({ error: 'invoice_id required' }, { status: 400 });
  if (!session_token) return Response.json({ error: 'session_token required' }, { status: 401 });

  // Verify secrets
  const merchantId  = Deno.env.get('PAYFAST_MERCHANT_ID');
  const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY');
  const passphrase  = Deno.env.get('PAYFAST_PASSPHRASE');
  const returnUrl   = Deno.env.get('PAYFAST_RETURN_URL');
  const cancelUrl   = Deno.env.get('PAYFAST_CANCEL_URL');
  const notifyUrl   = Deno.env.get('PAYFAST_NOTIFY_URL');
  const processUrl  = Deno.env.get('PAYFAST_PROCESS_URL');

  if (!merchantId || !merchantKey || !passphrase || !returnUrl || !cancelUrl || !notifyUrl || !processUrl) {
    return Response.json({ error: 'PayFast not configured' }, { status: 500 });
  }

  // Authenticate session
  let user = null;
  try {
    const appUsers = await base44.asServiceRole.entities.AppUser.filter({ session_token });
    user = Array.isArray(appUsers) ? appUsers[0] : appUsers;
  } catch (e) {}
  if (!user) {
    try {
      const legacy = await base44.asServiceRole.entities.User.filter({ session_token });
      user = Array.isArray(legacy) ? legacy[0] : legacy;
    } catch (e) {}
  }
  if (!user || !user.session_expires_at || new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Session expired or invalid' }, { status: 401 });
  }

  // Fetch invoice
  const invResult = await base44.asServiceRole.entities.Invoice.filter({ id: invoice_id });
  const invoice = Array.isArray(invResult) ? invResult[0] : invResult;
  if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

  // Fetch client and verify ownership
  const clientResult = await base44.asServiceRole.entities.Client.filter({ id: invoice.client_id });
  const client = Array.isArray(clientResult) ? clientResult[0] : clientResult;
  if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

  // Security check: ensure the session user owns this client
  const ownsClient =
    client.client_user_id === user.id ||
    client.app_user_id === user.id ||
    (client.email && client.email.toLowerCase() === (user.email || '').toLowerCase());

  if (!ownsClient) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const amount = Number(invoice.total_amount || invoice.total || invoice.amount || 0);
  if (amount <= 0) return Response.json({ error: 'Invoice has no payable amount' }, { status: 400 });

  // Format amount as X.XX
  const amountStr = amount.toFixed(2);
  const invoiceNumber = invoice.invoice_number || invoice.id.slice(0, 8);
  const itemName = `Invoice ${invoiceNumber}`;

  // Split contact_person into first/last
  const fullName = String(client.contact_person || '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const nameFirst = parts[0] || '';
  const nameLast  = parts.length > 1 ? parts.slice(1).join(' ') : '';

  const mPaymentId = generateMPaymentId();

  const returnUrlWithRef = appendRef(returnUrl, mPaymentId);
  const cancelUrlWithRef = appendRef(cancelUrl, mPaymentId);

  const candidate = {
    merchant_id:      merchantId,
    merchant_key:     merchantKey,
    return_url:       returnUrlWithRef,
    cancel_url:       cancelUrlWithRef,
    notify_url:       notifyUrl,
    name_first:       nameFirst,
    name_last:        nameLast,
    email_address:    client.email || '',
    cell_number:      '',
    m_payment_id:     mPaymentId,
    amount:           amountStr,
    item_name:        itemName,
    item_description: `Payment for ${itemName} - Marketing iO`,
    custom_str1:      'invoice',       // marks this as an invoice payment in ITN
    custom_str2:      client.id,       // client_id for ITN attribution
    custom_str3:      invoice.id,      // invoice_id so ITN can mark it paid
  };

  const fields = {};
  for (const key of FIELD_ORDER) {
    const v = candidate[key];
    if (v === undefined || v === null) continue;
    if (OPTIONAL_FIELDS.has(key) && String(v).trim() === '') continue;
    fields[key] = String(v).trim();
  }

  const { queryString, signature } = buildSignedSet(fields, passphrase);
  fields.signature = signature;

  console.log('[payfast-invoice-init] fields to POST:', JSON.stringify(fields, null, 2));
  console.log('[payfast-invoice-init] queryString for signature:', queryString);

  const signedPayloadHash = createHash('sha256').update(queryString).digest('hex');

  // Create pending Payment row
  try {
    await base44.asServiceRole.entities.Payment.create({
      client_id:           client.id,
      client_name:         client.business_name || '',
      invoice_id:          invoice.id,
      amount,
      currency:            'ZAR',
      type:                'monthly_subscription',
      status:              'pending',
      gateway:             'payfast',
      gateway_reference:   mPaymentId,
      signed_payload_hash: signedPayloadHash,
      commission_calculated: false,
    });
  } catch (err) {
    console.error('[payfast-invoice-init] Payment.create failed:', err?.message);
    return Response.json({ error: 'Could not create pending payment. Please try again.' }, { status: 500 });
  }

  return Response.json({ fields, process_url: processUrl, m_payment_id: mPaymentId });
});