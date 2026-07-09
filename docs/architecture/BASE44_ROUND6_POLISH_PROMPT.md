# MARKETING iO CRM — POLISH & COMPLETION PROMPT (ROUND 6)

> **Purpose:** Self-contained prompt for the Base44 AI builder. Pick up where the 5-round recovery plan ended (PRs #58–#62) and complete the existing flows into a fully operational CRM.
> **Status:** Ready to paste into Base44 task-by-task. Each task is independently verifiable.
> **Scope discipline:** This is polish. Closes gaps in flows already half-built. **Does not introduce new features.** See "DO NOT BUILD" at the bottom.

---

## CONTEXT (give this to the Base44 AI before any task)

This is the Marketing iO CRM. Five rounds of recovery work have already shipped (PRs #58–#62) and are merged. Those rounds fixed the spine: invoice status integrity, payfast→invoice wiring, the empty Activity tab, RLS on the four most-exposed entities (Commission, OTPCode, AppUser, InternalMessage), auto-Contract on Deal closed-won, auto-Invoice on Contract signed, recurring monthly retainer batch, the `/admin/invoices` chase queue, the onboarding SLA flag and "review & hand off" action, the two stub pages, the OwnerDashboard real chart, and owner→staff user provisioning.

**This prompt is the polish round.** Closes gaps in flows already half-built. **Do NOT introduce new features** — see the "DO NOT BUILD" list at the bottom.

**Existing entities used here:** Client, Deal, Contract, Invoice, Payment, Commission, ClientActivityLog, ClientNotification, ClientCommunication, Deliverable, FulfilmentTemplate, ClientOnboardingSubmission, OnboardingStep, Lead, LoginAttempt, SecurityEvent, Task, ServiceOrder, AppUser, User, EmailTemplate, InternalMessage.

**Existing functions used:** create-invoice, calculate-commission, log-client-activity, notifyClient, list-client-activity, mark-invoice-paid-eft, send-invoice-chase, generate-monthly-retainer-invoices, on-deal-closed-won-create-contract, payfast-itn, send-onboarding-progress-email.

**Rules:**
1. Every new function is idempotent.
2. Every entity write that user-faces also writes a ClientActivityLog row.
3. Every change has a verification step that opens a page or invokes a function.
4. No new entities unless explicitly listed.
5. Don't rename anything; backwards-compat matters.
6. RLS rules use the role permission matrix from blueprint Section 2.

---

## TASK A — Auto-create Deliverables from FulfilmentTemplate on onboarding hand-off

**Problem:** The "Review & hand off to head_of_tech" button on `/onboarding-submissions` (Round 4) creates a Task and notifies head_of_tech, but doesn't actually provision Deliverable rows. Head_of_tech opens an empty queue.

**Do:**

1. Create a new function `auto-create-deliverables-from-template` accepting `{ token, client_id, deal_id, package_code }`. Validates session token, requires role `owner` or `admin`.
2. Logic:
   - Look up `FulfilmentTemplate` by `code` matching `package_code` (or by `bucket` if no code match).
   - Idempotency: check `Deliverable.filter({ client_id, deal_id })` first. If any exist, return `{ skipped: true, reason: 'deliverables_exist', count }` and stop.
   - For each item in the template's deliverables list, create a `Deliverable` row with `client_id`, `deal_id`, `title`, `status='not_started'`, due_date computed from the template's `sla_days` field (if present), and `assigned_role='head_of_tech'` (or whatever the template specifies).
   - Write a `ClientActivityLog` row with `event_type='deliverables_provisioned'`, `event_category='document'`, `event_summary='N deliverables created from <package> template'`.
   - Return `{ success: true, created_count, deliverable_ids[] }`.
3. Modify `src/pages/ClientOnboardingReview.jsx`. In the `reviewAndHandOff` action, after creating the Task and the InternalMessage, invoke the new function with the submission's `client_id`, `deal_id`, and resolved `package_code` (look up the Deal to get its `package` field). Wrapped in try/catch — non-fatal on failure (admin still has the Task as a manual fallback).
4. Verify: submit a test onboarding form for a client whose deal has package='ignite'. Click "Review & hand off". Confirm Deliverable rows appear in `/deliverables` for that client, mapping to the FulfilmentTemplate. Click again — confirm zero new deliverables (idempotency).

---

## TASK B — Overdue invoice sweep

**Problem:** The Overdue tab on `/admin/invoices` only fills if Invoice.status is actually `'overdue'`. Today nothing flips `'sent'` rows to `'overdue'` when their `due_date` passes. The tab shows rows via the *computed* fallback (`status='sent' AND due_date<today`) but the entity itself never updates, so reports based on `Invoice.status='overdue'` are wrong.

**Do:**

1. Create a new function `sweep-overdue-invoices` accepting `{ token, dry_run? }`. Validates session token, requires role `owner` or `admin`.
2. Logic:
   - Find all Invoice rows where `status='sent'` AND `due_date < today`.
   - For each, update `status='overdue'`.
   - Write a `ClientActivityLog` row with `event_type='invoice_overdue'`, `event_category='invoice'`.
   - Idempotency comes from the filter: a row already `'overdue'` is not selected.
   - If `dry_run=true`, return the candidate list without updating.
   - Return `{ updated_count, dry_run, candidates }`.
3. Add a "Sweep overdue" header button on `/admin/invoices` (next to "Generate this month's batch") that:
   - First call: `dry_run=true`, opens a preview modal showing N invoices that will flip.
   - Confirm: invokes again with `dry_run=false`, refreshes the list, toasts the result.
4. Defer scheduled execution to when Base44 cron support is configured. Document a TODO inline in the function header: `// CRON: schedule daily at 06:00 SAST.`
5. Verify: create a test invoice with `status='sent'` and `due_date` 7 days in the past. Click "Sweep overdue" preview — confirm it appears. Confirm-execute. Confirm `Invoice.status='overdue'`. Run again — confirm zero updates.

---

## TASK C — Contract renewal sweep (30 / 7 / 0 day reminders)

**Problem:** `EmailTemplate.code='renewal_reminder'` was seeded months ago. Nothing fires it. Contracts approach end with no automated nudge.

**Do:**

1. Create a new function `sweep-contract-renewals` accepting `{ token, dry_run? }`. Validates session token, requires role `owner` or `admin`.
2. Logic:
   - Find Contract rows where `status` in `['signed', 'active']` AND `auto_renews=true` AND `contract_end_date` is exactly 30, 7, or 0 days from today (in SAST).
   - Idempotency: track which reminders have been sent via a per-contract field `last_renewal_reminder_at` (add this field to Contract.jsonc — string, format: date-time). Skip if a reminder of the same stage has already been sent today.
   - For each candidate, send the existing `renewal_reminder` email template via Resend, populating template variables (`business_name`, `contract_end_date`, `renewal_term`, `cancellation_email`).
   - Use the same wrapEmail pattern as `cancel-invoice` and `send-invoice-chase` (mirror the brand wrapper inline).
   - Write a `ClientActivityLog` row `event_type='renewal_reminder_sent'`, `event_category='communication'`, with the stage in metadata.
   - Update `Contract.last_renewal_reminder_at = now`.
   - Return `{ sent_count, candidates }`.
3. Schema change: add `last_renewal_reminder_at` to `Contract.jsonc` as `{ "type": "string", "format": "date-time" }`. Optional field (don't add to required).
4. Defer scheduled execution to Base44 cron. Document TODO in function header: `// CRON: schedule daily at 09:00 SAST.`
5. Add a manual trigger button on `/admin/invoices` header (small, secondary) labelled "Send renewal reminders" — same dry-run-then-confirm flow as overdue sweep.
6. Verify: create a test Contract with `contract_end_date` = today + 30 days, `auto_renews=true`. Run dry_run — confirm it appears. Run real — confirm email arrives at the client and `last_renewal_reminder_at` is set. Run again same day — confirm zero new sends.

---

## TASK D — Client cancel / reactivate / 30-day churn grace

**Problem:** `Client.status` enum allows `'cancelled'` and `'churned'` but nothing in code transitions a client to either. Cancellation is currently "admin updates a spreadsheet."

**Do:**

1. **Schema change to `Client.jsonc`:** add three optional fields:
   - `deactivated_at` — string, format date-time. Set when client is cancelled.
   - `archived_at` — string, format date-time. Set when client moves to churned (post-grace).
   - `cancellation_reason` — string. Free-form admin note.
2. Create function `cancel-client` accepting `{ token, client_id, reason }`. Validates session token, requires role `owner` or `admin`.
   - Idempotency: if `Client.status` is already `'cancelled'` or `'churned'`, return `{ skipped: true, current_status }`.
   - Updates: `status='cancelled'`, `deactivated_at=now`, `cancellation_reason=reason`.
   - Cancels any Invoice rows for this client where `status='sent'` (call `cancel-invoice` for each, with reason `Client cancelled`). Skip already paid/overdue/cancelled.
   - Writes ClientActivityLog: `event_type='client_cancelled'`, `event_category='account'`.
3. Create function `reactivate-client` accepting `{ token, client_id }`. Validates session token, requires role `owner`.
   - Idempotency: if `Client.status` is already `'active'`, return `{ skipped: true }`.
   - Only reactivates clients in `'cancelled'` (within 30-day grace) — refuses if `'churned'` (data may have been archived; reactivation requires owner manual reset).
   - Updates: `status='active'`, clears `deactivated_at` and `cancellation_reason`.
   - Writes ClientActivityLog: `event_type='client_reactivated'`.
4. Create function `sweep-client-churn` accepting `{ token, dry_run? }`. Owner+admin only.
   - Finds Client rows where `status='cancelled'` AND `deactivated_at < now - 30 days`.
   - Updates each to `status='churned'`, sets `archived_at=now`.
   - Writes ClientActivityLog `event_type='client_churned'`.
   - Defer scheduled execution to Base44 cron. Document TODO: `// CRON: schedule daily at 03:00 SAST.`
5. Add UI on `/clients/:id` (OwnerClientDetail) — admin/owner only — a small action menu with:
   - "Cancel client" button (if status active/onboarding/lead/prospect/suspended) → opens modal asking for reason → invokes `cancel-client`.
   - "Reactivate client" button (if status='cancelled') → confirm dialog → invokes `reactivate-client`.
   - Status banner at top of page if `status` in `['cancelled', 'churned']` showing `deactivated_at` / `archived_at` and `cancellation_reason`.
6. Verify: cancel a test client. Confirm status flips, an unpaid invoice gets cancelled, ClientActivityLog row exists. Reactivate within grace — confirm flip back. Force-set `deactivated_at` to >30 days ago, run sweep-client-churn — confirm flip to churned.

---

## TASK F — ClientNotification recipient model + admin alerts

**Problem:** `ClientNotification` requires `client_id`, so it can't model "notify all admins" or "notify head_of_tech" without a specific client context. There's no admin notification model today.

**Do:**

1. **Schema changes to `ClientNotification.jsonc`:**
   - **Remove** `client_id` from the `required` array (keep it as a property — still useful when the notification is *about* a client).
   - **Add** `recipient_user_id` — string. The intended recipient's user id.
   - **Add** `recipient_role` — string with enum `["client", "owner", "admin", "head_of_tech", "field_agent", "cpc"]`. Used when broadcasting to a role rather than a specific user.
   - **Add** RLS rule:
     - read: `data.recipient_user_id == user.id` OR (`data.client_id != null` AND `data.client_id == user.data.client_id`) OR `user_condition: { role: "owner" }`
     - create: any authenticated (server functions write these via asServiceRole anyway)
     - update: `data.recipient_user_id == user.id` (recipient marks read) OR `user_condition: { role: "owner" }`
     - delete: owner only
2. Create helper function `notify-staff` accepting `{ token, recipient_user_id?, recipient_role?, title, body, link?, related_client_id? }`. Validates session token, requires authenticated user (any role).
   - At least one of `recipient_user_id` / `recipient_role` must be set.
   - If `recipient_role` is set, fan-out: look up all users with that role and create one notification per recipient (with `recipient_user_id` populated for each).
   - Otherwise, single create with the supplied `recipient_user_id`.
   - Returns `{ created_count, notification_ids[] }`.
3. **Wire 4 admin alerts** (each a single-line invoke at the existing event point):
   - **New onboarding submission** — call `notify-staff` with `recipient_role='admin'` from `notifyAdminFormSubmitted` (already exists; add the call alongside the existing email).
   - **Payment failed** — call `notify-staff` with `recipient_role='admin'` from `payfast-itn` failed branch (around the existing ClientActivityLog write).
   - **Lead awaiting verification > 24h** — invoke from a new function `sweep-stale-leads` (similar pattern to overdue/renewal sweeps), `dry_run` flag, manual trigger button on `/staff/verify-leads` page, defer cron.
   - **Invoice overdue >7 days** — call `notify-staff` from inside `sweep-overdue-invoices` (Task B) when an invoice flips with days_overdue >= 7.
4. Update `src/components/AppLayout.jsx`. Add badge counts for non-client roles by reading `ClientNotification.filter({ recipient_user_id: user.id, is_read: false })`. Surface count next to a bell icon in the header (or on the sidebar, owner's choice). When clicked, navigate to a new page `/notifications` (next step).
5. Create new page `src/pages/Notifications.jsx`. Lists notifications for the current user (filter by `recipient_user_id`), grouped by read/unread. "Mark all as read" button. RouteGuard owner/admin/field_agent/cpc/head_of_tech/driver. Add route in App.jsx and a sidebar entry under each non-client role's nav block.
6. Verify: sign in as admin. Submit a test onboarding form. Confirm a notification badge appears within polling interval. Open `/notifications` — confirm it lists the row. Mark as read — confirm badge clears.

---

## TASK G — RLS on 8 more entities

**Problem:** Round 2 hardened the four worst (Commission, OTPCode, AppUser, InternalMessage). The remaining ~36 entities are still exposed via the front-end SDK if any client-side code calls them directly. Pick the next 8 by sensitivity.

**Do:** Add an `rls` block to each entity below. Mirror the pattern style of `Client.jsonc` and `Invoice.jsonc` (which already work — keep `user_condition` role checks and `data.X == {{user.id}}` predicates).

1. **`Lead.jsonc`** — read: owner OR admin OR field_agent (own only) OR cpc (own only). Create: owner+admin+field_agent+cpc. Update: owner+admin (verify/reject). Delete: owner only.
2. **`LoginAttempt.jsonc`** — all operations: owner only. Server-only entity; auth functions use asServiceRole.
3. **`SecurityEvent.jsonc`** — all operations: owner only. Server-only entity.
4. **`Contract.jsonc`** — read: own (`data.client_id == user.data.client_id`) OR owner OR admin. Create/update: owner+admin. Delete: owner only.
5. **`Deliverable.jsonc`** — read: own (`data.client_id == user.data.client_id`) OR owner OR admin OR (head_of_tech and `data.assigned_role='head_of_tech'`). Create/update: owner+admin+head_of_tech. Delete: owner.
6. **`Task.jsonc`** — read: assigned_to matches OR owner OR admin. Create: any authenticated staff. Update: assigned_to matches OR owner+admin. Delete: owner.
7. **`ServiceOrder.jsonc`** — read: own (`data.client_id == user.data.client_id`) OR owner+admin. Create: own (`data.client_id == user.data.client_id`) OR owner+admin. Update: owner+admin. Delete: owner.
8. **`ClientNotification.jsonc`** — already covered in Task F. Skip if Task F is already done.

For each: verify after deploy by signing in as a client and trying `await base44.entities.X.list()` in the browser console. Expect empty/forbidden where appropriate.

---

## REFERENCE — Cron schedule recommendation

When Base44 scheduled jobs are configured, run the following daily:

| Time (SAST) | Function | Purpose |
|---|---|---|
| 03:00 | `sweep-client-churn` | Cancelled → Churned after 30 days |
| 06:00 | `sweep-overdue-invoices` | sent → overdue when due_date passed |
| 06:30 | `sweep-stale-leads` | Notify admins of leads pending >24h |
| 09:00 | `sweep-contract-renewals` | 30/7/0-day renewal reminders |
| 1st of month, 07:00 | `generate-monthly-retainer-invoices` | Auto-recurring batch (currently manual via Round 3 button) |

Keep the manual trigger buttons for all of these — cron failure shouldn't kill the operation.

---

## REFERENCE — DEFINITION OF DONE FOR ROUND 6

- [ ] Onboarding hand-off creates Deliverables (Task A end-to-end test).
- [ ] An invoice with `status='sent'` and past due_date flips to `'overdue'` after sweep.
- [ ] A contract 30 days from end_date sends an email and bumps `last_renewal_reminder_at`.
- [ ] Cancelling a client cancels their unpaid invoices and writes audit log.
- [ ] Reactivation works within grace; refused after grace.
- [ ] Admin sees notification badge for new onboarding submission, lead pending verification, payment failed, invoice 7+ days overdue.
- [ ] All 8 entities in Task G show their RLS block in the Base44 console after deploy.
- [ ] Sign in as a client; cannot list `Lead`, `Contract`, `Deliverable`, `Task`, `ServiceOrder`, `LoginAttempt`, `SecurityEvent` for clients other than themselves.

---

## DO NOT BUILD (defer with prejudice)

These are explicitly not in this round per the blueprint Section 8.5. If a sub-prompt asks for any of them, refuse and report back.

1. Strategic dashboards: MRR roll-up, runway calculator, churn dashboard, cohort retention, CAC/LTV. Build the data pipeline first; templates are presentation glue.
2. CPC / Field Agent submission flows + proposal builder. Post-launch.
3. Driver role build-out (routes, zones, photo evidence). No Pulse demand yet.
4. Resend wrapper consolidation across 27 functions. Refactor with no user-facing value pre-launch.
5. `User → AppUser` full migration. The dual-entity reality works; 66 callers depend on User.
6. Brand-kit / package-pricing CMS. Edit code for now.
7. Year-end statement / per-receipt PDF for clients. Post-launch.
8. Bank reconciliation CSV upload. Post-launch.
9. Mobile-first sales redesign. Post-launch.
10. FNC referral logging UI (the entity exists; the commission engine handles it; the UI is a new feature).
11. More tabs on `OwnerClientDetail`. Already 10; trim before adding.

---

## TASK ORDER

Run in this order. Each task is independently verifiable. Don't move on until verification passes.

1. Task G (RLS) — fastest wins, locks down what's already exposed.
2. Task A (Deliverables) — completes the onboarding flow.
3. Task B (Overdue sweep) — completes the Invoice state machine.
4. Task F (Notification model) — unblocks admin alerts that other tasks reference.
5. Task C (Renewal sweep) — uses Task F's `notify-staff` for the admin "renewal reminder sent" log.
6. Task D (Client lifecycle) — uses Task F's `notify-staff` for the cancel/churn alerts.

---

**END OF PROMPT.** Round 6 polishes the existing five-round recovery into a complete operational CRM. After this round, the only items remaining are the post-launch features in the "DO NOT BUILD" list above.
