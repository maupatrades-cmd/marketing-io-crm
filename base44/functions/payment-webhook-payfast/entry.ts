import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';
import { createHash } from 'node:crypto';

const HEAD_EMAIL = 'head@marketingio.co.za';

// PayFast production source IPs (sandbox uses dynamic IPs — V1 logs but does not reject).
const PAYFAST_PROD_IPS = new Set([
  '197.97.145.144', '197.97.145.145',
  '41.74.179.194', '41.74.179.195', '41.74.179.196', '41.74.179.197',
  '41.74.179.200', '41.74.179.201', '41.74.179.203', '41.74.179.204',
  '41.74.179.210', '41.74.179.211'
]);

function pfEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function generatePayfastSignature(data: Record<string, string>, passphrase: string): string {
  const sortedKeys = Object.keys(data).sort();
  const queryString = sortedKeys
    .filter(key => data[key] !== undefined && data[key] !== null && data[key] !== '')
    .map(key => `${key}=${pfEncode(String(data[key]).trim())}`)
    .join('&');
  const stringToHash = passphrase
    ? `${queryString}&passphrase=${pfEncode(passphrase)}`
    : queryString;
  return createHash('md5').update(stringToHash).digest('hex');
}

function clientIpFromRequest(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

async function postFormToValidate(url: string, params: Record<string, string>): Promise<string> {
  const formBody = Object.entries(params)
    .map(([k, v]) => `${k}=${pfEncode(String(v))}`)
    .join('&');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody
  });
  return (await res.text()).trim();
}

async function notifyHead(subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return;
  try {
    await new Resend(apiKey).emails.send({
      from: 'Marketing iO Payments <hello@marketingio.co.za>',
      to: HEAD_EMAIL,
      subject,
      html
    });
  } catch (err) {
    console.error('[payment-webhook-payfast] notifyHead failed:', err);
  }
}

async function processIPN(req: Request, raw: string, sourceIp: string) {
  const base44 = createClientFromRequest(req);

  const sandboxUrlValue = Deno.env.get('SandboxURL') || '';
  const passphrase = Deno.env.get('SaltPassphrase') || '';
  const isSandbox = sandboxUrlValue.toLowerCase() === 'true' || sandboxUrlValue.includes('sandbox');
  const PAYFAST_VALIDATE_URL = isSandbox
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://www.payfast.co.za/eng/query/validate';

  // Parse form-urlencoded body into a flat object.
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) {
    params[k] = v;
  }
  const m_payment_id = params['m_payment_id'] || '';
  const pf_payment_id = params['pf_payment_id'] || '';
  const payment_status = params['payment_status'] || '';
  const amount_gross = params['amount_gross'] || '';
  const receivedSig = params['signature'] || '';

  console.log('[payment-webhook-payfast] IPN received', {
    timestamp: new Date().toISOString(),
    sourceIp,
    m_payment_id,
    pf_payment_id,
    payment_status,
    amount_gross,
    isSandbox
  });

  // Locate Payment record.
  let payment: any = null;
  try {
    const matches = await base44.asServiceRole.entities.Payment.filter({ gateway_reference: m_payment_id });
    payment = Array.isArray(matches) ? matches[0] : matches;
  } catch (err) {
    console.error('[payment-webhook-payfast] payment lookup failed:', err);
  }

  if (!payment) {
    console.error('[payment-webhook-payfast] No Payment row for m_payment_id', m_payment_id);
    await notifyHead(
      `[PAYMENT WEBHOOK] Unknown m_payment_id: ${m_payment_id}`,
      `<p>Received IPN with no matching Payment row.</p><pre>${JSON.stringify(params, null, 2)}</pre><p>Source IP: ${sourceIp}</p>`
    );
    return;
  }

  const failVerification = async (reason: string) => {
    console.error('[payment-webhook-payfast] verification failed:', reason, { m_payment_id, sourceIp });
    try {
      await base44.asServiceRole.entities.Payment.update(payment.id, {
        status: 'failed',
        failed_reason: `IPN verification failed: ${reason}`,
        ipn_payload: params,
        gateway_payment_status: payment_status
      });
    } catch (err) {
      console.error('[payment-webhook-payfast] failed to mark payment failed:', err);
    }
    await notifyHead(
      `[SECURITY] PayFast IPN verification failed: ${reason}`,
      `<p><strong>Reason:</strong> ${reason}</p>
       <p><strong>Source IP:</strong> ${sourceIp}</p>
       <p><strong>m_payment_id:</strong> ${m_payment_id}</p>
       <p><strong>pf_payment_id:</strong> ${pf_payment_id}</p>
       <pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;">${JSON.stringify(params, null, 2)}</pre>`
    );
  };

  // STEP 1: Signature check.
  const dataForSig: Record<string, string> = { ...params };
  delete dataForSig['signature'];
  const expectedSig = generatePayfastSignature(dataForSig, passphrase);
  if (!receivedSig || receivedSig.toLowerCase() !== expectedSig.toLowerCase()) {
    await failVerification(`signature mismatch (expected ${expectedSig}, got ${receivedSig})`);
    return;
  }

  // STEP 2: Source IP check (production only — sandbox uses dynamic IPs).
  if (!isSandbox) {
    if (!PAYFAST_PROD_IPS.has(sourceIp)) {
      await failVerification(`source IP ${sourceIp} not in PayFast production IP whitelist`);
      return;
    }
  } else {
    console.log('[payment-webhook-payfast] sandbox mode — skipping IP whitelist check, source IP:', sourceIp);
  }

  // STEP 3: Validate POST-back to PayFast.
  let validateResp = '';
  try {
    validateResp = await postFormToValidate(PAYFAST_VALIDATE_URL, params);
  } catch (err: any) {
    await failVerification(`validate POST failed: ${err?.message || err}`);
    return;
  }
  if (!validateResp.includes('VALID') || validateResp.includes('INVALID')) {
    await failVerification(`PayFast validate URL returned: ${validateResp}`);
    return;
  }

  // STEP 4: Amount match.
  const expectedAmount = Number(payment.amount).toFixed(2);
  const receivedAmount = Number(amount_gross).toFixed(2);
  if (expectedAmount !== receivedAmount) {
    await failVerification(`amount mismatch: expected R${expectedAmount}, received R${receivedAmount}`);
    return;
  }

  // All verification passed — act on payment_status.
  const nowIso = new Date().toISOString();

  if (payment_status === 'COMPLETE') {
    try {
      await base44.asServiceRole.entities.Payment.update(payment.id, {
        status: 'successful',
        gateway_pf_payment_id: pf_payment_id,
        gateway_payment_status: 'COMPLETE',
        ipn_payload: params,
        completed_at: nowIso
      });
    } catch (err) {
      console.error('[payment-webhook-payfast] payment update failed:', err);
    }

    let invoice: any = null;
    try {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: payment.invoice_id });
      invoice = Array.isArray(invoices) ? invoices[0] : invoices;
    } catch (err) {
      console.error('[payment-webhook-payfast] invoice lookup failed:', err);
    }

    if (invoice) {
      try {
        await base44.asServiceRole.entities.Invoice.update(invoice.id, {
          status: 'paid',
          paid_at: nowIso,
          payment_date: nowIso.slice(0, 10),
          payment_method: 'payfast'
        });
      } catch (err) {
        console.error('[payment-webhook-payfast] invoice update failed:', err);
      }

      if (invoice.contract_id) {
        try {
          await base44.asServiceRole.entities.Contract.update(invoice.contract_id, { status: 'paid' });
        } catch (err) {
          console.error('[payment-webhook-payfast] contract update failed:', err);
        }
      }

      const invType = invoice.type || invoice.invoice_type || '';
      if (['setup_fee', 'combined'].includes(invType)) {
        base44.functions.invoke('initiate-onboarding', {
          client_id: invoice.client_id,
          deal_id: invoice.deal_id || null
        }).catch((err: any) => {
          console.error('[payment-webhook-payfast] initiate-onboarding failed:', err);
        });
      }
    }

    base44.functions.invoke('send-payment-receipt-email', { payment_id: payment.id })
      .catch((err: any) => {
        console.error('[payment-webhook-payfast] receipt email failed:', err);
      });

    return;
  }

  if (payment_status === 'FAILED' || payment_status === 'CANCELLED') {
    const newStatus = payment_status === 'FAILED' ? 'failed' : 'cancelled';
    try {
      await base44.asServiceRole.entities.Payment.update(payment.id, {
        status: newStatus,
        gateway_payment_status: payment_status,
        ipn_payload: params,
        failed_reason: `PayFast reported ${payment_status}`,
        completed_at: nowIso
      });
    } catch (err) {
      console.error('[payment-webhook-payfast] payment update (failed/cancelled) failed:', err);
    }
    try {
      await base44.asServiceRole.entities.Invoice.update(payment.invoice_id, { status: 'issued' });
    } catch (err) {
      console.error('[payment-webhook-payfast] invoice revert failed:', err);
    }
    await notifyHead(
      `[PAYMENT ${payment_status}] R${payment.amount} from ${payment.client_name || payment.client_id}`,
      `<p>Payment <strong>${payment_status}</strong> on PayFast.</p>
       <p>Client: ${payment.client_name || payment.client_id}</p>
       <p>Invoice: ${payment.invoice_id}</p>
       <p>Amount: R${payment.amount}</p>
       <p>m_payment_id: ${m_payment_id}</p>
       <pre style="background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;">${JSON.stringify(params, null, 2)}</pre>`
    );
    return;
  }

  console.log('[payment-webhook-payfast] non-final payment_status, no action:', payment_status);
}

// IMPORTANT: PayFast retries up to 10x if the IPN does not return 200 quickly.
// Return 200 OK immediately, then process verification asynchronously.
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let raw = '';
  try {
    raw = await req.text();
  } catch (err) {
    console.error('[payment-webhook-payfast] body read failed:', err);
  }
  const sourceIp = clientIpFromRequest(req);

  // Fire-and-forget — verification can take 1-2s (validate POST-back), do not block 200.
  processIPN(req, raw, sourceIp).catch(err => {
    console.error('[payment-webhook-payfast] processIPN crashed:', err);
  });

  return new Response('OK', { status: 200 });
});
