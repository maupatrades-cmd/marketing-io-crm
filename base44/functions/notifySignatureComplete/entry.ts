import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: contract.client_id });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch all signatures
    const signatures = await base44.asServiceRole.entities.ContractSignature.filter({ 
      contract_id,
      signer_role: 'client'
    });

    const clientSignature = signatures[0];

    // Send email to client
    await base44.integrations.Core.SendEmail({
      to: client.email,
      subject: `Your Contract Has Been Signed - ${contract.package}`,
      body: `Dear ${client.contact_person || client.business_name},

We are pleased to confirm that your Master Service Agreement has been successfully signed.

**Contract Details:**
- Package: ${contract.package}
- Setup Fee: R${(contract.setup_fee || 0).toLocaleString()}
- Monthly Retainer: R${(contract.monthly_retainer || 0).toLocaleString()}
- Start Date: ${contract.contract_start_date || 'To be confirmed'}

${clientSignature ? `Signed on: ${new Date(clientSignature.signed_date).toLocaleDateString()}` : ''}

Your signed contract PDF is attached. Keep this for your records.

The next step in your onboarding journey will be initiated shortly. You will receive further communication from our team regarding:
1. Invoice for setup fees
2. Debit mandate for recurring payments
3. Onboarding form for brand assets collection

If you have any questions, please don't hesitate to reach out to us at info@marketingio.co.za or ${client.phone || '+27 (0) 11 XXX XXXX'}.

Best regards,
Marketing iO Team`
    });

    // Send email to admin
    const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    
    for (const adminUser of adminUsers) {
      await base44.integrations.Core.SendEmail({
        to: adminUser.email,
        subject: `Contract Signed: ${client.business_name} - ${contract.package}`,
        body: `A contract has been successfully signed.

**Client Details:**
- Business: ${client.business_name}
- Contact: ${client.contact_person}
- Email: ${client.email}
- Phone: ${client.phone}

**Contract Details:**
- Package: ${contract.package}
- Setup Fee: R${(contract.setup_fee || 0).toLocaleString()}
- Monthly Retainer: R${(contract.monthly_retainer || 0).toLocaleString()}
- Contract ID: ${contract.id}

${clientSignature ? `Signed by: ${clientSignature.signer_full_name} on ${new Date(clientSignature.signed_date).toLocaleDateString()}` : ''}

**Next Actions Required:**
1. Issue setup fee invoice
2. Send debit mandate for signature
3. Send onboarding form
4. Schedule onboarding call

View contract details: [Admin Dashboard Link]`
      });
    }

    // Create activity log
    await base44.asServiceRole.entities.ClientActivityLog.create({
      client_id: contract.client_id,
      client_name: contract.client_name,
      event_type: 'milestone',
      event_label: `Contract Signed - ${contract.package}`,
      to_value: 'signed',
      logged_by: user.id,
      logged_by_name: user.full_name
    });

    return Response.json({
      success: true,
      message: 'Signature notification emails sent',
      contract_id,
      client_email: client.email,
      admins_notified: adminUsers.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});