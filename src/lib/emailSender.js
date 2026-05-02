import { base44 } from '@/api/base44Client';

const FALLBACK_VARIABLES = {
  full_name: 'there',
  primary_contact_name: 'there',
  business_name: 'your business',
  package_name: 'your selected package',
  setup_fee: '—',
  monthly_retainer: '—',
  amount: '—',
  invoice_number: '—',
  due_date: 'shortly',
  contract_end_date: 'shortly',
  reset_link: '#',
  welcome_pack_pdf_url: '#',
  onboarding_form_link: '#',
  payment_link: '#',
  invoice_pdf_url: '#',
  report_pdf_url: '#',
  review_link: '#',
  packages_link: '#',
  contact_link: '#',
  unsubscribe_link: '#'
};

async function validateAndRenderTemplate(template, variables) {
  let subject = template.subject;
  let htmlBody = template.html_body;
  let plainTextBody = template.plain_text_body;

  // Get list of expected variables
  const expectedVariables = JSON.parse(template.variables_used || '[]');

  // Replace all variables with provided values or fallbacks
  expectedVariables.forEach(variable => {
    const value = variables[variable] || FALLBACK_VARIABLES[variable] || '';
    const regex = new RegExp(`{{${variable}}}`, 'g');
    subject = subject.replace(regex, value);
    htmlBody = htmlBody.replace(regex, value);
    plainTextBody = plainTextBody.replace(regex, value);
  });

  // Check for unreplaced variables (indicates missing variable handling)
  const unreplacedVars = subject.match(/{{.*?}}/g) || [];
  if (unreplacedVars.length > 0) {
    return {
      valid: false,
      error: `Unreplaced variables in template: ${unreplacedVars.join(', ')}`
    };
  }

  return {
    valid: true,
    rendered: { subject, htmlBody, plainTextBody }
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function retryWithBackoff(fn, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return { success: true, result: await fn(), attempt_count: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delayMs = 30000 * Math.pow(2, attempt - 1); // 30s, 60s, 120s
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  return { success: false, error: lastError?.message, attempt_count: maxAttempts };
}

export async function sendTemplatedEmail({
  templateCode,
  toEmail,
  variables = {},
  attachments = [],
  clientId = null
}) {
  try {
    // 1. Load template
    const templates = await base44.entities.EmailTemplate.filter({
      code: templateCode
    });

    if (!templates || templates.length === 0) {
      console.error(`[EmailSender] Template not found: ${templateCode}`);
      await base44.entities.SecurityEvent.create({
        event_type: 'email_send_failed_permanent',
        email: toEmail || 'unknown',
        details: `EmailTemplate not found: ${templateCode}`
      });
      return { success: false, error: 'Template not found', attempt_count: 0 };
    }

    const template = templates[0];

    if (!template.is_active) {
      console.error(`[EmailSender] Template inactive: ${templateCode}`);
      return { success: false, error: 'Template is inactive', attempt_count: 0 };
    }

    // 2. Validate email format
    if (!isValidEmail(toEmail)) {
      console.error(`[EmailSender] Invalid email format: ${toEmail}`);
      await base44.entities.SecurityEvent.create({
        event_type: 'email_send_failed_permanent',
        email: toEmail,
        details: `Invalid email format for template: ${templateCode}`
      });
      return { success: false, error: 'Invalid email address', attempt_count: 0 };
    }

    // 3. Render template with fallbacks
    const validation = await validateAndRenderTemplate(template, variables);
    if (!validation.valid) {
      console.error(`[EmailSender] Template validation failed: ${validation.error}`);
      await base44.entities.SecurityEvent.create({
        event_type: 'email_send_failed_permanent',
        email: toEmail,
        details: `Template rendering failed: ${validation.error} (${templateCode})`
      });
      
      // Send alert to admin
      try {
        await base44.integrations.Core.SendEmail({
          to: 'thapelom@marketingio.co.za',
          subject: `[ALERT] Email template failed: ${templateCode}`,
          body: `Template rendering failed. Details:\n\n${validation.error}\n\nTemplate: ${templateCode}\nRecipient: ${toEmail}`
        });
      } catch (err) {
        console.error('Failed to send alert email:', err);
      }

      return { success: false, error: validation.error, attempt_count: 0 };
    }

    const { subject, htmlBody, plainTextBody } = validation.rendered;

    // 4. Send with retry logic
    const sendResult = await retryWithBackoff(async () => {
      return await base44.integrations.Core.SendEmail({
        to: toEmail,
        subject,
        body: plainTextBody
      });
    });

    if (!sendResult.success) {
      console.error(`[EmailSender] Send failed after ${sendResult.attempt_count} attempts:`, sendResult.error);
      
      // Log permanent failure
      await base44.entities.SecurityEvent.create({
        event_type: 'email_send_failed_permanent',
        email: toEmail,
        details: `Failed to send template ${templateCode} after ${sendResult.attempt_count} attempts. Error: ${sendResult.error}`
      });

      // Send admin alert
      try {
        await base44.integrations.Core.SendEmail({
          to: 'admin@marketingio.co.za',
          subject: `[ALERT] Email send failed (permanent): ${templateCode}`,
          body: `Email send failed after 3 retries.\n\nTemplate: ${templateCode}\nRecipient: ${toEmail}\nError: ${sendResult.error}\n\nVariables used: ${JSON.stringify(variables, null, 2)}`
        });
      } catch (err) {
        console.error('Failed to send admin alert:', err);
      }

      return { success: false, error: sendResult.error, attempt_count: sendResult.attempt_count };
    }

    // 5. Log success
    if (clientId) {
      try {
        await base44.entities.ClientActivityLog.create({
          client_id: clientId,
          event_type: 'email_sent',
          event_label: `Sent: ${template.name}`,
          logged_by: 'system',
          logged_by_name: 'Email System'
        });
      } catch (err) {
        console.error('Failed to log activity:', err);
      }
    }

    console.log(`[EmailSender] Success: ${templateCode} sent to ${toEmail} (attempt ${sendResult.attempt_count})`);
    return { success: true, attempt_count: sendResult.attempt_count };
  } catch (error) {
    console.error(`[EmailSender] Unexpected error:`, error);
    return { success: false, error: error.message, attempt_count: 0 };
  }
}