import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

// =============================================================================
// finalize-signed-contract — async background orchestrator that runs after
// a client signs a contract via submit-contract-signature.
//
// Flow:
//   1. Lookup Contract + verify signed_by_client.
//   2. Idempotency: skip if final_signed_pdf_url already set.
//   3. Pull latest client ContractSignature row.
//   4. Lookup Client (for email + business_name on the audit / email body).
//   5. Pull capacity from ClientActivityLog (signer_capacity is not on the
//      ContractSignature schema — locked decision A from PR #122 keeps it
//      form-only, rendered into PDF only. submit-contract-signature writes
//      it into event_metadata.signer_capacity which we re-read here).
//   6. Compute content-fingerprint document_hash via SHA-256.
//   7. Invoke generate-msa-pdf with the populated signer payload — that
//      function inlines the 22-page template and runs the signed-state
//      render (typed cursive on page 19 OR drawn signature image; real
//      audit trail on page 20).
//   8. Write Contract.final_signed_pdf_url with the returned URL.
//   9. Fetch the signed PDF bytes from the URL and base64-encode for the
//      Resend attachment.
//   10. Email the client with the attachment. CC info@marketingio.co.za,
//       Reply-To info@marketingio.co.za. Skip-with-log if no client email.
//   11. Activity log row (non-fatal try/catch).
//
// No step rolls back. submit-contract-signature already returned success
// to the user — the contract IS signed. Finalize is purely enrichment.
// Every failure pushes to warnings[] and continues; the activity log
// captures warnings for admin visibility, and a console hint prints the
// re-run procedure for ops.
//
// Re-run procedure (printed to logs when warnings exist):
//   admin nulls Contract.final_signed_pdf_url, then re-invokes
//   finalize-signed-contract { contract_id }.
// =============================================================================

const EMAIL_SHAPE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INFO_EMAIL      = 'info@marketingio.co.za';
const FROM_EMAIL      = 'Marketing iO <contracts@marketingio.co.za>';
const ATTACH_FILENAME = (clientName: string, contractRef: string) =>
  `MSA-${clientName || 'Client'}-${contractRef}-SIGNED.pdf`
    .replace(/[^A-Za-z0-9._-]+/g, '_');

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

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[<>&"']/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function fmtZar(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string): string {
  if (!s) return '—';
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Chunked base64 encoder — avoids stack overflow on large Uint8Arrays and the
// O(n²) byte-by-byte concat that caused the 502 in PR #122.
function base64FromBytes(bytes: Uint8Array): string {
  let s = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(s);
}

function wrapEmail(bodyHtml: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-collapse:collapse;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendSignedContractEmail(args: {
  to:                string;
  cc:                string;
  clientName:        string;
  contract_id:       string;
  package:           string;
  setup_fee:         number;
  monthly_retainer:  number;
  signed_at:         string;
  signedPdfUrl:      string | null;
  attachmentBase64:  string | null;
}) {
  // Explicit env-var check — other email functions assume RESEND_API_KEY
  // exists and fail with cryptic errors when it's missing. This explicit
  // throw bubbles up through finalize's catch block with a clear reason.
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('resend_api_key_missing');

  const resend      = new Resend(apiKey);
  const contractRef = String(args.contract_id).slice(-8).toUpperCase();
  const filename    = ATTACH_FILENAME(args.clientName, contractRef);
  const pkgLabel    = String(args.package || '').replace(/_/g, ' ');

  const html = wrapEmail(`
    <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;">Your signed contract</h1>
    <p>Hi ${escapeHtml(args.clientName || 'there')},</p>
    <p>Thank you for signing your Marketing iO Master Service Agreement. Your fully executed copy is attached to this email and is also available in your client portal.</p>

    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;background:#f8fafc;border-radius:8px;">
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;">Contract reference</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">${escapeHtml(contractRef)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Package</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;text-transform:capitalize;border-top:1px solid #e2e8f0;">${escapeHtml(pkgLabel)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Setup Fee</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">R${fmtZar(args.setup_fee)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Monthly Retainer</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">R${fmtZar(args.monthly_retainer)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:14px;color:#64748b;border-top:1px solid #e2e8f0;">Signed on</td>
          <td style="padding:10px 16px;font-size:14px;color:#0f172a;text-align:right;font-weight:600;border-top:1px solid #e2e8f0;">${escapeHtml(fmtDate(args.signed_at))}</td></tr>
    </table>

    ${args.signedPdfUrl
      ? `<p style="margin:16px 0;"><a href="${escapeHtml(args.signedPdfUrl)}" style="color:#a764e6;">Open in browser →</a></p>`
      : ''}

    <p style="margin:0 0 16px 0;">A team member will be in touch shortly to begin onboarding. If you have questions in the meantime, reply to this email or WhatsApp us.</p>

    <p style="margin:0 0 16px 0;font-size:13px;color:#64748b;">Reference: ${escapeHtml(contractRef)}</p>
    <p style="margin:0 0 4px 0;">— The Marketing iO Team</p>
    <p style="margin:0;font-style:italic;color:#a764e6;">Too good to stay hidden.</p>
  `);

  const sendArgs: any = {
    from:     FROM_EMAIL,
    to:       [args.to],
    cc:       [args.cc],
    reply_to: INFO_EMAIL,
    subject:  `Signed Contract — ${args.clientName || 'Marketing iO'} — Marketing iO`,
    html,
  };
  if (args.attachmentBase64) {
    sendArgs.attachments = [{
      filename,
      content:      args.attachmentBase64,
      encoding:     'base64',
      content_type: 'application/pdf',
    }];
  }

  const result = await resend.emails.send(sendArgs);
  if (result?.error) {
    throw new Error(String((result.error as any)?.message || 'resend_error'));
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'use POST' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const contract_id = String(body?.contract_id ?? '').trim();
  if (!contract_id) return Response.json({ error: 'contract_id required' }, { status: 400 });

  const warnings: string[] = [];

  // ── STEP 1 — Lookup Contract ────────────────────────────────────────────
  let contract: any = null;
  try {
    contract = unwrap(await base44.asServiceRole.entities.Contract.filter({ id: contract_id }))[0] || null;
  } catch (err) {
    console.error(`[finalize-signed-contract] Contract.filter failed for ${contract_id}:`, errMsg(err));
    return Response.json({ error: 'contract_lookup_failed', contract_id }, { status: 500 });
  }
  if (!contract) {
    console.error(`[finalize-signed-contract] contract_not_found ${contract_id}`);
    return Response.json({ error: 'contract_not_found', contract_id }, { status: 404 });
  }

  if (!contract.signed_by_client) {
    console.error(`[finalize-signed-contract] ${contract_id} not signed by client yet`);
    return Response.json({ error: 'not_signed_yet', contract_id }, { status: 400 });
  }

  // ── STEP 2 — Idempotency ────────────────────────────────────────────────
  if (contract.final_signed_pdf_url) {
    console.log(`[finalize-signed-contract] ${contract_id} already finalized — skipping`);
    return Response.json({
      success:        true,
      skipped:        true,
      reason:         'already_finalized',
      contract_id,
      signed_pdf_url: String(contract.final_signed_pdf_url),
    });
  }

  // ── STEP 3 — Latest client ContractSignature ────────────────────────────
  let clientSig: any = null;
  try {
    const sigs = unwrap(await base44.asServiceRole.entities.ContractSignature.filter({ contract_id }));
    clientSig = sigs
      .filter((s: any) => s.signer_role === 'client')
      .sort((a: any, b: any) => new Date(b.signed_date || 0).getTime() - new Date(a.signed_date || 0).getTime())[0]
      || null;
  } catch (err) {
    console.error(`[finalize-signed-contract] ContractSignature.filter failed for ${contract_id}:`, errMsg(err));
    return Response.json({ error: 'signature_lookup_failed', contract_id }, { status: 500 });
  }
  if (!clientSig) {
    console.error(`[finalize-signed-contract] no client signature for ${contract_id}`);
    return Response.json({ error: 'no_client_signature', contract_id }, { status: 400 });
  }

  // ── STEP 4 — Client lookup ──────────────────────────────────────────────
  let client: any = {};
  if (contract.client_id) {
    try {
      const list = unwrap(await base44.asServiceRole.entities.Client.filter({ id: contract.client_id }));
      client = list[0] || {};
    } catch (err) {
      console.error(`[finalize-signed-contract] Client.filter failed (non-fatal) for ${contract_id}:`, errMsg(err));
      // Continue with empty client — PDF still renders, email may skip later.
    }
  }

  // ── STEP 5 — Capacity from activity log (PR #122 decision A) ────────────
  let signerCapacity = 'Client';
  try {
    const logs = unwrap(await base44.asServiceRole.entities.ClientActivityLog.filter({
      client_id: contract.client_id,
      event_type: 'contract_signed_by_client',
    }));
    const match = logs.find((l: any) => {
      const m = l?.event_metadata;
      return m && (m.contract_id === contract_id || m.signature_id === clientSig.id);
    });
    if (match?.event_metadata?.signer_capacity) {
      signerCapacity = String(match.event_metadata.signer_capacity);
    }
  } catch (err) {
    console.error(`[finalize-signed-contract] capacity lookup failed (non-fatal) for ${contract_id}:`, errMsg(err));
  }

  // ── STEP 6 — Content-fingerprint document hash ──────────────────────────
  const hashInput = [
    contract.id,
    contract.package || '',
    String(contract.setup_fee || 0),
    String(contract.monthly_retainer || 0),
    contract.client_id || '',
    clientSig.signed_date || '',
    clientSig.signer_email || '',
  ].join('|');
  const document_hash = await sha256Hex(hashInput);

  // ── STEP 7 — Invoke generate-msa-pdf with signer payload ────────────────
  let signedPdfUrl: string | null = null;
  try {
    const res = await base44.asServiceRole.functions.invoke('generate-msa-pdf', {
      contract_id,
      signer: {
        full_name:           String(clientSig.signer_full_name || ''),
        capacity:            signerCapacity,
        id_number:           String(clientSig.signer_id_number || ''),
        email:               String(clientSig.signer_email || ''),
        signature_method:    String(clientSig.signature_method || 'typed'),
        typed_signature:     String(clientSig.typed_signature || ''),
        signature_data_url:  String(clientSig.drawn_signature_data_url || ''),
        signed_at:           String(clientSig.signed_date || ''),
        place:               '',
        signed_ip_address:   String(clientSig.signed_ip_address || 'unknown'),
        signed_user_agent:   String(clientSig.signed_user_agent || '').slice(0, 200),
        document_hash,
      },
    });
    const data = res?.data ?? res;
    if (data?.success && data?.pdf_url) {
      signedPdfUrl = String(data.pdf_url);
    } else {
      warnings.push(`generate_signed_pdf_failed: ${data?.error || 'unknown'}`);
      console.error(`[finalize-signed-contract] generate-msa-pdf failed for ${contract_id}:`, data?.error);
    }
  } catch (err) {
    warnings.push(`generate_signed_pdf_threw: ${errMsg(err)}`);
    console.error(`[finalize-signed-contract] generate-msa-pdf threw for ${contract_id}:`, errMsg(err));
  }

  // ── STEP 8 — Write final_signed_pdf_url ─────────────────────────────────
  if (signedPdfUrl) {
    try {
      await base44.asServiceRole.entities.Contract.update(contract_id, {
        final_signed_pdf_url: signedPdfUrl,
      });
    } catch (err) {
      warnings.push(`final_signed_pdf_url_write_failed: ${errMsg(err)}`);
      console.error(`[finalize-signed-contract] Contract.update final_signed_pdf_url failed for ${contract_id}:`, errMsg(err));
    }
  }

  // ── STEP 9 — Fetch signed PDF bytes for attachment ──────────────────────
  let attachmentBase64: string | null = null;
  if (signedPdfUrl) {
    try {
      const fetchRes = await fetch(signedPdfUrl);
      if (fetchRes.ok) {
        const bytes = new Uint8Array(await fetchRes.arrayBuffer());
        attachmentBase64 = base64FromBytes(bytes);
      } else {
        warnings.push(`pdf_fetch_failed: ${fetchRes.status}`);
        console.error(`[finalize-signed-contract] PDF fetch returned ${fetchRes.status} for ${contract_id}`);
      }
    } catch (err) {
      warnings.push(`pdf_fetch_threw: ${errMsg(err)}`);
      console.error(`[finalize-signed-contract] PDF fetch threw for ${contract_id}:`, errMsg(err));
    }
  }

  // ── STEP 10 — Email the client ─────────────────────────────────────────
  const clientEmail = String(clientSig.signer_email || client.email || '').trim().toLowerCase();
  let emailSentTo: string | null = null;
  if (!clientEmail || !EMAIL_SHAPE.test(clientEmail)) {
    console.error(`[finalize-signed-contract] no/invalid client email for ${contract_id} — skipping email`);
    warnings.push('no_client_email');
  } else {
    try {
      await sendSignedContractEmail({
        to:               clientEmail,
        cc:               INFO_EMAIL,
        clientName:       String(client.business_name || ''),
        contract_id,
        package:          String(contract.package || ''),
        setup_fee:        Number(contract.setup_fee || 0),
        monthly_retainer: Number(contract.monthly_retainer || 0),
        signed_at:        String(clientSig.signed_date || ''),
        signedPdfUrl,
        attachmentBase64,
      });
      emailSentTo = clientEmail;
    } catch (err) {
      warnings.push(`email_failed: ${errMsg(err)}`);
      console.error(`[finalize-signed-contract] email send failed for ${contract_id}:`, errMsg(err));
    }
  }

  // ── STEP 11 — Activity log (non-fatal) ──────────────────────────────────
  try {
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id:      String(contract.client_id || ''),
      client_name:    String(client.business_name || contract.client_name || ''),
      actor_id:       'system',
      actor_role:     'system',
      event_type:     'contract_finalized',
      event_category: 'document',
      event_summary:  `Signed PDF generated and emailed for contract ${contract_id}`,
      event_label:    'Contract finalized',
      event_metadata: {
        contract_id,
        signed_pdf_url:   signedPdfUrl,
        email_sent_to:    emailSentTo,
        document_hash,
        warnings,
      },
      logged_by:      'system',
      logged_by_name: 'finalize-signed-contract',
    });
  } catch (err) {
    console.error(`[finalize-signed-contract] activity log failed for ${contract_id} (non-fatal):`, errMsg(err));
  }

  // Print the re-run hint when warnings exist so ops can pick it up easily.
  if (warnings.length > 0) {
    console.warn(
      `[finalize-signed-contract] ${contract_id} completed WITH WARNINGS: ${warnings.join('; ')}. ` +
      `To re-run: null Contract.final_signed_pdf_url then re-invoke finalize-signed-contract { contract_id: "${contract_id}" }.`,
    );
  }

  return Response.json({
    success:        true,
    contract_id,
    signed_pdf_url: signedPdfUrl,
    email_sent_to:  emailSentTo,
    document_hash,
    ...(warnings.length ? { warnings } : {}),
  });
});
