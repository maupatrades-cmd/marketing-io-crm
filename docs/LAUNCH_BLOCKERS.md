# Launch Blockers — Master List

**Single source of truth.** Every fix lands as one PR per item ID. No bundling, no in-line drive-by fixes. New issues get appended here, not fixed in the same PR.

## Status legend

- `NOT STARTED` — not yet touched
- `IN PROGRESS` — PR open, awaiting tester confirmation
- `✅ DONE (YYYY-MM-DD)` — tester confirmed WORKING

## Severity legend

- `CRITICAL` — cannot launch with this in place (data exposure, privilege escalation, money corruption, hardcoded secrets in source, broken core workflows).
- `HIGH` — should fix before launch; workaround possible for first week.
- `MED` — fix in first sprint post-launch.
- `LOW` — backlog / polish.

## Sources consolidated

- Owner portal audit (pass 1)
- Client portal audit (pass 1 + pass 2 deep)
- Admin portal audit
- Backend functions deep audit
- Entity schemas + RLS audit
- Holistic deps + integrations audit
- Spot-checks against App.jsx routing + schema cross-references

## Architectural note — LB-001 to LB-011 need reshaping

LB-281 (auth bridge) verified empirically that Base44's RLS engine does NOT recognise the custom `mio_session_token` as a valid SDK bearer — custom UUIDs can never be valid Base44 JWTs, and the built-in User entity cannot be written from backend functions (confirmed by Base44 directly via the `auth-verify-otp` comment). The fix Base44 applied: bypass SDK auth entirely, route all sensitive entity reads through backend functions that validate `AppUser.session_token` server-side and use `asServiceRole` to read.

**This makes entity-level `rls` blocks irrelevant for client-portal users.** LB-001 through LB-011 (and LB-122-LB-124, LB-130, LB-216, etc. that depend on RLS) need to be re-scoped: instead of "add `rls` block to entity X", the new framing is **"create `get<X>` / `update<X>` backend functions with role-based authz, and rewire all client-portal callers to use them"**. Same goal (cross-tenant isolation, POPIA compliance), different mechanism. Pattern reference: `getPlaybooks` and `updatePlaybook` functions added by Base44 on 2026-05-17.

Items LB-001 through LB-011 are kept on the list for now but will be re-titled and re-scoped as we work through them. The new task per entity is approximately:
1. Add `get<Entity>` function: validate `AppUser.session_token`, role-check, return `asServiceRole.entities.<Entity>.filter(...)` results.
2. Add `update<Entity>` and any other mutating functions with role gates.
3. Rewire every `base44.entities.<Entity>.<method>` call in `src/` to use the function instead.

---

# CRITICAL

## RLS / cross-tenant data exposure

- **LB-001** [CRITICAL] `base44/entities/Client.jsonc` — no RLS block; every authenticated user can read every Client row including monthly_retainer, contact details, notes. Status: NOT STARTED
- **LB-002** [CRITICAL] `base44/entities/Payment.jsonc` — empty RLS object; every authenticated user can read every Payment with ZAR amounts and IPN payloads. Status: NOT STARTED
- **LB-003** [CRITICAL] `base44/entities/ClientOnboardingSubmission.jsonc` — no RLS block; stores plaintext website passwords, Google Business Profile creds, social media creds, bank confirmation file URLs, VAT certificates — all world-readable. Status: NOT STARTED
- **LB-004** [CRITICAL] `base44/entities/ClientThread.jsonc` — no RLS block; every authenticated user can list every thread. Status: NOT STARTED
- **LB-005** [CRITICAL] `base44/entities/ClientThreadMessage.jsonc` — no RLS block; every authenticated user can read every message body across every client. Status: NOT STARTED
- **LB-006** [CRITICAL] `base44/entities/ClientUpload.jsonc` — no RLS block; every client can list every other client's uploaded brand assets. Status: NOT STARTED
- **LB-007** [CRITICAL] `base44/entities/ClientCommunication.jsonc` — no RLS block; all inquiries, billing complaints, support requests globally readable. Status: NOT STARTED
- **LB-008** [CRITICAL] `base44/entities/ClientAddOn.jsonc` — no RLS block; reveals per-tenant pricing and active subscriptions. Status: NOT STARTED
- **LB-009** [CRITICAL] `base44/entities/Deliverable.jsonc:137-140` — field_agent read rule has no client_id scope; every field agent can read every deliverable. Status: NOT STARTED
- **LB-010** [CRITICAL] `base44/entities/Contract.jsonc:188-196` — field_agent + cpc read rules have no client_id scope; cross-tenant contract leak including signed PDFs. Status: NOT STARTED
- **LB-011** [CRITICAL] `base44/entities/OTPCode.jsonc:64` — `rls.update = {}`; anyone can mutate any OTP row (flip `used` flag on someone else's code). Status: NOT STARTED

## Unauthenticated backend endpoints — money / commission attacks

- **LB-012** [CRITICAL] `base44/functions/update-commission-attribution/entry.ts:18-26` — no auth; anyone can rewrite commission attribution on any client. Status: NOT STARTED
- **LB-013** [CRITICAL] `base44/functions/update-milestone-tracker/entry.ts:28-38` — no auth; anyone can force milestone unlocks (money trigger). Status: NOT STARTED
- **LB-014** [CRITICAL] `base44/functions/calculate-commission/entry.ts:105-111` — no auth; anyone can fire commission calc on any payment_id. Status: NOT STARTED
- **LB-015** [CRITICAL] `base44/functions/create-invoice/entry.ts:18-46` — no auth; anyone can mint invoices with arbitrary closer_id for commission attribution. Status: NOT STARTED
- **LB-016** [CRITICAL] `base44/functions/handle-failed-debit-notification/entry.ts:3-30` — no auth; anyone can trigger acceleration clause (full balance immediately due) against any client. Status: NOT STARTED
- **LB-017** [CRITICAL] `base44/functions/cancel-invoice/entry.ts:48-74` — session check but no role gate and no `invoice.client_id == caller's client_id` scope; any logged-in user can cancel any invoice. Status: NOT STARTED
- **LB-018** [CRITICAL] `base44/functions/process-clawback/entry.ts:104-115` — no auth + writes invalid Commission.status values. Status: NOT STARTED

## Unauthenticated backend endpoints — identity / account-takeover

- **LB-019** [CRITICAL] `base44/functions/migrate-owner-to-appuser/entry.ts:9-10` — no auth + hardcoded `business.lekgoro@gmail.com` / `MarketingIO2026!` in source (already in git history). Status: ✅ DONE (2026-05-17) — function deleted via PR #86. Manual password rotation still required outside the PR.
- **LB-020** [CRITICAL] `base44/functions/seedOwnerAccount/entry.ts:9-11` — no auth + hardcoded owner creds; can recreate owner account on demand. Status: ✅ DONE (2026-05-17) — function deleted via PR #88. Tester confirmed 404.
- **LB-021** [CRITICAL] `base44/functions/create-test-client/entry.ts:7-8,48` — no auth + hardcoded `Thapelo15!` returned in response body. Status: ✅ DONE (2026-05-17) — function deleted via PR #89. Tester confirmed 404.
- **LB-022** [CRITICAL] `base44/functions/seed-test-staff-users/entry.ts:23,121` — `Test123456!` shared password returned to caller. Status: ✅ DONE (2026-05-17) — function deleted via PR #90. Tester confirmed 404. **Manual password rotation on the 5 test staff accounts still required.**
- **LB-023** [CRITICAL] `base44/functions/cleanup-stuck-signup/entry.ts` — no auth; deletes AppUser + Clients + OTPCodes for any email. Status: ✅ DONE (2026-05-17) — function deleted via PR #91. Tester confirmed 404.
- **LB-024** [CRITICAL] `base44/functions/request-account-deletion/entry.ts` — upgraded to a full 14-day cooling-off deletion pattern with email notifications, in-app cancel banner, email-link cancel page, and daily cron that anonymises (SARS+POPIA compliant: financial records retained 5 years, personal data scrubbed). Status: ✅ DONE (2026-05-17) — shipped via PR #93. Manual setup remaining: wire the Base44 Automation for daily 03:00 SAST cron invocation of `process-pending-deletions`.
- **LB-025** [CRITICAL] `base44/functions/sign-out-everywhere/entry.ts:13-44` — no auth; force-logout any user by user_id. Status: ✅ DONE (2026-05-17) — auth gate added via PR #94. Tester confirmed self-flow works; console-based attack tests deferred to curl (base44 SDK not exposed on window in prod builds).
- **LB-026** [CRITICAL] `base44/functions/updateUserRole/entry.ts:6-23` — caller validated against legacy User entity (post-migration broken), no whitelist on target role, admin can self-promote to owner. Status: ✅ DONE (2026-05-17) — function deleted via PR #95. Tester confirmed 404.
- **LB-027** [CRITICAL] `base44/functions/send-thread-message/entry.ts:49-82` — `sender_id` taken from body without session verification; any caller can impersonate any thread participant. Status: ✅ DONE (2026-05-19) — sender now derived from session token via PR #96. ClientThread + ClientThreadMessage entities also deployed to live (were missing from production app entirely).
- **LB-028** [CRITICAL] `base44/functions/list-thread-messages/entry.ts:19-43` — `current_user_id` from body; IDOR reads any thread. Status: ✅ DONE (2026-05-19) — caller derived from session via PR #97.
- **LB-029** [CRITICAL] `base44/functions/get-or-create-client-thread/entry.ts:43-80` — same IDOR pattern as LB-028. Status: ✅ DONE (2026-05-19) — caller derived from session via PR #97.
- **LB-030** [CRITICAL] `base44/functions/change-password/entry.ts:18` — `user_id` from body, not session; design flaw (current_password is the only gate). Status: NOT STARTED

## Unauthenticated backend endpoints — email / notifications

- **LB-031** [CRITICAL] `base44/functions/send-email-public/entry.ts:218-239` — `purpose: 'admin_notification'` accepts arbitrary `to` + HTML body; **open email relay** using hello@marketingio.co.za domain. Status: NOT STARTED
- **LB-032** [CRITICAL] `base44/functions/notifyClientCommunication/entry.ts:60-71` — no auth + interpolates `comm.subject`/`comm.message` into HTML email body unescaped; reflected HTML/phishing-link injection to admins. Status: NOT STARTED
- **LB-033** [CRITICAL] `base44/functions/payfast-test-config/entry.ts` — no auth + returns `merchant_id` and `merchant_key` (half the signing-secret pair). Status: NOT STARTED
- **LB-034** [CRITICAL] `base44/functions/payfast-sign/entry.ts` — no auth + generates valid PayFast-signed form payloads on demand. Status: NOT STARTED

## Schema mismatches breaking core workflows

- **LB-035** [CRITICAL] `src/pages/AdminServiceOrders.jsx:61-71` — Deal.create writes 3 invalid enum values (`stage="contract_pending"`, `source="self_service"`, `package=<product_code>`); admin add-on approvals create malformed Deal. Status: NOT STARTED
- **LB-036** [CRITICAL] `src/pages/ClientDeliverables.jsx:72,91,118,162-168` — writes Deliverable.approval_status + client_change_notes (phantom fields); every client deliverable approval click is silently dropped. Status: NOT STARTED
- **LB-037** [CRITICAL] `base44/functions/calculate-commission/entry.ts:367-397` — writes Commission.status='pending_payment'/'pending_milestone' (not in enum `pending|approved|paid|withheld|clawback`); entire payroll pipeline writes invalid statuses. Status: NOT STARTED
- **LB-038** [CRITICAL] `base44/functions/update-commission-attribution/entry.ts:62-68` — filters on invalid statuses; commission reassignment is currently a no-op. Status: NOT STARTED
- **LB-039** [CRITICAL] `base44/functions/update-milestone-tracker/entry.ts:103-109` — filters on Commission.type (phantom field; real field is commission_type); milestone payouts never fire. Status: NOT STARTED
- **LB-040** [CRITICAL] `base44/functions/mark-invoice-paid-eft/entry.ts:99-118` — Payment.type='eft' + gateway='eft_manual' (both invalid enum values) + idempotency filter on type='eft' (never written); double-clicking "Mark Paid" creates duplicate Payments. Status: NOT STARTED
- **LB-041** [CRITICAL] `src/pages/LogSale.jsx:162,182` — hardcoded `staff_role: "field_agent"` on commissions; owner/admin/cpc closers get wrong role attributed → payroll filters break. Status: NOT STARTED

## Frontend security

- **LB-042** [CRITICAL] `src/pages/ClientProfile.jsx:30-35` — `Client.update(id, formData)` writes entire formData blob; client can mass-assign `package`, `monthly_retainer`, `lifecycle_stage` via DevTools (self-promote). Status: NOT STARTED
- **LB-043** [CRITICAL] `src/pages/ClientOnboardingFormFull.jsx:48-55` — auto-save writes entire formData blob to ClientOnboardingSubmission.update; same mass-assign vector. Status: NOT STARTED
- **LB-044** [CRITICAL] `src/pages/ClientOnboardingFormPublic.jsx:89-92` — autoSave fires on every keystroke (no debounce) with full formData; mass-assign + data-burn on mobile. Status: NOT STARTED
- **LB-045** [CRITICAL] `src/pages/ContractView.jsx:40` — `Math.random().toString(36)` for signing tokens; ~32-bit entropy, brute-forceable. Status: NOT STARTED
- **LB-046** [CRITICAL] `src/pages/ContractSigningPublic.jsx:140-159` — two non-atomic writes (ContractSignature.create then Contract.update); network failure between them = ContractSignature row exists but Contract still unsigned. Status: NOT STARTED
- **LB-047** [CRITICAL] `src/pages/ContractSigningPublic.jsx:25,154-159` — signing token not invalidated after use; valid for replay until expiry. Status: NOT STARTED
- **LB-048** [CRITICAL] `src/pages/ContractSigningPublic.jsx:254-259` — PDF preview is literal placeholder div (`📄 PDF Preview / (Full contract embedded viewer would display here)`); clients sign agreement they cannot read. POPIA/ECTA legal risk. Status: NOT STARTED
- **LB-049** [CRITICAL] `src/pages/ContractSigningPublic.jsx:364-374` — signature canvas only handles mouse events; SA mobile users cannot draw signature. Status: NOT STARTED
- **LB-050** [CRITICAL] `src/pages/ContractSigningPublic.jsx:120-123,308-317` — SA ID number stored plaintext on ContractSignature.signer_id_number; no validation. POPIA sensitive data. Status: NOT STARTED

## Infrastructure / observability

- **LB-051** [CRITICAL] No Sentry or equivalent error reporting wired across `src/` or `base44/functions/`; production errors invisible until customers phone in. Status: NOT STARTED
- **LB-052** [CRITICAL] No CI workflow (`.github/workflows/` missing); `lint` and `typecheck` scripts never enforced. Status: NOT STARTED
- **LB-053** [CRITICAL] Zero tests (`*.test.*`, `*.spec.*`, `cypress/`, `playwright.config.*` all absent); PayFast signature verification, bcrypt round-trip, RLS enforcement untested. Status: NOT STARTED

## Routing / auth gates frontend

- **LB-054** [CRITICAL] `src/App.jsx` — ~25 admin/owner routes have no `RouteGuard` (lines 145-167 plus owner/admin routes 175-196); typed URL reaches admin pages from any authenticated role. Status: NOT STARTED
- **LB-055** [CRITICAL] `src/components/RouteGuard.jsx` — purely client-side; race window before `isLoadingAuth` resolves lets typed URLs bypass. Status: NOT STARTED

## Auth bridge (added during this session)

- **LB-281** [CRITICAL] Custom `mio_session_token` was not recognised by Base44 SDK as a valid bearer; entire user base (except Base44 platform owner) hit 401 on `User/me` and 500 on functions calling `auth.me()`. Status: ✅ DONE (2026-05-17) — resolved by Base44 directly via architectural pattern shift: bypass SDK auth, route entity reads through backend functions that validate `AppUser.session_token` server-side. Pattern reference: `getPlaybooks` / `updatePlaybook` functions. **Implications: LB-001 through LB-011 need re-scoping to use this pattern (see architectural note at top of file).**

---

# HIGH

## Backend — unauth endpoints (email / notification class)

- **LB-056** [HIGH] `base44/functions/notifyDeliverableSubmitted/entry.ts` — no auth; arbitrary `deliverable_id` triggers ClientNotification + email. Status: NOT STARTED
- **LB-057** [HIGH] `base44/functions/notifyDeliverableApproved/entry.ts` — no auth. Status: NOT STARTED
- **LB-058** [HIGH] `base44/functions/notifyDeliverableOverdue/entry.ts` — no auth. Status: NOT STARTED
- **LB-059** [HIGH] `base44/functions/notifyStaffOnUpload/entry.ts:8-25` — no auth; spams assigned field agent. Status: NOT STARTED
- **LB-060** [HIGH] `base44/functions/notifySignatureComplete/entry.ts` — no auth. Status: NOT STARTED
- **LB-061** [HIGH] `base44/functions/notifyAdminFormSubmitted/entry.ts` — no auth + hardcoded `app.base44.com` URL in body. Status: NOT STARTED
- **LB-062** [HIGH] `base44/functions/notify-staff/entry.ts` — no auth; broadcasts ClientNotification rows to all admins. Status: NOT STARTED
- **LB-063** [HIGH] `base44/functions/notify-client-deliverable-update/entry.ts` — no auth. Status: NOT STARTED
- **LB-064** [HIGH] `base44/functions/initiate-onboarding/entry.ts:1-40` — no auth; creates ClientOnboardingProgress + OnboardingStep rows at zero cost. Status: NOT STARTED
- **LB-065** [HIGH] `base44/functions/log-whatsapp-contact/entry.ts:1-25` — no auth + emails head@marketingio.co.za with unescaped client-supplied body. Status: NOT STARTED
- **LB-066** [HIGH] `base44/functions/send-owner-lead-notification/entry.ts:34` — no auth; spoof fake "new lead" alerts to head@. Status: NOT STARTED
- **LB-067** [HIGH] `base44/functions/send-payment-receipt-email/entry.ts:59-73` — no auth + no `payment.status === 'successful'` check; spam receipts for guessable payment_ids. Status: NOT STARTED
- **LB-068** [HIGH] `base44/functions/send-signup-welcome-email/entry.ts:27-33` — no auth. Status: NOT STARTED
- **LB-069** [HIGH] `base44/functions/send-welcome-email/entry.ts:26-32` — no auth. Status: NOT STARTED
- **LB-070** [HIGH] `base44/functions/send-invoice-issued-email/entry.ts:98-108` — token optional; arbitrary invoice_id triggers email to client. Status: NOT STARTED
- **LB-071** [HIGH] `base44/functions/send-followup-reminder/entry.ts:25` — no auth + swallows all errors with `success:true`. Status: NOT STARTED
- **LB-072** [HIGH] `base44/functions/send-onboarding-progress-email/entry.ts:25` — no auth. Status: NOT STARTED
- **LB-073** [HIGH] `base44/functions/send-onboarding-progress-email-batch/entry.ts:3` — no auth + fan-out per active onboarding (Resend quota DoS). Status: NOT STARTED
- **LB-074** [HIGH] `base44/functions/send-campaign-reports-batch/entry.ts:3-25` — no auth + fan-out to all 500 active clients. Status: NOT STARTED
- **LB-075** [HIGH] `base44/functions/send-campaign/entry.ts:3-23` — no auth + unbounded `User.list()`. Status: NOT STARTED
- **LB-076** [HIGH] `base44/functions/log-client-activity/entry.ts:60-91` — no auth; arbitrary writes against any client_id (audit log pollution). Status: NOT STARTED
- **LB-077** [HIGH] `base44/functions/log-client-activity-public/entry.ts:173-197` — unauth path defaults `actor_role:'client'` and writes any client_id. Status: NOT STARTED
- **LB-078** [HIGH] `base44/functions/abandoned-cart-trigger/entry.ts:77` — no auth; seed marketing drips against arbitrary emails. Status: NOT STARTED
- **LB-079** [HIGH] `base44/functions/abandoned-cart-runner/entry.ts:31` — no auth (comment acknowledges); fire 15-minute sweep at will (Resend + Gemini budget exhaustion). Status: NOT STARTED
- **LB-080** [HIGH] All cron-style unauth: `escalateUnsentReports`, `generateDraftReports`, `sweep-overdue-invoices`, `sweep-contract-renewals`, `sweep-client-churn`, `checkOnboardingFormReminders`, `checkOverdueDeliverables`, `sendOnboardingReminders`. Add shared cron-token gate. Status: NOT STARTED
- **LB-081** [HIGH] `base44/functions/generate-hero-image/entry.ts:189` — no auth + no AI budget cap. Status: NOT STARTED
- **LB-082** [HIGH] `base44/functions/generate-marketing-image/entry.ts:30,113` — budget check + spend update race; concurrent calls bypass cap. Status: NOT STARTED

## Hardcoded credentials / personal emails / secrets in source

- **LB-083** [HIGH] `base44/functions/migrate-owner-to-appuser/entry.ts:10` — `MarketingIO2026!` in git history (must rotate live password). Status: NOT STARTED
- **LB-084** [HIGH] `base44/functions/seedOwnerAccount/entry.ts:9-11` — `MarketingIO2026!` (rotate). Status: NOT STARTED
- **LB-085** [HIGH] `base44/functions/create-test-client/entry.ts:7-8` — `Thapelo15!` (rotate). Status: NOT STARTED
- **LB-086** [HIGH] `base44/functions/seed-test-staff-users/entry.ts:23` — `Test123456!` (rotate). Status: NOT STARTED
- **LB-087** [HIGH] `base44/functions/submit-enquiry/entry.ts:181` — `maupatrades@gmail.com` hardcoded as production owner notification recipient. Status: NOT STARTED
- **LB-088** [HIGH] `base44/functions/test-resend-send/entry.ts:46,55` — `maupatrades@gmail.com` hardcoded; public endpoint sends test email there. Status: NOT STARTED
- **LB-089** [HIGH] `src/pages/OwnerCampaigns.jsx:30` — `useState('maupatrades@gmail.com')` test email default. Status: NOT STARTED
- **LB-090** [HIGH] 5+ functions hardcode `HEAD_EMAIL = 'head@marketingio.co.za'` (send-owner-lead-notification, send-payment-receipt-email, request-account-deletion, cancel-invoice, send-invoice-chase). Move to SystemSettings. Status: NOT STARTED
- **LB-091** [HIGH] `src/pages/StaffHR.jsx:62` — `to: "admin@marketingio.co.za"` hardcoded for payroll notification. Status: NOT STARTED
- **LB-092** [HIGH] `src/lib/emailSender.js:133` — `to: 'thapelo@marketingio.co.za'` hardcoded for failed-render alerts. Status: NOT STARTED
- **LB-093** [HIGH] `src/pages/ClientInvoices.jsx:11-17` — hardcoded `BANK_DETAILS` object; banking detail change requires code push. Status: NOT STARTED
- **LB-094** [HIGH] `src/pages/Unsubscribe.jsx:230-232` — hardcoded `75 Marshall Street, Polokwane 0699` POPIA s69 footer. Status: NOT STARTED
- **LB-095** [HIGH] 4+ functions hardcode Cloudinary logo URL with public UUID. Status: NOT STARTED

## Schema mismatches — secondary workflows

- **LB-096** [HIGH] `base44/functions/payfast-invoice-init/entry.ts:185` — writes `Payment.type='monthly_subscription'` for all invoices regardless of `invoice_type`; mislabels setup payments. Status: NOT STARTED
- **LB-097** [HIGH] `base44/functions/create-invoice/entry.ts:116-143` — writes 10 phantom Invoice fields (closer_id, lead_source_user_id, type, total, currency, subtotal, line_items, contract_id, issued_at, paid_at); commission attribution downstream reads undefined. Status: NOT STARTED
- **LB-098** [HIGH] `base44/functions/generateDraftReports/entry.ts:49-50` — MonthlyReport.status='draft' (invalid; enum has 'drafted') + report_type=client.package (no overlap with valid enum). Status: NOT STARTED
- **LB-099** [HIGH] `base44/functions/send-onboarding-progress-email/entry.ts:103` — queries legacy User entity by email (empty post-AppUser migration). Status: NOT STARTED
- **LB-100** [HIGH] `src/pages/ClientPortal.jsx:218` — Invoice filter `status:"issued"/"pending_payment"` not in enum; outstanding-invoices widget always empty. Status: NOT STARTED
- **LB-101** [HIGH] `base44/functions/cancel-invoice/entry.ts:9` — `CANCELLABLE_STATUSES` includes invalid 'issued', 'pending_payment'; branches never trigger. Status: NOT STARTED
- **LB-102** [HIGH] `src/pages/Leads.jsx:121` — `l.created_by !== user?.email` (field doesn't exist on Lead; should be `submitted_by !== user.id`); field agents see zero leads. Status: NOT STARTED
- **LB-103** [HIGH] `src/pages/StaffMyDay.jsx:77` — filters on `s.status === "submitted"` but field is `submission_status`; admin pending-onboarding queue always empty. Status: NOT STARTED
- **LB-104** [HIGH] `src/pages/StaffMyDay.jsx:281` — renders `sub.business_name` / `sub.client_name`; neither exists on ClientOnboardingSubmission. Status: NOT STARTED
- **LB-105** [HIGH] `src/pages/StaffMyDay.jsx:88` — non-admin branch filters on `a.created_by` (doesn't exist; should be `actor_id` or `logged_by`); staff see empty Recent Activity. Status: NOT STARTED
- **LB-106** [HIGH] `src/pages/StaffHR.jsx:76` — `inviteUser(email, "user")`; `"user"` not in User.role enum. Status: NOT STARTED
- **LB-107** [HIGH] Multiple functions skip required ClientActivityLog fields (`event_summary`, `actor_role`, `event_category`): `notifySignatureComplete`, `sendWelcomePack`, `onDealLost`, `notifyStaffOnUpload`, `onDealClosedWon`, `createOnboardingSubmission`, `cancel-client`. Activity rows fail validation and are lost. Status: NOT STARTED
- **LB-108** [HIGH] `base44/functions/send-contract-for-signature/entry.ts:117-126` — writes ClientActivityLog `metadata`/`performed_by_id`/`performed_by_name` (wrong field names; should be `event_metadata`/`actor_id`/`logged_by_name`). Status: NOT STARTED
- **LB-109** [HIGH] `base44/functions/cancel-client/entry.ts:67-73` — `metadata` instead of `event_metadata` on ClientActivityLog. Status: NOT STARTED
- **LB-110** [HIGH] `base44/functions/sweep-overdue-invoices/entry.ts:73-80` — `event_category: "billing"` not in enum (valid: auth/profile/payment/invoice/document/communication/support/account/lead). Status: NOT STARTED
- **LB-111** [HIGH] `base44/functions/send-email-public/entry.ts:66,73` — SecurityEvent.event_type='email_send_failed' (not in enum); writes rejected. Status: NOT STARTED
- **LB-112** [HIGH] `base44/functions/unsubscribe/entry.ts:156-167` — SecurityEvent.event_type='email_unsubscribed' (not in enum). Status: NOT STARTED
- **LB-113** [HIGH] `base44/functions/payment-public-summary/entry.ts:110-117` — SecurityEvent.event_type='payment_summary_rate_limit' (not in enum). Status: NOT STARTED
- **LB-114** [HIGH] `base44/functions/auth-me/entry.ts:41` — returns `user.phone` but AppUser schema has `mobile_number`; always undefined. Status: NOT STARTED
- **LB-115** [HIGH] `src/pages/Receipts.jsx:13,22,52-58` — writes 4 invalid invoice_type values + 3 phantom Invoice fields (category, date, document_url). Status: NOT STARTED
- **LB-116** [HIGH] `src/pages/StaffVerifyLeads.jsx:196-198,319-334` — writes 3 phantom Lead fields (best_time_to_call_date, best_time_to_call_time, interested_products). Status: NOT STARTED
- **LB-117** [HIGH] `base44/functions/seed-product-images/entry.ts:85,90` — writes SystemSettings.product_images_json (field doesn't exist); seed silently no-ops. Status: NOT STARTED
- **LB-118** [HIGH] `base44/entities/Client.jsonc` missing fields code expects: `lifecycle_stage`, `assigned_consultant_id`, `app_user_id`, `lead_source_type`, `signup_completed_steps`, `lead_score`, `lead_score_calculated_at` — confirm by syncing from live schema. Status: NOT STARTED

## Multi-write flows without transactions

- **LB-119** [HIGH] `src/pages/LogSale.jsx:113-322` — 8 sequential writes (Client/Deal/Commission/Contract/Invoice/ClientOnboarding/Tasks/Deliverables) with no rollback or catch block. Wrap in server function. Status: NOT STARTED
- **LB-120** [HIGH] `src/pages/AdminServiceOrders.jsx:57-109` — 4 sequential writes (Deal/ServiceOrder/Task/ClientNotification) with no rollback. Status: NOT STARTED
- **LB-121** [HIGH] `src/pages/ClientOrderAddOns.jsx:54-88` — 3 sequential writes (ServiceOrder/Task/ClientNotification) with no rollback; silent failure on submit. Status: NOT STARTED

## AuthContext / session handling

- **LB-122** [HIGH] `src/lib/AuthContext.jsx` — no 401 interceptor; expired session leaves user on broken-data UI with no redirect to login. Status: NOT STARTED
- **LB-123** [HIGH] `src/lib/AuthContext.jsx` — no `storage` event listener; logout in tab A leaves tab B stale until refresh. Status: NOT STARTED
- **LB-124** [HIGH] `src/lib/customAuth.js` — `getCurrentUser()` calls invoke per consumer with no memoisation; redundant network. Status: NOT STARTED

## Money handling

- **LB-125** [HIGH] All ZAR fields stored as `number` (float) across Client/Deal/Invoice/Payment/Commission/Contract/ServiceOrder/StaffRecord schemas; IEEE-754 rounding eventually breaks debit reconciliation. Status: NOT STARTED
- **LB-126** [HIGH] `base44/functions/payfast-itn/entry.ts:410-428` — amount comparison uses floats with 0.005 tolerance; move to integer cents. Status: NOT STARTED
- **LB-127** [HIGH] `base44/functions/calculate-commission/entry.ts:118-120` — idempotency flag set AFTER Commission.create writes; concurrent invocations double-create. Status: NOT STARTED
- **LB-128** [HIGH] `base44/functions/create-invoice/entry.ts:100-112` — non-atomic invoice number generation; concurrent calls produce duplicate numbers. Status: NOT STARTED
- **LB-129** [HIGH] `base44/functions/handle-failed-debit-notification/entry.ts:38-44` — calls payfast-invoice-init without session_token → 401; pay link in customer email is `#`. Status: NOT STARTED

## Frontend security / UX (client-facing)

- **LB-130** [HIGH] `src/pages/ClientBillingUpdate.jsx:62-89` — allows email change without OTP re-verification; email is login key (self-lockout vector). Status: NOT STARTED
- **LB-131** [HIGH] `src/pages/ClientSettings.jsx:174-183` — mobile mirror writes empty string if both `mobileNumber` and `client.phone` empty; overwrites valid phone with `""`. Status: NOT STARTED
- **LB-132** [HIGH] `src/pages/Register.jsx:303-326` — step 1 success without OTP arrival leaves user stranded; no sessionStorage persistence of clientId/verificationEmail/step. Status: NOT STARTED
- **LB-133** [HIGH] `src/pages/Register.jsx:391-413` — POPIA consent write is fire-and-forget across two awaits with no rollback; consent can be lost while marketing emails enabled. Status: NOT STARTED
- **LB-134** [HIGH] `src/pages/PaymentSuccess.jsx:287,317,357-361` — auto-redirects guest to `/login?next=/client-portal` they have no credentials for; brand-damaging first impression. Status: NOT STARTED
- **LB-135** [HIGH] `src/pages/PaymentSuccess.jsx:75-82` — polling stops on any error (incl. transient); no recovery. Status: NOT STARTED
- **LB-136** [HIGH] `src/pages/ContractView.jsx:60` — "Send for Signature" TODO never actually sends email; admin toast says success while no email leaves. Status: NOT STARTED
- **LB-137** [HIGH] `src/pages/ContractSigningPublic.jsx:96-99` — typed signature not validated to match contact name; can sign "Mickey Mouse". Status: NOT STARTED
- **LB-138** [HIGH] `src/pages/ClientUploads.jsx:65-89` — no file-size validation; 50MB raw camera photos burn data + freeze UI. Status: NOT STARTED
- **LB-139** [HIGH] `src/pages/ClientUploads.jsx:223` — only HTML `accept` attribute, no `file.type` validation; can upload `.exe` as "logo". Status: NOT STARTED
- **LB-140** [HIGH] `src/pages/ClientUploads.jsx:69-86` — sequential awaits per file; 5 photos on 3G = 2 minutes UI freeze. Status: NOT STARTED
- **LB-141** [HIGH] `src/pages/ClientUploads.jsx:230-233` — no upload progress; just blanket spinner. Status: NOT STARTED
- **LB-142** [HIGH] `src/pages/ClientUploads.jsx:131-134` — Delete is two-tap with no confirmation; fat-finger destroys brand assets. Status: NOT STARTED
- **LB-143** [HIGH] `src/pages/ClientUploads.jsx:74` — `uploaded_by_id: client.id` should be `user.id`; audit attributes uploads to business not person. Status: NOT STARTED
- **LB-144** [HIGH] `src/pages/ClientMessages.jsx:152-170` — polling overwrites optimistic messages; user-sent messages can vanish. Status: NOT STARTED
- **LB-145** [HIGH] `src/pages/ClientMessages.jsx:152-170` — no `visibilityState` guard; data burns on backgrounded tab (SA pay-per-MB). Status: NOT STARTED
- **LB-146** [HIGH] `src/pages/ClientInvoices.jsx:140-146` — 30s polling no visibility guard. Status: NOT STARTED
- **LB-147** [HIGH] `src/pages/ClientInvoices.jsx:96,114` — native `alert()` for errors. Status: NOT STARTED
- **LB-148** [HIGH] `src/pages/ClientSubscription.jsx:187,309-321` — 5 dead buttons with no onClick. Status: NOT STARTED
- **LB-149** [HIGH] `src/pages/ClientSubscription.jsx:197` — uses `alert()` for upgrade-requested message. Status: NOT STARTED
- **LB-150** [HIGH] `src/pages/Checkout.jsx:332-334` + `src/pages/PortalCheckout.jsx:293-295` — Service Agreement / Terms / Refund Policy links are `href="#"`. Status: NOT STARTED
- **LB-151** [HIGH] `src/pages/ClientDeliverables.jsx:28-48` — subscribe-then-load race; closure captures stale `client` reference. Status: NOT STARTED
- **LB-152** [HIGH] `src/pages/ClientDeliverables.jsx:204-205` — grouped render uses unfiltered `deliverables` instead of `filtered`; filter UI shows wrong results. Status: NOT STARTED
- **LB-153** [HIGH] `src/App.jsx:175,178` + `:176,179` — duplicate route registrations for `/owner/financials` and `/owner/reports`. Status: NOT STARTED
- **LB-154** [HIGH] `index.html` — `<title>Base44 APP</title>` ships to production users. Status: NOT STARTED
- **LB-155** [HIGH] `index.html` — favicon points to `https://base44.com/logo_v2.svg` (third-party + wrong brand). Status: NOT STARTED
- **LB-156** [HIGH] `index.html` — references `/manifest.json` but no file exists in `public/`; 404 every page load. Status: NOT STARTED
- **LB-157** [HIGH] No `public/robots.txt`; search engines will index `/sign-contract?token=...` and other sensitive paths. Status: NOT STARTED

## Infrastructure / deps

- **LB-158** [HIGH] `package.json` — 12 unused heavy deps shipped to prod: `three`, `react-leaflet`, `leaflet`, `react-quill`, `moment`, `lodash`, `html2canvas`, `lottie-react`, `canvas-confetti`, `@stripe/react-stripe-js`, `@stripe/stripe-js`, `@hello-pangea/dnd`. Status: NOT STARTED
- **LB-159** [HIGH] `package.json` — `react-quill@2.0.0` transitively ships `quill@1.3.7` (historical XSS CVEs). Status: NOT STARTED
- **LB-160** [HIGH] `package.json` — `bcryptjs@^2.4.3` is pure-JS, 5+ years stale, cost factor 10 (too low for 2026). Bump to `^3` or migrate to `@noble/hashes/argon2`; raise cost to 12 for new hashes. Status: NOT STARTED
- **LB-161** [HIGH] Base44 SDK version drift: frontend `@base44/sdk@^0.8.27` vs all 100+ functions pinned at `npm:@base44/sdk@0.8.25`. Status: NOT STARTED
- **LB-162** [HIGH] `vite.config.js` — no `manualChunks` configuration; 2.66MB monolithic JS bundle hurts SA-mobile users. Status: NOT STARTED
- **LB-163** [HIGH] `jsconfig.json` — excludes `src/lib`, `src/api`, `src/components/ui` from typecheck. Status: NOT STARTED
- **LB-164** [HIGH] `eslint.config.js` — covers only `src/components`, `src/pages`, `src/Layout.jsx`; misses src/lib, src/api, src/utils, src/hooks. Status: NOT STARTED
- **LB-165** [HIGH] 30+ direct `fetch('https://api.resend.com/emails')` calls in functions have no `AbortController` timeout (only `payfast-itn` has 10s timeout). Resend outage hangs functions to full timeout. Status: NOT STARTED
- **LB-166** [HIGH] No Resend retry / 429 handling in Deno functions (only `src/lib/emailSender.js` retries; functions don't). Campaign burst will silently drop. Status: NOT STARTED
- **LB-167** [HIGH] No Resend webhook for bounces/complaints; no `unsubscribed` flag check before send. Status: NOT STARTED
- **LB-168** [HIGH] `src/lib/imageGenerator.js` — `callDalleAPI` runs `globalThis.Deno.env.get('OPENAI_API_KEY')` in browser code; if key ever leaks into `VITE_*` it ships to browser bundle. Status: NOT STARTED

---

# MED

## Schema / data integrity

- **LB-169** [MED] `base44/entities/MonthlyReport.report_month` — `"YYYY-MM"` string with no format validator; typo-prone in queries. Status: NOT STARTED
- **LB-170** [MED] `base44/entities/Commission.payroll_month` — same `"YYYY-MM"` no validator. Status: NOT STARTED
- **LB-171** [MED] `base44/entities/Payment.ipn_payload` — `type: object` with no shape; consumers reinvent. Status: NOT STARTED
- **LB-172** [MED] `base44/entities/ClientActivityLog.event_metadata` — `type: object` with no shape doc. Status: NOT STARTED
- **LB-173** [MED] `base44/entities/Invoice.jsonc` — `payment_date` vs `paid_at` inconsistency between schema and `mark-invoice-paid-eft`; launch-readiness-check asserts `paid_at`. Status: NOT STARTED
- **LB-174** [MED] `base44/entities/AppUser.pending_otp_purpose` enum diverges from `OTPCode.purpose` enum (latter adds `sensitive_action`). Status: NOT STARTED
- **LB-175** [MED] `base44/entities/Deal.add_on_name` exists; AdminServiceOrders should write here instead of `Deal.package` for addons. Status: NOT STARTED
- **LB-176** [MED] Orphan entity `FNCReferral.jsonc` — defined, no `.create/.update/.filter` callers; either implement or delete. Status: NOT STARTED
- **LB-177** [MED] Orphan entity `StaffMilestone.jsonc` — defined but milestone tracking actually uses `MilestoneTracker`. Status: NOT STARTED
- **LB-178** [MED] Referenced entity `AddOnCatalogItem` has no `.jsonc`; `StaffAddOnCatalog.jsx:129,139` queries will fail at runtime. Status: NOT STARTED
- **LB-179** [MED] Four overlapping onboarding entities (ClientOnboarding, ClientOnboardingProgress, ClientOnboardingSubmission, OnboardingStep) — pick authoritative; document the rest. Status: NOT STARTED
- **LB-180** [MED] Legacy `User` + canonical `AppUser` coexistence — auth functions create both; reads fall through. Pick one and migrate. Status: NOT STARTED
- **LB-181** [MED] `base44/entities/Lead.warm_lead_criteria` and `warm_lead_criteria_v2` are parallel fields; migration plan undocumented. Status: NOT STARTED
- **LB-182** [MED] Most entities have undocumented fields (no `description`); Base44's AI assistant relies on these. Pass through each entity adding 1-line descriptions. Status: NOT STARTED

## Backend correctness / performance

- **LB-183** [MED] `base44/functions/send-thread-message/entry.ts:178-195` — N+1 user lookup; should batch. Status: NOT STARTED
- **LB-184** [MED] `base44/functions/checkOverdueDeliverables/entry.ts:8-27` — `Deliverable.filter({})` unbounded then in-memory filter + N+1 lookups. Status: NOT STARTED
- **LB-185** [MED] `base44/functions/generate-monthly-retainer-invoices/entry.ts:127-130` — sequential per-client; will timeout at >1000 clients. Status: NOT STARTED
- **LB-186** [MED] `base44/functions/run-scheduled-campaigns/entry.ts:25` — unbounded `User.list()` + O(campaigns × users) sequential SDK calls. Status: NOT STARTED
- **LB-187** [MED] `base44/functions/check-failed-debits-follow-up/entry.ts:13-37` — `Invoice.list(1000)` + N+1 Task/Client filters. Status: NOT STARTED
- **LB-188** [MED] `base44/functions/auth-login/entry.ts:79-81` — error response distinguishes locked-account from generic auth failure (account enumeration). Status: NOT STARTED
- **LB-189** [MED] `base44/functions/auth-login/entry.ts:84-92` — pending-verification login regenerates OTP and resends on every attempt; email spam vector. Status: NOT STARTED
- **LB-190** [MED] `base44/functions/auth-verify-otp/entry.ts:34-47` — no constant-time compare on OTP (lockout mitigates but flag). Status: NOT STARTED
- **LB-191** [MED] `base44/functions/reset-password/entry.ts:42-83` — fallback through AppUser then legacy User; mixed-entity update path. Status: NOT STARTED
- **LB-192** [MED] `base44/functions/auth-register/entry.ts:148-152` — error response leaks create payload (`{email, full_name, role}`). Status: NOT STARTED
- **LB-193** [MED] `base44/functions/payfast-checkout-init/entry.ts:267-280` — anonymous flow creates Client rows; no CAPTCHA / rate limit (table flooding). Status: NOT STARTED
- **LB-194** [MED] `base44/functions/payfast-send-receipt/entry.ts` — no idempotency guard on the function itself; concurrent calls both pass status check. Status: NOT STARTED
- **LB-195** [MED] `base44/functions/checkOnboardingFormReminders/entry.ts:32` — placeholder URL `https://your-app.com/...` in email body. Status: NOT STARTED
- **LB-196** [MED] `base44/functions/sendOnboardingReminders/entry.ts:63` — wrong host `app.base44.com` in email body. Status: NOT STARTED
- **LB-197** [MED] `base44/functions/notifyAdminFormSubmitted/entry.ts:54-58` — wrong host `app.base44.com` in CTA URL. Status: NOT STARTED
- **LB-198** [MED] `base44/functions/notifyDeliverableApproved`, `notifyDeliverableOverdue` — use `notification_type: 'deliverable_ready'` for both Approved and Overdue (semantic mismatch). Status: NOT STARTED

## Frontend correctness / performance / UX

- **LB-199** [MED] `src/pages/OwnerClientDetail.jsx:177-184` — `Client.list()` unbounded for `/clients/:id` detail; ships full client table to browser. Use `.get(id)` or `.filter({id})`. Status: NOT STARTED
- **LB-200** [MED] `src/pages/OwnerClientDetail.jsx:278` — reads `client.lead_score` (field on Lead, not Client); badge never renders. Status: NOT STARTED
- **LB-201** [MED] `src/pages/OwnerClientDetail.jsx:284` — renders raw `client.assigned_field_agent` id instead of resolved name. Status: NOT STARTED
- **LB-202** [MED] `src/pages/OwnerClientDetail.jsx:388-390` — Save Notes is fire-and-forget without await/toast/error handling. Status: NOT STARTED
- **LB-203** [MED] `src/pages/AdminInvoices.jsx:251-276` — bulk chase fires N concurrent invokes; no per-row results; modal dismisses regardless. Status: NOT STARTED
- **LB-204** [MED] `src/pages/AdminInvoices.jsx:413-444` — Overdue/Renewal sweeps don't disable each other; admin can fire all three in parallel. Status: NOT STARTED
- **LB-205** [MED] `src/pages/AdminInvoices.jsx:127-130` — Create-Invoice dropdown doesn't filter cancelled/churned clients. Status: NOT STARTED
- **LB-206** [MED] `src/pages/AdminInvoices.jsx:351-375` — no concurrency check; two admins race-cancelling same invoice. Status: NOT STARTED
- **LB-207** [MED] `src/pages/AdminServiceOrders.jsx:33-37` — `Client.list()` + `User.list()` unbounded. Status: NOT STARTED
- **LB-208** [MED] `src/pages/AdminServiceOrders.jsx:96-99` — rejection notification includes admin's reason verbatim to client. Status: NOT STARTED
- **LB-209** [MED] `src/pages/AdminServiceOrders.jsx:103,129` — local state patched with stub; discards server-returned full row. Status: NOT STARTED
- **LB-210** [MED] `src/pages/AdminServiceOrders.jsx:53` — `setLoading(false)` not in finally; loading stays true on fetch error. Status: NOT STARTED
- **LB-211** [MED] `src/components/tasks/TaskModal.jsx:75-109` — `save` swallows log-client-activity errors; audit trail loss silent. Status: NOT STARTED
- **LB-212** [MED] `src/components/tasks/TaskModal.jsx:130-142` — markComplete bypasses log-client-activity hook. Status: NOT STARTED
- **LB-213** [MED] `src/components/tasks/TaskModal.jsx:84-92` — writes `event_type: "task_completed"` even when status becomes "cancelled". Status: NOT STARTED
- **LB-214** [MED] `src/components/activity/ActivityFeed.jsx:281-307` — `generate-activity-pdf` passes session token in payload (logs leak risk); use header. Status: NOT STARTED
- **LB-215** [MED] `src/pages/LeadScoring.jsx:39-87` — loads 500 leads + all clients + 1000 activity logs + all users + N parallel Lead.update; client-side scoring. Status: NOT STARTED
- **LB-216** [MED] `src/pages/CancelledContracts.jsx:30-35` — in-memory filter for field_agent/cpc on cancellation list; cross-tenant data already in browser. Status: NOT STARTED
- **LB-217** [MED] `src/pages/OwnerInbox.jsx:152-173` — `openThread` passes `current_user_role: 'owner'` regardless of caller role. Status: NOT STARTED
- **LB-218** [MED] `src/pages/OwnerInbox.jsx:192` — empty catch swallows polling failures. Status: NOT STARTED
- **LB-219** [MED] `src/pages/DebitOrderTracking.jsx:141-162` — recordFail appends to `client.notes` unbounded; concurrent admins clobber. Status: NOT STARTED
- **LB-220** [MED] `src/pages/DebitOrderTracking.jsx:164-168` — clearFail resets without reason/audit. Status: NOT STARTED
- **LB-221** [MED] `src/pages/DebitOrderTracking.jsx:170-178` — createMandate flips boolean without Contract/DebitMandate audit trail. Status: NOT STARTED
- **LB-222** [MED] `src/pages/LogSale.jsx:128-138` — new-client creation doesn't log `client_created` ClientActivityLog event. Status: NOT STARTED
- **LB-223** [MED] `src/pages/LogSale.jsx:267-279` — `assigned_admin_id` falls back to closerId if no admin in users map; onboarding queue gets unwrong assignee. Status: NOT STARTED
- **LB-224** [MED] `src/components/kpi/TeamKPIsWidget.jsx:23,60` — allows `'founder'` role (not in enum); calculates 150 sequential KPI values per dashboard load. Status: NOT STARTED
- **LB-225** [MED] `src/pages/ClientMessages.jsx:36` — `totalParticipants` defaults to 3 if no thread; 2-person threads never show read receipts. Status: NOT STARTED
- **LB-226** [MED] `src/pages/ClientOrderAddOns.jsx:98` — `!active.some(a => a.add_on === t.code)` allows duplicate orders during stale cache window. Status: NOT STARTED
- **LB-227** [MED] `src/pages/ClientOrderAddOns.jsx:187,190` — `JSON.parse(t.setup_deliverables)` no try/catch. Status: NOT STARTED
- **LB-228** [MED] `src/pages/Checkout.jsx:21` vs `Register.jsx:127` — SA mobile regex differs (strict vs lax); user passes signup but fails checkout. Status: NOT STARTED
- **LB-229** [MED] `src/pages/ClientOnboardingFormPublic.jsx:111-119` — overwrites `Client.business_name` with onboarding `business_legal_name`. Status: NOT STARTED
- **LB-230** [MED] `src/pages/ClientOnboardingFormFull.jsx:68-96` — no required-field validation per step. Status: NOT STARTED
- **LB-231** [MED] `src/pages/ClientOnboardingFormFull.jsx:62-66` — accepts FileList but only stores `files[0]`; "up to 20" copy is a lie. Status: NOT STARTED
- **LB-232** [MED] Two onboarding form implementations (Full + Public) with different step counts; will drift. Status: NOT STARTED
- **LB-233** [MED] `src/pages/Register.jsx:236,300` + `src/pages/SignIn.jsx:30,98` — CAPTCHA never refreshes after failed attempt. Status: NOT STARTED
- **LB-234** [MED] `src/pages/Register.jsx:282-283` — empty-array form field treated as skip; can't clear checkboxes once set. Status: NOT STARTED
- **LB-235** [MED] `src/pages/Checkout.jsx:149-188` + `src/pages/PaymentCancelled.jsx:58-60` — `payfast-mark-cancelled` can race with successful ITN. Status: NOT STARTED
- **LB-236** [MED] `src/pages/Checkout.jsx:233-235` + `src/pages/PortalCheckout.jsx:236-238` — 1.1s auto-submit to PayFast with no Cancel button. Status: NOT STARTED
- **LB-237** [MED] `src/pages/PaymentSuccess.jsx:419,406-411` — countdown copy says "click anywhere to stay" but CTA tap navigates. Status: NOT STARTED
- **LB-238** [MED] `src/pages/ContractSigningPublic.jsx:171-177` — loading state is blank spinner; no logo or context on 3G. Status: NOT STARTED
- **LB-239** [MED] `src/pages/ContractSigningPublic.jsx:69` — `Error loading contract: ${err.message}` leaks raw error messages to client. Status: NOT STARTED
- **LB-240** [MED] `src/pages/ContractView.jsx` — typo in 32-char token slicing (substring 2-34 of base36 string is shorter than expected). Status: NOT STARTED

## Infrastructure

- **LB-241** [MED] No `Dockerfile` / `vercel.json` / `netlify.toml` / hosting config; deploy posture lives entirely in Base44 dashboard. Document the runbook. Status: NOT STARTED
- **LB-242** [MED] `base44/config.jsonc` — `serveCommand: npm run dev` (HMR dev server). Should be `npm run preview` for prod preview. Status: NOT STARTED
- **LB-243** [MED] `vite.config.js` — `logLevel: 'error'` suppresses build warnings. Status: NOT STARTED
- **LB-244** [MED] `jsconfig.json` — `checkJs:true` but no `strict`/`noImplicitAny`/`noUnusedLocals`. Status: NOT STARTED
- **LB-245** [MED] No `target` / browserslist for SA market; older Android WebViews on entry-level phones might fail. Status: NOT STARTED
- **LB-246** [MED] `README.md` is 39-line Base44 stock template; new dev cannot onboard. Status: NOT STARTED
- **LB-247** [MED] No `AGENTS.md` / `CLAUDE.md` at root despite this being a Claude-Code-on-the-web project. Status: NOT STARTED
- **LB-248** [MED] Three coexisting backend auth patterns (`base44.auth.me()` / session-token / no-auth) cause confusion; pick one. Status: NOT STARTED
- **LB-249** [MED] Most `base44.auth.me()` paths likely return null in production (no UI logs into Base44 auth); functions silently 403 for legitimate owners. Status: NOT STARTED
- **LB-250** [MED] No CSP / X-Frame-Options / HSTS headers; add via `index.html` meta or hosting config. Status: NOT STARTED

---

# LOW

- **LB-251** [LOW] `index.html` — no `<meta description>`, no Open Graph, no Twitter Card; WhatsApp link previews blank. Status: NOT STARTED
- **LB-252** [LOW] `package.json` — `caret`-pinned security libs (bcryptjs, @base44/sdk, zod); use `npm ci` with locked versions. Status: NOT STARTED
- **LB-253** [LOW] `package.json` — `jspdf@^4.0.0` ships html2canvas + DOMPurify (224KB) into main bundle; lazy-load. Status: NOT STARTED
- **LB-254** [LOW] `package.json` — `react-day-picker@8.10.1` is v8; v9 has React 18.3 fixes. Status: NOT STARTED
- **LB-255** [LOW] `package.json` — 676 installed packages from 84 declared; supply-chain surface. Status: NOT STARTED
- **LB-256** [LOW] Email functions duplicate ~25 lines of `wrapEmail` boilerplate per file; tech debt. Status: NOT STARTED
- **LB-257** [LOW] `seedOwnerAccount/entry.ts:9-10` comment says "maupatrades@gmail.com" but creates `business.lekgoro@gmail.com` (comment drift). Status: NOT STARTED
- **LB-258** [LOW] `seedKPITargets/entry.ts:8` — accepts `'founder'` role (not in enum). Status: NOT STARTED
- **LB-259** [LOW] `src/AUTH_SYSTEM_FIX.md`, `src/BUG_FIXES_SUMMARY.md`, `src/CLIENT_PORTAL_REFACTOR.md`, `src/TEST_REPORT.md` — historical notes inside `src/`; move to `docs/history/`. Status: NOT STARTED
- **LB-260** [LOW] `src/lib/utils.js:9` — top-level `window` access prevents SSR. Status: NOT STARTED
- **LB-261** [LOW] `src/lib/query-client.js` — `retry: 1` global; flaky 4G gets 50% failure rate. Status: NOT STARTED
- **LB-262** [LOW] `src/pages/AdminInvoices.jsx:108` — `eftDate` defaults to UTC date; SA evening users see yesterday. Status: NOT STARTED
- **LB-263** [LOW] `src/pages/AdminInvoices.jsx:558,607,712` — `inv.total_amount || inv.total || inv.amount` includes dead fallback to `inv.total`. Status: NOT STARTED
- **LB-264** [LOW] `src/pages/CancelledContracts.jsx` — named for Contracts but queries Invoice; rename. Status: NOT STARTED
- **LB-265** [LOW] `src/pages/Tasks.jsx:80` — uses `window.location.href = '/login'` (hard reload mid-render); use Navigate. Status: NOT STARTED
- **LB-266** [LOW] `src/pages/Tasks.jsx:111` — missing optional chaining on `assigned_to_name`. Status: NOT STARTED
- **LB-267** [LOW] `src/pages/Commissions.jsx:95-115` — amounts displayed without ZAR formatter. Status: NOT STARTED
- **LB-268** [LOW] `src/pages/ClientBillingUpdate.jsx:70-77` — email saved without `.toLowerCase().trim()`. Status: NOT STARTED
- **LB-269** [LOW] `src/pages/ActivityLog.jsx:62-75` — "last 7 days" uses local midnight; off by hours for non-SAST viewers. Status: NOT STARTED
- **LB-270** [LOW] `src/pages/SignIn.jsx:218-236` — mascot animation 3.4s delay before form fully interactive. Status: NOT STARTED
- **LB-271** [LOW] `src/pages/SignIn.jsx:42-48` — typewriter setInterval 115ms layout-thrash on low-end Android. Status: NOT STARTED
- **LB-272** [LOW] `src/pages/SignIn.jsx:121` — `mio_pending_login` localStorage never cleared on OTP success. Status: NOT STARTED
- **LB-273** [LOW] `src/pages/SignIn.jsx:14` — `next` whitelist excludes `/client-portal`; deep-link redirects silently dropped. Status: NOT STARTED
- **LB-274** [LOW] `src/pages/ForgotPassword.jsx:81-82` — hardcoded "1 hour" TTL copy. Status: NOT STARTED
- **LB-275** [LOW] `src/pages/ResetPassword.jsx:55` — 3s auto-redirect to /login with no abort. Status: NOT STARTED
- **LB-276** [LOW] `src/pages/Unsubscribe.jsx:149-156` — Saved state has no path back. Status: NOT STARTED
- **LB-277** [LOW] CAPTCHA accessibility — no audio fallback, hostile to screen readers. Status: NOT STARTED
- **LB-278** [LOW] No prettier/dprint formatter config; diff noise. Status: NOT STARTED
- **LB-279** [LOW] `.gitignore` lists `.env` twice (lines 2 and 30); harmless duplicate. Status: NOT STARTED
- **LB-280** [LOW] Many email functions inline a dead `LOGO_URL` constant that's overridden by different Cloudinary URLs in the actual `<img>`. Status: NOT STARTED

---

# Footer

**Last updated:** 2026-05-17

**Counts:**
- CRITICAL: 55
- HIGH: 113
- MED: 82
- LOW: 30
- Total: 280

**Process:**
1. Pick highest-severity NOT STARTED item.
2. Open one PR fixing only that item.
3. PR description format: `Fixes LB-NNN: [problem]. Changes: [files]. To test: [steps].`
4. Push, then stop and wait for tester WORKING / NOT WORKING confirmation.
5. On WORKING: update status to `✅ DONE (YYYY-MM-DD)` and pick next item.
6. On NOT WORKING: fix what was reported, push, wait again.
7. Any new issues spotted during work get appended here as new LB-NNN items, not fixed inline.
