import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contract_id } = await req.json();

    if (!contract_id) {
      return Response.json({ error: 'contract_id required' }, { status: 400 });
    }

    // Fetch contract
    const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contract_id });
    if (!contracts || contracts.length === 0) {
      return Response.json({ error: 'Contract not found' }, { status: 404 });
    }

    const contract = contracts[0];

    // Fetch all signatures for this contract
    const signatures = await base44.asServiceRole.entities.ContractSignature.filter({ contract_id });

    // Fetch the original contract PDF (would be generated/stored)
    // For now, we'll create a simple PDF with signature placeholders filled

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    // Header
    doc.setFontSize(14);
    doc.text('MARKETING IO MASTER SERVICE AGREEMENT', margin, margin);
    
    doc.setFontSize(10);
    doc.text(`Contract ID: ${contract.id}`, margin, margin + 10);
    doc.text(`Client: ${contract.client_name}`, margin, margin + 16);
    doc.text(`Package: ${contract.package}`, margin, margin + 22);
    
    // Contract details
    doc.setFontSize(9);
    let y = margin + 35;
    doc.text(`Setup Fee: R${(contract.setup_fee || 0).toLocaleString()}`, margin, y);
    y += 7;
    doc.text(`Monthly Retainer: R${(contract.monthly_retainer || 0).toLocaleString()}`, margin, y);
    y += 7;
    doc.text(`Contract Start: ${contract.contract_start_date || 'N/A'}`, margin, y);
    y += 7;
    doc.text(`Contract End: ${contract.contract_end_date || 'N/A'}`, margin, y);

    // Signatures section
    y = pageHeight - 100;
    doc.setFontSize(10);
    doc.text('SIGNATURES:', margin, y);
    y += 10;

    // Add signatures from ContractSignature records
    signatures.forEach((sig, index) => {
      doc.setFontSize(8);
      doc.text(`${sig.signer_role.replace(/_/g, ' ').toUpperCase()}:`, margin, y);
      y += 5;
      
      if (sig.signature_method === 'typed') {
        doc.setFontSize(14);
        doc.setFont(undefined, 'italic');
        doc.text(sig.typed_signature || sig.signer_full_name, margin, y);
        doc.setFont(undefined, 'normal');
      } else if (sig.drawn_signature_data_url) {
        // Embed drawn signature image
        try {
          const imgData = sig.drawn_signature_data_url;
          doc.addImage(imgData, 'PNG', margin, y - 8, 40, 15);
        } catch (imgErr) {
          doc.text('[Signature Image]', margin, y);
        }
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

    // Generate PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Upload to file storage via integration
    const uploadRes = await base44.integrations.Core.UploadFile({
      file: pdfBuffer.toString('base64')
    });

    // Update contract with final signed PDF URL
    await base44.asServiceRole.entities.Contract.update(contract.id, {
      final_signed_pdf_url: uploadRes.file_url,
      signing_status: 'fully_signed'
    });

    return Response.json({
      success: true,
      pdf_url: uploadRes.file_url,
      contract_id,
      signatures_count: signatures.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});