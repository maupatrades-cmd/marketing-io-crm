# Marketing iO CRM — Owner Feature Walkthrough

> Reference document for the Lovable rebuild. This is what the **owner role**
> sees and does in the current Base44 CRM, end to end, screen by screen,
> grounded in the actual code. Use it as the feature-parity checklist —
> Lovable can build each surface, you tick it off here.
>
> Every section: **what you see** → **how it works** → **expected result** →
> **files** (where the current implementation lives).
>
> Companion to `CRM_Complete_Blueprint_v1.md` (audit), `REBUILD_BLUEPRINT_ENTERPRISE.md`
> (vendor stack), and `/root/.claude/plans/buzzing-seeking-gem.md` (investigation).

---

## 0. Login → owner landing

**What you see**
1. `/login` — email + password form (`SignIn.jsx`). Optional Cloudflare Turnstile CAPTCHA (reverted in commit history; currently off).
2. On valid credentials → `/verify-otp?email=&purpose=login_mfa` — 6-digit code entry (`VerifyOTP.jsx`).
3. Enter OTP → **`OwnerDashboard`** (because `AppUser.role === 'owner'` routes to `/` which renders OwnerDashboard).

**How it works**
- Frontend posts `{ email, password }` to `auth-login` function.
- Function: bcrypt-compares password → generates 6-digit OTP → stores `pending_otp_code` + `pending_otp_expires_at` (10 min TTL) on AppUser row → sends OTP via Resend → returns `{ needs_otp: true, email, user_id }`.
- Frontend posts OTP to `auth-verify-otp` → returns `mio_session_token` (24h TTL) → stored in `localStorage` → role-based redirect.
- Failed-login lockout: 5 wrong passwords → 15-min lock + `unlock_token` sent via email with "wasn't me" panic link.
- Emergency lockdown via the "wasn't me" link locks the account + sets `password_reset_required` → forces account recovery via security questions.

**Expected result**
- Owner lands on OwnerDashboard within 30 seconds (assuming OTP arrives — failing email send currently silently looks like success, see the rebuild blueprint).

**Files**
- `src/pages/SignIn.jsx`, `src/pages/VerifyOTP.jsx`, `src/pages/AccountLockedDown.jsx`, `src/pages/AccountRecovery.jsx`
- `base44/functions/auth-login/entry.ts`, `auth-verify-otp/entry.ts`, `resend-otp/entry.ts`, `emergency-account-lockdown/entry.ts`, `unlock-account/entry.ts`, `recover-account/entry.ts`

---

## 1. The OwnerDashboard — the central command screen

**What you see** (`src/pages/OwnerDashboard.jsx`, 357 lines)

Top row of KPI cards:
- **Active clients** count
- **Pipeline value (R)** — sum of deal `setup_fee + monthly_retainer × term` for deals not closed_lost
- **Monthly recurring (R)** — sum of `monthly_retainer` for clients with `status='active'`
- **Closed deals this month**
- **Open leads**
- **Commission accrued this month**

Two charts:
- **Weekly paid invoices** (12-week area chart, SAST week buckets, Recharts)
- **Pipeline stage funnel** (bar chart, deals by stage)

Three widgets:
- **TaskWidget** — your open tasks (assigned_to = your AppUser id)
- **TeamKPIsWidget** — staff hitting/missing KPI targets
- **QuickScriptsWidget** — Playbooks pinned to owner role

Real-time updates: `base44.entities.{Client|Deal|Invoice|Lead}.subscribe(...)` — every CRUD event updates the dashboard live without refresh.

**How it works**
- On load: parallel `Promise.all` fetch of Client + Deal + Commission + Invoice + Lead + MonthlyReport (latest 100-500 rows each).
- All numbers computed client-side from those collections (`buildWeeklyPaidSeries`, pipeline stage roll-up, MRR sum).
- Subscriptions keep the in-memory state in sync.

**Expected result**
- You can see — without clicking — whether the business hit its weekly invoice target, where deals are stuck, who's earning, what's overdue.

**Known issues (call them out for the rebuild)**
- Computes everything in the browser → slow if entities >500 rows. Server-side aggregation in the rebuild.
- `paid_at`/`completed_at`/`updated_date` triple-fallback because the Invoice schema doesn't have a canonical "when was this paid" field.
- Subscriptions break under `mio_session_token` sessions (RLS). Real-time mostly doesn't fire.

---

## 2. Sales pipeline — from cold lead to closed deal

### 2.1 `/leads` — Leads inbox

**What you see**
- Table of `Lead` rows: name, email, phone, source, status (new/contacted/interested/lost/converted), lead_score, assigned_to.
- Filter by source + status + assigned.
- "Verify" button on each `new` lead → opens verify panel.
- Owner can reassign, mark contacted/interested/lost, convert to Client+Deal.

**How it works**
- Inbound paths: `EnquiryEvent` from marketing site contact forms → cron creates Lead rows.
- Manual entry by owner/admin.
- Checkout-derived: anonymous PayFast checkout creates a Lead-tagged Client.
- Lead scoring: `calculate-lead-score` function — currently rule-based (looks at source, package interest, engagement).

**Expected result**
- Owner triages new leads daily, assigns to a closer, marks dead ones.

**Files**
- `src/pages/Leads.jsx`, `src/pages/LeadScoring.jsx`, `src/pages/owner/LeadInbox.jsx`, `src/pages/StaffVerifyLeads.jsx`
- `base44/functions/calculate-lead-score/entry.ts`, `record-checkout-engagement/entry.ts`

### 2.2 `/sales-opportunities` — the active pipeline

**What you see**
- Kanban-style columns by `Deal.stage`: new_lead → discovery_visit → proposal_sent → negotiation → closed_won → closed_lost.
- Each card: client name, package, value, days-in-stage, closer.
- Drag to advance stages.
- Click → opens deal detail panel with notes, history, next action.

**How it works**
- Deals are created when a Lead converts OR directly via "New Deal" button OR auto-created during log-sale.
- Each stage change writes to ClientActivityLog.
- Owner sees ALL deals; field_agent/cpc see only their own (RLS filters by `closer_id` / `cpc_id`).

**Expected result**
- Owner can identify deals stuck > 14 days in a stage and intervene.
- Closers update their own pipeline; owner monitors.

**Files**
- `src/pages/SalesOpportunities.jsx`, `src/pages/Deals.jsx`, `src/pages/StaffMyPipeline.jsx`
- `base44/functions/list-sales-opportunities/entry.ts`, `close-sales-opportunity/entry.ts`

### 2.3 `/log-sale` — the close

**What you see** (`src/pages/LogSale.jsx`)
- 5-step form:
  1. **Client** — Existing (dropdown) or New (business_name, contact_person, phone, email, city).
  2. **Deal details** — Package selector (Ignite/Accelerate/Dominate/Street Pulse/Township Pulse/Add-On) + setup fee + monthly + term.
  3. **Attribution** — Closer (defaults to you) + Originating CPC (optional, earns R250 bonus).
  4. **Dates** — Close date + Expected start date.
  5. **Notes** — Free text.
- Submit button + preview badges showing what will be created.

**How it works** (server orchestrator: `base44/functions/log-sale/entry.ts`, 12 steps)
1. Session + role gate (owner/admin/cpc/field_agent allowed)
2. Input validation
3. Closer lookup (with LB-180 fallback to handle legacy User.id → AppUser drift)
4. CPC lookup (optional)
5. Client lookup OR create (with orphan-rollback hook)
6. **Deal.create** — `stage='closed_won'`, `probability=100`, commission_generated=false
7. Commission.bulkCreate — server-computed from `PACKAGE_COMMISSIONS` config. For owner-closer maps to `staff_role: 'founder'` (PR #132 fix), CPC gets R87+R250, admin gets R25 flat.
8. Contract.create — draft, with `signing_token` + 30-day expiry. The /contracts queue picks it up.
9. Invoice.create — routed through `create-invoice` function so `send-invoice-issued-email` fires automatically.
10. ClientOnboarding.create — assigned to first available admin/owner.
11. Task.bulkCreate — onboarding task + setup-fee follow-up at +5 days.
12. ClientActivityLog — `event_type='sale_logged'`, full metadata snapshot.
13. (PR #130, pending) Deliverable auto-creation from FulfilmentTemplate.

**Expected result**
- One form submit creates Deal + Commission rows + Contract draft + Invoice + onboarding task + activity log entry + (after PR #130) Deliverable queue items.
- Client receives "Setup invoice issued" email.
- Head_of_tech sees fulfilment work appear in their queue.
- Closer's My Sales tab updates.

**Files**
- `src/pages/LogSale.jsx`, `src/pages/LogSaleOnBehalf.jsx` (owner/admin records sale for a consultant)
- `base44/functions/log-sale/entry.ts`, `log-sale-on-behalf/entry.ts`, `create-invoice/entry.ts`, `calculate-commission/entry.ts`

### 2.4 `/upsell` — cross-sell existing clients

**What you see**
- List of `Client` rows with `status='active'` + their current package + suggested add-ons.
- Click client → opens add-on order flow: pick add-on, see scope, click "Add to client".

**How it works**
- Add-on catalog driven by `Products` entity + `ClientAddOn` for the order itself.
- "Add to client" calls `add-product-to-client` function → creates Invoice (with `send_email=true`) + ServiceOrder + commission rows.
- Commission tier depends on add-on bucket (A/B/C/D/E — defined in `commissionConfig.js`).

**Expected result**
- Existing clients get more add-ons → more revenue → closers earn add-on commission.

**Files**
- `src/pages/StaffAddOnCatalog.jsx`, `src/pages/upsell/UpsellListing.jsx`
- `base44/functions/add-product-to-client/entry.ts`, `list-upsell-clients/entry.ts`

---

## 3. Money — invoices, payments, payroll, commissions

### 3.1 `/invoices` — all invoices

**What you see**
- Table: invoice_number, client, type (setup/retainer/add-on/cancellation), amount, due_date, status, paid_at.
- Status filter: draft / sent / paid / overdue / failed / cancelled.
- "Create invoice" button.
- Per-row actions: view, mark paid (EFT), cancel, send chase, download PDF.

**How it works**
- Reads via `list-my-invoices` (owner gets ALL rows; staff get their own attributed via `closer_id`).
- Mark-paid-EFT → `mark-invoice-paid-eft` updates status + fires payment-receipt-email + triggers commission unlock checks.
- PayFast-paid invoices flip status via `payfast-itn` webhook.

**Expected result**
- Owner can see at a glance who owes, what's overdue, and chase.

**Files**
- `src/pages/Invoices.jsx`, `src/pages/AdminInvoices.jsx`, `src/pages/InvoiceDetail.jsx`
- `base44/functions/list-my-invoices/entry.ts`, `create-invoice/entry.ts`, `cancel-invoice/entry.ts`, `mark-invoice-paid-eft/entry.ts`, `send-invoice-chase/entry.ts`

### 3.2 `/receipts` — payments received

**What you see**
- Table: payment_date, client, invoice ref, amount, payment_method (debit/EFT/PayFast/cash), gateway_reference.
- Filter by date range, payment method.
- Click → see ITN payload + matched invoice.

**How it works**
- One Payment row per inbound money event (manual EFT mark or PayFast ITN).
- Idempotent — duplicate ITNs detected via `gateway_pf_payment_id`.
- Commission unlock: `Payment.status='successful'` AND `commission_calculated=false` → triggers `calculate-commission` to flip retainer commission rows from `pending_milestone` → `pending_payment`.

**Expected result**
- Reconciled view of money in.

**Files**
- `src/pages/Receipts.jsx`
- `base44/functions/payfast-itn/entry.ts`, `payfast-send-receipt/entry.ts`, `send-payment-receipt-email/entry.ts`

### 3.3 `/debit-orders` — failed debit management

**What you see**
- Table of `Invoice` rows with `payment_method='debit_order'` and `failed_debit_count > 0`.
- Per client: failed count this rolling 12 months, last failed date, acceleration_triggered flag.
- "Retry" / "Mark cleared" / "Cancel client" actions.

**How it works**
- Debit failure flows through `handle-failed-debit-notification` → increments `Client.failed_debits_count` + creates urgent Task → emails owner.
- 3 fails in 12 months → `acceleration_triggered=true` per contract clause (you can call in the full debt).
- `check-failed-debits-follow-up` cron creates follow-up Tasks at 48-hour intervals.

**Expected result**
- Owner triages failed debits before they become unrecoverable.

**Files**
- `src/pages/DebitOrderTracking.jsx`
- `base44/functions/handle-failed-debit-notification/entry.ts`, `check-failed-debits-follow-up/entry.ts`

### 3.4 `/payroll` + `/commissions` + `/owner/commissions`

**What you see**
- **PayrollReport** — by-staff roll-up: pending vs approved vs paid commissions for the current payroll month.
- **CommissionDashboard** (owner-only) — granular: every Commission row with staff, type, deal, amount, status. Bulk approve / mark paid / withhold / clawback.

**How it works**
- Commissions are created during log-sale (closer attribution) + during add-on orders + manually.
- Status state machine: pending → pending_milestone (waiting for 5-deal threshold) → pending_payment (waiting for setup-fee cleared OR first retainer received) → approved → paid → (clawback if cancellation in clawback window).
- Milestone tracker: `update-milestone-tracker` increments per-staff per-month deal count; once 5 deals → bulk-flip retainer commissions from pending_milestone to pending_payment.
- Payout schedule: `scheduled_payout_date` = 25th of NEXT month if qualifying event days 1-6 of current month, else 25th of month after next.
- Process-clawback: if client cancels within clawback window → reverses commission with new clawback row.

**Expected result**
- Owner runs payroll on the 25th by approving all `pending_payment` rows → marks paid after EFT → staff sees pay slip in StaffMyEarnings.

**Files**
- `src/pages/PayrollReport.jsx`, `src/pages/owner/CommissionDashboard.jsx`, `src/pages/StaffMyEarnings.jsx`, `src/pages/MySales.jsx`
- `base44/functions/calculate-commission/entry.ts`, `update-commission-attribution/entry.ts`, `update-milestone-tracker/entry.ts`, `process-clawback/entry.ts`, `backfill-invoice-closer/entry.ts`

### 3.5 `/owner/financials` — finance overview

**What you see**
- Cash position month-to-date.
- Revenue by package (Ignite vs Accelerate vs Dominate vs Pulse).
- Outstanding receivables.
- Commission liability (pending + approved unpaid).
- Owner-only export to CSV.

**How it works**
- Aggregations over Invoice + Payment + Commission.
- Currently computed client-side (slow at scale).

**Expected result**
- Owner closes books at month-end, knows true cash position.

**Files**
- `src/pages/OwnerFinancials.jsx`, `src/pages/owner/CommissionDashboard.jsx`

---

## 4. Contracts — legal lifecycle

### 4.1 `/contracts` — contract list

**What you see**
- Table: client, package, signing_status, start_date, end_date, renewal_date.
- Status filter: draft / sent_for_signature / signed / active / cancelled / expired.
- "Send for signature" action → fires `contract-send-for-signature-wrapped` → emails client with signing link.
- "View MSA" → opens generated PDF preview.

**How it works**
- Contracts auto-created during log-sale (draft status, signing_token pre-generated, 30-day signing link expiry).
- Send-for-signature fires the email with `/sign-contract?token=...` link.
- Client opens public signing page → draws signature → submits → contract flips to `signed` → `finalize-signed-contract` generates the final signed PDF → emails both parties.

**Expected result**
- Owner sees pipeline: drafts pending send → sent waiting for signature → signed.
- POPIA + ECTA-grade audit trail: signer IP, timestamp, user agent.

**Files**
- `src/pages/Contracts.jsx`, `src/pages/ContractView.jsx`, `src/pages/ContractSigningPublic.jsx`
- `base44/functions/send-contract-for-signature/entry.ts`, `contract-send-for-signature-wrapped/entry.ts`, `get-contract-for-signing/entry.ts`, `submit-contract-signature/entry.ts`, `finalize-signed-contract/entry.ts`, `contract-mark-signed/entry.ts`, `onContractSigned/entry.ts`
- `base44/functions/generate-msa-pdf/entry.ts` (22-page V3.0 generator), `base44/lib/msaTemplate.ts`, `base44/lib/directorSignature.ts`

### 4.2 `/cancelled-contracts` — churn tracking

**What you see**
- Table of `Contract.status='cancelled'` rows + `Client.status='churned'`.
- Cancellation reason, churn date, lost MRR, salvage attempts.

**How it works**
- Cancellation flow: `cancel-client` function → flips Client.status to cancelled → end-dates active Contract → cancels recurring invoices → flags commission rows for clawback if inside window.
- Churn auto-detection: `sweep-client-churn` cron flags clients with no engagement, failed debits, overdue deliverables.

**Expected result**
- Owner reviews weekly: what caused the churn, was it preventable, was salvage attempted.

**Files**
- `src/pages/CancelledContracts.jsx`
- `base44/functions/cancel-client/entry.ts`, `reactivate-client/entry.ts`, `sweep-client-churn/entry.ts`, `sweep-contract-renewals/entry.ts`

---

## 5. Fulfilment — delivering the work

### 5.1 `/deliverables` — work item queue

**What you see**
- Table: client, deliverable title, phase (setup/monthly_recurring/once_off), product, owner_role, assigned_to, status, due_date, days-overdue.
- Status filter: not_started / in_progress / awaiting_client / client_reviewing / approved / completed / blocked.
- Click deliverable → status update, file upload, client notification.
- Bulk assign owner-role → specific staff.

**How it works**
- Auto-spawned by `auto-create-deliverables-from-template` after a deal closes (PR #130 restores this in log-sale STEP 11.5).
- FulfilmentTemplate per package defines `setup_deliverables` (one-time) and `recurring_deliverables` (monthly).
- Head-of-tech assigns work, sets due dates within template SLA, marks in_progress.
- When ready for client review → status flips to `awaiting_client` → client sees in /client/deliverables → client_reviewing → approved/rejected.
- Auto-approval: `deemed_approved` after 7 days of `client_reviewing` with no action (configurable).
- Overdue alerts: `checkOverdueDeliverables` cron + `notifyDeliverableOverdue` email + Task to head_of_tech.

**Expected result**
- Owner sees fulfilment velocity (deliverables completed/week) + bottlenecks.

**Files**
- `src/pages/Deliverables.jsx`, `src/pages/DeliverableQuality.jsx`, `src/pages/StaffOnboardingForm.jsx`
- `base44/functions/auto-create-deliverables-from-template/entry.ts`, `checkOverdueDeliverables/entry.ts`, `notifyDeliverableSubmitted/entry.ts`, `notifyDeliverableApproved/entry.ts`, `notifyDeliverableOverdue/entry.ts`, `notify-client-deliverable-update/entry.ts`
- `base44/entities/FulfilmentTemplate.jsonc`, `Deliverable.jsonc`, `DeliverableFeedback.jsonc`, `TimeLog.jsonc`

### 5.2 `/deliverable-quality` — owner quality audit

**What you see**
- All deliverables grouped by staff member, with quality scores from client feedback + on-time delivery % + revisions per item.
- Identifies staff who consistently deliver late or get poor ratings.

**Expected result**
- Performance review data + early warning of fulfilment slippage.

**Files**
- `src/pages/DeliverableQuality.jsx`, `src/pages/StaffProductivity.jsx`

### 5.3 `/admin/service-orders` — add-on fulfilment queue

**What you see**
- Table of `ServiceOrder` rows: client, add-on name, status (pending/approved/in_progress/completed), requested_date.
- Owner approves orders → triggers add-on fulfilment flow → spawns Deliverables for that add-on.

**Files**
- `src/pages/AdminServiceOrders.jsx`
- `base44/entities/ServiceOrder.jsonc`

### 5.4 `/onboarding` + `/onboarding-submissions`

**What you see**
- **ClientOnboarding** queue: clients in each onboarding phase (1-6), assigned admin, days in phase.
- **Onboarding submissions review**: clients who submitted the onboarding form, brand assets, credentials. Owner/admin verifies + hands off to head_of_tech.

**How it works** (6-phase model)
1. **phase1_contract_signed** — Contract filed, PDF uploaded, client added to CRM
2. **phase2_welcome_invoicing** — Welcome pack emailed, setup invoice issued, debit mandate emailed, onboarding form emailed
3. **phase3_pre_onboarding** — Setup fee follow-up, form completion follow-up, onboarding call scheduled
4. **phase4_onboarding_call** — Call held, brand kit brief completed
5. **phase5_asset_collection** — Logo, brand colors, photos, login access, target audience brief collected
6. **phase6_delivery_start** — First deliverable scheduled

Triggers auto-advance phases when conditions met (setup_fee_paid, onboarding_form_returned, debit_mandate_signed, brand_assets_received).

**Expected result**
- Owner sees onboarding flow without micro-managing — escalations surface only when a phase stalls.

**Files**
- `src/pages/ClientOnboarding.jsx`, `src/pages/ClientOnboardingReview.jsx`, `src/pages/ClientOnboardingFormFull.jsx`
- `base44/functions/initiate-onboarding/entry.ts`, `on-deal-won-initiate-onboarding/entry.ts`, `createOnboardingSubmission/entry.ts`, `checkOnboardingFormReminders/entry.ts`, `sendOnboardingReminders/entry.ts`, `notifyAdminFormSubmitted/entry.ts`, `send-onboarding-progress-email/entry.ts`

---

## 6. Team & HR

### 6.1 `/owner/users` — user management

**What you see**
- Table: full_name, email, role, status (active/suspended), last_login, created_date.
- "Provision new user" → email + role → triggers password-set flow.
- Per-row: change role, suspend, delete (owner-only delete).

**How it works**
- `provision-staff-user` (owner-only): creates AppUser row → sends email with reset-password link → user sets own password.
- Suspended users can't login but data references survive (FK protection).

**Expected result**
- Onboard new staff in 2 minutes; offboard cleanly.

**Files**
- `src/pages/OwnerUsers.jsx`
- `base44/functions/provision-staff-user/entry.ts`, `provision-client-user/entry.ts`, `sign-out-everywhere/entry.ts`

### 6.2 `/owner/staff-hr` — HR records

**What you see**
- Per-staff record: ID number, bank account, salary, employment start, manager, role, status.
- StaffMilestone unlock tracking (90 days / 6 months / 1 year tenure bonuses).
- Document storage for contracts/POPIA consents.

**How it works**
- StaffRecord entity (one per staff AppUser) holds the sensitive data.
- StaffMilestone rows auto-created on hire, unlocked by `sweep-password-expiry` (or similar tenure check).

**Expected result**
- HR records compliant + auditable for SARS/UIF.

**⚠ Critical**: StaffRecord currently has NO RLS — meaning every authenticated client can read all staff bank details. Top priority fix.

**Files**
- `src/pages/StaffHR.jsx`
- `base44/entities/StaffRecord.jsonc`, `StaffMilestone.jsonc`

### 6.3 `/owner/kpi-targets` — performance goals

**What you see**
- Per-staff KPI editor: leads_per_month, sales_target_zar, deliverable_quality.
- Period: monthly / quarterly.
- Status auto-computed: on_track / behind / exceeded.

**Expected result**
- Owner sets targets → KPIs surface in MyKPIs (staff view) and TeamKPIs (owner view).

**Files**
- `src/pages/owner/KPITargetEditor.jsx`, `src/pages/MyKPIs.jsx`, `src/pages/TeamKPIs.jsx`
- `base44/functions/seedKPITargets/entry.ts`

### 6.4 `/team-oversight` — daily team view

**What you see**
- Per-staff card: open tasks, deals in pipeline, deliverables assigned, hours logged this week, KPI status.
- "Reassign" task action.
- Drilldown into any staff member's day.

**Expected result**
- Owner runs a Monday morning check-in based on this view; reassigns where needed.

**Files**
- `src/pages/TeamOversight.jsx`, `src/pages/StaffProductivity.jsx`, `src/pages/TeamKPIs.jsx`
- `src/components/kpi/TeamKPIsWidget.jsx`

### 6.5 `/playbooks` — scripts and SOPs

**What you see**
- Library of Playbooks: sales scripts, objection handling, onboarding scripts, support procedures.
- Filter by category + visible_to_roles.
- Owner creates/edits; staff reads + checks off steps.

**How it works**
- Playbook entity: name, category, steps array (each step has title/description/check_boxes), visible_to_roles.
- Pinned in OwnerDashboard via `QuickScriptsWidget`; in StaffMyDay for relevant role.

**Expected result**
- Repeatable processes. New staff ramps faster.

**Files**
- `src/pages/Playbooks.jsx`
- `base44/functions/seedPlaybooks/entry.ts`, `getPlaybooks/entry.ts`, `updatePlaybook/entry.ts`

---

## 7. Marketing & catalog

### 7.1 `/owner/campaigns` — marketing campaigns

**What you see**
- Campaign list: name, type (email/sms/social), status (draft/scheduled/active/completed), start/end date, target audience.
- Per-campaign drilldown: recipients, sends, opens, clicks, replies.
- "New campaign" wizard → segment selection → message composer → schedule.

**How it works**
- MarketingCampaign + CampaignSend entities track everything.
- `run-scheduled-campaigns` cron processes scheduled sends.
- `send-campaign` blast function delivers via Resend → CampaignSend records each delivery.
- Open/click tracking via Resend webhooks (needs wiring).

**Expected result**
- Owner runs nurture sequences against leads + reactivation campaigns against churned clients.

**Files**
- `src/pages/OwnerCampaigns.jsx`
- `base44/functions/send-campaign/entry.ts`, `run-scheduled-campaigns/entry.ts`, `seed-campaigns/entry.ts`, `send-campaign-reports-batch/entry.ts`

### 7.2 `/email-templates` — template library

**What you see**
- Rich-text editor (React Quill) for transactional + campaign email bodies.
- Categories: welcome, onboarding, payment, contract, campaign, report, notification.

**How it works**
- EmailTemplate entity stores subject + body_html + footer_html.
- Currently NOT wired to email senders — each send-* function has body inlined. Templates exist but aren't used (gap to fix in rebuild).

**Expected result** (when wired)
- Owner edits "welcome email" copy without a deploy.

**Files**
- `src/pages/EmailTemplates.jsx`
- `base44/functions/seedEmailTemplates/entry.ts`

### 7.3 `/monthly-reports` — client value packaging

**What you see**
- Per-client monthly report: leads generated, conversions, website visitors, social engagement, ad spend, ROI.
- "Generate" button per client; report PDF emailed to client.

**How it works**
- MonthlyReport entity holds the data + sent_to_client_at.
- `generateDraftReports` cron creates drafts; owner/admin edits + sends.
- `generate-campaign-report` handles per-campaign reports separately.
- Escalation: `escalateUnsentReports` cron flags drafts not sent within 5 days of month-end.

**Expected result**
- Every client gets a monthly receipt showing the value delivered → reduces churn.

**Files**
- `src/pages/MonthlyReports.jsx`
- `base44/functions/generateDraftReports/entry.ts`, `generate-campaign-report/entry.ts`, `escalateUnsentReports/entry.ts`

### 7.4 `/products` — catalog editor

**What you see**
- Package catalog: Ignite/Accelerate/Dominate/Street Pulse/Township Pulse with pricing.
- Add-on catalog: 20 add-ons with bucket assignment (A/B/C/D/E).
- Per-product: image, description, billing model.

**Expected result**
- Owner adjusts pricing or adds new add-ons → catalog updates in StaffAddOnCatalog + Checkout.

**Files**
- `src/pages/Products.jsx`, `src/pages/StaffAddOnCatalog.jsx`
- `base44/functions/get-product-images/entry.ts`, `seed-product-images/entry.ts`

### 7.5 `/staff/image-generator` — AI image generation

**What you see**
- Prompt input → generates hero images / product images / social media graphics for clients.

**How it works**
- `generate-marketing-image`, `generate-hero-image` functions.
- Output saved as GeneratedImage entity, attached to client.

**Expected result**
- Speed up content production for "Short Form Video" + "Email Newsletter" add-ons.

**Files**
- `src/pages/StaffImageGenerator.jsx`
- `base44/functions/generate-marketing-image/entry.ts`, `generate-hero-image/entry.ts`

---

## 8. Activity & audit

### 8.1 `/activity` — global activity feed

**What you see**
- Stream of all `ClientActivityLog` rows across all clients, reverse-chronological.
- Filter by event_category (auth/profile/payment/invoice/document/communication/support/account/lead) + actor_role + date range.

### 8.2 `/owner/admin-activity`, `/owner/staff-activity`, `/owner/client-activity`, `/owner/cpc-activity`, `/owner/field-activity`

Same shape, scoped to actor_role.

**How it works**
- Every business action writes a ClientActivityLog row (log-sale STEP 12 is the canonical pattern).
- Owner can drill down: "show me every payment received this week" / "every contract signed by CPCs in October".

**Expected result**
- Owner has full audit trail. Disputes resolvable from the log.

**Files**
- `src/pages/ActivityLog.jsx`, `src/pages/owner/AdminActivityLog.jsx`, `StaffActivityLog.jsx`, `ClientActivityLog.jsx`, `CPCActivityLog.jsx`, `FieldActivityLog.jsx`
- `base44/functions/log-client-activity-public/entry.ts`, `list-client-activity/entry.ts`

### 8.3 `/calendar` — agency calendar

**What you see**
- Tasks + deliverable due dates + onboarding calls + contract renewals + debit run dates.

**Expected result**
- Owner sees the next 30 days of agency commitments in one place.

**Files**
- `src/pages/Calendar.jsx`
- `base44/entities/Task.jsonc`

---

## 9. Communication

### 9.1 `/inbox` (`OwnerInbox`)

**What you see**
- Aggregated inbox: ClientCommunication (support tickets), InternalMessage (staff-to-staff), ClientThreadMessage (portal messaging).
- Categorised by source.
- Click → reply / route to staff / close.

**How it works**
- ClientCommunication entity for support inquiries with type (billing/technical/general/support_request).
- ClientThread + ClientThreadMessage for ongoing client conversations.
- InternalMessage for staff coordination.

**Expected result**
- Owner triages once a day; rest routes to admin/CPC/HoT.

**Files**
- `src/pages/OwnerInbox.jsx`, `src/pages/InternalMail.jsx`, `src/pages/StaffCommunications.jsx`
- `base44/functions/get-or-create-client-thread/entry.ts`, `send-thread-message/entry.ts`, `list-thread-messages/entry.ts`, `notifyClientCommunication/entry.ts`

### 9.2 `/mail` (`InternalMail`)

Internal mail for staff coordination. Shared with all staff roles.

---

## 10. Settings

### 10.1 `/owner/settings`

**What you see**
- Brand assets, business details, debit run dates, payroll cutoff.
- Notification preferences.
- Commission rate edits (currently inlined in code — should be here).

**Expected result**
- Owner self-serves business config without engineering.

**Files**
- `src/pages/OwnerSettings.jsx`
- `base44/entities/SystemSettings.jsonc` (under-used)

### 10.2 `/owner/reports`

Library of owner reports: monthly P&L, commission roll-up, churn analysis, fulfilment SLA, lead conversion funnel.

**Files**
- `src/pages/OwnerReports.jsx`

---

## 11. The owner's daily / weekly / monthly rhythm

How the surfaces above are used in practice:

### Daily (15 min, morning coffee)
1. OwnerDashboard — KPIs, alerts, today's tasks
2. Inbox — triage support + internal messages
3. Failed debit alerts (if any) → DebitOrderTracking
4. Sales Opportunities — any deals stuck > 14 days

### Weekly (Monday standup, ~30 min)
5. TeamOversight + TeamKPIs — staff status
6. Pipeline review — Sales Opportunities + Upsell
7. Fulfilment health — Deliverables + DeliverableQuality
8. Activity audit — spot anomalies in Admin/Staff/Client activity logs

### Monthly (25th + month-end, ~2 hrs)
9. PayrollReport + CommissionDashboard — approve + mark paid
10. OwnerFinancials — close books, export to accountant
11. MonthlyReports — review drafts before client send
12. CancelledContracts + churn analysis

### Quarterly
13. KPI Targets — adjust per staff
14. Playbooks — update SOPs based on what worked
15. Products / EmailTemplates / brand assets refresh

---

## 12. Owner sidebar nav (the surfaces that route here)

Documenting so Lovable rebuild has the nav structure:

| Group | Items |
|---|---|
| **Home** | OwnerDashboard, MyKPIs, Calendar |
| **Sales** | Leads, LeadInbox (owner), SalesOpportunities, Deals, Upsell, LogSale, LogSaleOnBehalf, LeadScoring, VerifyLeads |
| **Money** | Invoices, AdminInvoices, Receipts, DebitOrderTracking, PayrollReport, OwnerFinancials |
| **Commissions** | CommissionDashboard (owner), MySales, Commissions (shared) |
| **Contracts** | Contracts, CancelledContracts |
| **Fulfilment** | Deliverables, DeliverableQuality, AdminServiceOrders, ClientOnboarding, OnboardingSubmissions |
| **Team** | OwnerUsers, StaffHR, KPITargetEditor, TeamOversight, StaffProductivity, TeamKPIs, Playbooks |
| **Marketing** | OwnerCampaigns, EmailTemplates, MonthlyReports, Products, AddOnCatalog, ImageGenerator |
| **Activity** | ActivityLog, AdminActivityLog, StaffActivityLog, ClientActivityLog, CPCActivityLog, FieldActivityLog |
| **Communication** | OwnerInbox, InternalMail, StaffCommunications |
| **Settings** | OwnerSettings, OwnerReports |

**Owner sees ALL of these.** Admin sees the same minus `/owner/*`. CPC/field_agent see only Sales + their own My-* views. Head_of_tech sees Fulfilment + Communication. Client sees nothing here — entirely separate portal.

---

## 13. What the owner experience is **supposed** to deliver

Read this as the user-story-level outcome statement:

> As the owner of a SA marketing agency, I want to walk into work, open
> one dashboard, and within 60 seconds know:
> — Is the business hitting its revenue target this month?
> — Is anyone on my team stuck or underperforming?
> — Are any clients at risk (failed debits, overdue deliverables, low engagement)?
> — Are there any compliance/security issues I need to action?
>
> If the answer to all four is "no", I close the laptop and trust the system
> to handle the day. If any answer is "yes", I have one click to drill into
> the offending area and take action.
>
> Every action I (or anyone) takes is logged. Every email, contract, invoice,
> deliverable, commission, and conversation has an audit trail. Nothing
> happens without me being able to see it later.

That's the experience the existing code is reaching for. The Lovable rebuild should explicitly architect for that user story.

---

## 14. Critical gaps in the current owner experience (for the rebuild to fix)

Where the existing build falls short of the vision above:

1. **No "morning brief" surfacing.** OwnerDashboard shows KPIs but doesn't say "you need to look at X today". Should be Claude-generated.
2. **No deal-at-risk detection.** A deal sitting 21 days in `negotiation` should auto-surface; today you have to manually scan SalesOpportunities.
3. **No churn risk surfacing.** Clients with reduced engagement, failed debits, or overdue deliverables aren't auto-flagged.
4. **No financial close button.** OwnerFinancials shows numbers but no "close period" workflow + lock.
5. **No audit drilldown UI.** Activity logs exist but you can't say "show me everything Lekgoro did last Tuesday" in one query.
6. **No bulk operations.** Mark 12 invoices paid? Approve 30 commissions? Click each one today.
7. **No CSV export.** Most pages have no export. You can't pull data into Excel.
8. **No dashboard customization.** OwnerDashboard is fixed; no widget reorder, no add/remove.
9. **No notifications inbox.** Important alerts live as Tasks; should be a notification bell with categorisation.
10. **No mobile experience.** Field operations need a mobile app; OwnerDashboard barely works on a phone.

Each of these is a small ticket in the Lovable rebuild. None is hard. All are owner-experience differentiators.

---

## 15. Files index — by surface

Quick lookup of where each owner-facing surface lives.

| Surface | Frontend | Backend |
|---|---|---|
| OwnerDashboard | `src/pages/OwnerDashboard.jsx` | reads Client/Deal/Commission/Invoice/Lead/MonthlyReport entities |
| Sales Opps | `src/pages/SalesOpportunities.jsx` | `base44/functions/list-sales-opportunities/`, `close-sales-opportunity/` |
| Log Sale | `src/pages/LogSale.jsx` | `base44/functions/log-sale/` |
| Deals | `src/pages/Deals.jsx` | Deal entity |
| Leads | `src/pages/Leads.jsx`, `LeadScoring.jsx`, `owner/LeadInbox.jsx` | `calculate-lead-score/` |
| Invoices | `src/pages/Invoices.jsx`, `AdminInvoices.jsx`, `InvoiceDetail.jsx` | `create-invoice/`, `cancel-invoice/`, `mark-invoice-paid-eft/`, `list-my-invoices/`, `send-invoice-chase/`, `send-invoice-issued-email/`, `generate-monthly-retainer-invoices/`, `sweep-overdue-invoices/` |
| Receipts | `src/pages/Receipts.jsx` | `payfast-itn/`, `send-payment-receipt-email/`, `payfast-send-receipt/` |
| Debit Orders | `src/pages/DebitOrderTracking.jsx` | `handle-failed-debit-notification/`, `check-failed-debits-follow-up/` |
| Commissions | `src/pages/owner/CommissionDashboard.jsx`, `MySales.jsx`, `Commissions.jsx`, `PayrollReport.jsx` | `calculate-commission/`, `update-commission-attribution/`, `update-milestone-tracker/`, `process-clawback/`, `backfill-invoice-closer/` |
| Contracts | `src/pages/Contracts.jsx`, `ContractView.jsx`, `ContractSigningPublic.jsx`, `CancelledContracts.jsx` | `contract-send-for-signature-wrapped/`, `get-contract-for-signing/`, `submit-contract-signature/`, `finalize-signed-contract/`, `generate-msa-pdf/`, `onContractSigned/`, `sweep-contract-renewals/`, `cancel-client/` |
| Deliverables | `src/pages/Deliverables.jsx`, `DeliverableQuality.jsx`, `AdminServiceOrders.jsx` | `auto-create-deliverables-from-template/`, `notifyDeliverable*/`, `checkOverdueDeliverables/` |
| Onboarding | `src/pages/ClientOnboarding.jsx`, `ClientOnboardingReview.jsx` | `initiate-onboarding/`, `createOnboardingSubmission/`, `checkOnboardingFormReminders/`, `sendOnboardingReminders/`, `send-onboarding-progress-email/` |
| Users / HR | `src/pages/OwnerUsers.jsx`, `StaffHR.jsx`, `owner/KPITargetEditor.jsx` | `provision-staff-user/`, `provision-client-user/`, `sign-out-everywhere/`, `seedKPITargets/` |
| Team Oversight | `src/pages/TeamOversight.jsx`, `StaffProductivity.jsx`, `TeamKPIs.jsx`, `MyKPIs.jsx` | reads KPITarget + Task + Deal entities |
| Campaigns | `src/pages/OwnerCampaigns.jsx` | `send-campaign/`, `run-scheduled-campaigns/`, `seed-campaigns/` |
| Email Templates | `src/pages/EmailTemplates.jsx` | `seedEmailTemplates/` |
| Monthly Reports | `src/pages/MonthlyReports.jsx` | `generateDraftReports/`, `generate-campaign-report/`, `escalateUnsentReports/` |
| Products | `src/pages/Products.jsx`, `StaffAddOnCatalog.jsx` | `get-product-images/`, `seed-product-images/`, `add-product-to-client/` |
| Image Generator | `src/pages/StaffImageGenerator.jsx` | `generate-marketing-image/`, `generate-hero-image/` |
| Activity Logs | `src/pages/ActivityLog.jsx`, `owner/*ActivityLog.jsx` | `log-client-activity-public/`, `list-client-activity/` |
| Inbox / Comms | `src/pages/OwnerInbox.jsx`, `InternalMail.jsx`, `StaffCommunications.jsx` | `get-or-create-client-thread/`, `send-thread-message/`, `list-thread-messages/`, `notifyClientCommunication/` |
| Settings | `src/pages/OwnerSettings.jsx`, `OwnerFinancials.jsx`, `OwnerReports.jsx` | reads SystemSettings + cross-entity aggregations |
| Playbooks | `src/pages/Playbooks.jsx` | `getPlaybooks/`, `updatePlaybook/`, `seedPlaybooks/` |
| Calendar / Tasks | `src/pages/Calendar.jsx`, `Tasks.jsx` | Task entity |

---

## 16. How to use this doc for the Lovable rebuild

For each section above:
1. **Verify the surface exists in current Base44** — open the file path, take a screenshot
2. **Prompt Lovable** to create the same page on the new stack — pass the screenshot + the "what you see" + "how it works" + "expected result" from this doc
3. **Have Claude Code wire the backend** — Postgres function for the orchestrator (e.g. `close_sale()`), edge function for the email send, RLS policy for who can see/edit
4. **Tick off in this doc** when feature parity is reached

Build order recommendation:
1. Login + OwnerDashboard (foundation, week 1)
2. Sales flow (Leads → Opps → LogSale, week 2-3)
3. Money (Invoices + Receipts + Commissions, week 3-4)
4. Contracts + signing, week 5
5. Fulfilment (Deliverables + Onboarding), week 6-7
6. Team + HR, week 8
7. Marketing + Reports, week 9
8. Activity + Communication, week 10
9. Settings + polish, week 11
10. Mobile staff app, week 12-14

Total ~14 weeks for feature-parity rebuild on Lovable (faster than greenfield because requirements are now documented).

---

*Document grounded in actual code as of commit `c416e84` (PR #131 merge). All file paths verifiable. No invented features.*
