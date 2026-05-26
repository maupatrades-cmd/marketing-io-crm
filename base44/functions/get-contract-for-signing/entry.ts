import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// =============================================================================
// get-contract-for-signing — public, unauthenticated lookup for the
// /sign-contract page. Validates the public signing_token, fetches the
// Contract + Client metadata, and internally invokes generate-msa-pdf to
// produce the personalised PDF. Returns everything the signing page needs
// in a single round-trip.
//
// Design choices:
//   - PDF generation lives in ONE place (generate-msa-pdf) so the 1336-line
//     MSA template only has one inline copy. This function delegates via
//     asServiceRole.functions.invoke and forwards the response field.
//   - Security mirrors payment-public-summary (the other public-by-design
//     function in this app):
//       * Strict token shape validation BEFORE any DB call.
//       * Generic 404 (`not_found_or_expired`) for missing / malformed /
//         expired / not-found — no information leakage about which case.
//       * Token never appears in logs in full — truncate to first 8 chars.
//       * Whitelist response — only fields the signing page renders.
//       * Read-only — no writes against Contract / Client.
//   - Per-IP rate limit is enforced inside generate-msa-pdf's heavier code
//     path (PDF render is expensive); this lookup is cheap enough that
//     adding rate-limit here would add latency without much defence.
// =============================================================================

// UUID v4 shape, plus a legacy 32-char base36 token shape for LB-045 rows
// that pre-date crypto.randomUUID. Anything else → generic 404.
const TOKEN_SHAPE = /^[A-Za-z0-9-]{20,64}$/;

function unwrap(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (result?.data?.id) return [result.data];
  if (typeof result === 'object' && result.id) return [result];
  return [];
}

function notFound() {
  return Response.json({ success: false, error: 'not_found_or_expired' }, { status: 404 });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const token = String(body?.token ?? '').trim();

  // Shape check before any DB call (no info leak on bad input).
  if (!token || !TOKEN_SHAPE.test(token)) {
    return notFound();
  }

  console.log(`[get-contract-for-signing] lookup token=${token.slice(0, 8)}…`);

  // Validate token against Contract.
  let contract: any = null;
  try {
    const list = unwrap(
      await base44.asServiceRole.entities.Contract.filter({ signing_token: token }),
    );
    contract = list[0] || null;
  } catch (err) {
    console.error('[get-contract-for-signing] Contract.filter failed:', (err as any)?.message);
    return notFound();
  }

  if (!contract) return notFound();

  // Expiry check.
  if (contract.signing_link_expires_at) {
    const exp = new Date(contract.signing_link_expires_at).getTime();
    if (Number.isFinite(exp) && exp < Date.now()) return notFound();
  }

  // Lookup Client (must exist for the signing page to render meaningful data).
  let client: any = null;
  try {
    const list = unwrap(
      await base44.asServiceRole.entities.Client.filter({ id: contract.client_id }),
    );
    client = list[0] || null;
  } catch (err) {
    console.error('[get-contract-for-signing] Client.filter failed:', (err as any)?.message);
    return notFound();
  }
  if (!client) return notFound();

  // Generate the PDF by delegating to the function that owns the template.
  let pdfBase64: string | null = null;
  try {
    const res = await base44.asServiceRole.functions.invoke('generate-msa-pdf', {
      signing_token: token,
    });
    const data = res?.data ?? res;
    if (data?.success && data?.pdf_base64) {
      pdfBase64 = data.pdf_base64;
    } else {
      console.error('[get-contract-for-signing] generate-msa-pdf returned non-success:', data?.error);
    }
  } catch (err) {
    console.error('[get-contract-for-signing] generate-msa-pdf invoke failed:', (err as any)?.message);
  }

  // PDF failure isn't fatal — signing page can still display the form and
  // re-render. But we surface the missing PDF in the response so the
  // frontend can show a degraded state if needed.
  return Response.json({
    success: true,
    contract: {
      id:                       String(contract.id || ''),
      package:                  contract.package || null,
      add_on_name:              contract.add_on_name || null,
      setup_fee:                contract.setup_fee ?? null,
      monthly_retainer:         contract.monthly_retainer ?? null,
      status:                   contract.status || null,
      signing_status:           contract.signing_status || null,
      signed_by_client:         Boolean(contract.signed_by_client),
      signed_by_mio:            Boolean(contract.signed_by_mio),
      signing_link_expires_at:  contract.signing_link_expires_at || null,
      contract_start_date:      contract.contract_start_date || null,
    },
    client: {
      business_name:  client.business_name || '',
      contact_person: client.contact_person || '',
      email:          client.email || '',
      phone:          client.phone || '',
      address:        client.address || '',
      id_reg_number:  client.id_reg_number || '',
    },
    pdf_base64: pdfBase64,
  });
});
