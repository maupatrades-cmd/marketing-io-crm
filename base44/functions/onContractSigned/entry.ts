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

      // Create task for admin to follow up with invoice & debit mandate
      await base44.asServiceRole.entities.Task.create({
        title: `Issue Setup Invoice - ${contract.client_name}`,
        description: `Issue setup fee invoice of R${contract.setup_fee} for ${contract.package} package`,
        client_id: contract.client_id,
        client_name: contract.client_name,
        deal_id: contract.deal_id,
        status: 'open',
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