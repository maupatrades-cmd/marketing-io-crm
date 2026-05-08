# Marketing iO CRM — Master Recovery & Polish Prompt for Base44 Builder (NEW APP)

> **Use this when:** you've created a fresh Base44 app for Marketing iO and you want the AI builder to apply all 21 recovery + polish tasks from scratch, in order. Paste **task-by-task**, not all at once. Each task is independently verifiable. Don't move to the next until verification passes.
> **Do NOT use this for:** a partial migration on top of an existing app that already has some of these changes — you'll get duplicate entities, conflicting RLS, etc. Use only on a clean fresh app.

---

## CONTEXT — give this to the Base44 AI before any task

This is **Marketing iO CRM** — operational system for a South African SME marketing-services agency. Sells packages (Ignite/Accelerate/Dominate setup R700–R9,800 + monthly retainers R200–R4,000) plus add-ons (SMS, WhatsApp, websites, Google Ads, Pulse street/township activations).

**Roles:** owner, admin, field_agent, cpc, head_of_tech, driver, client.

**Required entities** (create these via the schema management tools before any task that uses them, if not already present):

`Client, Deal, Contract, Invoice, Payment, Commission, ClientActivityLog, ClientNotification, ClientCommunication, Deliverable, FulfilmentTemplate, ClientOnboarding, ClientOnboardingProgress, ClientOnboardingSubmission, OnboardingStep, Lead, LoginAttempt, SecurityEvent, Task, ServiceOrder, AppUser, User, EmailTemplate, InternalMessage, ClientUpload, ClientThread, ClientThreadMessage, EnquiryEvent, MonthlyReport, MilestoneTracker, StaffRecord, KPITarget, Playbook, FNCReferral, MarketingCampaign, CampaignSend, CheckoutEngagement, AbandonedCartSequence, EmailPreferences, GeneratedImage, PackageEmailImage, OTPCode, ContractSignature, TimeLog, DeliverableFeedback, ClientAddOn, StaffMilestone, InteractionNote, SystemSettings`

**Rules for every task:**

1. Every new function is idempotent — re-running it produces the same result.
2. Every entity write that user-faces also writes a `ClientActivityLog` row with `event_type`, `event_category`, `event_summary`.
3. Every change has a verification step the human owner runs before moving on.
4. No new entities unless explicitly listed in the task.
5. Don't rename existing fields. Backwards-compat matters.
6. RLS rules use the role permission matrix in the Reference section at the bottom.

---

# PHASE 1 — DATA INTEGRITY FOUNDATIONS (Tasks 1-5)

## TASK 1 — Invoice status corruption

**Problem:** The `create-invoice` function commonly defaults to writing `status: 'issued'`, but the Invoice schema enum is `[draft, sent, paid, overdue, failed, cancelled, partial]`. There is no `'issued'`. Every invoice ever written via this function lands in an out-of-enum state, so the Paid/Unpaid tabs on the client portal never populate correctly.

**Do:**

1. In the `create-invoice` function, change the line that writes `status: 'issued'` to `status: 'sent'`.
2. Run a one-shot data backfill via the data console: `UPDATE Invoice SET status = 'sent' WHERE status = 'issued'`.
3. Verify: create a test invoice via the existing flow. Open the resulting Invoice row. Confirm status is `sent`. Open `/client/invoices` as the buyer and confirm it shows on the Unpaid tab.

---

## TASK 2 — PayFast → Invoice propagation

**Problem:** The `payfast-itn` function updates `Payment.status` to `successful` on a successful payment but never touches `Invoice.status`. Successful payments leave invoices stuck in `'sent'`. The Paid tab and any chase queue keyed on Invoice.status are always empty.

**Do:**

1. In the `payfast-itn` function, after the existing `Payment.update` succeeds:
   - If the Payment row has an `invoice_id` set AND the new payment status is `successful` or `failed`, update the linked Invoice. On success: `status='paid'`, `paid_at=now()`. On failure: `status='failed'` (preserve `due_date`).
   - Wrap in try/catch — non-fatal because the Payment row is already in its terminal state.
2. Verify: run an R1 sandbox PayFast test transaction. Confirm Invoice row flips to `paid` with `paid_at` populated. Confirm `/client/invoices` Paid tab populates.

---

## TASK 3 — `/staff` route conflict

**Problem:** Two pages may be registered at `/staff` — `StaffHR` (owner-only HR page) and `StaffMyDay` (staff personal dashboard). The first registration wins, so all staff users (field_agent, cpc, head_of_tech, driver) navigating to `/staff` land on the owner HR page.

**Do:**

1. Move `StaffHR` to `/owner/staff-hr`. Wrap in a route guard for `owner` only.
2. Keep `StaffMyDay` at `/staff` with a route guard for `admin`, `owner`, `field_agent`, `cpc`, `head_of_tech`, `driver`.
3. Update internal sidebar links: the owner sidebar's "Staff & HR" entry now points to `/owner/staff-hr`. The non-owner role sidebars' "My Day" entries continue to point to `/staff`.
4. Verify: sign in as a field_agent test account, navigate to `/staff`, confirm StaffMyDay renders. Sign in as owner, navigate to `/owner/staff-hr`, confirm StaffHR renders.

---

## TASK 4 — Empty Activity tab on owner-side `/clients/:id`

**Problem:** Owner opens any client detail page, clicks Activity tab, sees nothing — even when the same client has activity rows visible on their own `/client/activity` page. Root cause: the RLS read rule on ClientActivityLog has role-based OR branches that don't match for staff sessions.

**Do:**

1. Create a new function `list-client-activity`. It accepts `{ session_token, client_id, limit }`. Validates the session token, resolves the user, rejects if the user's role is not `owner` or `admin`, then reads `ClientActivityLog` via service-role access filtered by `client_id`. Returns the rows.
2. In the polling hook used by ActivityFeed (and similar reads on OwnerClientDetail), when the viewer's role is owner or admin, call the new function instead of the direct entity SDK call. Keep direct entity calls for client-role viewers.
3. Verify: sign in as owner, open any client detail page that has activity. Click Activity tab. Confirm rows render.

---

## TASK 5 — RLS hardening on 4 most-exposed entities

**Problem:** Several entities have no RLS, so any authenticated user (even a client) could enumerate them via the SDK if any client-side code reads them.

**Do** — Add RLS to these four entities, mirroring the pattern style of any existing `Client` or `Invoice` RLS:

1. **Commission**: read = `data.user_id == {{user.id}}` OR `data.staff_id == {{user.id}}` OR role=owner. Create = owner OR admin (LogSale and Deals do bulkCreate from front-end). Update = owner only. Delete = owner only.
2. **OTPCode**: all four operations = owner only. Server-only entity in practice; auth functions all use service-role.
3. **AppUser**: read = `data.id == {{user.id}}` OR `data.email == {{user.email}}` OR role=owner. Update = self by id OR owner. Create/delete = owner only.
4. **InternalMessage**: read = `data.from_id == {{user.id}}` OR `data.to_id == {{user.id}}` OR role=owner. Update = participant OR owner. Create = any authenticated. Delete = owner only.

Verify each: sign in as a client account and try `await base44.entities.<Entity>.list()` in the browser console. Should return empty/forbidden where appropriate.

---

# PHASE 2 — SPINE WIRING (Tasks 6-8)

## TASK 6 — Auto-create Contract on Deal closed-won

**Problem:** When a Deal moves to `stage='closed_won'`, no Contract is created automatically. Admin has to remember to do it. This is the first manual handoff in the revenue spine.

**Do:**

1. Create function `on-deal-closed-won-create-contract`. Triggers on Deal entity update.
2. Logic:
   - When a Deal's stage changes to `closed_won` and no Contract exists for that `deal_id`, create one.
   - Contract fields: `client_id`, `closer_id`, `package`, `setup_fee`, `monthly_retainer` copied from the Deal. Status = `draft`.
   - Idempotency: check `Contract.filter({ deal_id })` first. Skip if any exists.
   - After creation, notify admin/head with "Contract drafted for {client_name} — review and send".
3. Wire it: invoke from the existing closed-won handler (typically `on-deal-won-initiate-onboarding`) inside a try/catch — non-fatal on failure.
4. Verify: change a test Deal's stage to `closed_won`. Confirm a Contract row appears with status `draft`. Trigger again — confirm no duplicate.

---

## TASK 7 — Auto-create setup-fee Invoice on Contract signed

**Problem:** The `onContractSigned` function creates a Task ("Issue Setup Invoice") but doesn't actually create an Invoice. Admin has to remember.

**Do:**

1. In `onContractSigned`, after the existing Task creation, invoke `create-invoice` with: `client_id` from Contract, `invoice_type='setup_fee'`, line item with the Contract's setup_fee, `closer_id`, `due_date` = +7 days.
2. Idempotency: skip the invoke if an Invoice exists with `contract_id` matching AND `invoice_type='setup_fee'`. Re-firing the signature webhook is then safe.
3. If invoice auto-create succeeds, mark the existing Task as `done` (so admin's queue doesn't show duplicates).
4. Verify: sign a test contract via the existing flow. Confirm a setup_fee Invoice row is created with status `sent` (Task 1's fix). Confirm the Task is marked `done`.

---

## TASK 8 — Recurring monthly retainer invoice batch

**Problem:** Monthly retainer invoices for active clients have to be created by hand. No batch generator exists.

**Do:**

1. Create function `generate-monthly-retainer-invoices` accepting `{ token, period?, dry_run? }`. Validates session token, requires role owner or admin.
2. Logic:
   - `period` defaults to current month in SAST format `YYYY-MM`.
   - Find all `Client.status='active'` rows.
   - For each, find their most recent Contract with status in `[signed, active]` and `monthly_retainer > 0`.
   - Skip if Invoice exists for `(client_id, invoice_type='monthly_retainer')` with `issue_date` starting with `period`.
   - Invoke `create-invoice` for each remaining client with `invoice_type='monthly_retainer'`, amount from Contract, due_date = +14 days.
   - If `dry_run=true`, return preview only; don't create.
   - Returns `{ created[], skipped[], total_amount }`.
3. Verify: with 5 test active clients, invoke with `dry_run=true` from the Base44 console. Confirm preview. Re-run with `dry_run=false`. Confirm 5 invoices appear. Run again — confirm zero new (idempotency).

---

# PHASE 3 — ADMIN OPERATIONS UI (Tasks 9-11)

## TASK 9 — `/admin/invoices` chase queue

**Problem:** Admin's most important daily job — chasing unpaid invoices — has no dedicated UI. The owner-level invoice page exposes aggregate financials admin shouldn't see per the role permission matrix.

**Do:**

1. Create page at `/admin/invoices`. Route guard: admin + owner only.
2. **Tabs (with counts):** All / Unpaid (`status='sent'`) / Overdue (`status='overdue'` OR (`status='sent'` AND `due_date<today`)) / Paid / Cancelled.
3. **Columns:** Invoice # / Client / Amount / Issued / Due / Days outstanding (computed) / Last chase date / Status badge / Actions.
4. **Row actions:**
   - View detail (modal): line items + payment history pulled from `Payment.filter({ invoice_id })`.
   - Send chase email: opens stage-select modal (4 templates: Day 1 reminder / Day 3 firm / Day 7 final / Day 14 escalation), optional admin custom-note field. Invokes `send-invoice-chase` (Task 9b).
   - Mark paid (EFT): opens modal for bank reference + paid date. Invokes `mark-invoice-paid-eft` (Task 9c).
   - Open client: navigate to `/clients/:id`.
5. **Bulk:** select multiple via row checkboxes, "Send chase to N" header button uses the same chase modal in bulk mode.
6. **Header actions:** "Generate this month's batch" button — first invokes `generate-monthly-retainer-invoices` with `dry_run=true`, opens preview modal showing N to create / total amount, "Create N invoices" confirm button switches to `dry_run=false`.
7. **Strict per-row visibility — NO aggregate revenue/profit/MRR/runway anywhere on this page.**
8. Add admin sidebar entry: "Invoice Chase" → `/admin/invoices`.

### Task 9b — `send-invoice-chase` function

`POST { invoice_id, stage, token, custom_message? }`. Stage values: `reminder`, `firm`, `final`, `escalation`. Validates session + role (owner/admin). Uses inline HTML template with the existing brand wrapper (mirror cancel-invoice's pattern). Sends via Resend BCC `head@marketingio.co.za`. Logs `ClientCommunication` AND `ClientActivityLog`.

### Task 9c — `mark-invoice-paid-eft` function

`POST { invoice_id, gateway_reference, paid_at?, token, note? }`. Validates session + role. Idempotent: if Invoice already paid, returns existing Payment row. Otherwise creates Payment row `type='eft'`, `status='successful'`, `gateway_reference` from input AND updates Invoice `status='paid'` + `paid_at` + `payment_method='eft'`. Logs ClientActivityLog.

**Verify:** sign in as admin. Open `/admin/invoices`. Send a chase email. Mark an invoice paid via EFT. Click "Generate this month's batch" → preview → confirm. Each action should show a toast and the relevant row should update.

---

## TASK 10 — `/onboarding-submissions` SLA flag + handoff

**Problem:** The existing onboarding review page has no SLA flagging or hand-off action. Admin reviews submissions but the work doesn't actually move forward to fulfilment.

**Do:**

1. Sort submissions: oldest unreviewed first. Submitted-but-not-reviewed always before everything else.
2. Add a red SLA badge on any submission with `submission_status='submitted'` AND `submitted_at` > 3 days ago. Also add a red dot + red border on the row.
3. Add a new action in the detail modal: "Review & hand off to head_of_tech". On click:
   - Update `submission_status='reviewed'`, `reviewed_at=now`.
   - Create a `Task` with `status='open'`, `priority='high'`, `auto_generated=true`, due_date +5 days, title `Begin fulfilment — {client_name}`.
   - Write an `InternalMessage` with `recipient_role='head_of_tech'`, subject `Fulfilment kickoff: {client_name}`.
4. Keep the legacy "Mark as Reviewed" button for cases where admin doesn't want to trigger handoff.
5. Verify: open a test submission older than 3 days. Confirm the red SLA badge. Click "Review & hand off". Confirm a Task lands in `/tasks` and an InternalMessage in `/mail` for head_of_tech.

---

## TASK 11 — Owner → Staff user provisioning

**Problem:** No UI for the owner to create a new admin (or any staff) user. Today this requires direct database manipulation.

**Do:**

1. Add a Users tab on `/owner/settings` (or extend the existing one) with a "Create staff user" button.
2. Form: full_name, email, role (dropdown: admin / field_agent / cpc / head_of_tech / driver), phone.
3. Create function `provision-staff-user` accepting `{ token, full_name, email, role, phone? }`. Validates caller is owner. Creates AppUser with email, role, hashed temp password, `password_reset_token`, `password_reset_expires_at` = +24 hours. Sends a setup email with a link to `/reset-password?token=<token>`.
4. Verify: as owner, create a test admin account. Receive setup email. Click link. Set password. Sign in. Confirm landing page is `/staff` (StaffMyDay) and `/admin/invoices` is accessible.

---

# PHASE 4 — CLIENT-FACING POLISH (Tasks 12-14)

## TASK 12 — Real `/client/invoices/:invoiceId` page

**Problem:** Currently a 25-line "Coming soon" stub. Clients land on this when they tap an invoice from the list.

**Do:**

1. Replace the stub with a full invoice detail view. Route: `/client/invoices/:invoiceId`. ClientLayout-wrapped.
2. Render: invoice number, client name, line items table, totals, status badge, issued date, due date, paid date (if paid), download PDF button (use existing PDF infrastructure if present).
3. Pay-now button: shown only if `status='sent'` or `'overdue'`. Links to PayFast checkout for this invoice.
4. Payment-history section: pulls matching Payment rows.
5. Verify: as a client, click any invoice from `/client/invoices`. Confirm the full detail renders, no "Coming soon."

---

## TASK 13 — Real `/client/messages/:threadId` page

**Problem:** Currently a 25-line "Coming soon" stub.

**Do:**

1. Replace the stub with a full thread detail view. Route: `/client/messages/:threadId`.
2. Render the thread: list of messages with sender role badges, reply form, real-time polling like the existing inbox. Use existing entities `ClientThread` + `ClientThreadMessage` and existing functions `list-thread-messages` + `send-thread-message`.
3. Verify: as a client, click any thread from `/client/messages`. Confirm full thread renders. Send a reply. Confirm it appears.

---

## TASK 14 — OwnerDashboard real chart

**Problem:** OwnerDashboard's revenue chart is hardcoded sample data. Embarrassing if a non-Thapelo opens it.

**Do:**

1. Replace the hardcoded `revenueData` array with computed data: "Paid invoices total per week, last 12 weeks." Compute from Invoice rows where `status='paid'`, grouped by week of `paid_at`.
2. Remove the "target" line (we don't have real targets).
3. Replace the dashboard's hardcoded count cards with real counts from entity lists: total active clients, total open deals, total unpaid invoices, total commission accrued this month.
4. Don't add new strategic widgets (MRR roll-up, runway, churn) — that's post-launch.
5. Verify: sign in as owner, open `/`. Confirm the chart shows real numbers and the count cards reflect the data.

---

# PHASE 5 — POLISH & COMPLETION (Tasks 15-21)

## TASK 15 — Auto-create Deliverables from FulfilmentTemplate on hand-off

**Problem:** Task 10's "Review & hand off" creates a Task and notifies head_of_tech, but doesn't actually provision Deliverable rows. Head_of_tech opens an empty queue.

**Do:**

1. Create function `auto-create-deliverables-from-template` accepting `{ token, client_id, deal_id, package_code }`. Validates session, requires owner/admin.
2. Logic:
   - Look up `FulfilmentTemplate` by `code` matching `package_code`.
   - Idempotency: check `Deliverable.filter({ client_id, deal_id })` first. If any exist, return `{ skipped: true, reason: 'deliverables_exist' }`.
   - For each item in the template's deliverables list, create a Deliverable row with `client_id`, `deal_id`, `title`, `status='not_started'`, due_date computed from template's `sla_days` field, `assigned_role='head_of_tech'`.
   - Write a ClientActivityLog `event_type='deliverables_provisioned'`.
3. In the Task 10 hand-off action, after creating the Task and InternalMessage, invoke this function with the submission's `client_id`, `deal_id`, and resolved `package_code` from the Deal. Wrapped in try/catch — non-fatal on failure.
4. Verify: submit a test onboarding form for a client whose deal has package='ignite'. Click "Review & hand off". Confirm Deliverable rows appear in `/deliverables` for that client. Click again — confirm zero new (idempotency).

---

## TASK 16 — Overdue invoice sweep

**Problem:** The Overdue tab on `/admin/invoices` only fills if `Invoice.status` is actually `'overdue'`. Today nothing flips `'sent'` rows to `'overdue'` when their `due_date` passes. Reports based on `Invoice.status='overdue'` will be wrong.

**Do:**

1. Create function `sweep-overdue-invoices` accepting `{ token, dry_run? }`. Owner+admin only.
2. Logic:
   - Find Invoice rows where `status='sent'` AND `due_date < today`.
   - For each, update `status='overdue'`. Write ClientActivityLog `event_type='invoice_overdue'`.
   - If `dry_run=true`, return candidate list without updating.
   - Returns `{ updated_count, dry_run, candidates }`.
3. Add a "Sweep overdue" header button on `/admin/invoices` (next to "Generate this month's batch"). First invokes with `dry_run=true`, opens preview, confirm switches to `dry_run=false`.
4. Schedule daily at 06:00 SAST when Base44 cron is configured.
5. Verify: create test invoice with `status='sent'`, `due_date` 7 days in past. Click "Sweep overdue" preview. Confirm-execute. Confirm `Invoice.status='overdue'`. Run again — zero updates.

---

## TASK 17 — Contract renewal sweep (30 / 7 / 0 day reminders)

**Problem:** `EmailTemplate.code='renewal_reminder'` was seeded but never fires. Contracts approach end with no automated nudge.

**Do:**

1. Schema change to `Contract`: add field `last_renewal_reminder_at` (date-time, optional).
2. Create function `sweep-contract-renewals` accepting `{ token, dry_run? }`.
3. Logic:
   - Find Contracts with status in `[signed, active]` AND `auto_renews=true` AND `contract_end_date` exactly 30, 7, or 0 days from today (SAST).
   - Idempotency: skip if `last_renewal_reminder_at` is from today.
   - Send `renewal_reminder` email template via Resend, populating `business_name`, `contract_end_date`, `renewal_term`, `cancellation_email`.
   - Write ClientActivityLog `event_type='renewal_reminder_sent'` with stage in metadata.
   - Update `Contract.last_renewal_reminder_at = now`.
4. Add manual trigger button on `/admin/invoices` header: "Send renewal reminders" — same dry-run-then-confirm flow.
5. Schedule daily at 09:00 SAST.
6. Verify: create test Contract with `contract_end_date = today + 30 days`, `auto_renews=true`. Run dry_run. Run real. Confirm email arrives. Run again same day — zero new sends.

---

## TASK 18 — Client cancel / reactivate / 30-day churn grace

**Problem:** `Client.status` enum allows `'cancelled'` and `'churned'` but nothing in code transitions a client to either.

**Do:**

1. Schema changes to `Client`: add three optional fields — `deactivated_at` (date-time), `archived_at` (date-time), `cancellation_reason` (string).
2. Create function `cancel-client` accepting `{ token, client_id, reason }`. Owner+admin only.
   - Idempotency: if status already `cancelled` or `churned`, return `{ skipped: true }`.
   - Updates: `status='cancelled'`, `deactivated_at=now`, `cancellation_reason=reason`.
   - Cancels any `status='sent'` invoices for this client via existing `cancel-invoice`.
   - Writes ClientActivityLog `event_type='client_cancelled'`.
3. Create function `reactivate-client` accepting `{ token, client_id }`. Owner only.
   - Refuses if status is `churned` (post-grace).
   - Updates: `status='active'`, clears `deactivated_at` and `cancellation_reason`.
   - Writes ClientActivityLog `event_type='client_reactivated'`.
4. Create function `sweep-client-churn` accepting `{ token, dry_run? }`. Owner+admin only.
   - Finds Clients with `status='cancelled'` AND `deactivated_at < now - 30 days`.
   - Updates each to `status='churned'`, sets `archived_at=now`. Writes ClientActivityLog.
   - Schedule daily at 03:00 SAST.
5. Add UI on `/clients/:id` (admin/owner only): "Cancel client" button (with reason modal), "Reactivate client" button (when status=cancelled), status banner if cancelled/churned showing dates and reason.
6. Verify: cancel a test client. Confirm status flips, unpaid invoice gets cancelled, ClientActivityLog row exists. Reactivate within grace — confirm flip back. Force-set `deactivated_at` to >30 days ago, run sweep — confirm flip to churned.

---

## TASK 19 — ClientNotification recipient model + admin alerts

**Problem:** `ClientNotification` requires `client_id`, so it can't model "notify all admins" or "notify head_of_tech" without a specific client context.

**Do:**

1. Schema changes to `ClientNotification`:
   - Remove `client_id` from required (keep as optional property).
   - Add `recipient_user_id` (string).
   - Add `recipient_role` (enum: `client, owner, admin, head_of_tech, field_agent, cpc`).
   - RLS read: `data.recipient_user_id == {{user.id}}` OR (`data.client_id != null` AND `data.client_id == {{user.data.client_id}}`) OR role=owner. Update: recipient OR owner. Delete: owner.
2. Create helper function `notify-staff` accepting `{ token, recipient_user_id?, recipient_role?, title, body, link?, related_client_id? }`.
   - At least one of `recipient_user_id` / `recipient_role` required.
   - If `recipient_role` set, fan out: look up all users with that role, create one notification per recipient.
   - Returns `{ created_count, notification_ids[] }`.
3. Wire 4 admin alerts:
   - **New onboarding submission** → `notify-staff` with `recipient_role='admin'` from `notifyAdminFormSubmitted`.
   - **Payment failed** → `notify-staff` with `recipient_role='admin'` from `payfast-itn` failed branch.
   - **Lead awaiting verification > 24h** → from a new `sweep-stale-leads` function (manual trigger button on `/staff/verify-leads`).
   - **Invoice overdue >7 days** → from inside `sweep-overdue-invoices` (Task 16) when an invoice flips with days_overdue >= 7.
4. Add badge counts in the layout for non-client roles by polling `ClientNotification.filter({ recipient_user_id: user.id, is_read: false })`. Bell icon in header. Click → navigate to `/notifications`.
5. Create `/notifications` page. Lists notifications for current user, grouped read/unread. "Mark all as read" button. Route guard owner/admin/field_agent/cpc/head_of_tech/driver.
6. Verify: sign in as admin. Submit a test onboarding form. Confirm a notification badge appears. Open `/notifications` — confirm row listed. Mark as read — badge clears.

---

## TASK 20 — RLS on 8 more entities

**Problem:** Task 5 hardened the four worst. Round 2 of hardening covers the next layer.

**Do** — add RLS to each:

1. **Lead**: read = owner OR admin OR field_agent (own only) OR cpc (own only). Create = owner+admin+field_agent+cpc. Update = owner+admin. Delete = owner.
2. **LoginAttempt**: all = owner only.
3. **SecurityEvent**: all = owner only.
4. **Contract**: read = `data.client_id == {{user.data.client_id}}` OR owner+admin. Create/update = owner+admin. Delete = owner.
5. **Deliverable**: read = `data.client_id == {{user.data.client_id}}` OR owner+admin OR (head_of_tech with `data.assigned_role='head_of_tech'`). Create/update = owner+admin+head_of_tech. Delete = owner.
6. **Task**: read = `data.assigned_to == {{user.id}}` OR owner+admin. Create = any authenticated staff. Update = assigned OR owner+admin. Delete = owner.
7. **ServiceOrder**: read = `data.client_id == {{user.data.client_id}}` OR owner+admin. Create = own client OR owner+admin. Update = owner+admin. Delete = owner.
8. **ClientNotification**: covered in Task 19.

Verify each: sign in as a client; cannot list other clients' rows in browser console.

---

## TASK 21 — Final smoke test (no code change)

After Tasks 1-20 are deployed, run this end-to-end smoke test:

1. **R1 PayFast sandbox test:** Invoice flips `sent → paid`, Payment is `successful`, Commission row exists, ClientActivityLog logs the event, receipt email arrives.
2. **EFT mark-paid test:** invoice flips, Payment row created with `type='eft'`, client portal Paid tab populates.
3. **Role test:** sign in as 4 different role accounts (owner, admin, field_agent, client). Confirm: client sees only own data; admin sees `/admin/invoices` but not OwnerFinancials; field agent lands on StaffMyDay; owner sees everything.
4. **Recurring batch test:** trigger on the 1st. Confirm exactly N invoices for N active clients. Re-run — zero duplicates.
5. **Activity tab test:** open any client detail page as owner. Click Activity tab. Confirm rows render.
6. **Cancel/reactivate test:** cancel a test client. Confirm flow. Reactivate. Confirm flow.
7. **Notification test:** submit a test onboarding form. Confirm admin badge increments.
8. **RLS test:** as a client, attempt `await base44.entities.Commission.list()` in console. Should fail.
9. **Stub elimination:** click every primary nav link in client and staff sidebars. None lands on "Coming soon."
10. **Smoke test on production after deploy:** single transaction end-to-end.

---

# REFERENCE — Role permission matrix

| Capability | Owner | Admin | Field Agent | CPC | Head of Tech | Driver | Client |
|---|---|---|---|---|---|---|---|
| Aggregate financials (MRR, profit, runway) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Per-invoice visibility | ✅ all | ✅ all | ❌ | ❌ | ❌ | ❌ | ✅ own |
| Mark invoice paid (EFT) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Send chase email | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Recurring batch trigger | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Onboarding submission review | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Lead verification + allocation | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Own pipeline | ✅ all | ✅ all | ✅ own | ✅ own | ❌ | ❌ | ❌ |
| Own clients | ✅ all | ✅ all | ✅ own (90d) | ❌ | ✅ assigned | ❌ | n/a |
| Own commissions | ✅ all | ❌ aggregate | ✅ own | ✅ own | ❌ | ❌ | ❌ |
| Staff payroll totals | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Brand kit + package pricing edits | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Build queue + SLA | ✅ all | ✅ all | ❌ | ❌ | ✅ assigned | ❌ | ❌ |
| Routes/zones/photo evidence | ✅ all | ✅ all | ❌ | ❌ | ❌ | ✅ own | ❌ |
| Own portal | n/a | n/a | n/a | n/a | n/a | n/a | ✅ |
| Self-checkout upgrades | n/a | n/a | n/a | n/a | n/a | n/a | ✅ |

---

# REFERENCE — State machines

### Invoice
```
draft → sent (when send-invoice-email called)
sent → paid (payfast-itn success OR mark-paid-eft)
sent → overdue (sweep-overdue-invoices when due_date < now)
sent → failed (payfast-itn failed branch)
sent → cancelled (cancel-invoice called)
overdue → paid (any payment success)
failed → paid (retry payment success)
```

### Payment
```
pending → successful (payfast-itn success)
pending → failed (payfast-itn failed)
pending → cancelled (payfast-itn cancelled)
successful → refunded (refund flow — future)
```

### Commission
```
pending_milestone → pending_payment (milestone reached)
pending_payment → approved (owner approves)
approved → paid (payroll batch run)
pending_payment → clawback (client churns within 30 days)
clawback → clawed_back (clawback processed)
```

### Client lifecycle
```
lead → active (payfast-itn success on first payment)
active → cancelled (cancel-client) → churned (after 30-day grace via sweep)
churned → active (reactivate-client — owner only)
```

---

# REFERENCE — Cron schedule

When Base44 scheduled jobs are configured:

| Time (SAST) | Function |
|---|---|
| 03:00 daily | `sweep-client-churn` |
| 06:00 daily | `sweep-overdue-invoices` |
| 06:30 daily | `sweep-stale-leads` |
| 09:00 daily | `sweep-contract-renewals` |
| 1st of month, 07:00 | `generate-monthly-retainer-invoices` |

Keep manual trigger buttons for all of these. Cron failure shouldn't kill the operation.

---

# DO NOT BUILD

Explicitly out of scope for this prompt. If a sub-prompt asks for any of these, refuse and report back.

1. Strategic dashboards: MRR roll-up, runway calculator, churn dashboard, cohort retention, CAC/LTV.
2. CPC / Field Agent submission flows + proposal builder.
3. Driver role build-out (routes, zones, photo evidence).
4. Resend wrapper consolidation across functions (refactor with no user value).
5. `User → AppUser` full migration (the dual-entity reality works).
6. Brand-kit / package-pricing CMS.
7. Year-end statement / per-receipt PDF for clients.
8. Bank reconciliation CSV upload.
9. Mobile-first sales redesign.
10. FNC referral logging UI (the entity exists; the commission engine handles it; UI is a new feature).
11. More tabs on `OwnerClientDetail` (already 10; trim before adding).

---

# TASK ORDER

Run in this order. Don't move on until verification passes:

**Phase 1 — Data integrity foundations:** 1 → 2 → 3 → 4 → 5
**Phase 2 — Spine wiring:** 6 → 7 → 8
**Phase 3 — Admin operations UI:** 9 → 10 → 11
**Phase 4 — Client-facing polish:** 12 → 13 → 14
**Phase 5 — Polish & completion:** 15 → 16 → 17 → 18 → 19 → 20
**Phase 6 — Final smoke test:** 21

After Task 21, the new Base44 app is operationally complete. Anything not on this list is either out of scope or post-launch.

---

**END OF PROMPT.**
