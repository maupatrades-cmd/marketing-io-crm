# Marketing iO CRM — Enterprise Rebuild Blueprint ($300K Tier)

> Companion to `CRM_Complete_Blueprint_v1.md`. Where v1 audits what exists,
> this document specifies how a procurement-grade rebuild would be sourced,
> staffed, and shipped — with named vendors, named APIs, named cost tiers,
> and explicit decisions about every layer of a modern agency operating
> system.
>
> No code in here. Reading the existing 50 entities, 133 functions, 100 pages,
> the 22-page MSA V3.0, the synthwave email branding, the Lottie mascot, the
> 6-phase onboarding, the milestone-gated commission scheme, the PayFast
> integration, and the SA-specific package catalogue (Township Pulse / Street
> Pulse) — this is the system the code is reaching toward. The rebuild
> realises it.

---

## 0. What your code says you actually want

Before naming vendors, the intent extracted from your artifacts. This isn't a guess — every claim points to a real file you wrote.

| Signal in the code | What it tells me you want |
|---|---|
| `FulfilmentTemplate` entity + `auto-create-deliverables-from-template` function | Productised service delivery — every package has a defined fulfilment chain |
| 22-page MSA V3.0 + `directorSignature.ts` + witness blocks | Legal robustness as part of the brand experience |
| Synthwave email header/footer + Cloudinary CDN | Brand-first communication, not utilitarian |
| `MascotPlayer.jsx` + Lottie animation | A character is part of the product, not an afterthought |
| `ClientActivityLog` with 30+ event types | Enterprise-grade auditability is the goal |
| Commission engine with milestone gating + clawbacks + CPC bonuses | Sophisticated sales-org compensation |
| `PayFast` + `AbandonedCartSequence` + `CheckoutEngagement` | Self-service checkout matters — not just rep-led sales |
| Six AppUser roles (owner/admin/cpc/field_agent/head_of_tech + driver) | A scaled team with division of labour |
| `KPITarget` + `StaffMilestone` + `StaffRecord` (banking) | Full HR/payroll ambition, not just CRM |
| Township Pulse + Street Pulse R130–R444 packages | SA mass-market play, not boutique-only |
| `MonthlyReport` entity | Monthly value packaging is part of retention |
| `generate-hero-image` + Three.js installed + AI image function naming | AI-augmented features are on the roadmap |
| `Leaflet` + `FAVisitLog` with GPS | Field operations matter — not just a desk CRM |
| 22 client portal routes | Clients should self-serve, not pester staff |
| POPIA 14-day grace + tombstone retention | SA compliance is non-negotiable |

**The implicit product brief:** *A South African marketing agency operating system that productises service delivery, tracks every interaction, automates sales attribution and payroll, runs end-to-end from inbound lead to fulfilment to monthly retainer to renewal — with the agency's distinct personality (mascot, synthwave, MSA) making every touchpoint unmistakably yours, AI-augmented where it adds real value, and SA-native in every payment, communication, and compliance choice.*

That's the system the rebuild specifies.

---

## 1. The vendor stack — every layer, every alternative

### 1.1 Foundation

| Layer | Pick | Alternatives considered | Why this pick |
|---|---|---|---|
| Frontend hosting | **Vercel** (Pro $20/user/mo) | Netlify, Cloudflare Pages, AWS Amplify | Next.js home base, preview deploys, edge runtime, Vercel Analytics |
| Backend / DB | **Supabase** (Pro $25/mo + usage) | Neon + Hasura, Firebase, PlanetScale | Real Postgres + RLS policies as SQL + Auth + Storage + Realtime + Edge Functions in one. Replaces 60% of what Base44 gives you |
| Source control | **GitHub** (Team $4/user/mo, Enterprise if needed) | GitLab | Existing repo, MCP integration, marketplace |
| CI/CD | **GitHub Actions** + **Vercel** preview deploys | CircleCI, Buildkite | Free for your scale, ecosystem |
| IaC | **Terraform Cloud** ($20/user/mo) | Pulumi, AWS CDK | Vendor-neutral, mature, easy to onboard contractors |
| Secrets | **Doppler** ($7/user/mo) | HashiCorp Vault, AWS Secrets Manager, 1Password CLI | Simplest dev experience, audit log included |
| CDN / WAF / DDoS | **Cloudflare** (Pro $20/site/mo) | AWS CloudFront + WAF | Bot mitigation, image optimization, R2 storage if needed |

**Why Supabase over staying on Base44:** Base44 is closed, dashboard-driven, hides RLS behind a UI, has SDK version drift in your functions, and silent-catches your email failures into success responses. Supabase gives you SQL migrations in version control, RLS as auditable policy SQL, generated TypeScript types, and Deno edge functions that CAN import shared libraries — which kills your wrapEmail copy-paste problem.

### 1.2 Identity & Access

| Concern | Pick | Cost | Notes |
|---|---|---|---|
| Auth core | **Supabase Auth** (included) | $0 | Email/password, OTP, OAuth, magic link, MFA |
| 2FA | TOTP (Authy/Google Authenticator) | $0 | Plus email OTP fallback for SA users who hate apps |
| SSO (later) | **WorkOS** | $125/connection/mo | Only when enterprise SA clients (banks, telcos, gov) demand SAML |
| User management UI | Build native | — | Owner dashboard at `/owner/users` already exists — port the UX |
| Audit log | Postgres triggers → `audit_log` table | $0 | Every INSERT/UPDATE/DELETE on whitelisted tables |
| Session management | Supabase Auth + Refresh tokens | $0 | Kills your custom `mio_session_token` (which is what causes LB-281) |

**Roles in the rebuild:** `owner`, `admin`, `head_of_tech`, `field_agent`, `cpc`, `client`. Drop `driver` (dead role today), drop `staff` (legacy bucket), drop `founder` as a role (becomes a metadata tag on commissions for board-level attribution).

### 1.3 Data layer

| Concern | Pick | Cost | Notes |
|---|---|---|---|
| Database | **Postgres 15** on Supabase | included | ACID, RLS, triggers, JSONB for flexibility |
| Migrations | **Supabase CLI** (`supabase migration new`) | $0 | Versioned files in `supabase/migrations/` |
| Type generation | `supabase gen types typescript` | $0 | End-to-end type safety, no manual DTOs |
| Backups | Supabase PITR (Pro tier) | $100/mo for 28-day window | Point-in-time recovery — non-negotiable for financial data |
| Search | Postgres `tsvector` | $0 | Algolia/Meilisearch only when you outgrow it |
| Vector storage (for RAG) | `pgvector` on Supabase | $0 | Pinecone/Weaviate are overkill at your scale |
| Cache | Upstash Redis | pay-per-request | For session state, rate limits |
| Data warehouse | Same Postgres + **dbt Core** | $0 | Snowflake/BigQuery aren't justified at agency scale; dbt transforms inside Postgres |

### 1.4 Backend orchestration — the durable workflow layer

**This is the biggest architectural upgrade.** You have 14 cron-style sweep functions today with NO scheduler — they're triggered manually from Base44's dashboard. Replace all of them.

| Pick | Cost | Replaces |
|---|---|---|
| **Inngest** (Free tier 50k steps/mo, then $20/mo) | $0–$300/mo | All sweepers + payfast-itn retries + email send queues + onboarding phase progression + abandoned cart sequences + commission unlock checks |

Why Inngest specifically:
- Durable execution (function dies mid-flight → resumes from last step)
- Step-by-step retries with exponential backoff
- Cron schedules in code (`@cron('0 3 * * *')`) — versioned, not in a dashboard
- Wait-for-event primitives: "wait 14 days for `account_deletion_cancelled` event then process"
- Replay UI for debugging — you can re-run any failed step
- Built-in observability — see every workflow run

Alternatives: Trigger.dev (similar), Hatchet (self-host), Temporal (heavyweight). Inngest is the right size.

### 1.5 Frontend

| Concern | Pick | Alternative | Notes |
|---|---|---|---|
| Framework | **Next.js 14 App Router** | Remix | Server Components reduce JS bundle for owner dashboards |
| UI primitives | **shadcn/ui** (keep) | Mantine, Chakra | You're already invested |
| Tables / data grids | **TanStack Table v8** | AG Grid (when enterprise) | /commissions, /invoices, /payroll need real grids |
| Charts | **Tremor** + **Recharts** for niche cases | Chart.js | Tremor is the right level for owner dashboards |
| 3D / animation | **Three.js** + **react-three-fiber** | Babylon.js | You installed three.js — actually use it for the owner revenue dashboard |
| Animations | **Framer Motion** (keep) | Motion One | Already adopted |
| Forms | **react-hook-form** + **Zod** (keep) | — | Working stack |
| Mascot | **Rive** | Lottie (current) | Rive is interactive — mascot reacts to mouse, mood states, idle cycles. Lighter bundle |
| Toasts | **sonner** only | — | Kill react-hot-toast + Radix toast |
| Date | **date-fns** only | — | Kill moment |
| PDF | **react-pdf** | jsPDF (current) | Template-friendly, better composition for the 22-page MSA |
| Component docs | **Storybook 8** | Ladle | Onboard new contractors fast |
| Design tokens | **Style Dictionary** | — | Figma → tokens.json → tailwind.config.js |

### 1.6 Payments — SA-native first

| Use case | Pick | Cost | Notes |
|---|---|---|---|
| ZAR card + debit order | **PayFast** (keep) | 3.5% + R2/transaction | Already integrated; SA-native |
| Instant EFT (SA) | **Ozow** | 1.95% per transaction | Lower fees than debit, instant clearance — kills 50% of failed-debit issues |
| Open banking / statement read | **Stitch** | tier-based, ~R500/mo + per-call | Read client bank statements to detect debits BEFORE the bounce. End the failed-debit hellscape |
| In-person card (field agents) | **Yoco** | 2.7% per transaction | When field agents need to swipe at client sites |
| International card | **Stripe** | 2.9% + 30c | The SDK is already in your package.json — finish the integration when you have non-ZAR clients |
| Subscription billing | Native on Postgres | $0 | You have Invoice + Payment entities — don't outsource your billing logic |
| Recurring debits | PayFast tokenised debits + Ozow Recurring | included | Use both — PayFast for retainers, Ozow as fallback |
| Reconciliation | Stitch + custom matching logic | — | Bank statement vs Invoice.status auto-reconcile |

### 1.7 Communications

| Channel | Pick | Cost | Replaces |
|---|---|---|---|
| Transactional email | **Resend** + **React Email** | $20/mo for 50k sends | Your hand-rolled wrapEmail duplication |
| Marketing email (campaigns) | **Customer.io** | $100–$500/mo | Hand-rolled MarketingCampaign + CampaignSend entities |
| SMS (SA) | **Africa's Talking** | R0.40–R0.60/SMS | Cheaper than Twilio in SA — this matters at agency volume |
| **WhatsApp Business** (CRITICAL) | **360dialog** (Meta partner) | €49/mo + per-conversation | You sell "WhatsApp Automation" as a $$ add-on. You can't sell it without this API |
| Voice / IVR | Africa's Talking Voice | per-minute | For callback flows when invoices go overdue |
| Push notifications (mobile) | **OneSignal** | Free up to 10k subs | When you ship the mobile app |
| In-app real-time | **Supabase Realtime** | included | Replaces poll-on-focus pattern in MyInvoices.jsx |
| Email inbound | **Resend Inbound** | included | Email → webhook → create ClientCommunication ticket |
| Calendar / scheduling | **Cal.com** ($15/user/mo) | $15/user/mo | Discovery call booking, embedded in marketing site + portal |
| Meeting recording / transcription | **tldv** or **Fathom** | $20/user/mo | Auto-attach call transcript to Lead row |
| Internal team chat | **Slack** (or **Linear** for async) | $7-12/user/mo | Don't conflate ops with the CRM |

### 1.8 The AI layer — currently ZERO; this is your competitive moat

You've named functions `generate-hero-image`, you have a `GeneratedImage` entity, you installed Three.js — the AI intent is there but unrealized. The rebuild puts a proper AI layer in.

| Use case | Pick | Cost (est. month 1) |
|---|---|---|
| Mascot chatbot in client portal | **Claude Haiku 4.5** via Anthropic API | $50–200 (cached) |
| Hard customer queries / proposal drafting | **Claude Sonnet 4.6** | $200–800 |
| Lead scoring beyond rules | Claude Sonnet | $50–200 |
| Discovery call transcription | **AssemblyAI** (better diarisation than Whisper) or **Deepgram** | $0.37/audio hour |
| Call transcript → action items | Claude Sonnet | included above |
| Email triage (ClientCommunication) | Claude Haiku | $20–80 |
| Content generation per add-on | Claude Sonnet (with RAG on client brand kit) | $200–600 |
| Image generation | **ideogram.ai** API or **Recraft** | $30–100 |
| Video generation (Short Form Video add-on) | **Synthesia** or **HeyGen** | $30/video × volume |
| RAG vector storage | **pgvector** on Supabase | $0 |
| Orchestration | Anthropic SDK + Inngest | $0 |
| Eval & monitoring | **Braintrust** | $20–200/mo |
| Prompt registry | Braintrust or in-repo Markdown | $0 |
| Cost guardrails | Per-org token budgets in code | $0 |

**Why Claude specifically over OpenAI**: Anthropic's models are stronger on long-context reasoning (your 22-page MSA, your fulfilment template scope docs), better at refusing hallucination on financial data, and the Haiku/Sonnet tier split gives you cost-effective routing — cheap model for "what's my invoice number?", smart model for "draft a proposal".

**Specific AI features I'd ship:**
1. **The mascot IS the chatbot.** Click the mascot anywhere in the client portal → conversational UI. RAG over the client's invoices/deliverables/contracts. Answers "when is my next debit?" "where's my November social media report?" Personality matches the brand voice.
2. **Lead scorer**: replaces `calculate-lead-score`. Reads the EnquiryEvent text + checkout engagement + UTM source + IP geolocation → emits a 1–100 score with reasoning.
3. **Proposal drafter**: from a Lead row + the package chosen → outputs a branded 4-page PDF proposal with the client's business specifics. Closer reviews and sends.
4. **Discovery call assistant**: meeting starts → AssemblyAI transcribes → Claude summarises → Tasks created automatically for follow-ups + ClientActivityLog row + email summary to the client.
5. **Inbox triage**: incoming `ClientCommunication` rows → Claude classifies (billing / bug / feature / compliment) → routes to the right queue, sets SLA.
6. **Brand-tone content generator**: per add-on bucket (social posts, ad copy, email sequences) using RAG on the client's onboarding form responses + brand guidelines.
7. **Monthly report drafter**: pulls Deliverable + Payment + MetricSnapshot data → generates the prose for `MonthlyReport`. Owner edits before send.
8. **Owner's morning brief**: 7am email — "3 deals at risk, 2 invoices overdue 7+ days, Lekgoro hit her milestone yesterday, the Acme contract auto-renews in 14 days."

### 1.9 Documents, signatures, legal

| Concern | Pick | Notes |
|---|---|---|
| 22-page MSA | Port to **react-pdf** with template variables | Director / witness names from `system_settings` |
| Template library | Versioned in `document_templates` table | Each contract snapshots the template version it used (legal evidence) |
| E-signature flow | **Native** (your current flow is good) | But add eIDAS-grade audit per SA ECTA Act §13 |
| Non-MSA docs (NDAs, debit mandates, ad-hoc) | **PandaDoc API** ($59/user/mo) or native if low volume | Pandadoc is good for sales-side proposals |
| Storage | **Supabase Storage** with signed URLs | Per-bucket policies, retention rules |
| Audit trail | IP + geolocation + browser fingerprint + timestamp on every signing | Required for ECTA Act |
| ID verification (advanced) | **Smile Identity** (SA-native) or **Yoti** | When you need to verify a signer's identity for enterprise contracts |

### 1.10 Analytics, BI, reporting

| Layer | Pick | Cost |
|---|---|---|
| Product analytics | **PostHog** (self-hosted = POPIA-clean) | $0–$450/mo |
| Marketing analytics | **Plausible Analytics** | $9/mo (privacy-first, POPIA-friendly) |
| BI / dashboards | **Metabase OSS** | $0 self-hosted, $85/mo cloud |
| Transformations | **dbt Core** | $0 |
| Owner dashboards (in-app) | **Tremor** + **react-three-fiber** for animated revenue viz | $0 |
| CSV exports | Native via Supabase Edge Functions | $0 |
| Session replay | PostHog | included |
| Feature flags | PostHog or **GrowthBook** | $0 self-host |
| A/B testing | PostHog | included |
| Event tracking | PostHog SDK on frontend + backend events | included |

### 1.11 Customer support

| Concern | Pick | Cost |
|---|---|---|
| In-portal ticketing | Build native on `ClientCommunication` entity | $0 |
| Email-to-ticket | Resend Inbound webhook → create `ClientCommunication` | $0 |
| Knowledge base (client-facing) | **Mintlify** or **Docusaurus** | $0–$120/mo |
| Internal wiki | **Notion** | $10/user/mo |
| Live chat (later) | Plug Claude chatbot first; **Intercom** or **Front** only if you outgrow it | $74/user/mo |

### 1.12 Project management & internal tooling

| Concern | Pick | Cost |
|---|---|---|
| Engineering / product PM | **Linear** | $8/user/mo |
| Time tracking | Extend `TimeLog` entity with proper UI | $0 |
| Design files | **Figma** | $15/editor/mo |
| Documentation | Notion + Mintlify (split: internal vs external) | as above |
| Mobile builds | **EAS Build** (Expo) | $99/mo Production tier |

### 1.13 Mobile

| App | Stack | Why now |
|---|---|---|
| **Staff app** (field agents, CPCs) | **Expo (React Native)** + EAS | Field agents need: GPS-tagged visit logs, deal logging at the client site, photo upload, push notifications. Web doesn't cut it |
| **Client portal app** | Don't build day-one. Mobile-responsive web first. | Build native only when ≥30% of portal traffic is mobile |

### 1.14 Observability & ops

| Concern | Pick | Cost |
|---|---|---|
| Error tracking | **Sentry** | $26/mo Team |
| Log aggregation | **Axiom** or **Logtail** | $25/mo |
| Uptime monitoring | **Better Uptime** | $20/mo |
| Status page | Better Uptime status pages | included |
| APM | Vercel Analytics + Sentry Performance | included |
| Database monitoring | Supabase built-in + **pganalyze** if you outgrow it | $0–$199/mo |
| On-call rotation | **PagerDuty** when team grows | $21/user/mo |
| Runbook automation | **Rootly** (later) | — |

### 1.15 Security & compliance

| Concern | Pick | Cost |
|---|---|---|
| POPIA | Your existing 14-day-grace pattern productionised | $0 |
| SOC 2 (if you pursue enterprise SA clients) | **Vanta** or **Drata** | $7–11k/year |
| DAST (security scan) | **Snyk Code** | $0 free tier |
| Dependency scanning | GitHub Dependabot + Snyk | included |
| Secrets scanning | GitHub Advanced Security or **TruffleHog** | included |
| Penetration test (annual) | SA-based firm (~R80k–R150k) | once-off |
| Cookie / consent | **Cookiebot** | $9/mo |
| Privacy policy generator | **Termly** | $10/mo |
| Data subject access (POPIA) | Build native (you have the entities) | $0 |
| Backup verification | Quarterly disaster recovery drill | team time |

### 1.16 Marketing & growth

| Concern | Pick | Cost |
|---|---|---|
| Marketing site CMS | **Sanity** or **Payload CMS** | $0–$199/mo |
| Form capture | **Tally** | $29/mo |
| Email campaigns | **Customer.io** (above) | — |
| Lead enrichment | **Apollo** | $59/user/mo (note: SA data quality is patchy) |
| Social scheduling for client deliverables | **Buffer API** | $6/channel/mo |
| SEO | Ahrefs or SEMrush | $99–$229/mo |
| Heatmaps | PostHog session replay | included |

---

## 2. Build phases — what gets shipped when, and the actual cost

| Phase | Weeks | Labour cost | Software year 1 |
|---|---|---|---|
| 0. Discovery & design | 2 | R275–460k | — |
| 1. Foundation | 3 | R460–640k | Supabase, Vercel, Sentry: ~R2k/mo |
| 2. Sales engine | 3 | R460–640k | PayFast (existing) |
| 3. Contracts & invoicing | 2 | R370–550k | + Stitch open banking |
| 4. Fulfilment system | 3 | R460–640k | + Inngest |
| 5. Client portal & communications | 3 | R460–640k | + Resend, Customer.io, 360dialog, Africa's Talking |
| 6. Marketing & growth | 2 | R370–460k | + Cal.com, Tally |
| 7. AI layer | 3 | R460–640k | + Anthropic, AssemblyAI, Braintrust (~R3k/mo) |
| 8. Mobile staff app | 3 | R460–640k | + Expo EAS |
| 9. Reporting & BI | 2 | R370–460k | + Metabase, PostHog |
| 10. Compliance & handoff | 1 | R185–275k | + Vanta if pursuing SOC 2 |
| **Total** | **27 weeks (~6.5 mo)** | **R4.3M–6.1M (~$235–330k)** | **R45–90k/year** |

USD–ZAR at 18:1. Cost range reflects junior-to-senior team mix. Add 15% PM overhead, 10% contingency.

---

## 3. Team composition

| Role | Allocation | Weekly rate (R) | Total (27w) |
|---|---|---|---|
| Tech Lead (full-stack + arch) | 100% × 27w | R55–75k | R1.5–2.0M |
| Senior Full-stack Eng | 100% × 27w | R40–55k | R1.1–1.5M |
| Design + Frontend specialist | 100% × 18w | R35–45k | R630–810k |
| AI Engineer (Phase 7 + advisory) | 50% × 8w | R45–60k | R180–240k |
| Mobile specialist (Phase 8) | 100% × 4w | R40–55k | R160–220k |
| Owner / Product (you) | ongoing | — | your time |
| QA / Test automation | 30% × 27w | R30–40k | R245–325k |
| **Subtotal** | | | **~R3.8–5.1M** |

Plus ~10% recruiting / advisor / specialist consult overhead.

Alternative shape: One senior tech lead full-time + freelance specialists per phase = R3.0–4.0M but slower, more coordination overhead, more risk.

---

## 4. The migration / cutover strategy

Don't shut Base44 off on day one. Migration runs in parallel.

**Months 1–3 (Phases 1–4)**: Build new stack. Production stays on Base44.

**Month 4 (Phase 5)**: Parallel mode begins.
- New auth on Supabase, dual-login flow during transition
- Data sync: Supabase ← (read-only) replicate from Base44 entities via scheduled exports
- Client portal v2 live on a subdomain (`portal.marketingio.co.za`), old portal stays on main
- New sales logged in BOTH systems via the new orchestrator (with feature flag toggle)

**Month 5 (Phases 6–7)**: Feature parity check. AI layer goes live. Old client portal redirects to new.

**Month 6 (Phases 8–9)**: Mobile ships. Reporting reaches parity. Run reconciliation reports to verify financial data integrity.

**Month 7 (Phase 10)**: Cutover weekend. Final data migration. Base44 set to read-only for 30 days as backup. Decommission.

Risk mitigation: every commit deployable to preview. Every commit can be rolled back. Database backups every 6 hours during cutover weekend.

---

## 5. What I'd preserve from your current build (with respect)

- **Synthwave email brand language** — it's distinctive
- **22-page MSA V3.0 template** — the legal work is real and good; port it, don't redo it
- **Commission scheme structure** — milestone gating, CPC bonuses, retainer-term math is sophisticated and fits the model
- **6-phase onboarding model** — the phase definitions are sound
- **FulfilmentTemplate concept** — this is your IP
- **Package + add-on catalogue** — Ignite / Accelerate / Dominate / Street Pulse / Township Pulse is your market positioning
- **ClientActivityLog event taxonomy** — extend it, don't replace
- **POPIA grace-period pattern** — productionise it, expose it to clients via the portal
- **The mascot Lottie** — keep as v1, ship Rive v2 in Phase 5
- **AppUser session lockdown + recovery flows** — the "wasn't me" link is good UX
- **Public signing token model** — works well, port it
- **Director / witness blocks** — but move the humans into `system_settings`

---

## 6. What I'd kill

- **Base44 platform** — you'll outgrow it; the silent catch + RLS gaps + dashboard-managed crons are foundational, not patchable
- **AppUser vs User duality** — finish the migration
- **`driver` role** — dead
- **`staff` legacy role** — migrate everyone to a specific role
- **`founder` as a confused enum** — make it explicitly a "non-staff attribution" metadata tag
- **jsPDF for templates** — react-pdf is far better for the MSA
- **moment.js** — date-fns only
- **react-hot-toast + Radix toast** — sonner only
- **The 12× wrapEmail copy-paste** — react-email templates
- **Hand-rolled MarketingCampaign + CampaignSend** — Customer.io
- **Stripe SDK install with no integration** — either ship it or remove it
- **Three.js install with no usage** — actually use it on the owner revenue dashboard
- **All silent `catch (_) {}` patterns** — every catch logs to Sentry and either returns a 5xx or surfaces in the UI
- **Browser-side `entities.X.create()`** — every mutation goes through a server function with RLS
- **Hardcoded director name, witness name, email addresses, Cloudinary URLs** — `system_settings`

---

## 7. The mascot — designed as a system, not a sprite

You have a Lottie file played in two places. In the rebuild:

**Identity**
- A name (give them one — "Mio"? "Pulse"? You decide)
- A voice & personality guide (Notion doc): how they speak in success, in error, in waiting, in confusion
- A do-not-use guide: when the mascot is wrong (legal pages, compliance, payment failures)

**Technical**
- Rive file with **8+ mood states**: idle, thinking, celebrating, apologising, explaining, excited, sleepy (loading), surprised
- Bound to context: dashboard loads → idle → confetti on milestone → sleepy during long operations
- Eye tracking with mouse on hover (Rive can do this natively)
- 60fps on mobile, < 100kb gzipped

**Appearances**
- The chatbot UI in client portal (the mascot IS the AI assistant face)
- Splash / onboarding (current)
- Payment celebration (current)
- Every empty state: "No deals yet — let's go close one!"
- Achievement unlocks: 5 sales milestone, first client onboarded, first signed contract
- 404 / 500 pages with apologetic mood
- Login screen as ambient idle
- Email signature (a small static frame in the synthwave footer)
- Loading states for long AI operations

**Mascot brand kit** (deliverable from Phase 0):
- Style guide PDF
- Reference renders at every mood state
- Token names in code (`mascot.mood.celebrating`)
- Voice guide for content writers
- Mascot animation principles (timing, easing, pause)

---

## 8. The signature system — generalised for enterprise

Today: one MSA template, one director, one witness, all hardcoded in TypeScript.

In the rebuild:

**Schema**
- `document_templates` (versioned, JSON template body, variables list, retention policy)
- `document_versions` (every template version snapshotted)
- `document_signatures` (signer, document_version_id, IP, geolocation, browser fingerprint, timestamp, witness_id × N)
- `document_audit_trail` (every view, every download, every email about this document)

**Capabilities**
- Multiple template types: MSA, NDA, debit mandate, SLA, project SOW, ad-hoc addendum
- Per-template signatory configuration (some need 2 witnesses, some need 1, some need a director attestation)
- E-sign field types: signature, initial, date, checkbox, text input, dropdown
- Sequential signing (client → director → witness)
- Decline + comment workflow
- Auto-reminder cadence per template
- POPIA-compliant retention: financial docs 5y, marketing consents revocable
- ECTA Act §13 audit grade: IP + UA + geolocation + device fingerprint + cryptographic hash of document at signing moment
- Witness/director assignments managed in `system_settings.legal_signatories` — bring on a co-director without a deploy

**External integrations**
- ID verification: **Smile Identity** (SA-native, ID document + selfie liveness) for high-value contracts
- Notarisation: optional integration with **Notarize.com** if you ever need cross-border legal weight

---

## 9. The API surface — make it intentional

Today: 133 ad-hoc named functions.

In the rebuild:
- **REST conventions**: `POST /api/v1/sales`, `POST /api/v1/sales/:id/close`, `GET /api/v1/clients/:id/invoices`
- **OpenAPI spec** auto-generated from route handlers (via `next-openapi-gen` or hand-curated)
- **API keys** per organisation, scoped permissions, audit logged
- **Rate limiting** via Upstash Redis (token bucket)
- **Webhooks out**: subscribers register URLs, deliveries signed with HMAC, retried with exponential backoff, dead-letter queue after 5 attempts
- **Webhook UI**: clients see delivery history, can replay failed ones
- **Public API docs**: Mintlify-hosted, OpenAPI-driven
- **Versioning**: `/api/v1/...` with deprecation lifecycle and `Sunset` headers
- **GraphQL (later)**: only if a client integration demands it. REST is fine for 95% of use cases.

This unlocks: Zapier integration, embedded signup forms on the marketing site, a Slack bot for owner morning briefs, third-party integrations from clients themselves.

---

## 10. SA-specific must-haves

These aren't optional for a SA agency. Listed separately so they don't get lost.

| Need | Solution | Why |
|---|---|---|
| ZAR debit orders | **PayFast** (existing) + **Ozow** for instant EFT | Maximise collection success |
| Failed-debit visibility | **Stitch** open banking | Read client bank statements directly — see the bounce coming |
| WhatsApp Business | **360dialog** | You sell this as an add-on; must have the API |
| SMS | **Africa's Talking** | SA-native, cheaper than Twilio |
| In-person card | **Yoco** | Field agents at client premises |
| POPIA self-service | Native (you have the entities) | Mandatory under the Act |
| ECTA Act §13 signature audit | Native | Court-admissible e-signatures |
| ID verification | **Smile Identity** | SA-native, supports SA ID document |
| ZAR pricing display | Use `Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })` everywhere | You have it inconsistent today |
| SA holidays in scheduling | `date-fns-holidays` or custom | Avoid scheduling debits on public holidays |
| Cape Town / JHB / Durban geofencing | Leaflet (you have it) + GeoJSON | Township Pulse package is regional |
| Vernacular language support (Zulu, Xhosa, Afrikaans) | i18next from day one, even if only English ships first | Roadmap insurance |
| FICA compliance (for any payment-adjacent KYC) | **Smile Identity** + manual document upload | Bank-tier clients will ask |

---

## 11. Owner dashboard — what makes this feel like a "$300k system"

The owner dashboard is where you'll spend the most time. It needs to feel like Bloomberg / Salesforce / Pipedrive's best executive view, not the current /OwnerDashboard.

**Above the fold:**
- Revenue this month vs target (live), with a 12-month rolling chart
- Pipeline value by stage (Tremor funnel chart)
- Commission accrued this month by staff member
- Cash flow forecast: known recurring + expected setup fees — 90 days out

**The three.js animated centerpiece:**
- A 3D revenue globe — pillars rise per client showing monthly revenue, animated growth, click a pillar → client detail
- This is what makes the dashboard memorable. You installed three.js; let's use it.

**AI-driven cards:**
- "Owner morning brief" (Sonnet-generated): top 3 things you need to know today
- "Deals at risk": Sonnet flags deals stuck > 14 days at one stage
- "Churn risk": clients with reduced engagement / failed debits / overdue deliverables
- "Wins": milestones hit, contracts signed, large invoices paid

**Drill-downs:**
- Click any number → underlying table → CSV export
- Every chart is filterable by date range, staff, package
- Every table has TanStack Table with sorting, filtering, column visibility

**Mobile-responsive but desk-first** — you'll use it on a laptop, not a phone.

---

## 12. The "vision check" — what your code says you really want

The full sentence:

> A South African marketing agency operating system that productises service delivery via FulfilmentTemplates, tracks every interaction in a compliant ClientActivityLog, automates sales attribution and payroll through a milestone-gated commission engine, runs end-to-end from inbound lead (with AI scoring) through PayFast checkout, eIDAS-grade contract signing, phase-driven onboarding, head-of-tech-managed deliverables, monthly retainer billing with bank-statement reconciliation, AI-augmented monthly client reports, and POPIA-compliant data lifecycle — wrapped in a synthwave brand voice with a personality-driven mascot at every touchpoint, accessible to clients via a portal that respects their package level, accessible to field agents via a mobile app that respects their location, and accessible to you via an executive dashboard that shows you what matters before you have to ask.

That's what the code is reaching for. The rebuild delivers it.

---

## 13. Decision points for you

I can't pick these for you. They shape the build.

1. **Stay on Base44 or move to Supabase?** This is the foundational architecture decision. Base44 = faster iteration, but the ceiling is real (RLS gaps, silent catches, dashboard-bound crons). Supabase = real software engineering discipline, slower start, much higher ceiling.

2. **AI now or AI later?** Phase 7 can move earlier or later. Some agencies need AI as a Day-1 differentiator; some can wait.

3. **Self-serve vs rep-led?** You've built both (`/checkout/:packageId` AND `/log-sale`). Pick the dominant motion and lean into it.

4. **Mobile app priority?** Field agents will love it. Investment is real (4 weeks specialist time). Worth it iff > 3 active field agents.

5. **Multi-tenant or single-tenant?** Multi-org from day one (recommended) costs 15% more but lets you white-label later. Single-org is cheaper but locks you in.

6. **SOC 2?** Only if you're chasing banks/telcos/government as clients. Otherwise wait.

7. **Build vs buy customer support?** Native ticketing is cheap (you have the entities). Intercom is faster but $74/user/mo and lock-in.

8. **Mascot personality lead?** This is a creative direction decision. Get a brand designer involved in Phase 0 — the mascot voice will be referenced for the next 5 years.

---

## 14. The "what would I do today, before anything else?"

Before the full rebuild, three things to make production sane:

1. **Fix the silent OTP catch** in `auth-login` — surfaces Resend failures as 5xx
2. **Add RLS to Commission, AppUser, StaffRecord, ClientOnboardingSubmission, Payment** — the 5 most sensitive entities. Even Base44-side this is possible
3. **Merge PRs #130–#133** — they're branch-ready, low-risk, high-value

Then start Phase 0.

---

## Sign-off

Every vendor named above has been chosen for a reason — SA market fit, your team's likely skill set, the scale you're at (small but ambitious), the data sovereignty rules you operate under (POPIA), the brand you've built (synthwave, mascot, premium MSA), and the AI-augmented future every modern CRM needs to claim.

This isn't a generic "use the popular tools" stack. It's a procurement-grade specification with named alternatives so you can negotiate, and named cost tiers so you can budget. The total spend (~$235–330k over 6.5 months + ~$50k/yr ongoing) puts the rebuild squarely in the $300k tier you asked for, with the operating costs of a serious SaaS business rather than an indie project.

If I were building it for you, I'd start with Phase 0 next Monday.
