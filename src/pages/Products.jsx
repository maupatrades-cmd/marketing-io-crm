import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, ChevronUp, Package } from "lucide-react";

const PRODUCTS = [
  {
    id: "ignite",
    name: "Ignite",
    type: "Core Package",
    setup: "R3,980",
    monthly: "R490/mo",
    annual: "R5,880/yr",
    description: "Entry-level digital marketing package for small businesses.",
    color: "text-[#10b981]",
    workflow: [
      { phase: "Onboarding", steps: ["Sign contract & POPIA form", "Collect brand assets (logo, colours, photos)", "Complete onboarding form", "Set up debit order mandate", "Create social media accounts (if needed)"] },
      { phase: "Setup", steps: ["Set up Facebook Business Manager", "Create/optimise Google Business Profile", "Design brand templates (post, story, cover)", "Schedule first 2 weeks of content", "Go-live sign-off from client"] },
      { phase: "Monthly Recurring", steps: ["8 social media posts/month", "Monthly performance report by 5th", "Content approval from client", "Reputation monitoring", "Monthly check-in call"] },
    ],
  },
  {
    id: "accelerate",
    name: "Accelerate",
    type: "Core Package",
    setup: "R6,500",
    monthly: "R890/mo",
    annual: "R10,680/yr",
    description: "Mid-tier package with website + advanced social management.",
    color: "text-primary",
    workflow: [
      { phase: "Onboarding", steps: ["Sign contract & POPIA form", "Collect brand assets", "Complete onboarding form", "Set up debit order", "Kickoff meeting with client"] },
      { phase: "Setup", steps: ["All Ignite setup steps", "5-page website build", "SEO meta setup", "WhatsApp Business integration", "Analytics setup (GA4)", "Hosting & domain configuration", "Client website review & approval"] },
      { phase: "Monthly Recurring", steps: ["12 social media posts/month", "Website maintenance & uptime check", "Monthly report by 5th", "Blog or article post", "Ad boosts (if applicable)", "Monthly strategy call"] },
    ],
  },
  {
    id: "dominate",
    name: "Dominate",
    type: "Core Package",
    setup: "R9,800",
    monthly: "R1,490/mo",
    annual: "R17,880/yr",
    description: "Full-service package for established businesses wanting market dominance.",
    color: "text-accent",
    workflow: [
      { phase: "Onboarding", steps: ["Full discovery & audit meeting", "Sign contract & POPIA", "Brand asset collection", "Competitor analysis", "Strategy document draft"] },
      { phase: "Setup", steps: ["All Accelerate setup steps", "E-commerce or booking integration", "Full SEO audit + implementation", "Email newsletter setup", "CRM onboarding assistance", "Video content setup (reels/shorts)", "Paid ads campaign setup"] },
      { phase: "Monthly Recurring", steps: ["20+ posts across all platforms", "Paid ads management", "Weekly performance summary", "Monthly full report by 5th", "Monthly strategy session", "Reputation management", "Email newsletter (2x/month)"] },
    ],
  },
  {
    id: "street_pulse",
    name: "Street Pulse",
    type: "Pulse Package",
    setup: "R700",
    monthly: "R3,700/mo",
    annual: "3-month contract",
    description: "High-frequency community-focused marketing for local/township businesses.",
    color: "text-warning",
    workflow: [
      { phase: "Onboarding", steps: ["Discovery visit + photography", "Sign 3-month contract", "Collect brand assets", "Community targeting strategy", "Setup WhatsApp broadcast list"] },
      { phase: "Setup", steps: ["Design community post templates", "Set up Facebook community page", "Create WhatsApp status content plan", "Deploy first campaign content", "Google Maps pin + photos"] },
      { phase: "Monthly Recurring", steps: ["Daily/weekly community posts", "WhatsApp campaign blasts", "Event or promo coverage", "Monthly deployment photo report", "Feedback and engagement summary"] },
    ],
  },
  {
    id: "township_pulse",
    name: "Township Pulse",
    type: "Pulse Package",
    setup: "R1,300 once-off",
    monthly: "Once-off",
    annual: "—",
    description: "Single campaign deployment for township businesses. Once-off service.",
    color: "text-[#f97316]",
    workflow: [
      { phase: "Campaign Setup", steps: ["Discover business & take photos", "Design 3 campaign posts", "Community WhatsApp & Facebook blast", "Google Maps update", "Deliver summary to client"] },
    ],
  },
  {
    id: "ai_chatbot",
    name: "AI Chatbot",
    type: "Add-On",
    setup: "Custom",
    monthly: "Recurring",
    annual: "—",
    description: "Automated AI chat assistant for the client's website or WhatsApp.",
    color: "text-[#00ccff]",
    workflow: [
      { phase: "Setup", steps: ["Client FAQ & knowledge base collection", "Chatbot flow design", "Integration with website/WhatsApp", "Test & QA", "Handover to client"] },
      { phase: "Monthly", steps: ["Monitor chat logs", "Update knowledge base", "Performance summary"] },
    ],
  },
  {
    id: "paid_ads",
    name: "Paid Ads Management",
    type: "Add-On",
    setup: "Included in setup",
    monthly: "Recurring",
    annual: "—",
    description: "Meta & Google ad campaign management on behalf of the client.",
    color: "text-[#a764e6]",
    workflow: [
      { phase: "Setup", steps: ["Ad account access & setup", "Campaign objective definition", "Audience targeting", "Creative design (static/video)", "Budget setting & launch"] },
      { phase: "Monthly", steps: ["Ad performance monitoring", "A/B test creatives", "Budget optimisation", "Monthly report", "Client approval for new creatives"] },
    ],
  },
  {
    id: "reputation",
    name: "Reputation Management",
    type: "Add-On",
    setup: "Included",
    monthly: "Recurring",
    annual: "—",
    description: "Monitor, respond to, and improve online reviews across platforms.",
    color: "text-[#ec4899]",
    workflow: [
      { phase: "Setup", steps: ["Audit existing reviews (Google, Facebook, HelloPeter)", "Claim/verify all listings", "Set up monitoring alerts", "Create response templates"] },
      { phase: "Monthly", steps: ["Respond to new reviews within 24h", "Flag negative reviews for client", "Request reviews from happy clients", "Monthly reputation score report"] },
    ],
  },
];

export default function Products() {
  const [expanded, setExpanded] = useState({});
  const [filter, setFilter] = useState("all");

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const types = ["all", "Core Package", "Pulse Package", "Add-On"];
  const filtered = filter === "all" ? PRODUCTS : PRODUCTS.filter(p => p.type === filter);

  return (
    <AppLayout title="Products & Workflows" subtitle="All packages, add-ons, and their delivery checklists">

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === t ? "gradient-bg text-white" : "glass text-muted-foreground hover:text-foreground"}`}
          >
            {t === "all" ? "All Products" : t}
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
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Type</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Setup Fee</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Monthly</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Annual / Term</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3">
                    <Badge className="border text-xs bg-transparent border-white/20 text-muted-foreground">{p.type}</Badge>
                  </td>
                  <td className={`px-4 py-3 font-semibold ${p.color}`}>{p.setup}</td>
                  <td className="px-4 py-3 text-foreground">{p.monthly}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.annual}</td>
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
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <Badge className="border text-xs bg-transparent border-white/20 text-muted-foreground">{p.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm font-bold ${p.color}`}>{p.setup}</span>
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