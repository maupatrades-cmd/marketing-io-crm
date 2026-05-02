import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, ChevronUp, Package } from "lucide-react";

const PRODUCTS = [
  // ── CORE PACKAGES ──────────────────────────────────────────────
  {
    id: "ignite",
    name: "Ignite",
    type: "Core Package",
    setup: "R3,980",
    monthly: "R490/mo",
    annual: "R5,880/yr",
    description: "Entry-level social media & Google Business package for small businesses starting their digital journey.",
    color: "text-[#10b981]",
    bucket: "B",
    workflow: [
      { phase: "Onboarding", steps: [
        "Sign service agreement & POPIA consent form",
        "Collect brand assets (logo, colours, photos)",
        "Complete client onboarding questionnaire",
        "Set up debit order / EFT mandate",
        "Create or access social media accounts",
      ]},
      { phase: "Setup", steps: [
        "Set up / optimise Facebook Business Page",
        "Create / claim & verify Google Business Profile",
        "Design brand templates (post, story, cover photo)",
        "Schedule first 2 weeks of content",
        "Client go-live approval & sign-off",
      ]},
      { phase: "Monthly Recurring", steps: [
        "8 branded social media posts per month",
        "Google Business Profile update (hours, photos, posts)",
        "Monthly performance report by the 5th",
        "Content approval from client before publishing",
        "Monthly check-in call / WhatsApp update",
      ]},
    ],
  },
  {
    id: "accelerate",
    name: "Accelerate",
    type: "Core Package",
    setup: "R6,500",
    monthly: "R890/mo",
    annual: "R10,680/yr",
    description: "Mid-tier package — professional website + advanced social management for growing businesses.",
    color: "text-primary",
    bucket: "B",
    workflow: [
      { phase: "Onboarding", steps: [
        "Sign service agreement & POPIA consent form",
        "Collect brand assets & business information",
        "Complete detailed onboarding questionnaire",
        "Set up debit order mandate",
        "Kickoff strategy meeting with client",
      ]},
      { phase: "Setup", steps: [
        "All Ignite setup steps",
        "5-page professional website build",
        "On-page SEO & meta tags setup",
        "WhatsApp Business link / chat button",
        "Google Analytics 4 & Search Console setup",
        "Domain, hosting & SSL configuration",
        "Client website review, revisions & go-live approval",
      ]},
      { phase: "Monthly Recurring", steps: [
        "12 branded social media posts per month",
        "Website uptime & security monitoring",
        "Monthly website content update (1 page)",
        "Monthly performance & website health report by 5th",
        "Monthly strategy call",
      ]},
    ],
  },
  {
    id: "dominate",
    name: "Dominate",
    type: "Core Package",
    setup: "R9,800",
    monthly: "R1,490/mo",
    annual: "R17,880/yr",
    description: "Full-service package for established businesses wanting to dominate their market online.",
    color: "text-accent",
    bucket: "B",
    workflow: [
      { phase: "Onboarding", steps: [
        "Full discovery & brand audit meeting",
        "Sign service agreement & POPIA consent",
        "Competitor analysis (3 competitors)",
        "Brand asset collection & strategy document",
        "Set up debit order mandate",
      ]},
      { phase: "Setup", steps: [
        "All Accelerate setup steps",
        "E-commerce or booking system integration",
        "Full technical SEO audit + implementation",
        "Email newsletter platform setup (Mailchimp / similar)",
        "Short-form video content plan & first reel",
        "Paid ads campaign setup (Meta / Google)",
        "CRM / WhatsApp automation light setup",
        "Client full review & go-live sign-off",
      ]},
      { phase: "Monthly Recurring", steps: [
        "20+ posts across all platforms",
        "Paid ads management & optimisation",
        "2× email newsletters per month",
        "Weekly performance summary (WhatsApp)",
        "Full monthly report by the 5th",
        "Monthly strategy session (video call)",
        "Reputation management (review responses)",
        "1× short-form video (reel/short) per month",
      ]},
    ],
  },

  // ── PULSE PACKAGES ─────────────────────────────────────────────
  {
    id: "street_pulse",
    name: "Street Pulse",
    type: "Pulse Package",
    setup: "R700",
    monthly: "R3,700/mo",
    annual: "3-month contract · R44,400 total",
    description: "High-frequency community marketing for local businesses — rapid deployment, WhatsApp & social blasts.",
    color: "text-warning",
    bucket: "C",
    workflow: [
      { phase: "Onboarding", steps: [
        "Discovery visit + on-site photography",
        "Sign 3-month Street Pulse contract & POPIA",
        "Collect brand assets & specials/promos",
        "Define community targeting area",
        "Set up WhatsApp broadcast list",
      ]},
      { phase: "Setup (Week 1)", steps: [
        "Design community post templates",
        "Set up / optimise Facebook Business Page",
        "Create WhatsApp status content calendar",
        "Deploy first campaign batch",
        "Add / update Google Maps pin & photos",
      ]},
      { phase: "Monthly Recurring", steps: [
        "Weekly community social media posts",
        "WhatsApp broadcast blasts (specials, events)",
        "Event / promo on-site coverage (photos)",
        "Monthly deployment photo report",
        "Engagement & reach summary",
        "Client feedback & next month planning",
      ]},
    ],
  },
  {
    id: "township_pulse",
    name: "Township Pulse",
    type: "Pulse Package",
    setup: "R1,300 once-off",
    monthly: "Once-off campaign",
    annual: "—",
    description: "Single-campaign deployment for township & community businesses. Once-off service, no retainer.",
    color: "text-[#f97316]",
    bucket: "A",
    workflow: [
      { phase: "Campaign Execution", steps: [
        "Discovery visit & on-site business photography",
        "Design 3 branded campaign posts",
        "WhatsApp community broadcast blast",
        "Facebook community page post & boost",
        "Google Maps business pin & photos update",
        "Deliver deployment photo summary to client",
      ]},
    ],
  },

  // ── ADD-ONS ────────────────────────────────────────────────────
  {
    id: "ai_chatbot",
    name: "AI Chatbot",
    type: "Add-On",
    setup: "Custom",
    monthly: "Recurring",
    annual: "—",
    description: "AI-powered chat assistant deployed on the client's website or WhatsApp to handle enquiries 24/7.",
    color: "text-[#00ccff]",
    bucket: "B",
    workflow: [
      { phase: "Setup", steps: [
        "Client FAQ & knowledge base collection",
        "Chatbot conversation flow design",
        "Integration with website or WhatsApp Business API",
        "QA testing across device types",
        "Client handover & training",
      ]},
      { phase: "Monthly", steps: [
        "Monitor chat logs & unanswered questions",
        "Update knowledge base with new info",
        "Monthly chatbot performance summary",
      ]},
    ],
  },
  {
    id: "whatsapp_automation",
    name: "WhatsApp Automation",
    type: "Add-On",
    setup: "Custom",
    monthly: "Recurring",
    annual: "—",
    description: "Automated WhatsApp flows for lead capture, appointment reminders, follow-ups and broadcasts.",
    color: "text-[#25d366]",
    bucket: "B",
    workflow: [
      { phase: "Setup", steps: [
        "Audit client's current WhatsApp usage",
        "Design automation flows (welcome, follow-up, broadcast)",
        "Set up WhatsApp Business API or approved tool",
        "Build contact segmentation lists",
        "Test flows & go-live",
      ]},
      { phase: "Monthly", steps: [
        "Broadcast campaign scheduling",
        "Flow performance review",
        "List maintenance & new contact imports",
        "Monthly summary report",
      ]},
    ],
  },
  {
    id: "reputation_management",
    name: "Reputation Management",
    type: "Add-On",
    setup: "Included",
    monthly: "Recurring",
    annual: "—",
    description: "Monitor, respond to and grow positive reviews on Google, Facebook and HelloPeter.",
    color: "text-[#ec4899]",
    bucket: "C",
    workflow: [
      { phase: "Setup", steps: [
        "Audit existing reviews (Google, Facebook, HelloPeter)",
        "Claim & verify all business listings",
        "Set up review monitoring alerts",
        "Create professional response templates",
        "Client briefing on review strategy",
      ]},
      { phase: "Monthly", steps: [
        "Respond to all new reviews within 24 hours",
        "Flag negative reviews for client action",
        "Proactively request reviews from happy clients",
        "Monthly reputation score & sentiment report",
      ]},
    ],
  },
  {
    id: "google_business_profile",
    name: "Google Business Profile",
    type: "Add-On",
    setup: "R500",
    monthly: "Recurring",
    annual: "—",
    description: "Full setup, optimisation and ongoing management of the client's Google Business Profile.",
    color: "text-[#4285f4]",
    bucket: "C",
    workflow: [
      { phase: "Setup", steps: [
        "Claim / verify Google Business Profile",
        "Complete all business info (hours, categories, services)",
        "Upload 10+ professional photos",
        "Add products / services listing",
        "Set up Q&A section",
      ]},
      { phase: "Monthly", steps: [
        "2× Google Posts per month",
        "Photo updates",
        "Q&A monitoring & responses",
        "Monthly GBP insights report",
      ]},
    ],
  },
  {
    id: "email_newsletter",
    name: "Email Newsletter",
    type: "Add-On",
    setup: "R1,500",
    monthly: "Recurring",
    annual: "—",
    description: "Professionally designed monthly email newsletters to keep clients top-of-mind with their audience.",
    color: "text-[#f59e0b]",
    bucket: "C",
    workflow: [
      { phase: "Setup", steps: [
        "Platform setup (Mailchimp / Brevo / similar)",
        "Import existing subscriber list",
        "Design branded email template",
        "Confirm send schedule with client",
        "Test send & approval",
      ]},
      { phase: "Monthly", steps: [
        "Draft newsletter content",
        "Client review & approval",
        "Schedule & send",
        "Monthly open rate & click report",
      ]},
    ],
  },
  {
    id: "short_form_video",
    name: "Short-Form Video",
    type: "Add-On",
    setup: "Custom",
    monthly: "Recurring",
    annual: "—",
    description: "Monthly branded Reels, TikToks or YouTube Shorts to grow organic reach and engagement.",
    color: "text-[#a855f7]",
    bucket: "C",
    workflow: [
      { phase: "Setup", steps: [
        "Video content strategy & brief",
        "Account setup (TikTok, YouTube Shorts if needed)",
        "First video brief, shoot plan & script",
        "Client approval of concept",
      ]},
      { phase: "Monthly", steps: [
        "1–4 short-form videos produced",
        "Caption, hashtag & SEO optimisation",
        "Scheduled posting across platforms",
        "Monthly video performance report",
      ]},
    ],
  },
  {
    id: "sms_marketing",
    name: "SMS Marketing",
    type: "Add-On",
    setup: "R500",
    monthly: "Per SMS + management fee",
    annual: "—",
    description: "Targeted SMS campaigns to the client's database — promos, reminders and bulk broadcasts.",
    color: "text-[#06b6d4]",
    bucket: "C",
    workflow: [
      { phase: "Setup", steps: [
        "SMS platform setup & sender ID registration",
        "Import & clean client contact database",
        "Draft first campaign copy",
        "Compliance check (POPIA, WASPA)",
        "Test send & go-live",
      ]},
      { phase: "Monthly", steps: [
        "Draft & schedule SMS campaigns",
        "Client approval before send",
        "Track delivery & opt-outs",
        "Monthly SMS performance report",
      ]},
    ],
  },
  {
    id: "staff_training_workshop",
    name: "Staff Training Workshop",
    type: "Add-On",
    setup: "R2,500 per session",
    monthly: "Once-off or recurring",
    annual: "—",
    description: "On-site or virtual digital marketing & social media training workshops for the client's staff.",
    color: "text-[#8b5cf6]",
    bucket: "A",
    workflow: [
      { phase: "Preparation", steps: [
        "Client needs assessment & staff level audit",
        "Custom training content development",
        "Training schedule & logistics confirmation",
        "Presentation & workbook preparation",
      ]},
      { phase: "Delivery", steps: [
        "On-site or virtual workshop delivery",
        "Practical exercises & Q&A session",
        "Post-training resource pack handover",
        "Certificate of completion (if applicable)",
        "Follow-up feedback survey",
      ]},
    ],
  },
  {
    id: "marketing_audit",
    name: "Marketing Audit",
    type: "Add-On",
    setup: "R1,500 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "Comprehensive audit of the client's current digital marketing presence with actionable recommendations.",
    color: "text-[#64748b]",
    bucket: "A",
    workflow: [
      { phase: "Audit", steps: [
        "Social media profile audit (all platforms)",
        "Website performance & SEO audit",
        "Google Business Profile review",
        "Competitor benchmarking (3 competitors)",
        "Advertising account review (if applicable)",
      ]},
      { phase: "Delivery", steps: [
        "Compile full audit report (PDF)",
        "Prioritised recommendations list",
        "Presentation meeting with client",
        "30-day action plan handover",
      ]},
    ],
  },
  {
    id: "competitor_analysis",
    name: "Competitor Analysis",
    type: "Add-On",
    setup: "R1,000 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "In-depth analysis of 3–5 key competitors' digital presence, strategies and positioning.",
    color: "text-[#ef4444]",
    bucket: "A",
    workflow: [
      { phase: "Research", steps: [
        "Identify top 3–5 competitors with client",
        "Social media & content strategy analysis",
        "Website & SEO comparison",
        "Advertising spend & ad copy review",
        "Pricing & offer positioning review",
      ]},
      { phase: "Delivery", steps: [
        "Compiled competitor analysis report (PDF)",
        "Opportunity gaps identified",
        "Strategic recommendations",
        "Presentation to client",
      ]},
    ],
  },
  {
    id: "ai_content_writing",
    name: "AI Content Writing",
    type: "Add-On",
    setup: "Custom",
    monthly: "Recurring",
    annual: "—",
    description: "AI-assisted blog posts, website copy, product descriptions and social captions — edited & brand-aligned.",
    color: "text-[#14b8a6]",
    bucket: "C",
    workflow: [
      { phase: "Setup", steps: [
        "Brand voice & tone guide development",
        "Content topic plan approval",
        "First batch of content drafted & approved",
      ]},
      { phase: "Monthly", steps: [
        "Monthly content calendar planning",
        "Draft articles / copy per agreed schedule",
        "Client review & edits",
        "Final publishing or handover",
        "Performance notes (if published to website)",
      ]},
    ],
  },
  {
    id: "crm_training_setup",
    name: "CRM Training & Setup",
    type: "Add-On",
    setup: "R2,000 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "Set up and train client staff on a CRM system (HubSpot Free / similar) for lead and client management.",
    color: "text-[#0ea5e9]",
    bucket: "A",
    workflow: [
      { phase: "Setup", steps: [
        "CRM platform selection & account creation",
        "Import existing contacts & deals",
        "Pipeline stages & field configuration",
        "Email & WhatsApp integration",
        "Staff accounts & permission setup",
      ]},
      { phase: "Training", steps: [
        "On-site or virtual training session (2–3 hrs)",
        "Step-by-step SOP document handover",
        "Q&A & walkthrough",
        "30-day follow-up support call",
      ]},
    ],
  },
  {
    id: "print_signage",
    name: "Print & Signage Design",
    type: "Add-On",
    setup: "From R800 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "Professional design of flyers, banners, business cards, menus and branded print materials.",
    color: "text-[#f43f5e]",
    bucket: "A",
    workflow: [
      { phase: "Design", steps: [
        "Confirm print item(s) & sizes needed",
        "Collect brand assets & copy",
        "First design concept (1–2 variations)",
        "Client feedback & revisions (up to 2 rounds)",
        "Final print-ready file delivery (PDF, AI, PNG)",
      ]},
    ],
  },
  {
    id: "domain_hosting_email",
    name: "Domain, Hosting & Email",
    type: "Add-On",
    setup: "R800 setup",
    monthly: "R300/mo",
    annual: "—",
    description: "Domain registration, website hosting, SSL certificate and professional email setup (e.g. info@business.co.za).",
    color: "text-[#6366f1]",
    bucket: "B",
    workflow: [
      { phase: "Setup", steps: [
        "Domain name registration (.co.za or .com)",
        "Hosting account setup & configuration",
        "SSL certificate installation",
        "Professional email accounts setup (up to 3)",
        "DNS records configuration",
        "Client email app setup (Gmail / Outlook)",
      ]},
      { phase: "Annual / Monthly", steps: [
        "Domain renewal management",
        "Hosting uptime monitoring",
        "SSL renewal",
        "Email support",
      ]},
    ],
  },
  {
    id: "website_maintenance",
    name: "Website Maintenance",
    type: "Add-On",
    setup: "Included",
    monthly: "Recurring",
    annual: "—",
    description: "Ongoing website updates, security patches, uptime monitoring and content changes.",
    color: "text-[#84cc16]",
    bucket: "C",
    workflow: [
      { phase: "Ongoing Monthly", steps: [
        "Uptime monitoring & alerts",
        "WordPress / platform plugin & theme updates",
        "Security scan & malware check",
        "Up to 2 content change requests per month",
        "Monthly website health report",
        "Backup verification",
      ]},
    ],
  },
  {
    id: "paid_ads_management",
    name: "Paid Ads Management",
    type: "Add-On",
    setup: "Included in setup",
    monthly: "Recurring + % of ad spend",
    annual: "—",
    description: "Meta (Facebook/Instagram) and Google Ads campaign management — strategy, creative, targeting & optimisation.",
    color: "text-[#a764e6]",
    bucket: "D",
    workflow: [
      { phase: "Setup", steps: [
        "Ad account access & Business Manager setup",
        "Campaign objective & target audience definition",
        "Ad creative design (static + video)",
        "Pixel / conversion tracking setup",
        "Campaign launch & initial budget set",
      ]},
      { phase: "Monthly", steps: [
        "Daily performance monitoring",
        "A/B test ad creatives & copy",
        "Audience & budget optimisation",
        "New creative production as needed",
        "Monthly paid ads performance report",
        "Client approval for budget changes",
      ]},
    ],
  },
  {
    id: "ecommerce_setup",
    name: "E-Commerce Setup",
    type: "Add-On",
    setup: "From R4,500 once-off",
    monthly: "Optional maintenance",
    annual: "—",
    description: "Full e-commerce store setup (WooCommerce / Shopify) with products, payments and shipping configured.",
    color: "text-[#22c55e]",
    bucket: "B",
    workflow: [
      { phase: "Setup", steps: [
        "Platform selection (WooCommerce / Shopify)",
        "Store design & theme configuration",
        "Product catalogue upload (up to 30 products)",
        "Payment gateway setup (PayFast / Yoco / PayGate)",
        "Shipping zones & courier integration",
        "Tax settings & invoice configuration",
        "Client walkthrough & training",
        "Go-live & test order",
      ]},
      { phase: "Post-Launch (Optional)", steps: [
        "Monthly product updates",
        "Order management support",
        "Conversion optimisation",
        "Monthly sales report",
      ]},
    ],
  },
  {
    id: "business_plan",
    name: "Business Plan",
    type: "Add-On",
    setup: "From R3,500 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "Professional business plan document for funding applications, CIPC registration or strategic planning.",
    color: "text-[#94a3b8]",
    bucket: "A",
    workflow: [
      { phase: "Discovery", steps: [
        "Client business information gathering session",
        "Market & industry research",
        "Financial projections input collection",
        "Competitor landscape review",
      ]},
      { phase: "Delivery", steps: [
        "Executive summary & business overview",
        "Market analysis & target audience",
        "Operations & management plan",
        "3-year financial projections",
        "Client review & revisions (1 round)",
        "Final PDF delivery",
      ]},
    ],
  },
  {
    id: "website_design_only",
    name: "Website Design Only",
    type: "Add-On",
    setup: "From R2,500 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "Standalone website design & build without a monthly package — ideal for once-off website clients.",
    color: "text-[#38bdf8]",
    bucket: "A",
    workflow: [
      { phase: "Design & Build", steps: [
        "Client brief & reference sites discussion",
        "Collect brand assets & copy",
        "Website wireframe / mockup approval",
        "Full website build (3–5 pages)",
        "Mobile responsiveness & speed optimisation",
        "SEO basics setup",
        "2 rounds of revisions",
        "Go-live & handover",
      ]},
    ],
  },
  {
    id: "business_plan_website_bundle",
    name: "Business Plan + Website Bundle",
    type: "Add-On",
    setup: "From R5,500 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "Bundled business plan + professional website — ideal for new businesses launching their brand.",
    color: "text-[#c084fc]",
    bucket: "A",
    workflow: [
      { phase: "Business Plan", steps: [
        "All Business Plan steps (see Business Plan add-on)",
      ]},
      { phase: "Website", steps: [
        "All Website Design Only steps (see Website Design add-on)",
        "Cross-link business plan branding with website design",
        "Bundle delivery & client handover",
      ]},
    ],
  },
];

const BUCKET_LABELS = {
  A: { label: "Bucket A", desc: "Once-off", color: "text-[#f59e0b] border-[#f59e0b]/30 bg-[#f59e0b]/10" },
  B: { label: "Bucket B", desc: "Setup + Recurring", color: "text-primary border-primary/30 bg-primary/10" },
  C: { label: "Bucket C", desc: "Pure Recurring", color: "text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10" },
  D: { label: "Bucket D", desc: "Paid Ads", color: "text-accent border-accent/30 bg-accent/10" },
};

export default function Products() {
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState("all");

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const types = ["all", "Core Package", "Pulse Package", "Add-On"];
  const filtered = filter === "all" ? PRODUCTS : PRODUCTS.filter(p => p.type === filter);

  return (
    <AppLayout title="Products & Workflows" subtitle="All packages, add-ons, pricing and delivery checklists">

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === t ? "gradient-bg text-white" : "glass text-muted-foreground hover:text-foreground"}`}
          >
            {t === "all" ? `All Products (${PRODUCTS.length})` : `${t} (${PRODUCTS.filter(p => p.type === t).length})`}
          </button>
        ))}
      </div>

      {/* Summary table */}
      <div className="glass rounded-xl overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Product</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Setup Fee</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Monthly</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium hidden lg:table-cell">Annual / Term</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Comm. Bucket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge className="border text-xs bg-transparent border-white/20 text-muted-foreground">{p.type}</Badge>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${p.color}`}>{p.setup}</td>
                  <td className="px-4 py-3 text-foreground hidden md:table-cell">{p.monthly}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.annual}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {p.bucket && BUCKET_LABELS[p.bucket] && (
                      <Badge className={`border text-xs ${BUCKET_LABELS[p.bucket].color}`}>
                        {BUCKET_LABELS[p.bucket].label} · {BUCKET_LABELS[p.bucket].desc}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workflow Checklists */}
      <div className="space-y-3">
        {filtered.map(p => (
          <div key={p.id} className="glass rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(p.id)}
              className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-lg gradient-bg-subtle flex items-center justify-center shrink-0 border border-white/10">
                <Package className={`w-4 h-4 ${p.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <Badge className="border text-xs bg-transparent border-white/20 text-muted-foreground">{p.type}</Badge>
                  {p.bucket && BUCKET_LABELS[p.bucket] && (
                    <Badge className={`border text-xs ${BUCKET_LABELS[p.bucket].color}`}>{BUCKET_LABELS[p.bucket].label}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className={`text-sm font-bold ${p.color}`}>{p.setup}</p>
                  <p className="text-xs text-muted-foreground">{p.monthly}</p>
                </div>
                {expanded[p.id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {expanded[p.id] && (
              <div className="border-t border-white/10 px-4 pb-4 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {p.workflow.map(phase => (
                    <div key={phase.phase} className="rounded-xl bg-white/4 p-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{phase.phase}</p>
                      <ul className="space-y-2">
                        {phase.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </AppLayout>
  );
}