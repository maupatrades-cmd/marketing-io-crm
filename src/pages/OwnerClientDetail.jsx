import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, FileText, Phone, Clock, AlertCircle } from "lucide-react";
import ActivityFeed from "@/components/activity/ActivityFeed";
import { getCurrentUser } from "@/lib/customAuth";

const TABS = [
  "overview", "discovery", "contacts", "deals", "invoices", "deliverables",
  "communications", "files", "activity", "audit"
];

const LEAD_SCORE_BADGES = {
  hot:         { label: "Hot",         emoji: "🔥", className: "bg-destructive/15 text-destructive border-destructive/40" },
  warm:        { label: "Warm",        emoji: "☀️", className: "bg-orange-500/15 text-orange-400 border-orange-500/40" },
  nurture:     { label: "Nurture",     emoji: "🌱", className: "bg-success/15 text-success border-success/40" },
  cold:        { label: "Cold",        emoji: "❄️", className: "bg-muted/40 text-muted-foreground border-border/40" },
  unqualified: { label: "Unqualified", emoji: "—",  className: "bg-muted/30 text-muted-foreground/70 border-border/30" }
};

const HUMAN_LABELS = {
  // industry
  retail: "Retail / Shop", services: "Services", construction: "Construction / Trades",
  hospitality: "Hospitality / Food", beauty: "Beauty / Salon", health: "Health / Wellness",
  professional: "Professional Services", education: "Education / Training", other: "Other",
  // years_in_business
  starting: "Just starting out", less_than_1: "Less than 1 year", "1_to_3": "1 – 3 years",
  "3_to_5": "3 – 5 years", "5_to_10": "5 – 10 years", "10_plus": "10+ years",
  // employees
  just_me: "Just me", "2_to_5": "2 – 5", "6_to_15": "6 – 15", "16_to_50": "16 – 50", "50_plus": "50+",
  // provinces
  gauteng: "Gauteng", western_cape: "Western Cape", kwazulu_natal: "KwaZulu-Natal",
  eastern_cape: "Eastern Cape", free_state: "Free State", limpopo: "Limpopo",
  mpumalanga: "Mpumalanga", north_west: "North West", northern_cape: "Northern Cape",
  // goals
  same_steady: "Stay where I am — steady and stable", double_revenue: "Double revenue",
  five_x_growth: "5× growth", sell_business: "Sell the business", open_branches: "Open more branches",
  // challenges
  not_enough_leads: "Not getting enough leads", customers_dont_return: "Customers don't return",
  cant_compete: "Can't compete with bigger players", dont_know_marketing: "Doesn't know marketing",
  too_busy_doing_work: "Too busy to market", bad_reputation: "Online reputation hurting",
  all_above: "All of the above",
  // revenue
  under_20k: "Under R20,000", "20k_to_50k": "R20,000 – R50,000", "50k_to_150k": "R50,000 – R150,000",
  "150k_to_500k": "R150,000 – R500,000", "500k_plus": "R500,000+",
  // new customers
  "5_to_10": "5 – 10", "10_to_25": "10 – 25", "25_to_50": "25 – 50",
  "50_to_100": "50 – 100", "100_plus": "100+",
  // urgency
  yesterday: "I needed it yesterday", within_1_month: "Within 1 month", within_3_months: "Within 3 months",
  planning_ahead: "Planning ahead", no_rush: "No rush — just looking",
  // budget
  under_500: "Under R500", "500_to_1500": "R500 – R1,500", "1500_to_3000": "R1,500 – R3,000",
  "3000_to_7000": "R3,000 – R7,000", "7000_plus": "R7,000+",
  // assets
  website: "Working website", whatsapp_automation: "WhatsApp automation",
  active_social: "Active social media", gmb_claimed: "Google Business Profile claimed",
  paid_ads: "Running paid ads", email_marketing: "Email marketing", crm: "CRM in use",
  // agency
  yes_didnt_work: "Yes — but it didn't work", yes_too_expensive: "Yes — but too expensive",
  never: "Never used one", tried_diy: "Tried DIY",
  // contact channels
  phone: "Phone call", whatsapp: "WhatsApp", email: "Email", sms: "SMS",
  // call times
  morning: "Morning (08:00 – 12:00)", lunch: "Lunch (12:00 – 14:00)",
  afternoon: "Afternoon (14:00 – 17:00)", evening: "Evening (17:00 – 20:00)",
  weekend_only: "Weekends only"
};

const human = (v) => HUMAN_LABELS[v] || v;
const humanList = (arr) => Array.isArray(arr) && arr.length ? arr.map(human).join(", ") : null;
const fmt = (v) => (v === undefined || v === null || v === "") ? "—" : (typeof v === "string" ? human(v) : v);

export default function OwnerClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [activity, setActivity] = useState([]);
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  // viewerRole drives ActivityFeed's actor-info column. The page is route-
  // guarded to admin|owner only, so we just need to know which one.
  const [viewerRole, setViewerRole] = useState("admin");

  useEffect(() => {
    (async () => {
      const me = await getCurrentUser().catch(() => null);
      const role = String(me?.role || "admin").toLowerCase();
      setViewerRole(role === "owner" ? "owner" : "admin");
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [c, d, inv, del, act, f] = await Promise.all([
        base44.entities.Client.list().then(res => Array.isArray(res) ? res.find(x => x.id === id) : res),
        base44.entities.Deal.filter({ client_id: id }),
        base44.entities.Invoice.filter({ client_id: id }),
        base44.entities.Deliverable.filter({ client_id: id }),
        base44.entities.ClientActivityLog.filter({ client_id: id }, "-created_date", 10),
        base44.entities.ClientUpload.filter({ client_id: id }),
      ]);
      
      setClient(c);
      setDeals(Array.isArray(d) ? d : d ? [d] : []);
      setInvoices(Array.isArray(inv) ? inv : inv ? [inv] : []);
      setDeliverables(Array.isArray(del) ? del : del ? [del] : []);
      setActivity(Array.isArray(act) ? act : act ? [act] : []);
      setFiles(Array.isArray(f) ? f : f ? [f] : []);
      setNotes(c?.notes || "");
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!client) return <div className="p-6 text-center text-muted-foreground">Client not found</div>;

  const outstanding = invoices.filter(i => ["issued", "overdue"].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0);
  const monthsAsClient = client.contract_start_date ? Math.floor((new Date() - new Date(client.contract_start_date)) / (1000 * 60 * 60 * 24 * 30)) : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text">{client.business_name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={client.status === "active" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>
                {client.status}
              </Badge>
              {client.lead_score && LEAD_SCORE_BADGES[client.lead_score] && (
                <Badge className={`border ${LEAD_SCORE_BADGES[client.lead_score].className}`}>
                  <span className="mr-1">{LEAD_SCORE_BADGES[client.lead_score].emoji}</span>
                  {LEAD_SCORE_BADGES[client.lead_score].label}
                </Badge>
              )}
              {client.assigned_field_agent && <span className="text-sm text-muted-foreground">Assigned: User {client.assigned_field_agent}</span>}
            </div>
          </div>
          <Button variant="outline">Edit Client</Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-secondary text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* TAB: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Package</p>
                  <p className="text-lg font-bold capitalize">{client.package}</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Monthly Retainer</p>
                  <p className="text-lg font-bold">R{(client.monthly_retainer || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">As Client</p>
                  <p className="text-lg font-bold">{monthsAsClient} months</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Next Renewal</p>
                  <p className="text-lg font-bold">{client.contract_end_date ? new Date(client.contract_end_date).toLocaleDateString("en-ZA") : "N/A"}</p>
                </CardContent>
              </Card>
            </div>

            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {activity.map(a => (
                  <div key={a.id} className="text-sm pb-2 border-b border-border/20 last:border-0">
                    <p className="text-muted-foreground text-xs">{new Date(a.created_date).toLocaleDateString("en-ZA")}</p>
                    <p className="text-foreground">{a.event_label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Internal Notes</h3>
                {!editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                  <Button size="sm" onClick={() => { setEditing(false); base44.entities.Client.update(id, { notes }); }}>Save</Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{notes || "No notes yet"}</p>
              )}
            </div>
          </div>
        )}

        {/* TAB: Discovery — qualifier answers from the 5-step signup */}
        {activeTab === "discovery" && (
          <div className="space-y-6">
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Lead Discovery</h3>
                <p className="text-xs text-muted-foreground">
                  Completed {client.signup_completed_steps || 1}/5 signup steps
                  {client.lead_score_calculated_at ? ` · scored ${new Date(client.lead_score_calculated_at).toLocaleDateString("en-ZA")}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Business Info */}
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Business Info</h4>
                  <dl className="space-y-2 text-sm">
                    <DRow label="Industry" value={fmt(client.industry)} />
                    <DRow label="Years in business" value={fmt(client.years_in_business)} />
                    <DRow label="Team size" value={fmt(client.number_of_employees)} />
                    <DRow label="City" value={fmt(client.business_city)} />
                    <DRow label="Address" value={fmt(client.business_address)} />
                    <DRow label="Province" value={fmt(client.business_province)} />
                  </dl>
                </div>

                {/* Story */}
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Their Story</h4>
                  <dl className="space-y-2 text-sm">
                    <DRow label="12-month goal" value={fmt(client.twelve_month_goal)} />
                    <DRow label="Biggest challenge" value={fmt(client.biggest_challenge)} />
                    <DRow label="What inspired them" value={client.founder_inspiration || "—"} multiline />
                    <DRow label="Competitor envy" value={client.competitor_envy || "—"} multiline />
                  </dl>
                </div>

                {/* Current State */}
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Current State</h4>
                  <dl className="space-y-2 text-sm">
                    <DRow label="Monthly revenue" value={fmt(client.monthly_revenue_range)} />
                    <DRow label="New customers wanted" value={fmt(client.new_customers_target)} />
                    <DRow label="Urgency" value={fmt(client.urgency_level)} />
                    <DRow label="Marketing assets they have" value={humanList(client.current_marketing_assets) || "—"} />
                    <DRow label="Agency history" value={fmt(client.agency_history)} />
                  </dl>
                </div>

                {/* Preferences */}
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">How To Reach Them</h4>
                  <dl className="space-y-2 text-sm">
                    <DRow label="Marketing budget" value={fmt(client.monthly_marketing_budget)} />
                    <DRow label="Preferred channels" value={humanList(client.preferred_contact_channels) || "—"} />
                    <DRow label="Best call time" value={fmt(client.best_call_time)} />
                    <DRow label="Wants consultation call" value={client.wants_consultation_call ? "Yes" : "No"} />
                    <DRow label="Wants personalized proposal" value={client.wants_personalized_proposal ? "Yes" : "No"} />
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Contacts */}
        {activeTab === "contacts" && (
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="pb-4 border-b border-border/40">
              <p className="text-xs text-muted-foreground mb-1">Primary Contact</p>
              <p className="font-semibold">{client.contact_person}</p>
              <p className="text-sm text-muted-foreground">{client.email} • {client.phone}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Communication Preference</p>
              <p className="text-sm capitalize">{client.preferred_communication_channel}</p>
            </div>
          </div>
        )}

        {/* TAB: Deals */}
        {activeTab === "deals" && (
          <div className="space-y-3">
            {deals.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">No deals</div>
            ) : (
              deals.map(d => (
                <div key={d.id} className="glass rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{d.package}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.stage}</p>
                    </div>
                    <span className="font-bold">R{(d.setup_fee + d.monthly_retainer * 12).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Closed: {d.created_date ? new Date(d.created_date).toLocaleDateString("en-ZA") : "pending"}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Invoices */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {outstanding > 0 && (
              <div className="glass rounded-xl p-4 border border-destructive/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-semibold">R{outstanding.toLocaleString()} outstanding</p>
                  <p className="text-xs text-muted-foreground">{invoices.filter(i => ["issued", "overdue"].includes(i.status)).length} unpaid</p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">No invoices</div>
              ) : (
                invoices.map(inv => (
                  <div key={inv.id} className="glass rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inv.created_date).toLocaleDateString("en-ZA")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">R{(inv.total || 0).toLocaleString()}</p>
                      <Badge className={inv.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"} variant="outline" className="text-xs mt-1">
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: Deliverables */}
        {activeTab === "deliverables" && (
          <div className="space-y-3">
            {deliverables.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">No deliverables</div>
            ) : (
              deliverables.map(d => (
                <div key={d.id} className="glass rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{d.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.approval_status}</p>
                    </div>
                    <Badge className="bg-primary/15 text-primary text-xs">{d.service}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Communications */}
        {activeTab === "communications" && (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">No communications</div>
            ) : (
              activity.map(a => (
                <div key={a.id} className="glass rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">{new Date(a.created_date).toLocaleDateString("en-ZA")}</p>
                  <p className="text-sm">{a.event_label}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Files */}
        {activeTab === "files" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {files.length === 0 ? (
              <div className="col-span-3 glass rounded-xl p-8 text-center text-muted-foreground">No files</div>
            ) : (
              files.map(f => (
                <div key={f.id} className="glass rounded-xl p-4">
                  <p className="font-semibold text-sm mb-2 truncate">{f.file_name}</p>
                  <p className="text-xs text-muted-foreground mb-3 capitalize">{f.file_type}</p>
                  <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer">Download</a>
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Activity (Client Portal PR A — full feed with filters + PDF) */}
        {activeTab === "activity" && (
          <div className="glass rounded-xl p-6">
            <ActivityFeed
              clientId={id}
              clientName={client.business_name || client.contact_person || ""}
              viewerRole={viewerRole}
            />
          </div>
        )}

        {/* TAB: Audit (legacy summary kept for back-compat) */}
        {activeTab === "audit" && (
          <div className="glass rounded-xl p-6">
            <p className="text-sm text-muted-foreground mb-4">
              Audit log: all system actions affecting this client are tracked
              under the Activity tab. This summary view shows the most recent
              10 entries.
            </p>
            <div className="space-y-2">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit entries.</p>
              ) : activity.map(a => (
                <div key={a.id} className="text-sm pb-2 border-b border-border/20 last:border-0">
                  <p className="text-muted-foreground text-xs">{new Date(a.created_date).toLocaleString("en-ZA")}</p>
                  <p className="text-foreground">{a.event_summary || a.event_label || a.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}

function DRow({ label, value, multiline = false }) {
  return (
    <div className={multiline ? "" : "flex items-baseline justify-between gap-3"}>
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-foreground ${multiline ? "mt-1 whitespace-pre-wrap" : "text-right"}`}>{value}</dd>
    </div>
  );
}