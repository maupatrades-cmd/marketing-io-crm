import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Automation handler triggered when a ContractSignature is created
 * Generates final PDF with embedded signature and sends notifications
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const { event, data } = await req.json();

    if (!data || !data.contract_id) {
      return Response.json({ error: 'Invalid signature data' }, { status: 400 });
    }

    const contractId = data.contract_id;

    // Check if all required signatures are present
    const signatures = await base44.asServiceRole.entities.ContractSignature.filter({ 
      contract_id: contractId 
    });

    // For MVP: fully_signed when client has signed (can add MIO signature requirement later)
    const clientSigned = signatures.some(s => s.signer_role === 'client' && s.typed_signature);

    if (!clientSigned) {
      return Response.json({ 
        success: false, 
        message: 'Waiting for client signature' 
      });
    }

    // Generate final signed PDF
    try {
      await base44.functions.invoke('generateSignedPDF', {
        contract_id: contractId
      });
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr.message);
      // Continue with notifications even if PDF generation fails
    }

    // Send notifications
    try {
      await base44.functions.invoke('notifySignatureComplete', {
        contract_id: contractId
      });
    } catch (notifyErr) {
      console.error('Notification error:', notifyErr.message);
    }

    // Update contract status
    const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contractId });
    if (contracts && contracts.length > 0) {
      const contract = contracts[0];
      
      await base44.asServiceRole.entities.Contract.update(contractId, {
        status: 'signed',
        signing_status: 'fully_signed',
        signed_by_client: true,
        signed_date: new Date().toISOString().split('T')[0]
      });

      // Auto-create the setup-fee Invoice (Round 3 of recovery plan).
      // The legacy "Issue Setup Invoice" Task remains as a manual fallback
      // and gets auto-completed below if the create-invoice call succeeds.
      // Idempotency: skip create if a setup_fee Invoice already exists for
      // this contract. Re-firing the signature webhook is therefore safe.
      let invoiceAutoCreated = false;
      try {
        const existingInvoices = await base44.asServiceRole.entities.Invoice.filter({
          contract_id: contractId,
          invoice_type: 'setup_fee',
        });
        const existingList = Array.isArray(existingInvoices)
          ? existingInvoices
          : (existingInvoices ? [existingInvoices] : []);
        if (existingList.length > 0) {
          console.log(
            `[onContractSigned] setup_fee Invoice already exists for contract_id=${contractId} ` +
            `(invoice_id=${existingList[0].id}) — skipping auto-create`
          );
          invoiceAutoCreated = true;
        } else if (Number(contract.setup_fee) > 0) {
          await base44.functions.invoke('create-invoice', {
            client_id:    contract.client_id,
            type:         'setup_fee',
            contract_id:  contractId,
            deal_id:      contract.deal_id,
            line_items: [{
              product_id:   contract.package || '',
              product_name: contract.package
                ? String(contract.package).split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
                : 'Setup',
              description:  `Setup fee — ${contract.package || 'package'}`,
              amount:       Number(contract.setup_fee),
              quantity:     1,
            }],
            due_date:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            send_email:   true,
          });
          invoiceAutoCreated = true;
          console.log(`[onContractSigned] setup_fee Invoice auto-created for contract_id=${contractId}`);
        }
      } catch (invErr) {
        console.error('[onContractSigned] setup_fee Invoice auto-create failed (non-fatal):', invErr.message);
      }

      // Create task for admin to follow up with invoice & debit mandate.
      // If the auto-create above succeeded, this Task is already informational —
      // we mark it 'done' on creation so it doesn't clutter admin's queue.
      await base44.asServiceRole.entities.Task.create({
        title: `Issue Setup Invoice - ${contract.client_name}`,
        description: invoiceAutoCreated
          ? `Setup fee invoice of R${contract.setup_fee} auto-created on signature. Verify it sent.`
          : `Issue setup fee invoice of R${contract.setup_fee} for ${contract.package} package`,
        client_id: contract.client_id,
        client_name: contract.client_name,
        deal_id: contract.deal_id,
        status: invoiceAutoCreated ? 'done' : 'open',
        priority: 'high',
        auto_generated: true,
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      await base44.asServiceRole.entities.Task.create({
        title: `Send Debit Mandate - ${contract.client_name}`,
        description: `Send debit mandate for R${contract.monthly_retainer}/month for client signature`,
        client_id: contract.client_id,
        client_name: contract.client_name,
        deal_id: contract.deal_id,
        status: 'open',
        priority: 'high',
        auto_generated: true,
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    }

    return Response.json({
      success: true,
      message: 'Contract signing workflow completed',
      contract_id: contractId
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});