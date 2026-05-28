import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// submit-contract-signature — public, anonymous client-signing submit.
//
// The caller is unauthenticated — the client arrives at /sign-contract from
// an email link and clicks "Sign Contract". Without this function, the page
// did direct base44.entities.ContractSignature.create() AND
// base44.entities.Contract.update() from the anonymous browser; the Contract
// update is RLS-blocked (owner/admin only). Routing through this function
// runs both writes via asServiceRole, bypassing RLS.
//
// Hardening mirrors payment-public-summary:
//   - Strict signing_token shape pre-check BEFORE any DB call
//   - Per-IP sliding-window rate limit (10 submits / 5 min); SecurityEvent
//     row + 429 on limit hit
//   - Generic 404 (`not_found_or_expired`) for missing/malformed/expired
//     tokens — no info leak about token state
//   - Generic 400 (`already_signed`) for re-submit attempts
//   - Token never logged in full — truncated to first 8 chars
//   - Read-only public path (no Contract creates from this function)
//
// Atomicity: ContractSignature.create + Contract.update + cache-clear are
// sequential best-effort. If Contract.update fails after a successful
// ContractSignature.create, the function attempts to delete the orphan
// signature row in a best-effort cleanup, then returns 500 with diagnostic
// context. Base44 has no DB transactions so this is the closest we can get.
//
// Capacity (signer_capacity) is captured from the form but NOT persisted —
// ContractSignature.jsonc has no signer_capacity field and the locked Step B
// decision (A) for PR #122 keeps capacity form-only, rendered into the
// signed PDF only. Same policy here.
// =============================================================================

const TOKEN_SHAPE = /^[A-Za-z0-9-]{20,64}$/;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limit — sliding window in-memory store. Best-effort (single-instance
// only; multi-instance Base44 deployments would need a shared store). Matches
// the pattern in payment-public-summary.
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX       = 10;
const rateStore: Map<string, number[]> = new Map();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = rateStore.get(ip) || [];
  const recent = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    rateStore.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateStore.set(ip, recent);
  return true;
}

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function errMsg(e: unknown): string {
  if (!e) return 'unknown_error';
  if (typeof e === 'string') return e;
  return (e as any)?.message || String(e);
}

function notFound() {
  return Response.json({ success: false, error: 'not_found_or_expired' }, { status: 404 });
}

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

const today  = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const signingToken = String(body?.signing_token ?? '').trim();
  const fullName     = String(body?.signer_full_name ?? '').trim();
  const capacity     = String(body?.signer_capacity ?? '').trim();
  const idNumber     = String(body?.signer_id_number ?? '').trim();
  const email        = String(body?.signer_email ?? '').trim().toLowerCase();
  const method       = String(body?.signature_method ?? '').trim();
  const typedSig     = String(body?.typed_signature ?? '').trim();
  const drawnSig     = String(body?.drawn_signature_data_url ?? '').trim();
  const place        = String(body?.place_of_signing ?? '').trim();
  const initials     = String(body?.signer_initials ?? '').trim().toUpperCase();
  const witnessName  = String(body?.witness_full_name ?? '').trim();

  // ── Token shape + rate limit (BEFORE any DB call) ────────────────────────
  if (!TOKEN_SHAPE.test(signingToken)) return notFound();

  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    try {
      await base44.asServiceRole.entities.SecurityEvent.create({
        event_type: 'rate_limit_exceeded',
        event_summary: `submit-contract-signature rate limit hit from ip=${ip}`,
        event_metadata: { ip, function: 'submit-contract-signature' },
      });
    } catch { /* best-effort */ }
    return Response.json({ success: false, error: 'rate_limited' }, { status: 429 });
  }

  console.log(`[submit-contract-signature] submit token=${signingToken.slice(0, 8)}… ip=${ip}`);

  // ── Field validation ─────────────────────────────────────────────────────
  if (!fullName)  return Response.json({ success: false, error: 'invalid_signature', detail: 'signer_full_name required' }, { status: 400 });
  if (!capacity)  return Response.json({ success: false, error: 'invalid_signature', detail: 'signer_capacity required' }, { status: 400 });
  if (!idNumber)  return Response.json({ success: false, error: 'invalid_signature', detail: 'signer_id_number required' }, { status: 400 });
  if (!initials || !/^[A-Z0-9]{1,5}$/.test(initials)) {
    return Response.json({
      success: false, error: 'invalid_signature',
      detail: 'signer_initials required (1-5 alphanumeric)',
    }, { status: 400 });
  }
  // witness_full_name is optional — empty allowed.
  if (!email || !EMAIL_SHAPE.test(email)) {
    return Response.json({ success: false, error: 'invalid_signature', detail: 'signer_email invalid' }, { status: 400 });
  }
  if (method !== 'typed' && method !== 'drawn') {
    return Response.json({ success: false, error: 'invalid_signature', detail: 'signature_method must be typed|drawn' }, { status: 400 });
  }
  if (method === 'typed' && !typedSig) {
    return Response.json({ success: false, error: 'invalid_signature', detail: 'typed_signature required' }, { status: 400 });
  }
  if (method === 'drawn' && !drawnSig.startsWith('data:image/')) {
    return Response.json({ success: false, error: 'invalid_signature', detail: 'drawn_signature_data_url required' }, { status: 400 });
  }

  // ── Token lookup ─────────────────────────────────────────────────────────
  let contract: any = null;
  try {
    const list = unwrap(
      await base44.asServiceRole.entities.Contract.filter({ signing_token: signingToken }),
    );
    contract = list[0] || null;
  } catch (err) {
    console.error('[submit-contract-signature] Contract.filter failed:', errMsg(err));
    return notFound();
  }
  if (!contract) return notFound();

  // Expiry check.
  if (contract.signing_link_expires_at) {
    const exp = new Date(contract.signing_link_expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) return notFound();
  }

  // ── Idempotency: already signed ──────────────────────────────────────────
  if (
    contract.signed_by_client === true ||
    contract.signing_status === 'fully_signed' ||
    contract.status === 'signed'
  ) {
    return Response.json({ success: false, error: 'already_signed' }, { status: 400 });
  }

  // ── Step 8: create ContractSignature (asServiceRole, bypasses RLS) ──────
  // signer_capacity is NOT persisted — not declared on the schema. Locked
  // decision (A) from PR #122: capacity is rendered into the signed PDF
  // only, not stored as a DB column. The capacity value still appears on
  // the rendered PDF via the regenerate flow (cache cleared in step 11).
  let signatureId: string | null = null;
  try {
    const sig = await base44.asServiceRole.entities.ContractSignature.create({
      contract_id:              String(contract.id),
      signer_role:              'client',
      signer_full_name:         fullName,
      signer_email:             email,
      signer_id_number:         idNumber,
      typed_signature:          method === 'typed' ? typedSig : fullName,
      signature_method:         method,
      drawn_signature_data_url: method === 'drawn' ? drawnSig : null,
      signed_date:              nowIso(),
      signed_ip_address:        ip,
      signed_user_agent:        req.headers.get('user-agent') || '',
    });
    signatureId = String(sig?.id || '') || null;
    if (!signatureId) throw new Error('ContractSignature.create returned no id');
  } catch (err) {
    console.error('[submit-contract-signature] ContractSignature.create failed:', errMsg(err));
    return Response.json({
      success: false,
      error:   'submit_failed',
      step:    'signature_create',
      detail:  errMsg(err),
    }, { status: 500 });
  }

  // ── Step 9: update Contract — both status enum flips per Q3 lock ────────
  try {
    await base44.asServiceRole.entities.Contract.update(String(contract.id), {
      status:           'signed',
      signing_status:   'fully_signed',
      signed_by_client: true,
      client_signed_at: nowIso(),
      signed_date:      today(),
    });
  } catch (err) {
    // Atomicity fallback: orphan ContractSignature exists, try to delete it.
    console.error('[submit-contract-signature] Contract.update failed:', errMsg(err));
    try {
      await base44.asServiceRole.entities.ContractSignature.delete(signatureId);
      console.error(`[submit-contract-signature] orphan signature ${signatureId} deleted after Contract.update failure`);
    } catch (deleteErr) {
      console.error(
        `[submit-contract-signature] orphan signature ${signatureId} delete ALSO failed — manual cleanup required:`,
        errMsg(deleteErr),
      );
    }
    return Response.json({
      success: false,
      error:   'submit_failed',
      step:    'contract_update',
      detail:  errMsg(err),
    }, { status: 500 });
  }

  // ── Step 11: invalidate cached PDF on Contract.document_url ─────────────
  // The next get-contract-for-signing call will regenerate the PDF with
  // the just-captured signature data embedded. finalize-signed-contract
  // (Step 11b below) also writes Contract.final_signed_pdf_url which is
  // what the client portal surfaces post-signing.
  try {
    if (contract.document_url) {
      await base44.asServiceRole.entities.Contract.update(String(contract.id), {
        document_url: null,
      });
    }
  } catch (err) {
    console.error('[submit-contract-signature] cache invalidation failed (non-fatal):', errMsg(err));
  }

  // ── Step 11b: kick off finalize-signed-contract (fire-and-forget) ───────
  // PR #125 — generates the signed-state PDF (typed/drawn signature on page
  // 19 + real audit trail on page 20), writes Contract.final_signed_pdf_url,
  // and emails the signed PDF to the client. We DO NOT await this — signing
  // UX must stay snappy. Failures inside finalize don't fail the sign; they
  // surface as warnings in the ClientActivityLog row finalize itself writes.
  // The .catch handler is required so an unhandled rejection doesn't crash
  // the parent function.
  try {
    base44.asServiceRole.functions.invoke('finalize-signed-contract', {
      contract_id: String(contract.id),
    }).catch((err: unknown) => {
      console.error(
        `[submit-contract-signature] finalize-signed-contract invoke failed for ${String(contract.id)} (non-fatal):`,
        errMsg(err),
      );
    });
  } catch (err) {
    // Synchronous-throw safety net — the .catch above handles async rejections.
    console.error(
      `[submit-contract-signature] finalize-signed-contract sync throw for ${String(contract.id)} (non-fatal):`,
      errMsg(err),
    );
  }

  // ── Step 12: activity log — non-fatal per workflow note ──────────────────
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      String(contract.client_id || ''),
      client_name:    String(contract.client_name || ''),
      actor_id:       'public_signer',
      actor_role:     'client',
      event_type:     'contract_signed_by_client',
      event_category: 'document',
      event_summary:  `Contract ${contract.id} signed by ${fullName} (${capacity}) — ${email}`,
      event_label:    'Contract signed by client',
      event_metadata: {
        contract_id:           String(contract.id),
        signature_id:          signatureId,
        signer_full_name:      fullName,
        signer_capacity:       capacity,
        signer_initials:       initials,
        witness_full_name:     witnessName || null,
        signer_email:          email,
        signature_method:      method,
        signed_ip_address:     ip,
        place_of_signing:      place || null,
      },
      logged_by:      'public_signer',
      logged_by_name: fullName,
    });
  } catch (err) {
    console.error('[submit-contract-signature] ClientActivityLog.create failed (non-fatal):', errMsg(err));
  }

  return Response.json({
    success:     true,
    contract_id: String(contract.id),
    signed_at:   nowIso(),
  });
});
