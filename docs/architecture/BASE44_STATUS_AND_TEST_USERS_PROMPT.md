# Marketing iO CRM — Status & Next Steps Prompt for Base44

> **What this is:** A single comprehensive prompt for the Base44 AI builder. Covers everything shipped (PRs #57–#66), what's still pending, what's been deferred, and the next concrete task — seeding 5 test staff users for CPC, Field Agent, and Admin role testing.
> **How to use:** Paste the relevant section into the Base44 builder. Each task is independently verifiable. Save the doc — you'll re-read it before each phase.

---

# PART 1 — CONTEXT (give this to the Base44 AI before any task)

This is **Marketing iO CRM** — operational system for a South African SME marketing-services agency. Sells packages (Ignite/Accelerate/Dominate setup R700–R9,800 + monthly retainers R200–R4,000) plus add-ons (SMS, WhatsApp, websites, Google Ads, Pulse street/township activations).

**Roles:** owner, admin, field_agent, cpc, head_of_tech, driver, client.

**Six rounds of recovery work have shipped and been merged into `main` via PRs #57–#66.** The source app is operationally complete for the spine: invoice integrity, payfast→invoice wiring, /staff route fix, empty Activity tab fix, RLS on 12 entities, auto-Contract on closed-won, auto-Invoice on signed, recurring monthly batch, /admin/invoices chase queue, onboarding SLA + handoff with auto-Deliverables provisioning, real client InvoiceDetail and ThreadDetail pages, real OwnerDashboard chart, owner→staff user provisioning.

---

# PART 2 — WHAT'S DONE (PRs #57–#66, all merged)

| PR | Round | Scope | Status |
|---|---|---|---|
| **#57** | Doc | CRM Architecture & Flow Blueprint v1 (874-line reference document) | ✅ Merged |
| **#58** | Round 1 | Spine foundations — invoice status `'issued' → 'sent'`, payfast→invoice wire-up, `/staff` route conflict fix | ✅ Merged |
| **#59** | Round 2 | Empty Activity tab fix (`list-client-activity` server function) + RLS on 4 entities (Commission, OTPCode, AppUser, InternalMessage) | ✅ Merged |
| **#60** | Round 3 | Auto-Contract on Deal closed-won + auto-Invoice on Contract signed + recurring monthly retainer batch | ✅ Merged |
| **#61** | Round 4 | `/admin/invoices` chase queue (with `send-invoice-chase` and `mark-invoice-paid-eft` functions) + onboarding SLA flag + Review-and-handoff button | ✅ Merged |
| **#65** | Round 5 (rebased) | Real `/client/invoices/:invoiceId` page + real `/client/messages/:threadId` page + OwnerDashboard real "last 12 weeks paid" chart + owner→staff user provisioning (`provision-staff-user` + `/owner/users` page) | ✅ Merged |
| **#66** | Round 6 quick wins | Auto-create Deliverables from FulfilmentTemplate on hand-off + RLS on 8 more entities (Lead, LoginAttempt, SecurityEvent, Contract, Deliverable, Task, ServiceOrder, ClientNotification) | ✅ Merged |

---

# PART 3 — WHAT'S STILL OPEN IN GITHUB

| PR | Action | Why |
|---|---|---|
| **#62** | Close (don't merge) | Old Round 5 branch with conflicts. Superseded by #65 which is already merged. Merging #62 now would break things. |
| **#63** | Merge (pure docs) | Round 6 polish prompt for Base44 — `docs/architecture/BASE44_ROUND6_POLISH_PROMPT.md` |
| **#64** | Merge (pure docs) | Master recovery prompt for the new Base44 app — `docs/architecture/BASE44_NEW_APP_RECOVERY_PROMPT.md` |
| **#15** | Review separately | Old May 5 fix unrelated to recovery work. Keep, close, or revisit when you have time. |

---

# PART 4 — WHAT'S DEFERRED (not built, lives as prompts only)

These were intentionally not built before launch per blueprint Section 8.5 ("DO NOT BUILD" list). Documented in PR #63 / #64 prompts so they can be picked up post-launch when needed.

## Round 6 polish items deferred

| Task | Why deferred | When to build |
|---|---|---|
| **6B** Overdue invoice sweep | `/admin/invoices` Overdue tab uses a computed UI fallback (`status='sent' AND due_date<today`) so the tab populates correctly. The entity status doesn't flip but the operational view works. | Post-launch when Base44 cron support is configured. |
| **6C** Renewal sweep (30/7/0 day) | First contracts won't reach renewal until 12 months from launch. Year-1 clients are nowhere near. | Month 11 of operation. |
| **6D** Client cancel/reactivate + churn grace | First 1-2 cancellations can be handled manually by admin updating the entity. | Month 2 once you've seen the actual cancellation flow needs. |
| **6F** ClientNotification recipient model + admin alerts | Admin checks `/admin/invoices`, `/onboarding-submissions`, `/staff/verify-leads` daily per SOP. SLA flags cover what notifications would. | Month 2-3 when admin volume increases. |

## Larger features deferred

| Item | Why deferred |
|---|---|
| Strategic dashboards: MRR roll-up, runway calculator, churn dashboard, cohort retention, CAC/LTV | Build the data pipeline first; templates are presentation glue. Premature without underlying KPI computation. |
| CPC / Field Agent submission flows + proposal builder | Post-launch — owner is the de-facto field agent for first month. |
| Driver role build-out (routes, zones, photo evidence) | No Pulse delivery demand yet. |
| Resend wrapper consolidation (27 functions) | Refactor with no user-facing value pre-launch. |
| `User → AppUser` full migration | Dual-entity reality works; 66 callers still use User. |
| Brand-kit / package-pricing CMS | Edit code for now. |
| Year-end statement / per-receipt PDF for clients | Tax-season feature; post-launch. |
| Bank reconciliation CSV upload | Post-launch operational tool. |
| Mobile-first sales redesign | Responsive is good enough. |
| FNC referral logging UI | Commission engine handles `fnc_referral` enum already; only the logging UI is missing — new feature, not polish. |
| More tabs on `OwnerClientDetail` | Already 10 tabs. Trim before adding. |

---

# PART 5 — NEXT TASK: SEED TEST STAFF USERS

You want test accounts for CPC and Field Agent role testing. Use the existing `provision-staff-user` function (Round 5) but with a known shared password instead of the default random temp password.

## TASK — Seed 5 test staff users with known passwords

**The 5 test users:**

| Email | Role | Purpose |
|---|---|---|
| `cpc1@marketingio.co.za` | `cpc` | CPC (cold-prospecting) test user #1 |
| `cpc2@marketingio.co.za` | `cpc` | CPC test user #2 |
| `field1@marketingio.co.za` | `field_agent` | Field agent test user #1 |
| `field2@marketingio.co.za` | `field_agent` | Field agent test user #2 |
| `admin@marketingio.co.za` | `admin` | Admin test user |

**All 5 passwords:** `Test123456!`

**Two ways to seed them.** Pick one.

### Option 1 — Use the existing /owner/users page (low risk, 5 minutes)

Sign in as owner, then for each of the 5 users:

1. Navigate to `/owner/users`
2. Click "Create staff user"
3. Fill in email + full name + role + (optional phone)
4. Submit. A modal shows the setup URL with a copy button.
5. Open the setup URL in a new browser tab (or incognito window so it doesn't affect your owner session)
6. Set the password to `Test123456!`
7. Confirm
8. Repeat for the next user

Repeat 5 times. Reliable, uses the flow you already shipped.

### Option 2 — Build a one-shot seed function (cleaner if you'll re-create test users often)

Create a new Base44 function `seed-test-staff-users`. Owner-only. POST `{ token }`.

Logic:

1. Validate session token, require role `owner`.
2. For each of the 5 users in the list above:
   - Check if `AppUser.filter({ email })` returns any row. If yes, skip with `reason='already_exists'` (idempotent).
   - Otherwise, create AppUser with:
     - `email` (lowercased)
     - `full_name` (e.g. "CPC Test 1")
     - `role` from the list
     - `password_hash` = bcrypt hash of `Test123456!` (use bcrypt, cost factor 10)
     - `email_verified` = true (skip OTP for test users)
     - `pending_verification` = false
     - `created_date` = now
   - Also create the parallel legacy User row with the same email + role (for backwards-compat with the 66 legacy callers).
3. Return `{ created: [{ email, role }, ...], skipped: [{ email, reason }, ...] }`.

Then invoke once from the Base44 console:

```js
await base44.functions.invoke('seed-test-staff-users', {
  token: '<your_owner_session_token>'
})
```

**Verification (both options):** Sign in to the app at each test email + `Test123456!`. Each one should land on `/staff` (StaffMyDay) and see the role-appropriate sidebar. CPC users see the CPC sidebar, field agents see the field_agent sidebar, admin sees the admin sidebar with `/admin/invoices`, `/onboarding-submissions`, etc.

---

# PART 6 — WHAT EACH ROLE CAN DO TODAY

Once test users are seeded, here's what each one will see when they sign in. **Important:** the CPC and Field Agent lead-capture flows are explicitly DEFERRED post-launch (Part 4). The portals exist and the navigation works, but the "create a Lead" submission flow doesn't exist on those role's pages yet — that's a future build.

## CPC (`cpc1@marketingio.co.za`, `cpc2@marketingio.co.za`)

**Sidebar:**
- My Day (`/staff` — StaffMyDay)
- My Pipeline (`/staff/pipeline`)
- My Leads (`/leads` — generic page, NOT a CPC-specific submission flow)
- Lead Scoring (`/lead-scoring`)
- Tasks (`/tasks`)
- Communications (`/staff/communications`)
- My Commissions (`/commissions` — RLS-scoped to own rows after Round 2)
- My KPIs (`/my-kpis`)
- Playbooks (`/playbooks`)
- Profile (`/profile`)

**What works:** view own pipeline, view own commissions, log communications, see KPIs.
**What doesn't (DEFERRED):** dedicated CPC outbound submission flow, re-engagement queue for rejected-invoice leads, R87/lead and R250/closure earnings aggregator (the entity rows exist via Round 3's commission engine, but no per-CPC summary card).

## Field Agent (`field1@marketingio.co.za`, `field2@marketingio.co.za`)

**Sidebar:**
- My Day (`/staff` — StaffMyDay)
- My Pipeline (`/staff/pipeline`)
- My Clients (`/staff/clients`)
- Add Lead (`/leads` — generic admin-style entry page)
- Lead Scoring (`/lead-scoring`)
- Tasks (`/tasks`)
- Communications (`/staff/communications`)
- My Commissions (`/commissions`)
- My KPIs (`/my-kpis`)
- Playbooks (`/playbooks`)
- Profile (`/profile`)

**What works:** view own pipeline + own clients (90-day post-close window enforced via RLS after Round 6G), log communications, view own commissions.
**What doesn't (DEFERRED):** mobile-first lead capture from a visit, visit log with GPS, proposal builder PDF generator, daily target dashboard.

## Admin (`admin@marketingio.co.za`)

**Sidebar:**
- My Day (`/staff` — StaffMyDay)
- Invoice Chase (`/admin/invoices`) — Round 4
- Onboarding Queue (`/onboarding-submissions`) — Round 4 with SLA flag + Round 6A handoff
- Verify Leads (`/staff/verify-leads`)
- Contracts (`/contracts`)
- Receipts (`/receipts`)
- Tasks (`/tasks`)
- All Clients (`/clients`)
- Communications (`/staff/communications`)
- My KPIs (`/my-kpis`)
- Playbooks (`/playbooks`)
- Profile (`/profile`)

**Daily SOP:**
1. `/admin/invoices` Overdue tab → send chase emails (4 stages: Day 1/3/7/14)
2. `/onboarding-submissions` → review submissions with red SLA badge → "Review & hand off to head_of_tech" (auto-creates Deliverables now thanks to Round 6A)
3. `/staff/verify-leads` → approve/reject pending leads
4. `/staff/communications` → reply to client messages

**Monthly:**
- `/admin/invoices` → "Generate this month's batch" → preview → confirm

**What works:** all of the above + EFT mark-paid, send chase email with custom note, RLS prevents admin from seeing aggregate revenue/profit (Section 2 role matrix).
**What's missing:** unified `/admin` dashboard aggregating "5 invoices overdue · 3 onboarding waiting · 2 leads pending" in one view (would be a Round 6.5 task; ~1-2 hours, no new backend).

---

# PART 7 — POST-SEED VERIFICATION CHECKLIST

After seeding the 5 test users, go through this checklist sign-in by sign-in.

## Owner (your existing account)

- [ ] Sign in at `/login`
- [ ] Land at `/` (OwnerDashboard) — chart shows "Paid invoices · last 12 weeks" with real data
- [ ] Open `/owner/users` — see all 5 newly seeded test users in the list
- [ ] Open `/clients/<test-client>` → click Activity tab → confirm rows render
- [ ] Open `/admin/invoices` → confirm visible (owner can access admin pages)

## Admin (`admin@marketingio.co.za`)

- [ ] Sign in with `Test123456!`
- [ ] Land at `/staff` (StaffMyDay)
- [ ] Sidebar shows admin nav (Invoice Chase, Onboarding Queue, Verify Leads, etc.)
- [ ] Open `/admin/invoices` → tabs work, can see invoices
- [ ] Try to open `/owner/financials` → should redirect to `/` (RouteGuard blocks admin from owner-only pages)
- [ ] Browser DevTools console: `await base44.entities.Commission.list()` → should return empty/forbidden (Round 2 RLS)
- [ ] Open `/onboarding-submissions` → confirm SLA badges show on old submissions

## CPC (`cpc1@marketingio.co.za`)

- [ ] Sign in with `Test123456!`
- [ ] Land at `/staff` (StaffMyDay)
- [ ] Sidebar shows CPC nav (My Pipeline, My Leads, Communications, My Commissions)
- [ ] Try to open `/admin/invoices` → should redirect (RouteGuard blocks)
- [ ] Browser DevTools console: `await base44.entities.Lead.list()` → should only show leads where `cpc_id` matches your user.id (Round 6G RLS)

## Field Agent (`field1@marketingio.co.za`)

- [ ] Sign in with `Test123456!`
- [ ] Land at `/staff`
- [ ] Sidebar shows field_agent nav (My Pipeline, My Clients, Add Lead, etc.)
- [ ] Try to open `/admin/invoices` → should redirect
- [ ] Browser DevTools console: `await base44.entities.Lead.list()` → should only show leads where `assigned_field_agent` matches your user.id

## Cross-role (RLS spot checks)

- [ ] As `cpc1`: try `await base44.entities.Commission.list()` → should only show commissions where `user_id` or `staff_id` matches you
- [ ] As `field1`: try `await base44.entities.Contract.list()` → should return empty (no field_agent in Contract read RLS)
- [ ] As anyone non-owner: try `await base44.entities.LoginAttempt.list()` → should return empty/forbidden

---

# PART 8 — SECURITY NOTE (READ BEFORE LAUNCH)

The shared password `Test123456!` is for **TESTING ONLY**. Before going live with real clients on **5 June**:

1. **Reset all 5 test user passwords** to strong, unique values (or have each user reset via the password-reset email flow).
2. **OR delete the test users** that won't be used in production (e.g. `cpc2`, `field2` if you only have one of each).
3. **Don't commit the test password to a public repo** — this doc lives in `docs/architecture/` and is fine for an internal repo, but if you ever open-source the codebase, redact it.
4. **Audit `LoginAttempt` and `SecurityEvent`** weekly during the first month — Round 6G locked these to owner-only, so use the Base44 data console to inspect.

---

# PART 9 — AFTER TEST USERS ARE SEEDED

If everything verifies cleanly, the operational system is **launch-ready** for the 5 June date. Remaining work falls into three buckets:

## Bucket A — Deferred polish (post-launch, when needed)

The 4 deferred Round 6 items (6B, 6C, 6D, 6F). Build them when operational signal demands — e.g. when you have your first cancellation, or when Base44 cron is configured.

## Bucket B — Real CPC / Field Agent build-out (month 2-3)

Mobile-first lead capture, visit log with GPS, proposal builder PDF, R87/lead earnings aggregator, re-engagement queue. The pages exist in the sidebar but the actual capture flow needs to be designed and built.

## Bucket C — Strategic vision (months 4-6)

MRR roll-up, runway calculator, churn dashboard, cohort retention, CAC/LTV. Build the KPI computation pipeline first (`lib/kpiCalculator.js` already scaffolds part of this per `KPI_SYSTEM.md`). Templates come after.

---

**END OF PROMPT.** This document is the complete state-of-play for Marketing iO CRM at the launch-readiness checkpoint. Re-read before each phase. Update as work ships.
