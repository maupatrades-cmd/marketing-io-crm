import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { Resend } from 'npm:resend@3.2.0';

function wrapEmail(bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Marketing iO</title></head>
<body style="margin:0;padding:0;background-color:#0a0a2e;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a2e;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;">
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;"/>
</td></tr>
<tr><td style="padding:32px 24px;background-color:#ffffff;font-size:16px;line-height:1.6;color:#1e293b;font-family:Arial,Helvetica,sans-serif;">
${bodyHtml}
</td></tr>
<tr><td align="center" style="padding:0;font-size:0;line-height:0;background-color:#0a0a2e;">
<img src="https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;"/>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendOwnerAlert(email, fullName) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const body = `
    <p style="margin:0 0 16px 0;"><strong>Security Alert</strong></p>
    <p style="margin:0 0 16px 0;">A user has exhausted all 3 recovery attempts for their account:</p>
    <ul style="margin:0 0 16px 0;">
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Name:</strong> ${fullName || 'Unknown'}</li>
      <li><strong>Time:</strong> ${new Date().toISOString()}</li>
    </ul>
    <p style="margin:0;">The user has been directed to the password-reset flow. No action required unless they contact support.</p>`;
  await resend.emails.send({
    from: 'Marketing iO Security <hello@marketingio.co.za>',
    to: 'info@marketingio.co.za',
    subject: `Failed security recovery for user: ${email}`,
    html: wrapEmail(body)
  }).catch(err => console.error('[recover-account] owner alert failed:', err));
}

// Maps question index (1-4) to AppUser hash field
const HASH_FIELDS = {
  1: 'security_question_1_answer_hash',
  2: 'security_question_2_answer_hash',
  3: 'security_question_3_answer_hash',
  4: 'security_question_4_answer_hash'
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { email, answers } = await req.json();
  // answers = [{question_index: 1, answer: "..."}, {question_index: 3, answer: "..."}, ...]

  if (!email || !Array.isArray(answers) || answers.length !== 3) {
    return Response.json({ error: 'Email and 3 answers required.' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const users = await base44.asServiceRole.entities.AppUser.filter({ email: normalizedEmail });
  const user = users?.[0];

  if (!user) {
    return Response.json({ error: 'No account found.' }, { status: 404 });
  }

  // Must have security questions set
  if (!user.security_questions_set_at) {
    return Response.json({ error: 'Security questions not set for this account. Use password reset instead.', fallback: true }, { status: 422 });
  }

  // Must be in post-lockdown state
  if (!user.password_reset_required) {
    return Response.json({ error: 'Account is not in recovery mode.' }, { status: 400 });
  }

  // Recovery attempt lock check
  if (user.recovery_attempts_locked_until && new Date(user.recovery_attempts_locked_until) > new Date()) {
    const msLeft = new Date(user.recovery_attempts_locked_until) - new Date();
    const minsLeft = Math.ceil(msLeft / 60000);
    return Response.json({
      error: `Too many failed attempts. Try again in ${minsLeft} minute${minsLeft === 1 ? '' : 's'} or reset your password.`,
      fallback: true
    }, { status: 429 });
  }

  // Verify all 3 answers
  let allCorrect = true;
  for (const { question_index, answer } of answers) {
    const hashField = HASH_FIELDS[question_index];
    if (!hashField || !user[hashField]) { allCorrect = false; break; }
    const match = await bcrypt.compare(String(answer).trim().toLowerCase(), user[hashField]);
    if (!match) { allCorrect = false; break; }
  }

  if (!allCorrect) {
    const newCount = (user.recovery_attempts_count || 0) + 1;
    const updateData = { recovery_attempts_count: newCount };

    if (newCount >= 3) {
      updateData.recovery_attempts_locked_until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.AppUser.update(user.id, updateData);
      try { await sendOwnerAlert(normalizedEmail, user.full_name); } catch (_) {}
      return Response.json({
        error: 'Answers incorrect. You have used all 3 attempts. Use password reset instead.',
        fallback: true,
        attempts_exhausted: true
      }, { status: 403 });
    }

    await base44.asServiceRole.entities.AppUser.update(user.id, updateData);
    const attemptsLeft = 3 - newCount;
    return Response.json({
      error: `Incorrect answers. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
      attempts_left: attemptsLeft
    }, { status: 403 });
  }

  // All correct — issue recovery token (15 min)
  const recoveryToken = crypto.randomUUID();
  const tokenExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await base44.asServiceRole.entities.AppUser.update(user.id, {
    recovery_token: recoveryToken,
    recovery_token_expires_at: tokenExpires,
    recovery_attempts_count: 0,
    recovery_attempts_locked_until: null
  });

  return Response.json({ success: true, recovery_token: recoveryToken });
});