import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Runs daily. Sends a warning email 7 days before expiry and an expiry notice on the day.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let warned = 0;
  let expired = 0;
  let errors = 0;

  try {
    // Fetch all AppUsers that have a password_expires_at set
    const allUsers = await base44.asServiceRole.entities.AppUser.list('-created_date', 500);
    const users = Array.isArray(allUsers) ? allUsers : [];

    for (const user of users) {
      if (!user.password_expires_at || !user.email) continue;
      const expiresAt = new Date(user.password_expires_at);

      // Already expired
      if (expiresAt <= now) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: 'Action required: Your password has expired',
            body: `
              <p>Hi ${user.full_name || 'there'},</p>
              <p>Your Marketing iO portal password <strong>has expired</strong>.</p>
              <p>Please log in and update your password immediately under <strong>Settings → Security → Change password</strong>.</p>
              <p>You will not be able to access certain features until your password is updated.</p>
              <p>The Marketing iO Team</p>
            `
          });
          expired++;
        } catch (e) {
          console.error('[sweep-password-expiry] expired email failed for', user.email, e?.message);
          errors++;
        }
        continue;
      }

      // Expiring within 7 days
      if (expiresAt <= in7Days) {
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: user.email,
            subject: `Reminder: Your password expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
            body: `
              <p>Hi ${user.full_name || 'there'},</p>
              <p>Your Marketing iO portal password will expire in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.</p>
              <p>Please log in and update your password now under <strong>Settings → Security → Change password</strong> to avoid being locked out.</p>
              <p>The Marketing iO Team</p>
            `
          });
          warned++;
        } catch (e) {
          console.error('[sweep-password-expiry] warning email failed for', user.email, e?.message);
          errors++;
        }
      }
    }
  } catch (err) {
    console.error('[sweep-password-expiry] failed:', err);
    return Response.json({ error: err?.message }, { status: 500 });
  }

  return Response.json({ success: true, warned, expired, errors });
});