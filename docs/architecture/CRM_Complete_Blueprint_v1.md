# Marketing iO CRM — Complete Architecture & Flow Blueprint v1

> **Status:** Draft v1, 2026-05-08. Documentation only — no code changes.
> **Author:** Claude Code, after deep read of the codebase at commit `e8e7a4a` (post-PR #56 merge).
> **Scope:** Complete description of what is built, what is planned, and the gap to a real working CRM. Sections 1–7 are descriptive. Section 8 is the only place opinion is given.
> **Citations:** File paths and line numbers throughout. Where evidence is indirect, the line is labelled `(inference based on …)`.

---

## 🚨 STOP-EVERYTHING FINDINGS

Five issues that need to be on your radar before any other work continues. None are catastrophic in the "data leak" sense — Client RLS holds firm — but several are operationally severe and one is straight-up data corruption.

### 1. ~40 entities have NO RLS rules at all

Out of 47 entity definitions in `base44/entities/`, only six have a non-empty `rls` block: `Client`, `Deal`, `Invoice`, `StaffRecord`, `ClientActivityLog`, `Payment`. Every other entity is `rls: {}` (default-deny on the back-office, but the front-end SDK works through it) or has no `rls` key at all. Entities with no RLS include:

- **`Commission`** — financial payroll data. Any authenticated user can `base44.entities.Commission.list()` and read every staff member's earnings.
- **`OTPCode`** — OTP codes for login MFA, password reset, signup verification.
- **`LoginAttempt`** — security audit log. Any user can enumerate failed logins by email.
- **`InternalMessage`** — staff-to-staff messages.
- **`AppUser`** — full user records including `password_hash`, `session_token`, `pending_otp_code`.
- **`StaffRecord`** — 18 required fields including bank account, ID number, next-of-kin.
- **`ClientNotification`, `ClientThread`, `ClientThreadMessage`, `ClientUpload`, `Contract`, `Deliverable`, `Lead`, `MonthlyReport`, …** — most operational data has no row-level enforcement.

**What protects us today:** the front-end SDK call surface and the fact that every server function uses `base44.asServiceRole`. The RLS block is the second line of defence; right now there isn't one. If a dev ever calls `base44.entities.Commission.list()` from a client-side bundle (intentionally or by accident), every authenticated user — including clients — can read every staff member's payroll.

**Severity:** Critical. Pre-launch fix. RLS rules per entity, matching Section 2's role matrix.

### 2. Every Invoice ever issued has an out-of-enum status

`base44/functions/create-invoice/entry.ts:133` writes `status: 'issued'`. The Invoice schema enum (`base44/entities/Invoice.jsonc:55-66`) is `[draft, sent, paid, overdue, failed, cancelled, partial]`. There is no `issued`. PR #56 fixed the UI to match the schema (the `Issued` tab was removed because nothing would ever match it). The data layer is still wrong — every row written by `create-invoice` since the function was deployed has an invalid status.

The likely runtime behaviour is one of: (a) Base44 silently coerces to default `monthly_retainer` (the schema's `invoice_type` default — but `status` has no default declared, so this is unlikely), (b) Base44 strips the field entirely so `status` ends up undefined, (c) Base44 writes `'issued'` verbatim and the enum is advisory rather than enforced. Either way, the Paid tab in `/client/invoices` will never populate from real Invoice rows because `'issued' !== 'paid'` and there is no transition from `'issued'` to anything.

**Severity:** Critical. Either change the write to `'sent'` (the canonical post-issuance status per schema) AND backfill existing rows, or extend the enum to include `'issued'` AND add transitions. The first is cleaner.

### 3. PayFast ITN never updates Invoice.status

This is the user's stated suspicion, now confirmed. `base44/functions/payfast-itn/entry.ts` writes `Payment` (line 491), `Client` (lines 550-557), `ClientActivityLog`, `SecurityEvent` — but never touches `Invoice`. The string `Invoice.update` does not appear in the file.

Combined with finding #2: every Invoice begins life with status `'issued'` and stays there forever. Successful payment is recorded on the Payment row only. The Invoice → Payment relationship is one-way; there is no back-link from a successful Payment to "mark this Invoice paid."

**Severity:** Critical for launch. Without this, the `/client/invoices` Paid tab is permanently empty (the bug we already half-fixed in PR #56), Admin can't tell paid from unpaid for chase purposes, and aging reports based on `Invoice.status` are meaningless. This is what was scoped as PR #57.

### 4. `/staff` route conflict — staff users can't reach their dashboard

`src/App.jsx:148` registers `/staff → StaffHR` (the owner-only HR page) and `src/App.jsx:181` registers the same path `/staff → StaffMyDay` (the staff personal dashboard). React Router uses the first match. Field agents, CPCs, head_of_tech, and drivers navigating to `/staff` get the StaffHR page. Owner gets it correctly by accident.

There is no RouteGuard on either registration. Anyone hitting `/staff` lands on `StaffHR`.

**Severity:** Critical for staff usability post-launch. Either remove the line 148 registration, rename one of the two pages' routes, or add per-role RouteGuards.

### 5. `OwnerClientDetail` Activity tab and "Recent Activity" widget render empty for owners

The page is route-guarded for owner+admin (`/clients/:id`), so we know the user reaching it is one of those two roles. The page makes two RLS-gated reads of `ClientActivityLog`:

- Line 109: `base44.entities.ClientActivityLog.filter({ client_id: id }, "-created_date", 10)` — feeds the legacy "Recent Activity" widget on the Overview tab (line 201-204) and the Audit tab (line 442-449).
- Line ~425 onwards: `<ActivityFeed clientId={id} viewerRole={viewerRole} />` — the new tab from PR #52, which uses `useActivityFeedPolling` (`src/lib/useActivityFeedPolling.js:89-91`) which itself calls `base44.entities.ClientActivityLog.filter(...)`.

Both paths use the front-end SDK (RLS-gated) rather than `asServiceRole`. The RLS read rule on `ClientActivityLog` (`base44/entities/ClientActivityLog.jsonc:111-119`) is:

```json
"read": {
  "$or": [
    { "data.client_id": "{{user.data.client_id}}" },
    { "user_condition": { "role": "owner" } },
    { "user_condition": { "role": "admin" } }
  ]
}
```

Branch 1 (`user.data.client_id` match) fails for staff because owners/admins have no `client_id` on their user record (it's null). Branches 2 and 3 (role check) should match for an owner. They aren't.

**Most likely root cause** *(inference based on RLS template syntax convention)*: the Base44 RLS `user_condition` evaluator is reading from a `user` context object hydrated by the SDK's session middleware. It's possible that `user.role` is exposed as `user.role`, `user.data.role`, or under a slightly different path; the RLS rule expects the literal value `"owner"` or `"admin"`. Possibilities:

- **Case mismatch.** If the seeded user role is stored as `"Owner"` (capitalised) somewhere upstream and the RLS check expects lowercase, the comparison fails. The User entity enum is lowercase (`base44/entities/User.jsonc:26-32`), so this is unlikely but not impossible if `auth-me` ever returns a different casing.
- **Role not in RLS user-context.** The `auth-me` function returns `{ id, email, role, full_name, ... }` (verified at `auth-me/entry.ts:48-53`). But the SDK's RLS evaluator may look at a different user-record field — e.g., the `role` on the underlying `User` entity row, not the `role` returned by `auth-me`. If a user's row has `role` blank or different from what the session shows, RLS would fail.
- **Two user entities, two roles.** The codebase migrated from `User` to `AppUser` (per `src/AUTH_SYSTEM_FIX.md`), but **66 grep hits remain on `entities.User.…`** vs **26 on `entities.AppUser.…`** — the migration is partial. The owner's user record may live in `AppUser` but the RLS evaluator may resolve `user_condition` against `User`. If the `User` row for that account is missing or has the wrong role, branches 2 and 3 fail.

I cannot confirm the exact cause without reading Base44's RLS template engine, which is closed. The diagnosis is bounded to: "the role-based OR branches in the RLS rule are not matching for staff sessions." A workaround is to have the page (or the `useActivityFeedPolling` hook) call a server function that uses `asServiceRole` instead of the front-end SDK — bypassing RLS entirely on the server side after auth-checking the caller's role explicitly.

**Severity:** High. Owner + admin cannot audit any client's activity. Documented in this audit as a real bug; a code fix is its own PR.

---

## SECTION 1 — EXECUTIVE SUMMARY

### What Marketing iO CRM is built to do

Marketing iO CRM is the operational system for a South African SME marketing-services agency. It runs the full revenue motion: **lead intake** (inbound enquiry from the portal, outbound CPC cold calls, field-agent face-to-face visits, FNC referrals from a partner network, anonymous self-checkout for people who landed on a package page); **sales process** (Deal pipeline with packages priced from R700–R9,800 setup + R200–R4,000/month retainer); **invoicing** (one-off setup invoices and monthly retainer invoices); **payment** (PayFast for cards, EFT for bank transfer, with manual confirmation); **fulfilment** (onboarding form intake → head_of_tech delivery queue → deliverables → quality review by client); **commission** (a Bucket A–D system tied to package categories with milestone-gating and 30-day clawback); **retention** (renewal reminders, monthly reports, contract-end tracking); **upsell** (add-ons sold from inside the client portal); **payroll roll-up** (commission to PayrollReport for owner export). Seven roles touch the system: **owner** (full controller), **admin** (operations runner), **field_agent** (mobile sales), **cpc** (cold-prospecting), **head_of_tech** (delivery executor), **driver** (street/township pulse logistics), and **client** (the buyer).

### Completeness scale per role (0–100)

| Role | Score | One-line justification |
|---|---|---|
| **Client** | **72** | Portal hub, invoices, contracts, messages, deliverables, uploads, activity, settings all real and connected. PR #50–#56 polished the post-payment surface. Two stub pages (`InvoiceDetail`, `ClientThreadDetail`), missing year-end statement, billing-update page exists but PaymentMethod entity isn't wired live. |
| **Owner** | **48** | Dashboard, /clients, /deals, /commissions, /tasks, /leads, /staff (HR), email templates, and the new Activity tab on `/clients/:id` are real. `/owner/financials` is partial (charts placeholder), `/owner/reports` is a mock-data stub, `/owner/settings` mixes real with hardcoded sections. No cash runway, no churn dashboard, no MRR roll-up — strategic vision layer is mostly absent. |
| **Admin** | **22** | Admin shares back-office routes with owner; no admin-specific page exists. The two admin-relevant flows that are real are `/admin/service-orders` (add-on order review) and `/staff/verify-leads`. There is no `/admin/invoices` for chase, no failed-payment queue, no recurring-batch trigger, no onboarding-review queue beyond the basic page. Admin's three core daily jobs (chase unpaid, review onboarding submissions, verify leads) are 1/3 supported. |
| **Field Agent** | **30** | `/staff/pipeline` and `/staff/clients` exist and are real. `/staff/communications`, `/staff/profile`, `/my-kpis`, `/playbooks`, and the staff-onboarding form are real. Lead capture from a visit log is missing — `Lead.create` only fires from `/leads` (admin-side manual entry), not from any field-agent flow. Proposal builder doesn't exist. The 90-day post-close client window is not enforced anywhere in code. |
| **CPC** | **18** | Same `/staff/*` surface as field_agent. No CPC-specific submission flow that creates a Lead. Re-engagement queue (rejected-invoice leads allocated by admin) is master-plan-only — no `RejectedInvoiceLead` entity, no allocation function. R87/lead and R250/closure rules exist in `calculate-commission/entry.ts:323-340` but the upstream Lead-by-CPC flow doesn't write the rows that would trigger them. |
| **Head of Tech** | **15** | Listed in the role enum and named in fulfilment-template `internal_owner_role`. No dedicated page, no deliverable queue view scoped to head_of_tech, no quality-review aggregator. `StaffMyClients` is shared with field/CPC roles. Currently the role is a placeholder. |
| **Driver** | **5** | Role exists in the enum (`User.role`). No pages, no routes, no entities for routes/zones/photo-evidence/wrap-reports. Schema and UI surface are both empty. |

### Five most consequential gaps blocking day-to-day CRM operation

1. **No paid-invoice signal.** `payfast-itn` doesn't update `Invoice.status`, and `create-invoice` writes a status (`'issued'`) that isn't in the enum. Admin and owner cannot tell paid from unpaid in the UI without manually cross-referencing Payment rows. *(Section 3.5 + STOP-EVERYTHING #2/3.)*
2. **No recurring invoice generator.** Monthly retainer invoices for active clients must be created by hand. With 5 clients today this is annoying; with 50 it's a full-time job. No `cron`, `schedule`, `recurring`, or `batch` function in the codebase generates Invoice rows. *(Section 3.5.)*
3. **No invoice chase queue for admin.** Admin's stated daily job ("chase unpaid invoices") has no UI. The only invoice management page exposes owner-level aggregates. Today this work happens in spreadsheets, WhatsApp, and memory. *(Section 3.14.)*
4. **Onboarding pipeline has two orphaned steps.** Form sent → client submits → ?. The submission updates `ClientOnboardingSubmission.submission_status`, the `notifyAdminFormSubmitted` function exists and fires, but there's no admin view that lists pending submissions for review (`/onboarding-submissions` exists but the contents lean on a single entity), and `autoCreateDeliverables` (a frontend lib function in `src/lib/fulfilmentAutomation.js`) is invoked from `LogSale.jsx:314` but not from the onboarding-completion path. The hand-off to head_of_tech is manual. *(Section 3.3, 3.4.)*
5. **No churn / soft-delete / reactivation handling.** Client cancellation has no end-to-end flow. The `Client.status` enum allows `'cancelled'` and `'churned'` but nothing in code transitions a client to either, and there's no page for admin to manage cancellations or for owner to see the churn rate. *(Section 3.12.)*

---

## SECTION 2 — ROLE PERMISSION MATRIX (canonical)

This is the architectural rule. Every later section is graded against it.

### OWNER — full system controller

- All Admin permissions, plus aggregate financial dashboards (revenue, MRR, profit margin, cash position, runway, CAC, LTV, churn rate, cohort analysis).
- Strategic KPIs and reports.
- Staff records, payroll totals, commission aggregates.
- All system settings, integrations, brand kit, package configuration.
- All client records across all statuses.
- 30,000-foot view AND drill into any record.

### ADMIN — operational, no aggregate financials

- Per-transaction invoice visibility (amounts + statuses) for chase and reconciliation.
- Per-client visibility — records, deals, deliverables, communications.
- Failed-payment chase queue with SLA tracking.
- Recurring invoice batch generation.
- Onboarding submission review and routing.
- Lead verification and routing to staff.
- Audit log for security/debugging.
- Staff communication channels.
- **NOT permitted:** aggregate revenue/profit/cash/runway dashboards, staff payroll totals, brand kit + package pricing edits, strategic LTV/CAC/cohort analysis.

### FIELD AGENT — mobile-first sales

- Own pipeline, own clients (90-day post-close window).
- Lead capture, visit logging, proposal builder.
- Own commissions and milestone tracker.
- Activity logging.
- **NOT permitted:** other agents' pipelines, financials, admin tooling.

### CPC — cold-calling prospector

- Own outbound queue, own submissions.
- Re-engagement queue (rejected-invoice leads allocated to me).
- Own earnings (R87/lead, R250/closure, Bucket A–D).
- **NOT permitted:** other CPCs' work, financials, client records.

### HEAD OF TECH — delivery executor

- Active builds, deliverable queue, SLA traffic.
- Quality reviews from clients.
- Resource library (fulfilment templates).
- **NOT permitted:** financials, sales pipelines, commissions.

### DRIVER — street/township pulse

- Routes, target zones, materials.
- Photo evidence + GPS capture.
- Daily wrap reports.
- **NOT permitted:** anything else.

### CLIENT — own data only

- Own portal: invoices, contracts, deliverables, activity, communications, uploads, settings, profile, billing.
- Self-checkout for upgrades and add-ons.
- **NOT permitted:** anything outside their own `client_id`.

---

## SECTION 3 — THE CORE BUSINESS FLOWS

### 3.1 Lead intake → Deal → Contract → Invoice → Payment → Commission

**What it should do.** A buyer expresses interest (any of five sources), is qualified into a Deal, the Deal closes, a Contract is signed, an Invoice is generated, the buyer pays, and the closer's commission accrues. The full revenue engine.

**What's there today, stage by stage.**

| Stage | Code path | Verdict |
|---|---|---|
| Lead intake | `submit-enquiry/entry.ts:101-133` writes `EnquiryEvent` and creates a `Deal` directly with `stage='new_lead'`. There is no `Lead` row created on this path. | ⚠️ Partial — enquiry skips the Lead entity entirely. |
| Manual lead | `Leads.jsx:81` writes `Lead.create(form)`. This is the only `Lead.create` call in the whole codebase. | ✅ But only admin-side manual. |
| Lead → Deal | Inbound enquiry: automatic in `submit-enquiry`. Manual lead: no automatic conversion — admin must open the Lead and create a Deal by hand. | ⚠️ Partial. |
| Deal → Contract | No automatic `Contract.create` on `Deal.stage='closed_won'`. Search confirms zero hits. Admin creates contracts via `LogSale.jsx:155` (one-shot create flow) or manually. | ❌ Manual gap. |
| Contract signed → Invoice | `onContractSigned/entry.ts:58-88` creates a Task ("Issue Setup Invoice") and invokes `notifySignatureComplete`. **Does not call `create-invoice`.** Admin must complete the task manually. | ❌ Manual gap. |
| Invoice → Payment | Two paths: `payfast-checkout-init` creates a Payment row in `pending` status; client pays via PayFast; ITN fires. Or EFT — client pays manually, admin matches deposit, has no UI to mark invoice paid. | ⚠️ Partial (PayFast); ❌ EFT. |
| Payment → Commission | `payfast-itn/entry.ts:594` invokes `calculate-commission` (awaited). `calculate-commission/entry.ts:367-402` creates Commission rows per line item with the right Bucket logic. | ✅ Working when PayFast succeeds. |
| Payment → Invoice.status | **Does not happen.** See STOP-EVERYTHING #3. | ❌ Broken. |
| FNC referral commission | `FNCReferral` entity exists with `r800_commission_status`. Zero `FNCReferral.create` or `FNCReferral.update` callers. Lead source `'fnc_referral'` exists in `Deal.lead_source_type` enum. Commission logic in `calculate-commission` does not reference FNCReferral at all. | ❌ Phantom — schema only. |

**What a real CRM has.** End-to-end automation with explicit state machines and visible state. Deal → Contract auto-creation on stage `'closed_won'` (configurable: maybe with admin approval gate). Contract signed → Invoice auto-creation (with line items derived from the deal). Invoice paid → both Payment.status and Invoice.status updated, with a paid-on date. Commission → audit trail per stage (accrued / cleared / paid / clawback). Cross-reference between Payment, Invoice, and Commission so any of the three opens the others.

**Gap, plain English.** The revenue engine has four manual handoffs in a flow that should be one chain. Each handoff is a place an invoice gets forgotten, a contract sits in `draft`, a commission isn't logged, or a paid invoice still says "issued." For an agency with 5 clients this is acceptable; for 50 it's a chaos generator.

### 3.2 Lead sources — five entry points, four broken

The brief lists five sources: **CPC, Field Agent, FNC Referral, Inbound, Checkout**. State of each in code:

| Source | Where it should write | Where it actually writes | Verdict |
|---|---|---|---|
| **Inbound** (portal enquiry) | `Lead` row, then `Deal` after qualification | `submit-enquiry/entry.ts:101-133` writes `EnquiryEvent` + `Deal` directly. No `Lead`. | ⚠️ Partial — Lead skipped. |
| **Checkout** (anonymous self-purchase) | `Client` (lookup-or-create) + `Payment` + maybe `Lead` | `payfast-checkout-init/entry.ts` creates `Client` + `Payment`. No Lead, no Deal. | ⚠️ Buyer becomes a Client without ever being a Lead or Deal. |
| **CPC** (outbound prospecting) | `Lead` with `source='cpc'`, `cpc_id=<user>` | No CPC submission flow exists. CPC users do not have a "log a lead" page. | ❌ Phantom. |
| **Field Agent** (visit log) | `Lead` with `source='field_visit'`, `assigned_field_agent=<user>` | No visit-log flow exists. Field agents have a pipeline view but no lead-capture UI. | ❌ Phantom. |
| **FNC Referral** (partner network) | `FNCReferral` row + `Lead` | `FNCReferral.create` is called nowhere. Schema is unread. | ❌ Phantom. |

**Routing rules — what should happen vs. what does.** When a lead lands, an admin should verify (`StaffVerifyLeads.jsx` exists and is real for `pending_verification` filter) and either reject (so it can be re-routed to CPC re-engagement) or allocate to a field agent. The allocation flow exists in `owner/LeadInbox.jsx` (lines 33+) which reads `Client` rows where `lifecycle_stage='lead'` and surfaces an Allocate modal. SLA tracking is absent — there is no "leads waiting >24h" alert anywhere.

**Gap.** Three of the five sources don't write the entity they're supposed to. The Lead entity is starved; almost every "lead" in the system is actually a Client row that skipped Lead entirely. The 5-source pipeline is, in practice, a 1.5-source pipeline (Inbound enquiry + admin-manual entry).

### 3.3 Onboarding engine

**What it should do.** Closed-won deal triggers an onboarding sequence. Client receives a form (or an admin completes it with them on a kickoff call). Submission lands; admin reviews; head_of_tech is assigned; deliverables are auto-provisioned from the package's `FulfilmentTemplate`.

**What's there today.**

- **Trigger:** `on-deal-won-initiate-onboarding/entry.ts:7-61` listens for `Deal.stage='closed_won'`. ✅
- **Initiation:** `initiate-onboarding/entry.ts:62-126` creates a `ClientOnboardingProgress` row (line 89) and 8 `OnboardingStep` rows (lines 101-113). It does NOT create a `ClientOnboarding` row despite the entity existing. ⚠️
- **Form distribution:** the `ClientOnboardingFormPublic.jsx` page exists at `/client-onboarding/:token`, reads a `ClientOnboardingSubmission` row by token (line 43), auto-saves field changes (line 91). What sends the form link? No code path automates this — the link is presumably emailed manually or generated ad-hoc. ⚠️
- **Submission notification:** `ClientOnboardingFormPublic.jsx:132` invokes `notifyAdminFormSubmitted`, which exists at `base44/functions/notifyAdminFormSubmitted/entry.ts`. ✅
- **Admin review:** `/onboarding-submissions` route → `ClientOnboardingReview.jsx` (177 lines). Lists submissions, has a review modal, can mark reviewed. ✅
- **Routing to head_of_tech:** No code. There's no function that hands a reviewed submission to head_of_tech, no entity field that records the assignment, and head_of_tech has no inbox. ❌
- **Deliverable provisioning:** `autoCreateDeliverables` exists in `src/lib/fulfilmentAutomation.js:8`, called from `LogSale.jsx:314` only. It is NOT called from any onboarding-completion path or any post-contract-signing path. ❌

**Gap.** The onboarding engine has its first three stages working but the hand-off from "admin reviewed the submission" to "deliverables are scheduled and head_of_tech has work" is entirely manual. In real life, this is where things vanish — admin closes the review modal, gets distracted, and a client is left with no deliverables for a week.

### 3.4 Fulfilment & deliverables

**What it should do.** Once onboarding completes, the package's `FulfilmentTemplate` is unrolled into individual `Deliverable` rows assigned to head_of_tech (or relevant role). Head_of_tech works through the queue; client is notified per status; client provides feedback (`DeliverableFeedback`); deliverables that miss SLA are flagged.

**What's there.**

- **`FulfilmentTemplate`** entity exists (no RLS). Read by some path (inference based on entity name; not directly verified). Write site unverified.
- **`ServiceOrder`** entity exists with full lifecycle enum. Created from `ClientOrderAddOns.jsx`, `ClientOrderDomain.jsx`, `ClientOrderEmail.jsx` — the client-portal "order an add-on" flow. Reviewed by admin via `AdminServiceOrders.jsx` (real, 349 lines). ✅ for add-ons.
- **`Deliverable`** entity exists with status enum `[not_started, in_progress, awaiting_client, client_reviewing, approved, deemed_approved, completed, blocked]`. Listed at `/deliverables` (real, 243 lines, owner/admin-side) and at `/client/deliverables` (real, 292 lines, client-side). Updated at `Deliverables.jsx:68`. Auto-creation from `LogSale.jsx:314` via `autoCreateDeliverables`. ✅ for the LogSale path.
- **`DeliverableFeedback`** entity exists. Read by `DeliverableQuality.jsx:28` (owner-only). Write site unverified.
- **`TimeLog`** entity exists, written from `Deliverables.jsx:92` for time tracking.
- **SLA enforcement:** No scheduled job sweeps Deliverable rows and flags overdue ones. The "SLA traffic" view that should exist for head_of_tech doesn't.

**Gap.** Add-on fulfilment is wired (client orders → admin reviews → deliverable created). Core-package fulfilment (the Ignite/Accelerate/Dominate path) hangs together only via `LogSale.jsx`'s manual one-shot, which both creates the Deal and provisions deliverables in one transaction. There's no separation between "deal closed" and "deliverables provisioned" — for any deal closed outside of `LogSale.jsx`, no deliverables get created automatically.

### 3.5 Invoice lifecycle

**What it should do.** Invoices flow through a state machine: `draft → sent → paid` (or `overdue`, `failed`, `cancelled`, `partial`). Each transition has a trigger.

**State machine in code.**

| Transition | Trigger | Code path | Verdict |
|---|---|---|---|
| `draft → sent` | Manual or batch | No automated path. Invoices are created by `create-invoice/entry.ts` which writes `'issued'` (out of enum, see STOP-EVERYTHING #2). | ❌ Broken — both schema and trigger are wrong. |
| `sent → paid` | Payment received | Should be triggered by `payfast-itn` on PayFast success or by admin manual mark on EFT. **Neither happens.** `payfast-itn` writes Payment, not Invoice. There is no admin "mark paid" function. | ❌ Broken. |
| `sent → overdue` | Scheduled sweep | No sweep function exists. Search for `cron`, `schedule`, `overdue`, `due_date` in `base44/functions/` returns no daily sweep. | ❌ Missing. |
| `sent → cancelled` | Client cancel button | `cancel-invoice/entry.ts:95-100` writes status `'cancelled'`, cancellation_reason, cancelled_at, cancelled_by. Triggered from `CancelInvoiceModal.jsx`. | ✅ Working. |
| `sent → partial` | Partial payment received | Status enum allows `'partial'`. No code writes it. | ❌ Phantom. |
| `sent → failed` | PayFast FAILED | Should be triggered by `payfast-itn` on FAILED status. `payfast-itn` writes Payment.status='failed' but not Invoice.status. | ❌ Broken — same as `sent → paid`. |

**What auto-fires today.** Two things: invoice creation (writes invalid status), and client-initiated cancellation. Everything else is manual or missing.

**Gap.** Five of seven status transitions either don't fire or write wrong values. The Invoice entity is, today, write-once-by-create-invoice and read-only after that (with a single exception: the cancel path).

### 3.6 Payment lifecycle

**Three paths.**

| Path | Status | Code |
|---|---|---|
| **PayFast** (live, production) | ✅ Working end-to-end | `payfast-checkout-init` creates Payment, `payfast-itn` confirms. Receipt email via `payfast-send-receipt`. Activity log + commission calculation downstream. |
| **EFT** (manual confirmation) | ⚠️ Partial — `EftModal.jsx` shows bank details and reference, but no admin UI confirms receipt. Admin sees the deposit on bank statement, has nowhere to record it against the invoice. | UI: `EftModal.jsx`. Confirmation flow: missing. |
| **Other (Yoco future)** | ❌ Not built | — |

**Reconciliation.** PayFast writes are reconciled against expected amount via the signed `signed_payload_hash` in `payfast-itn/entry.ts:443-456`. This is robust. EFT has no reconciliation; admin guesses by reference number.

**Gap.** The EFT path is the standard fallback for clients without cards — for SA SME clients this is roughly half. With no admin "match deposit → invoice" UI, EFT receipts are tracked in admin's inbox and head, then manually marked. Today this barely scales because the Invoice.status doesn't transition anyway (STOP-EVERYTHING #3); the EFT gap will become acute when the Invoice status fix lands.

### 3.7 Commission & payroll

**The brief calls out:** Bucket A–D rules per Working System v1.0, 5-deal milestones, 30-day clawback, FNC referral commission, state machine accrued → cleared → paid → clawback.

**What's there today** (mostly real and surprisingly well-built):

- **`calculate-commission/entry.ts:105-429`** — invoked from `payfast-itn/entry.ts:594` after a successful payment. Idempotent via `Payment.commission_calculated` flag. Reads `Invoice.line_items`, applies bucket logic.
- **Bucket logic** (lines 244-318):
  - Bucket A: 7% setup only
  - Bucket B: 7% setup + 7% retainer (milestone-gated)
  - Bucket C: 7% retainer only (milestone-gated)
  - Bucket D: 10% first-month for paid-ads
  - Bucket E: no commission
- **CPC closure bonus** (lines 323-340) — flat R250.
- **Admin contract-load bonus** (lines 343-363) — flat R25.
- **Milestone tracking** — `MilestoneTracker` entity. `update-milestone-tracker/entry.ts` invoked from `calculate-commission:413` (fire-and-forget) when a milestone-gated commission row is created.
- **Commission status** enum: `[pending, pending_milestone, pending_payment, approved, paid, withheld, clawback, clawed_back, cancelled]`.
- **Admin/Owner views:** `/commissions` (`Commissions.jsx`, real), `/owner/commissions` (`CommissionDashboard.jsx`, real with five tabs: Overview, By Person, Log, Payroll, Clawbacks), `/payroll` (`PayrollReport.jsx`, real, has CSV/PDF export).

**Where it breaks.**

- **30-day clawback** — `process-clawback/entry.ts` exists. Schedule for invoking it is unverified. No cron in the codebase.
- **FNC referral commission** — no code. The `FNCReferral` entity has `r800_commission_status` and `r800_paid_date` fields; nothing writes them.
- **State machine** — most rows live in `pending_payment` or `pending_milestone`. The transition to `approved` and `paid` is presumably manual via `Commissions.jsx:44` (real Commission.update). Owner approves → status='approved'; payroll batch marks paid. The lifecycle isn't documented in code, but the entity supports it.

**Gap.** The Commission engine is the most complete single subsystem in the CRM. The gaps are around it: scheduled clawback sweep, FNC referral wiring, and the manual status-transition UI which works but is fiddly.

### 3.8 Activity log (audit trail)

**Entity:** `ClientActivityLog`. Recently extended in PR #52 with `actor_id`, `actor_role`, `event_category`, `event_summary`, `event_metadata`, `ip_address`, `user_agent`. Legacy fields (`title`, `body`, `icon`, `category`, `source`, `link`, `read_at`, `user_id`) kept for back-compat.

**Wire-ins:** verified in PR #52. Sixteen server-side events (account_created, login_success/_failed, password_*, payment_initiated/succeeded/failed/cancelled, support_request_opened, message_sent_by/received_by_client, invoice_issued, invoice_cancelled_by_client) and one frontend event (`document_uploaded`).

**Three views, three states:**

| View | Page | Hook / call | State |
|---|---|---|---|
| Client own | `/client/activity` | `ClientActivity.jsx` → `<ActivityFeed viewerRole="client">` → `useActivityFeedPolling` → `base44.entities.ClientActivityLog.filter({client_id})` | ✅ Working — RLS branch 1 (`data.client_id == user.data.client_id`) matches. |
| Owner | `/clients/:id` Activity tab | `OwnerClientDetail.jsx:425` → `<ActivityFeed viewerRole={owner|admin}>` → same hook | ❌ Empty — see STOP-EVERYTHING #5. |
| Owner | `/clients/:id` Overview "Recent Activity" widget + Audit tab | `OwnerClientDetail.jsx:109` direct entity call | ❌ Empty — same RLS root cause. |

**Why owner sees empty:** the RLS read rule's `user_condition: { role: ... }` branches don't match for staff sessions. Diagnosed in STOP-EVERYTHING #5; the fix is its own PR.

**PDF export:** `generate-activity-pdf/entry.ts` is server-side, uses `asServiceRole`, and works correctly for owner+admin. The on-screen feed is the broken surface; the export is fine.

### 3.9 Communications

**Three channels.**

| Channel | Wired | Notes |
|---|---|---|
| **Threads** (in-portal client ↔ staff) | ✅ | `ClientThread`/`ClientThreadMessage` entities, `get-or-create-client-thread`, `send-thread-message`, `list-thread-messages`. Polling-based in `OwnerInbox.jsx:192-200` (10–20s). Activity log writes both directions per PR #52. |
| **Internal staff messages** | ⚠️ | `InternalMessage` entity exists, `/mail` route renders `InternalMail.jsx`. Status enum exists. Real but no RLS — staff can read any other staff member's messages. |
| **Email** | ⚠️ | Resend used by 27 functions. `sendEmailViaResend` helper exists at `src/lib/emailSender.js` (frontend-side) but **has zero callers in either backend or frontend** — every email function instantiates `new Resend()` directly. Branding wrappers are duplicated across `auth-register`, `payfast-send-receipt`, `abandoned-cart-runner`, `submit-enquiry`, etc. |
| **SMS** | ❌ | Not built. `sms-marketing` package is sold as a setup fee + monthly retainer for client SMS sending; the CRM itself doesn't send SMS to clients. |
| **WhatsApp** | ⚠️ | Support contact link in `src/config/contacts.js` (`+27 71 520 5334`) used in cancellation recovery flows. No inbound WhatsApp processing. The `whatsapp-automation` package is for clients, not the CRM. |

**The 405 errors on `/app-logs/.../log-user-in-app/...`:** Base44's internal telemetry endpoint, fired by the SDK on every auth event. It's not our code; it's the platform's. The 405 means the platform endpoint rejected the method (POST sent to a path expecting something else, or the endpoint was deprecated). It's a Base44 hosting quirk that surfaces in DevTools but doesn't break anything in our flow. Noted for Base44 support to investigate; **not** a Marketing iO issue to solve.

**Gap.** Email branding duplication is real (Step 8.6 cleanup, deferred). Internal-message RLS is a real security issue (covered by STOP-EVERYTHING #1). Cross-channel logging — i.e., recording an email send into `ClientActivityLog` — is inconsistent; some flows log, most don't.

### 3.10 Notifications

**Two recipient models.**

| Recipient | Mechanism | State |
|---|---|---|
| **Client** | `ClientNotification` entity. Required: `client_id`, `notification_type`, `title`, `body`. Read by `ClientLayout.jsx` for badge counts; written by `notifyClient` helper called from invoice/onboarding/deliverable functions. | ✅ Working. |
| **Admin** | No entity supports "notify all admins." `ClientNotification` is per-client by design — `client_id` is required. | ❌ Architectural gap. |

**What fires today** (read across `notifyClient`, `notifyAdminAndHead`, etc.):

- Invoice issued → `ClientNotification` to the buyer.
- Deliverable status change → `ClientNotification` to the buyer.
- Contract sent → `ClientNotification` + email.
- Onboarding step completed → email (`send-onboarding-progress-email`).
- Payment received → email (`payfast-send-receipt`) + activity log.

**What should fire that doesn't** (per Master Index Decision 2's "notify admin@ + head@ + in-app to all admins" pattern):

- Statement download by client.
- Per-invoice PDF download by client.
- Payment-method update by client.
- Bank confirmation letter upload by client (PR C scope).
- Account deactivation request by client (PR D scope).
- Failed payment / chase escalation.

**Architectural decision still open** (flagged before PR B): does `ClientNotification` get a `recipient_user_id` field, or does a new `AdminNotification` entity get created, or does `client_id` become semantically "subject client" with a separate recipient? Standing item.

### 3.11 Renewal / retention / upsell

**What should happen.** Day-30 before contract end: reminder. Day-7: warning. Day-of: renewal call book or auto-renew. Day-after: lapsed sequence.

**What's there.**

- **`renewal_reminder` email template** seeded into `EmailTemplate` (per `seedEmailTemplates/entry.ts`). References `contract_end_date`, `renewal_term`. ✅ Template only.
- **`admin_renewal_call` playbook** seeded — manual script for admin calls in month 11. ✅ Script only.
- **No cron, no sweep, no scheduled job** that compares `contract_end_date` against `Date.now()` and triggers anything.
- **Client-side renewal warning** — not present. `ClientPortal.jsx` doesn't surface "your renewal is in N days."
- **Auto-renew** — `Contract.auto_renews` field exists in schema. Nothing reads it.

**Upsell (positive direction).** Two surfaces:

- **In-portal sales floor** — `ClientPortal.jsx` (1157 lines) has dedicated sections for upgrades, add-ons, physical (Pulse), and custom orders. ✅ Real.
- **Add-on order flow** — `ClientOrderAddOns.jsx` → `ServiceOrder.create` → `AdminServiceOrders.jsx` review. ✅ Real and connected.

**Gap.** Retention is one-third built (template + script exist, automation doesn't). Upsell is well-built — the in-portal sales floor is the strongest part of the client view.

### 3.12 Churn / offboarding

**What should happen.** Client cancels → portal access scheduled to revoke at contract end → unpaid invoices either cleared or escalated → files archived → `Client.status='churned'`.

**What's there.** Almost nothing.

- `Client.status` enum allows `'cancelled'` and `'churned'`. **Zero code paths transition a client to either.**
- No soft-delete fields on Client (`deactivated_at`, `archived_at`, `auto_archive_at` were proposed for PR D — not added).
- No reactivation flow.
- No data-retention policy enforced.
- No portal-access revocation. Cancelled clients keep logging in until someone manually changes `Client.status` (which doesn't currently affect access — `RouteGuard` only checks role, not status).
- No final-statement export.
- No file-archive cleanup.

**Gap.** Churn handling is master-plan-only (PR D scope). Today, "client cancels" means an admin updates a spreadsheet and remembers not to send the next invoice. The CRM is silent on it.

### 3.13 Owner oversight — reports & dashboards

**What's referenced in the master plan and seeded code:**

- 8 report templates (per the previous-conversation reference to a Master Plan).
- `OwnerReports.jsx` — pure stub. Lines 7-18 define a `REPORTS` array (mock); lines 29-35 simulate fetch with `setTimeout(500)`. ❌
- `OwnerFinancials.jsx` — partial. Reads `Invoice.list()`, `Client.list()`, `Commission.list()` (lines 24-26). Renders summary cards (real). Charts at line 126 are a placeholder message. ⚠️
- `OwnerDashboard.jsx` — real, but reads everything via `.list()` with no aggregation logic. KPI cards show counts; charts are hardcoded sample data (lines 18-33).
- `OwnerCampaigns.jsx` — real (marketing campaigns to clients).
- `MonthlyReports.jsx` — real (per-client report generation, not aggregate KPI).
- `StaffProductivity.jsx` — real, hierarchical time-log aggregation per staff/client/phase.
- `DeliverableQuality.jsx` — real, star ratings aggregated.
- `TeamOversight.jsx` — real, 8-entity dashboard.
- `MyKPIs.jsx`, `TeamKPIs.jsx` — referenced in `src/docs/KPI_SYSTEM.md`. Real per the planning doc.

**KPIs that should exist** (from the role permission matrix):

- MRR (sum of active retainers)
- Cash position + runway
- Profit margin per package/category
- CAC by lead source
- LTV per cohort
- Churn rate (monthly)
- Cohort retention
- Lead-source ROI

**KPIs that exist:** counts of clients, deals, invoices, commissions. Time-log aggregation. Per-staff KPI targets (per `KPI_SYSTEM.md`).

**Gap.** The strategic vision layer is the weakest part of owner. There's solid drill-down (clients, deals, deliverables, time logs) but the 30,000-foot view is mostly absent. Charts on the dashboard are hardcoded sample data — that's embarrassing if a non-Thapelo opens the owner view.

### 3.14 Admin operations — invoice chase, onboarding review, lead verify

Admin's three core daily jobs.

| Job | UI today | Verdict |
|---|---|---|
| **Verify leads** | `/staff/verify-leads` (`StaffVerifyLeads.jsx`, 215 lines, real) — lists Lead rows in `pending_verification` status with approve/reject + clarification email. | ✅ Working. |
| **Review onboarding submissions** | `/onboarding-submissions` (`ClientOnboardingReview.jsx`, 177 lines, real) — submission list + review modal. | ✅ Working but minimal — no SLA flag, no priority sort, no deferred-handoff to head_of_tech. |
| **Chase unpaid invoices** | No dedicated admin page. `Invoices.jsx` is the back-office invoice page (real, 90 lines, owner-level). No "chase queue" tab, no Day 1/3/5/7 SLA, no pre-written chase email. | ❌ Not built. |

**What admin does today** (inference based on absent code paths): admin opens `Invoices.jsx`, eyeballs the list, manually emails delinquent clients via Gmail, marks invoices paid by hand (when there's no UI to do that, so probably doesn't), and tracks the chase status in their head.

**Gap.** Two of admin's three jobs work; the third (the most operationally important) has zero UI support. This is the biggest single admin-side gap.

---

## SECTION 4 — ROLE-BY-ROLE PAGE INVENTORY

Cross-cutting note on RouteGuards: only nine routes in `App.jsx` are wrapped with `RouteGuard`. The rest are unguarded — anyone authenticated can navigate to them. Status `🚨` below means a page is reachable by a role that shouldn't see it.

### 4.1 OWNER

| Route | Page | Status | Notes |
|---|---|---|---|
| `/` | OwnerDashboard | ⚠️ | Real KPI cards + Recent Activity feed. **Charts hardcoded sample data** (`OwnerDashboard.jsx:18-33`). |
| `/clients` | Clients | ✅ | Real. Create/update/notify pipeline working. No RouteGuard — any authenticated user can reach it. 🚨 |
| `/clients/:id` | OwnerClientDetail | ⚠️ | RouteGuard owner+admin. 10 tabs (Overview, Discovery, Contacts, Deals, Invoices, Deliverables, Communications, Files, Activity, Audit). **Activity tab and Recent Activity widget render empty for owner due to RLS — STOP-EVERYTHING #5.** |
| `/inbox` | OwnerInbox | ✅ | RouteGuard owner+admin. Real, polling-based message hub. |
| `/deals` | Deals | ✅ | Real pipeline. **No RouteGuard** — any authenticated user can reach. 🚨 |
| `/leads` | Leads | ✅ | Real. **No RouteGuard.** 🚨 |
| `/invoices` | Invoices | ✅ | Real owner-level invoice management. **No RouteGuard.** 🚨 (Admin needs a separate `/admin/invoices` view that hides aggregates.) |
| `/receipts` | Receipts | ✅ | Real. **No RouteGuard.** 🚨 |
| `/commissions` | Commissions | ✅ | Real. **No RouteGuard.** 🚨 (Sensitive financial data exposed if anyone navigates here.) |
| `/payroll` | PayrollReport | ✅ | CSV/PDF export. **No RouteGuard.** 🚨 |
| `/staff` | StaffHR | ✅ | HR + onboarding approval. **No RouteGuard.** 🚨 (And conflicts with line 181's `/staff → StaffMyDay` — first-match wins, so StaffHR is what everyone gets — STOP-EVERYTHING #4.) |
| `/products` | Products | ❌ Stub | Hardcoded array of 35+ products in `Products.jsx:6-683`. No CRUD. |
| `/log-sale` | LogSale | ✅ | Real one-shot deal creator with cascading creates. The path most "real" deals follow today. |
| `/onboarding` | ClientOnboarding | ✅ | Admin/owner-side onboarding overview. |
| `/tasks` | Tasks | ✅ | Real. |
| `/team-oversight` | TeamOversight | ✅ | Real, owner-only check inside the page (`line 68`). |
| `/contracts` | Contracts | ✅ | Real listing. **No RouteGuard.** 🚨 |
| `/contracts/:id` | ContractView | ✅ | Real. |
| `/onboarding-submissions` | ClientOnboardingReview | ✅ | Real. |
| `/monthly-reports` | MonthlyReports | ✅ | Real. |
| `/email-templates` | EmailTemplates | ✅ | Real, 19+ template variables. **No RouteGuard.** 🚨 |
| `/deliverables` | Deliverables | ✅ | Real, time-tracking integrated. |
| `/my-kpis` | MyKPIs | ✅ | Per `KPI_SYSTEM.md`. |
| `/team-kpis` | TeamKPIs | ✅ | Per `KPI_SYSTEM.md`. |
| `/playbooks` | Playbooks | ✅ | Per `PLAYBOOK_SYSTEM.md`. |
| `/owner/financials` | OwnerFinancials | ⚠️ | Real summary cards, charts placeholder. **Registered TWICE** in App.jsx (lines 165 and 168). |
| `/owner/reports` | OwnerReports | ❌ Stub | Mock data. **Registered TWICE.** |
| `/owner/settings` | OwnerSettings | ⚠️ | Users tab real. Packages tab redirects elsewhere. Commissions tab hardcoded. Emails tab redirects. Integrations tab hardcoded. Audit tab stub. |
| `/owner/campaigns` | OwnerCampaigns | ✅ | RouteGuard owner-only. Real. |
| `/owner/commissions` | CommissionDashboard | ✅ | 5 tabs all real. **No RouteGuard.** 🚨 |
| `/owner/leads` | LeadInbox | ✅ | **No RouteGuard.** 🚨 |
| `/staff-productivity` | StaffProductivity | ✅ | RouteGuard owner-only. |
| `/deliverable-quality` | DeliverableQuality | ✅ | RouteGuard owner-only. |
| `/lead-scoring` | LeadScoring | ✅ | RouteGuard owner+admin+field_agent+cpc. |
| `/calendar` | CalendarPage | (not audited) | — |
| `/profile` | StaffProfile | ✅ | Shared with all staff. |
| `/mail` | InternalMail | ⚠️ | Real but `InternalMessage` has no RLS. |
| `/activity` | ActivityLog | (not audited) | — |
| `/build-summary` | BuildSummary | ❌ Stub | 189-line hardcoded reference doc. |
| `/design-preview` | DesignPreview | (dev only) | — |

**Owner pages MISSING from the master plan:**

- `/owner/cash-runway` — runway calculator, prospect pipeline-vs-burn. ❌
- `/owner/mrr` — MRR roll-up, trend, by-package breakdown. ❌
- `/owner/cohorts` — cohort retention table. ❌
- `/owner/cac-ltv` — CAC by source vs LTV by cohort. ❌
- `/owner/churn` — churn dashboard. ❌
- `/owner/integrations` — currently hardcoded in `OwnerSettings.jsx:118-150`; no real integration management. ❌

### 4.2 ADMIN

The Admin role has no dedicated UI; admin shares back-office routes with owner. Gap inventory:

| Route admin needs | Status | What it should do |
|---|---|---|
| `/admin/invoices` | ❌ Not built | Master invoice management for chase. Tabs: unpaid / overdue / paid / cancelled / all. Bulk select. Send chase email button. Mark paid manually. Generate recurring batch. Record EFT payment. View payment history per invoice. |
| `/admin/onboarding-queue` | ⚠️ Exists as `/onboarding-submissions` but minimal | Submissions awaiting review with priority sort, SLA flag, and "hand off to head_of_tech" action. |
| `/admin/leads-verify` | ✅ Exists at `/staff/verify-leads` | RouteGuard admin+owner. |
| `/admin/leads-allocate` | ✅ Exists at `/owner/leads` | But namespaced under `/owner/`, no RouteGuard. Admin can reach it but the URL is misleading. |
| `/admin/payment-chase` | ❌ Not built | Failed-payment chase queue with Day 1/3/5/7 SLA tracking and pre-written email templates. |
| `/admin/recurring-batch` | ❌ Not built | Trigger to generate this month's recurring retainer invoices for all active clients. |
| `/admin/payroll-prep` | ❌ Not built (but `/payroll` exists for owner) | Approve commissions, prep monthly payroll without seeing aggregate financials. |
| `/admin/audit-log` | ⚠️ `/activity` exists | But unaudited; SecurityEvent rows aren't surfaced anywhere. |
| `/admin/staff-comms` | ✅ Exists at `/staff/communications` | Shared with field/CPC. |

### 4.3 CLIENT

| Route | Page | Status | Notes |
|---|---|---|---|
| `/client-portal` | ClientPortal | ✅ | 1157-line hub with 8 sections. Strongest single page in the app. |
| `/client/products` | ClientProducts | ✅ | All/Packages/AddOns + EnquiryModal. |
| `/client/invoices` | ClientInvoices | ✅ | PR #56 fixed tab filters. Outstanding Paid tab will populate once Invoice.status fix lands. |
| `/client/invoices/:invoiceId` | InvoiceDetail | ❌ Stub | 25-line "Coming soon" card. The page clients land on when they tap an invoice. Embarrassing. |
| `/client/contracts` | ClientContracts | ✅ | Real list. |
| `/client/messages` | ClientMessages | ✅ | Real thread + new-message UI. |
| `/client/messages/:threadId` | ClientThreadDetail | ❌ Stub | 25-line "Coming soon" card. |
| `/client/deliverables` | ClientDeliverables | ✅ | Real, with tabs and feedback. |
| `/client/activity` | ClientActivity | ✅ | Wired in PR #52. |
| `/client/settings` | ClientSettings | ✅ | Account / Notifications / Danger Zone tabs. |
| `/client-onboarding` | ClientOnboardingWizard | ✅ | 6-phase stepper. |
| `/client/onboarding-form` | ClientOnboardingFormFull | ✅ | Multi-section form, auto-save. |
| `/client/reports` | ClientReports | ✅ | List + download. |
| `/client/uploads` | ClientUploads | ✅ | PR A wired `document_uploaded` activity log. |
| `/client/profile` | ClientProfile | ✅ | Real form. |
| `/client/project-status` | ClientProjectStatus | ✅ | Phase timeline + deliverable cards. |
| `/client/order-addons` | ClientOrderAddOns | ✅ | ServiceOrder.create. |
| `/client/order-domain` | ClientOrderDomain | ✅ | Real (Domain entity referenced; not separately verified). |
| `/client/order-email` | ClientOrderEmail | ✅ | Real. |
| `/client/orders` | ClientOrders | ✅ | Real. |
| `/client/subscription` | ClientSubscription | ⚠️ | References `Subscription` entity which I did not see in `base44/entities/` listing. May be inferred or stub. |
| `/client/billing-update` | ClientBillingUpdate | ⚠️ | References `PaymentMethod` entity not in audited list. Likely stub or unverified. |

**Client pages MISSING:**

- Year-end statement (download all invoices for tax). ❌
- Receipt PDF for individual paid invoices. ❌ (PDF currently exists for invoices, not for receipts.)
- Bank confirmation upload (PR C scope). ❌
- Account deactivation / data export (POPIA right-to-be-forgotten). ❌

### 4.4 FIELD AGENT

| Route | Page | Status | Notes |
|---|---|---|---|
| `/staff` | StaffHR | 🚨 | Wrong page — first-match conflict, see STOP-EVERYTHING #4. Should be StaffMyDay. |
| `/staff/pipeline` | StaffMyPipeline | ✅ | RouteGuard field_agent+cpc. |
| `/staff/clients` | StaffMyClients | ✅ | RouteGuard field_agent+cpc+head_of_tech. |
| `/staff/communications` | StaffCommunications | ✅ | Real. |
| `/staff/profile` | StaffProfile | ✅ | Real. |
| `/profile` | StaffProfile | ✅ | Same page, different route. |
| `/my-kpis` | MyKPIs | ✅ | — |
| `/playbooks` | Playbooks | ✅ | — |

**Field Agent pages MISSING:**

- Lead capture from a visit. ❌ No form. Field agent cannot create a Lead row.
- Visit log. ❌
- Proposal builder. ❌
- 90-day post-close client window enforcement. ❌
- Mobile-first layout. ❌ (The app is responsive but not optimised for the field-agent on a phone.)

### 4.5 CPC

Same `/staff/*` surface as field_agent. CPC-specific gaps:

- Outbound queue. ❌
- Submission flow that creates a `Lead` with `source='cpc'`. ❌
- Re-engagement queue (rejected invoice leads). ❌ — and the `RejectedInvoiceLead` entity doesn't exist (PR D scope).
- Earnings page (R87/lead, R250/closure breakdown). ⚠️ — `Commissions.jsx` shows the rows but doesn't aggregate "this month I earned R X from leads + R Y from closures."

### 4.6 HEAD OF TECH

| Route | Page | Status |
|---|---|---|
| `/staff/clients` | StaffMyClients | ⚠️ Shared, not scoped to head_of_tech's queue |
| `/staff/image-generator` | StaffImageGenerator | ✅ RouteGuard admin+owner+head_of_tech |
| `/deliverables` | Deliverables | ✅ But not filtered for head_of_tech |

**Head of Tech pages MISSING:**

- Build queue. ❌ Should show all `Deliverable` rows assigned to head_of_tech with status flags.
- SLA traffic dashboard. ❌
- Quality reviews aggregator. ❌ (`DeliverableQuality.jsx` is owner-only; head_of_tech's own ratings should be visible to them.)
- Resource library / fulfilment templates. ❌ `FulfilmentTemplate` entity exists but no UI.

### 4.7 DRIVER

Zero pages. Zero routes. Zero entities for routes/zones/photo-evidence. The role exists in the enum and that's it.

---

## SECTION 5 — DATA MODEL HEALTH CHECK

### 5.1 Entity-by-entity table

47 entities discovered in `base44/entities/`. Per-entity row:

| Entity | Stores | Read by | Written by | RLS | Schema smells |
|---|---|---|---|---|---|
| **AbandonedCartSequence** | Recovery sequences for cancelled checkouts | abandoned-cart-runner | abandoned-cart-trigger, abandoned-cart-runner sweeps | None | OK |
| **AppUser** | App-side auth user (post-migration). `password_hash`, `session_token`, OTP fields. | auth-* functions, customAuth | auth-register, auth-login, auth-verify-otp | None | 🚨 No RLS on auth-sensitive entity. |
| **CampaignSend** | Per-recipient campaign send record | OwnerCampaigns | send-campaign | None | OK |
| **CheckoutEngagement** | Form-abandonment producer (PR #51) | abandoned-cart-runner | record-checkout-engagement | None | OK |
| **Client** | Core client record | Many — 30+ pages | auth-register, payfast-checkout-init, payfast-itn (status promotion), Clients.jsx, etc. | ✅ Tight (owner/admin/match) | Lifecycle status enum has `cancelled` and `churned` but nothing transitions to either. |
| **ClientActivityLog** | Audit trail | ClientActivity, ActivityFeed, OwnerClientDetail | log-client-activity, log-client-activity-public, server functions inline | ✅ but role branches failing for owner — STOP-EVERYTHING #5 | Legacy "ghost" fields (`title`, `body`, `icon`, `category`, `source`, `link`, `read_at`, `user_id`) kept for back-compat per PR #52. Cleanup deferred. |
| **ClientAddOn** | Per-client add-on subscriptions | (inferred — not separately verified) | (inferred) | None | Status enum: `[setup_pending, active, paused, cancelled, completed]`. |
| **ClientCommunication** | Client-staff communication records | ClientPortal, OwnerInbox | StaffCommunications, ClientPortal | None | OK |
| **ClientNotification** | Per-client portal notifications | ClientLayout (badge counts) | notifyClient helper (called from many) | None | 🚨 No `recipient_user_id`; cannot model "notify all admins." Architectural decision pending. |
| **ClientOnboarding** | Onboarding tracker (older shape) | ClientOnboardingWizard, OwnerClientDetail | initiate-onboarding (does NOT write this — writes ClientOnboardingProgress instead) | None | Two onboarding entities (this + ClientOnboardingProgress) overlap; unclear which is canonical. |
| **ClientOnboardingProgress** | Onboarding progress (newer shape) | ClientOnboarding pages | initiate-onboarding | None | Status: `[not_started, in_progress, completed, archived]`. |
| **ClientOnboardingSubmission** | Form submission record | ClientOnboardingFormPublic, ClientOnboardingReview | createOnboardingSubmission, auto-save in form | None | OK |
| **ClientThread** | Message thread between client + staff | ClientMessages, OwnerInbox | get-or-create-client-thread | None | OK |
| **ClientThreadMessage** | Individual messages | ClientMessages, OwnerInbox | send-thread-message | None | OK |
| **ClientUpload** | Files uploaded by clients | ClientUploads, OwnerClientDetail Files tab | ClientUploads.jsx | None | Per-client file privacy depends on RLS we don't have. |
| **Commission** | Commission rows per staff | Commissions, CommissionDashboard, PayrollReport | calculate-commission | None | 🚨 Financial data, no RLS — any user can list. |
| **Contract** | Contracts | Contracts.jsx, ContractView, ClientContracts | LogSale.jsx, manual via admin | None | OK |
| **ContractSignature** | E-signature artefacts | ContractSigningPublic | onContractSigned, ContractSigningPublic | None | OK |
| **Deal** | Sales deal | Deals.jsx, OwnerClientDetail | submit-enquiry, LogSale.jsx, Deals.jsx | ✅ But branches allow closer_id/cpc_id match — closers see all their own deals which is correct. | No `stage` enum in schema — stage is free-form string (smell — values vary across calls). |
| **Deliverable** | Per-client deliverables | Deliverables, ClientDeliverables, OwnerClientDetail | autoCreateDeliverables (only from LogSale), Deliverables.jsx | None | Status enum exhaustive (8 values) which is good. |
| **DeliverableFeedback** | Star ratings + comments | DeliverableQuality | (inference: `DeliverableDetailModal` writes — not separately verified) | None | OK |
| **EmailPreferences** | Marketing/transactional opt-in | unsubscribe function | unsubscribe function | None | OK |
| **EmailTemplate** | Seeded template content | EmailTemplates.jsx | EmailTemplates.jsx, seedEmailTemplates | None | No schema concerns. |
| **EnquiryEvent** | Inbound enquiry record | (inference) | submit-enquiry | None | Status enum: `[new, contacted, quoted, won, lost]`. |
| **FNCReferral** | FNC partner referrals | None | None | None | ❌ Phantom — entity exists, no callers. |
| **FulfilmentTemplate** | Per-bucket fulfilment scaffold | (inference) | (inference: seed function) | None | OK |
| **GeneratedImage** | AI-generated marketing images | StaffImageGenerator | StaffImageGenerator, generate-marketing-image, abandoned-cart-runner | None | OK |
| **InteractionNote** | Lead interaction notes | Leads.jsx | Leads.jsx | None | OK |
| **InternalMessage** | Staff-to-staff messages | InternalMail | InternalMail | None | 🚨 No RLS — staff can read each other's. |
| **Invoice** | Invoices | Many | create-invoice (writes invalid `'issued'`), cancel-invoice | ✅ Tight (owner/admin/client_id match) | 🚨 STOP-EVERYTHING #2: `create-invoice` writes status out of enum. |
| **KPITarget** | Per-role KPI targets | MyKPIs, TeamKPIs | seed | None | OK |
| **Lead** | Lead pipeline | Leads.jsx | Leads.jsx (only) | None | Underused — most "leads" are Client rows directly. |
| **LoginAttempt** | Login audit | (inference) | auth-login | None | 🚨 No RLS on security audit. |
| **MarketingCampaign** | Email campaigns | OwnerCampaigns | OwnerCampaigns, seed-campaigns | None | OK |
| **MilestoneTracker** | Per-staff milestone progress | CommissionDashboard | update-milestone-tracker (fire-and-forget from calculate-commission) | None | OK |
| **MonthlyReport** | Monthly client reports | MonthlyReports, ClientReports | MonthlyReports.jsx | None | OK |
| **OTPCode** | OTP codes for login MFA / signup / reset | (legacy) | (mostly bypassed — AppUser.pending_otp_code is used) | None | 🚨 No RLS on auth tokens. |
| **OnboardingStep** | Per-step onboarding progress | (inference) | initiate-onboarding | None | OK |
| **PackageEmailImage** | Cached package images for abandoned-cart emails | abandoned-cart-runner | abandoned-cart-runner | None | OK |
| **Payment** | Payment record | OwnerClientDetail, payment-public-summary | payfast-checkout-init, payfast-itn, payfast-mark-cancelled | ✅ Empty `{}` — service-role only. Correct. | No `email` field on row — caused friction in PR #50. Documented. |
| **Playbook** | Sales/admin scripts | Playbooks.jsx | seedPlaybooks | None | OK |
| **SecurityEvent** | Auth security audit | (inference) | auth-login (signature mismatch logging in payfast-itn), auth-register, password reset, log-client-activity-public | None | 🚨 No RLS. |
| **ServiceOrder** | Add-on/domain/email orders | ClientOrders, AdminServiceOrders, ClientPortal | ClientOrderAddOns, ClientOrderDomain, ClientOrderEmail | None | Status enum exhaustive; OK except no RLS. |
| **StaffMilestone** | Milestone tracker per staff (separate from MilestoneTracker?) | (inference) | (inference) | None | Two milestone entities — overlap unclear. |
| **StaffRecord** | Full HR record (18 required fields) | StaffHR | StaffOnboardingForm | ✅ Reads (email match or owner). Create empty `{}` (allow-all). | 🚨 18 required fields including residential address, next-of-kin phone — too strict. Allow-all create combined with strict required is contradictory. |
| **SystemSettings** | Global settings | (inference) | (inference) | None | OK if read-only; no RLS means any user can write. |
| **Task** | Tasks | Tasks.jsx, OwnerClientDetail, OwnerInbox, TaskCheckbox, TaskModal | Tasks.jsx, onContractSigned, LogSale.jsx | None | OK |
| **TimeLog** | Time tracked per deliverable | StaffProductivity | Deliverables.jsx | None | OK |
| **User** | Legacy user (back-office staff) | 66 callers (most owner/admin pages) | seed, AdminServiceOrders | None | 🚨 Migration to AppUser is partial — both entities still actively used. |

### 5.2 Schema-level smells (not entity-by-entity)

- **`Invoice.status` enum** — STOP-EVERYTHING #2.
- **`Deal.stage`** is a free-form string with no enum. Values seen in code: `'new_lead'`, `'closed_won'`. Anything written from any source is accepted; no consistency.
- **`Client.status` enum** — `cancelled` and `churned` are never written.
- **`ClientActivityLog`** — legacy ghost fields, deferred cleanup.
- **`User` vs `AppUser`** — partial migration. 66 vs 26 grep hits. Some flows resolve through both via fallback (e.g., `auth-me/entry.ts:14-31`). Long-term smell.
- **`StaffRecord.required` is 18 fields** — operationally hostile.
- **`SecurityEvent.email` is required** — STOP-EVERYTHING #5 noted this; rate-limit events have no email so we use sentinel `'unknown@rate-limit'`. Step 9 cleanup.

---

## SECTION 6 — THE GAPS — COMPLETE LIST, RANKED

| # | Severity | Domain | Gap | Who it blocks | Effort |
|---|---|---|---|---|---|
| 1 | 🚨 | Data integrity | `create-invoice` writes invalid `status: 'issued'`. Either fix to `'sent'` + backfill, or extend enum. | All — invoice state is meaningless. | S |
| 2 | 🚨 | Data integrity | `payfast-itn` doesn't update `Invoice.status` on payment success. | Admin (chase), Client (Paid tab) | S |
| 3 | 🚨 | Security | 40+ entities have no RLS. Commission, OTPCode, LoginAttempt, AppUser, StaffRecord (read), InternalMessage are most exposed. | All — second line of defence absent. | M (per entity) |
| 4 | 🚨 | Routing | `/staff` collision — first-match wins, staff users land on StaffHR (the owner-only HR page). | Field agent, CPC, head_of_tech, driver | XS |
| 5 | 🚨 | Audit | Owner sees empty Activity tab on `/clients/:id` due to RLS role-condition not matching. | Owner, Admin | M (need to read Base44 RLS template engine OR re-route via server function) |
| 6 | 🔴 | Revenue ops | No automatic Contract creation on Deal closed-won. | Sales process | S |
| 7 | 🔴 | Revenue ops | No automatic Invoice creation on Contract signed. | Sales process | S |
| 8 | 🔴 | Revenue ops | No recurring monthly invoice batch. | Admin (manual job) | M |
| 9 | 🔴 | Revenue ops | No overdue Invoice sweep. | Admin (chase visibility) | S (cron + sweep) |
| 10 | 🔴 | Revenue ops | No EFT confirmation UI for admin. | Admin | M |
| 11 | 🔴 | Operations | No `/admin/invoices` chase queue. | Admin | M |
| 12 | 🔴 | Operations | No failed-payment chase queue with SLA. | Admin | M |
| 13 | 🔴 | UX | `/client/invoices/:invoiceId` is a 25-line "Coming soon" stub. | Client | S |
| 14 | 🔴 | UX | `/client/messages/:threadId` is a 25-line "Coming soon" stub. | Client | S |
| 15 | 🔴 | Routing | Many owner-namespaced routes have no RouteGuard (`/clients`, `/deals`, `/invoices`, `/commissions`, `/payroll`, `/owner/commissions`, `/owner/leads`, `/email-templates`). Any authenticated user can navigate. | Permission model integrity | M (audit + add guards across many routes) |
| 16 | 🔴 | Onboarding | No automatic deliverable provisioning post-onboarding-review. `autoCreateDeliverables` only fires from LogSale.jsx. | Head of Tech, Admin | M |
| 17 | 🔴 | Onboarding | No hand-off to head_of_tech after admin reviews submission. | Head of Tech | M |
| 18 | 🔴 | Renewal | No 30/7/0/-1 day contract-end sweep. | Owner (retention), Admin | M |
| 19 | 🔴 | Churn | No churn / cancellation / soft-delete / reactivation flow. | Owner, Admin | L |
| 20 | 🔴 | Notifications | `ClientNotification` cannot model admin-as-recipient. Architectural decision pending. | Admin (in-app alerts) | S (decision) + M (entity change) |
| 21 | 🔴 | Sales pipeline | Lead entity underused — three of five lead sources don't write to it (CPC, field-agent visit, FNC referral all phantom). | Sales operations | L |
| 22 | 🔴 | Reports | `OwnerReports.jsx` is mock data. | Owner strategic vision | L |
| 23 | 🔴 | Reports | `OwnerFinancials.jsx` charts are a placeholder. | Owner | M |
| 24 | 🔴 | Reports | `OwnerDashboard.jsx` charts are hardcoded sample data. | Owner — embarrassing on first impression | S |
| 25 | 🔴 | Sales tools | Field agent has no lead-capture or visit-log UI. | Field Agent | M |
| 26 | 🔴 | Sales tools | CPC has no outbound submission UI. | CPC | M |
| 27 | 🔴 | Delivery | Head of Tech has no scoped queue or SLA dashboard. | Head of Tech | M |
| 28 | 🔴 | Communications | `sendEmailViaResend` helper has zero callers. 27 functions duplicate the Resend instantiation + branding wrapper. Step 8.6 cleanup. | DRY, future brand changes | M |
| 29 | 🟠 | Owner UX | `/owner/financials` and `/owner/reports` registered TWICE in App.jsx. | Code hygiene | XS |
| 30 | 🟠 | Owner UX | `OwnerSettings.jsx` Packages/Emails/Commissions/Integrations/Audit tabs partial or stubs. | Owner config workflow | M |
| 31 | 🟠 | Permissions | `Deal.stage` has no enum — accepts arbitrary values. | Pipeline integrity | S |
| 32 | 🟠 | Permissions | `User` vs `AppUser` migration partial (66 vs 26 callers). | Auth consistency | L |
| 33 | 🟠 | Onboarding tracking | Two onboarding entities (`ClientOnboarding` + `ClientOnboardingProgress`) overlap; canonical unclear. | Confusion | S (pick one) |
| 34 | 🟠 | Permissions | `StaffRecord.create` is allow-all `{}` but has 18 required fields. | HR onboarding | S |
| 35 | 🟠 | Client UX | No year-end statement download. | Client tax season | S |
| 36 | 🟠 | Client UX | Client cannot download a receipt PDF for paid invoices. | Client records | S |
| 37 | 🟠 | Routing | `/staff` route redundancy and ambiguity (line 148 vs 181). | Code hygiene | XS |
| 38 | 🟠 | Tracking | No SLA flags on `Deliverable` rows. | Head of Tech, Owner | M |
| 39 | 🟠 | Reports | No KPI roll-up: MRR, runway, CAC, LTV, churn rate, cohort retention. | Owner strategic | L |
| 40 | 🟠 | Permissions | `OwnerClientDetail.jsx` Activity tab has been registered between Files and Audit but the legacy "Recent Activity" widget on Overview is still wired to the broken direct fetch. Two paths fail in parallel. | Owner | S |
| 41 | 🟠 | Permissions | The `/client/subscription` and `/client/billing-update` pages reference entities (`Subscription`, `PaymentMethod`) not present in the audited entity list. Either inferred / partial / external. | Client billing | M |
| 42 | 🟠 | Receipt emails | Two payment-receipt email functions exist (`payfast-send-receipt`, `send-payment-receipt-email`) — caller of the second is unclear. Risk of double-send if both ever fire. | Client experience | S |
| 43 | 🟡 | Code hygiene | `BuildSummary.jsx` is a 189-line hardcoded stub on a public route. | Owner | XS |
| 44 | 🟡 | Code hygiene | `Products.jsx` is a hardcoded 35-product array (683 lines). Pricing changes are code edits. | Owner | M |
| 45 | 🟡 | Code hygiene | Eight planning docs in `src/` (root + `src/docs/`) — should consolidate to `docs/` per a docs convention. | Code hygiene | XS |
| 46 | 🟡 | Driver role | Driver role exists in enum, no UI. | Future Pulse delivery | L |

(Effort key: XS = <1 hr · S = 1-4 hr · M = half a day to 2 days · L = 3+ days.)

---

## SECTION 7 — WHAT A REAL CRM HAS (reference standard)

Capabilities that mature CRMs (HubSpot, Stripe Dashboard, Xero, Pipedrive, Front, Linear, Intercom) treat as basic table-stakes and that Marketing iO doesn't have. Filtered for relevance to Marketing iO's operating model — SA SME marketing-services agency, packages-based, field + CPC sales, agent fulfilment.

### Owner-level capabilities

- **Cash runway calculator on the dashboard.** "At current burn + this month's expected receivables, you have N months." Critical for launch — at any agency under R5M MRR you can survive or fail in a quarter; the owner should not need to ask.
- **MRR roll-up + trend.** Sum of active retainers, broken down by package, with month-on-month delta. Critical for launch.
- **Profit margin per package.** Setup margin = setup_fee − fulfilment_cost. Retainer margin = retainer − ongoing cost. Today fulfilment_cost lives nowhere. Important post-launch.
- **Churn dashboard.** Monthly churn % by package, by cohort. Important post-launch.
- **CAC vs LTV per source.** Lead-source ROI table. Future / scale.
- **Cohort retention table.** Standard SaaS view: clients acquired in month X, retention curve over months 1-12. Future / scale.
- **Live operational alerts.** "3 invoices overdue >7 days," "2 deliverables blocked," "1 payment failed retry due." Important post-launch.
- **Forecasting.** Pipeline-weighted forecast for next 30/60/90 days. Future / scale.

### Admin-level capabilities

- **Invoice chase queue with SLA.** Day 0 (issued), Day 1 (gentle reminder), Day 3 (firm reminder), Day 7 (final), Day 14 (escalate to admin@/head@). Pre-written templates per stage. Critical for launch.
- **Failed-payment chase queue.** Same pattern but for `Payment.status='failed'` rows. Critical for launch.
- **Recurring batch trigger** with preview. "Generate 12 monthly retainer invoices for May 2026, totalling R X. Confirm?" Critical for launch.
- **EFT match UI.** "I see R3,980 deposited with reference INV-2026-0042. Mark this invoice paid?" Critical for launch.
- **Bulk operations on invoices.** Select 10, send chase email to all 10, mark 10 paid (with separate confirmation). Important post-launch.
- **Onboarding submission queue with SLA flag.** "Acme submitted 3 days ago, no review yet — OVERDUE." Important post-launch.
- **Audit log viewer scoped to security events.** SecurityEvent rows with filter (account_locked, payment_signature_mismatch, etc.). Important post-launch.
- **Bank deposit reconciliation.** Upload bank statement CSV, auto-match by reference, flag unmatched. Future / scale.

### Sales-team capabilities (Field Agent + CPC)

- **Mobile-first lead capture.** One-screen lead-create from a visit or a call. Critical for launch.
- **Visit log with GPS.** Where I was, what I did, who I saw. Important post-launch.
- **Proposal builder.** Pick package, pick add-ons, generate PDF, email to lead. Critical for launch (today this is manual via Word + email).
- **My commissions this month.** Aggregate view: setups + retainers + bonuses + clawbacks. Critical for launch.
- **My pipeline conversion rates.** Of my N leads, M became deals, K closed. Important post-launch.
- **Re-engagement queue (CPC).** Allocated rejected-invoice leads with last-contact dates. Important post-launch (PR D).
- **Daily target dashboard.** N calls today, M leads logged, K deals closed. Critical for launch (KPI_SYSTEM.md scaffolds this).

### Delivery capabilities (Head of Tech)

- **Build queue scoped to head_of_tech.** All Deliverable rows assigned to me, status flags, SLA traffic light. Critical for launch.
- **Per-deliverable timer.** Start/stop time tracking integrated with TimeLog. Important post-launch (today TimeLog requires manual hours entry).
- **Quality review aggregator.** My ratings from clients over time. Important post-launch.
- **Resource library.** Browseable FulfilmentTemplate + Playbook by category. Important post-launch.
- **Capacity planner.** "I have N hours capacity this week, M hours allocated." Future / scale.

### Client-facing capabilities

- **Year-end statement.** Critical for launch (tax season, all-invoices-as-PDF).
- **Per-invoice receipt PDF.** Critical for launch (today only the invoice itself has a PDF).
- **Bank confirmation upload.** PR C scope. Important post-launch.
- **Auto-renewal toggle.** "Renew my plan automatically each year — toggle on/off." Important post-launch.
- **Payment-method update flow.** Live PR — `/client/billing-update` exists but unverified. Critical for launch.
- **Account deletion / data export.** POPIA right-to-be-forgotten. Important post-launch (PR D).
- **Referral programme.** "Refer a business, get R Y credit." Future / scale.

---

## SECTION 8 — STRATEGIC RECOMMENDATION (opinion)

### 8.1 The 18-day launch path (8 May → 25 May)

Section 6 has 28 launch-blocker or critical items. Eighteen days minus weekends and overhead is roughly 12 working days. You cannot ship 28 items in 12 days, and trying will produce broken-on-arrival code that erodes the launch credibility you can't get back.

The 8 you must ship before launch:

1. **STOP-EVERYTHING #2 + #3 — Invoice status integrity.** Fix `create-invoice` to write `'sent'`. Fix `payfast-itn` to update `Invoice.status` on success. Backfill existing rows. *(This is essentially the work scoped as PR #57; it's a 1-day job with care.)*
2. **STOP-EVERYTHING #4 — `/staff` route conflict.** XS — remove the line 148 collision. Half an hour.
3. **STOP-EVERYTHING #5 — Owner Activity tab.** Re-route the OwnerClientDetail Activity reads through a server function that uses `asServiceRole`. Half a day. Keeps the existing RLS in place and unbroken; just bypasses it cleanly with explicit role-check on the server.
4. **#6 + #7 — Auto-create Contract on Deal closed-won AND auto-create Invoice on Contract signed.** Two Base44 functions that fire on the existing entity-update events. One day total.
5. **#8 — Recurring monthly invoice batch.** Manual-trigger initially (admin clicks "Generate this month"), automated cron next phase. One day.
6. **#11 — `/admin/invoices` chase queue.** Tabs, list, manual mark-paid action, send-chase-email button. Most-important-single-page admin lacks. One day for v1.
7. **#13 + #14 — Stub pages.** `InvoiceDetail` and `ClientThreadDetail` need to render real data, even minimally. Half a day each. Embarrassment vector.
8. **#3 — RLS on the four most-exposed entities.** Commission, OTPCode, LoginAttempt, InternalMessage. RLS rules per the Section 2 matrix. Half a day each. Skip the long tail of 35+ other entities until after launch — those are second-line-of-defence and the front-end SDK isn't surfacing them today.

That's roughly 8 working days. Leaves margin for the inevitable "live tested, found three small things" days on the back end.

**What you defer and the consequences:**

- **#9 (overdue sweep), #10 (EFT UI), #12 (failed-payment chase):** Admin will run these manually in spreadsheets for the first 30 days. Cost: admin overtime, occasional missed chase. Acceptable.
- **#16 + #17 (post-onboarding deliverable provisioning + head_of_tech hand-off):** With 5 launch clients, head_of_tech can be told manually. Doesn't scale past 15.
- **#18 (renewal sweep):** Year-1 clients won't hit renewal until 12 months from launch. You have time.
- **#19 (churn handling):** You'll hand-handle the first 1-2 cancellations. Build PR D in month 2.
- **#21 (Lead entity wiring):** Live with the current "enquiry → Deal directly" path for now. CPC/field-agent submission flows are post-launch.
- **#22, #23, #24 (Owner reports/financials/dashboard charts):** Replace the hardcoded sample data with one real chart (e.g., last 12 weeks invoice total). Even one real chart beats fake data. The rest of the strategic vision layer — runway, MRR, churn — is post-launch.
- **#25, #26, #27 (sales team UI):** Field agent and CPC live with the current `/staff/pipeline` view for now. Mobile-first, proposal builder, lead capture all post-launch.
- **#15 (RouteGuard audit):** Add guards to the 5 most sensitive owner-only pages (`/commissions`, `/payroll`, `/staff` (HR), `/owner/commissions`, `/payroll`). The rest can wait.

### 8.2 First 30 days post-launch

Operational stabilisation. Three rough buckets, in order:

- **Week 1:** Triage live bugs as they surface. Expect 4–6 small fixes.
- **Week 2:** Finish the Invoice operational layer — overdue sweep (#9), EFT match UI (#10), failed-payment chase (#12). This is what makes the CRM actually replace the spreadsheets it's competing with.
- **Weeks 3-4:** Communications cleanup. Step 8.6 (consolidate the 27 Resend duplicates), the Activity legacy ghost fields, the two payment-receipt functions. Not glamorous; pays compounding interest.

### 8.3 Days 30-90

Build the admin and sales-team views to operational completeness.

- **Admin:** failed-payment queue, recurring batch automation, onboarding-review SLA, audit-log viewer, EFT reconciliation polish.
- **Sales team:** lead capture (#25, #26), proposal builder, "my commissions this month" aggregator, daily target dashboard.
- **Head of Tech:** scoped build queue, SLA traffic, quality reviews aggregator.
- **Notifications:** decide and ship the admin notification model (`ClientNotification.recipient_user_id` vs separate entity), wire admin alerts.
- **Renewal sweep** (#18) — has to land before month 11 for any year-1 client.
- **Churn / soft-delete / reactivation** (#19) — PR D scope. Plan for first cancellation around day 60.
- **Lead entity wiring** (#21) — make CPC and field-agent flows actually write to Lead. This unblocks the whole lead-source ROI story.

### 8.4 Months 4-6

The "real CRM" delta. The work that turns Marketing iO from "operational MVP" to "the kind of CRM you could sell to other agencies."

- **Owner strategic vision:** cash runway, MRR roll-up, profit-per-package, churn dashboard, cohort retention. Section 7's Owner block.
- **Financial integration:** Xero or Sage connector for invoice + payment sync. Removes the "spreadsheet accounting" risk.
- **Reporting suite:** the 8 master-plan templates, real this time.
- **Field agent mobile-first redesign:** PWA-style, offline-tolerant lead capture.
- **Driver role build-out:** routes, zones, photo-evidence, wrap reports. Today this role is empty — when Pulse scales, it has to exist.
- **Self-serve agency tier (if Marketing iO ever sells the platform):** admin = agency owner, clients = their clients. Multi-tenancy. Much later.

### 8.5 What I would refuse to build right now if I were you

Honest engineering pushback. These are things either in the master plan or implied by recent direction that I think are wrong, premature, or not worth the cost given where you are.

1. **PR B's "notify admin@ + head@ + in-app to all admins" full pattern, all-at-once.** Decision 2 of the Master Index makes sense long-term but adopting it across 5 PRs (B/C/D/F) without first deciding the `ClientNotification` recipient model means you'll either build the same thing 5 different ways or block PR B until the architectural decision lands. Push: decide the model first, ship one PR using it, then the other four follow the pattern. Don't bake a not-yet-decided pattern into a sequence.

2. **Building `OwnerReports.jsx` to the 8-template master plan before launch.** It's beautiful work and entirely ego-driven if the underlying KPIs (MRR, runway, churn) aren't computed. Build the data pipeline first (computed in real KPIs by `lib/kpiCalculator.js` per `KPI_SYSTEM.md`); the report templates are presentation glue. Doing them in reverse — pretty templates of mock data — is what you have today (`OwnerReports.jsx:7-35`).

3. **The `Field Consultant Plan` build out before launch.** Field agents will exist post-launch and need their tools, but with 5 launch clients and yourself probably being the de-facto field agent for the first month, this can wait. Prioritising it eats the launch budget for 3 deliverables nobody yet needs.

4. **Migrating away from `User` to `AppUser` completely.** It's tempting because the migration is half-done. But 66 legacy callers still work. Finishing the migration is a refactor with high regression risk and zero user-facing benefit. Live with the dual-entity reality for 6 months; revisit when you have to add a field anyway.

5. **A brand-kit / package-pricing edit UI for Owner.** `OwnerSettings.jsx` Packages tab redirects elsewhere; you've effectively shipped "edit pricing in the codebase" already. That's actually fine for an agency owner-coder who knows the codebase. Building a CMS-style package editor is a 2-week project that saves you an hour every six months. Don't.

6. **The Driver role build-out before there's actual Pulse demand.** It's in the role enum because someone will eventually do Pulse fulfilment, but you don't have the volume yet. Build it when the second Pulse client lands, not before.

7. **Step 8.6 (Resend wrapper consolidation) before anything operational.** It's tempting to clean up because we just touched email code. But the consolidation is a 27-file refactor that adds zero user value. Ship the operational gaps first; come back to Step 8.6 in month 2 when you're building admin notifications and need the wrapper anyway.

8. **The 8-tabbed `OwnerClientDetail.jsx` further expansion.** It's already 429 lines and 10 tabs. The "Audit" tab now duplicates the "Activity" tab. The "Communications" tab duplicates the activity feed of the Communications category. Trim before adding. Today the tab row is overflow-x-scroll on every screen smaller than 1280px.

---

> End of v1. This document is a living reference — changes to entities, flows, or roles should land here as part of the PR that changes them. Before sending the next PR brief, re-read Sections 2, 6, and 8.1.
