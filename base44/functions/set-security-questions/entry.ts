import { createClientFromRequest } from 'npm:@base44/sdk@0.8.30';
import bcrypt from 'npm:bcryptjs@2.4.3';

const QUESTIONS = [
  "What is your mother's maiden name?",
  "What primary school did you attend?",
  "What is your favourite car?",
  "What town were you born in?"
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { session_token, answers } = await req.json();

  if (!session_token) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (!Array.isArray(answers) || answers.length !== 4) {
    return Response.json({ error: 'All 4 security question answers are required.' }, { status: 400 });
  }
  for (let i = 0; i < 4; i++) {
    if (!answers[i] || String(answers[i]).trim().length < 1) {
      return Response.json({ error: `Answer ${i + 1} is empty.` }, { status: 400 });
    }
  }

  // Authenticate via session token
  const users = await base44.asServiceRole.entities.AppUser.filter({ session_token });
  const user = users?.[0];
  if (!user) {
    return Response.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
  }
  if (user.session_expires_at && new Date(user.session_expires_at) < new Date()) {
    return Response.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
  }

  // Already set — locked, cannot overwrite
  if (user.security_questions_set_at) {
    return Response.json({ error: 'Security questions already set. Contact support to reset.' }, { status: 409 });
  }

  // Hash all 4 answers (trim + lowercase for case-insensitive matching)
  const hashes = await Promise.all(
    answers.map(a => bcrypt.hash(String(a).trim().toLowerCase(), 12))
  );

  await base44.asServiceRole.entities.AppUser.update(user.id, {
    security_question_1_answer_hash: hashes[0],
    security_question_2_answer_hash: hashes[1],
    security_question_3_answer_hash: hashes[2],
    security_question_4_answer_hash: hashes[3],
    security_questions_set_at: new Date().toISOString()
  });

  return Response.json({ success: true });
});