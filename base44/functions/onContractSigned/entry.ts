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

    // For MVP: fully_signed when client has signed
    const clientSigned = signatures.some(s => s.signer_role === 'client');

    if (!clientSigned) {
      return Response.json({ 
        success: false, 
        message: 'Waiting for client signature' 
      });
    }

    // Generate final signed PDF (inline to avoid double-invocation)
    try {
      const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contractId });
      const contract = contracts[0];
      
      const { jsPDF } = await import('npm:jspdf@4.0.0');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      doc.setFontSize(14);
      doc.text('MARKETING IO MASTER SERVICE AGREEMENT', margin, margin);
      
      doc.setFontSize(10);
      doc.text(`Contract ID: ${contract.id}`, margin, margin + 10);
      doc.text(`Client: ${contract.client_name}`, margin, margin + 16);
      doc.text(`Package: ${contract.package}`, margin, margin + 22);
      
      doc.setFontSize(9);
      let y = margin + 35;
      doc.text(`Setup Fee: R${(contract.setup_fee || 0).toLocaleString()}`, margin, y);
      y += 7;
      doc.text(`Monthly Retainer: R${(contract.monthly_retainer || 0).toLocaleString()}`, margin, y);
      y += 7;
      doc.text(`Contract Start: ${contract.contract_start_date || 'N/A'}`, margin, y);
      y += 7;
      doc.text(`Contract End: ${contract.contract_end_date || 'N/A'}`, margin, y);

      y = pageHeight - 100;
      doc.setFontSize(10);
      doc.text('SIGNATURES:', margin, y);
      y += 10;

      signatures.forEach((sig) => {
        doc.setFontSize(8);
        doc.text(`${sig.signer_role.replace(/_/g, ' ').toUpperCase()}:`, margin, y);
        y += 5;
        
        if (sig.signature_method === 'typed') {
          doc.setFontSize(14);
          doc.setFont(undefined, 'italic');
          doc.text(sig.typed_signature || sig.signer_full_name, margin, y);
          doc.setFont(undefined, 'normal');
        }
        
        y += 12;
        doc.setFontSize(8);
        doc.text(`Signed: ${sig.signed_date ? new Date(sig.signed_date).toLocaleDateString() : 'N/A'}`, margin, y);
        y += 5;
        doc.text(`Name: ${sig.signer_full_name}`, margin, y);
        
        if (sig.signer_id_number) {
          y += 5;
          doc.text(`ID: ${sig.signer_id_number}`, margin, y);
        }
        
        y += 8;
      });

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      const uploadRes = await base44.integrations.Core.UploadFile({
        file: pdfBuffer.toString('base64')
      });

      await base44.asServiceRole.entities.Contract.update(contractId, {
        final_signed_pdf_url: uploadRes.file_url
      });
      
      console.log('[onContractSigned] PDF generated and saved');
    } catch (pdfErr) {
      console.error('PDF generation error:', pdfErr.message);
    }

    // Send notifications (inline email send)
    try {
      const { Resend } = await import('npm:resend@3.2.0');
      const apiKey = Deno.env.get('RESEND_API_KEY');
      if (apiKey) {
        const resend = new Resend(apiKey);
        const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contractId });
        const contract = contracts[0];
        const clients = await base44.asServiceRole.entities.Client.filter({ id: contract.client_id });
        const client = clients[0];
        const clientSignature = signatures.find(s => s.signer_role === 'client');

        const clientBodyHtml = `<p>Dear ${client.contact_person || client.business_name},</p>
          <p>Your Master Service Agreement has been successfully signed and is now active.</p>
          <p><strong>Package:</strong> ${contract.package}</p>
          <p><strong>Setup Fee:</strong> R${(contract.setup_fee || 0).toLocaleString()}</p>
          <p><strong>Monthly Retainer:</strong> R${(contract.monthly_retainer || 0).toLocaleString()}</p>
          <p>Your onboarding will begin shortly. Questions? <a href="mailto:info@marketingio.co.za">info@marketingio.co.za</a></p>`;

        await resend.emails.send({
          from: 'Marketing iO Team <hello@marketingio.co.za>',
          to: client.email,
          subject: `Your Contract Has Been Signed - ${contract.package}`,
          html: clientBodyHtml
        });
        
        console.log('[onContractSigned] Client notification sent');
      }
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