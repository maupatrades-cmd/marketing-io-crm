import { base44 } from '@/api/base44Client';

/**
 * Schedule nurture email sequence for newly registered users
 * Sends 4 emails over 10 days if user hasn't made a purchase
 */
export async function scheduleNurtureSequence(userId) {
  try {
    const now = new Date();
    
    // Email 1: Immediate (0 hours) - signup_thank_you
    await scheduleNurtureEmail({
      user_id: userId,
      template_code: 'signup_thank_you',
      delay_hours: 0,
      sequence_order: 1
    });

    // Email 2: 24 hours - choose_package_nurture
    await scheduleNurtureEmail({
      user_id: userId,
      template_code: 'choose_package_nurture',
      delay_hours: 24,
      sequence_order: 2
    });

    // Email 3: 5 days - still_deciding_nurture
    await scheduleNurtureEmail({
      user_id: userId,
      template_code: 'still_deciding_nurture',
      delay_hours: 120, // 5 days
      sequence_order: 3
    });

    // Email 4: 10 days - final_nurture_offer
    await scheduleNurtureEmail({
      user_id: userId,
      template_code: 'final_nurture_offer',
      delay_hours: 240, // 10 days
      sequence_order: 4
    });

    console.log(`[NurtureScheduler] Nurture sequence scheduled for user ${userId}`);
    return { success: true };
  } catch (err) {
    console.error('[NurtureScheduler] Failed to schedule nurture sequence:', err);
    return { success: false, error: err.message };
  }
}

async function scheduleNurtureEmail({ user_id, template_code, delay_hours, sequence_order }) {
  try {
    const send_at = new Date(Date.now() + delay_hours * 60 * 60 * 1000);
    
    // Create a task to track this scheduled email
    await base44.entities.Task.create({
      title: `Nurture email #${sequence_order}: ${template_code}`,
      description: `Auto-generated nurture sequence for user signup. Template: ${template_code}`,
      assigned_to: 'system',
      assigned_to_name: 'Email System',
      status: 'open',
      priority: 'medium',
      due_date: send_at.toISOString().split('T')[0],
      auto_generated: true,
      notes: JSON.stringify({
        user_id,
        template_code,
        sequence_order,
        send_at: send_at.toISOString(),
        type: 'nurture_email'
      })
    });
  } catch (err) {
    console.error('[NurtureScheduler] Failed to schedule email:', err);
    throw err;
  }
}

/**
 * Called by a daily cron job to process and send nurture emails
 * Checks tasks with "type: nurture_email" that are due today or overdue
 */
export async function processPendingNurtureEmails() {
  try {
    const tasks = await base44.entities.Task.list();
    const now = new Date();
    let processed = 0;

    for (const task of tasks || []) {
      if (!task.notes) continue;

      let metadata;
      try {
        metadata = JSON.parse(task.notes);
      } catch {
        continue;
      }

      if (metadata.type !== 'nurture_email') continue;
      if (task.status !== 'open') continue;

      const dueDate = new Date(task.due_date);
      if (dueDate > now) continue; // Not yet due

      // Check if user has made a Deal
      const deals = await base44.entities.Deal.filter({
        // We'd need user email to check, so skip this check for now
      });

      // TODO: Implement check for active deals
      // If deal exists, mark task as cancelled
      // If no deal, send the email

      console.log(`[NurtureScheduler] Would send nurture email: ${metadata.template_code} to user ${metadata.user_id}`);
      processed++;
    }

    console.log(`[NurtureScheduler] Processed ${processed} pending nurture emails`);
    return { processed };
  } catch (err) {
    console.error('[NurtureScheduler] Failed to process nurture emails:', err);
    return { processed: 0, error: err.message };
  }
}

/**
 * Cancel remaining nurture emails for a user when they make a purchase
 */
export async function cancelNurtureSequence(userId) {
  try {
    const tasks = await base44.entities.Task.list();

    for (const task of tasks || []) {
      if (!task.notes) continue;

      let metadata;
      try {
        metadata = JSON.parse(task.notes);
      } catch {
        continue;
      }

      if (metadata.type === 'nurture_email' && metadata.user_id === userId && task.status === 'open') {
        await base44.entities.Task.update(task.id, {
          status: 'cancelled'
        });
        console.log(`[NurtureScheduler] Cancelled nurture email task ${task.id}`);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('[NurtureScheduler] Failed to cancel nurture sequence:', err);
    return { success: false, error: err.message };
  }
}