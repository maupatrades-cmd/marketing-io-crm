import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Pencil, Save, X } from "lucide-react";

const INDUSTRY_OPTIONS = [
  { value: "retail", label: "Retail / Shop" },
  { value: "services", label: "Services" },
  { value: "construction", label: "Construction / Trades" },
  { value: "hospitality", label: "Hospitality / Food" },
  { value: "beauty", label: "Beauty / Salon" },
  { value: "health", label: "Health / Wellness" },
  { value: "professional", label: "Professional Services" },
  { value: "education", label: "Education / Training" },
  { value: "other", label: "Other" },
];

const YEARS_OPTIONS = [
  { value: "starting", label: "Just starting out" },
  { value: "less_than_1", label: "Less than 1 year" },
  { value: "1_to_3", label: "1 – 3 years" },
  { value: "3_to_5", label: "3 – 5 years" },
  { value: "5_to_10", label: "5 – 10 years" },
  { value: "10_plus", label: "10+ years" },
];

const EMPLOYEES_OPTIONS = [
  { value: "just_me", label: "Just me" },
  { value: "2_to_5", label: "2 – 5" },
  { value: "6_to_15", label: "6 – 15" },
  { value: "16_to_50", label: "16 – 50" },
  { value: "50_plus", label: "50+" },
];

const PROVINCE_OPTIONS = [
  { value: "gauteng", label: "Gauteng" },
  { value: "western_cape", label: "Western Cape" },
  { value: "kwazulu_natal", label: "KwaZulu-Natal" },
  { value: "eastern_cape", label: "Eastern Cape" },
  { value: "free_state", label: "Free State" },
  { value: "limpopo", label: "Limpopo" },
  { value: "mpumalanga", label: "Mpumalanga" },
  { value: "north_west", label: "North West" },
  { value: "northern_cape", label: "Northern Cape" },
];

const GOAL_OPTIONS = [
  { value: "same_steady", label: "Stay where I am — steady and stable" },
  { value: "double_revenue", label: "Double revenue" },
  { value: "five_x_growth", label: "5× growth" },
  { value: "sell_business", label: "Sell the business" },
  { value: "open_branches", label: "Open more branches" },
];

const CHALLENGE_OPTIONS = [
  { value: "not_enough_leads", label: "Not getting enough leads" },
  { value: "customers_dont_return", label: "Customers don't return" },
  { value: "cant_compete", label: "Can't compete with bigger players" },
  { value: "dont_know_marketing", label: "Doesn't know marketing" },
  { value: "too_busy_doing_work", label: "Too busy to market" },
  { value: "bad_reputation", label: "Online reputation hurting" },
  { value: "all_above", label: "All of the above" },
];

const REVENUE_OPTIONS = [
  { value: "under_20k", label: "Under R20,000" },
  { value: "20k_to_50k", label: "R20,000 – R50,000" },
  { value: "50k_to_150k", label: "R50,000 – R150,000" },
  { value: "150k_to_500k", label: "R150,000 – R500,000" },
  { value: "500k_plus", label: "R500,000+" },
];

const CUSTOMERS_OPTIONS = [
  { value: "5_to_10", label: "5 – 10" },
  { value: "10_to_25", label: "10 – 25" },
  { value: "25_to_50", label: "25 – 50" },
  { value: "50_to_100", label: "50 – 100" },
  { value: "100_plus", label: "100+" },
];

const URGENCY_OPTIONS = [
  { value: "yesterday", label: "I needed it yesterday" },
  { value: "within_1_month", label: "Within 1 month" },
  { value: "within_3_months", label: "Within 3 months" },
  { value: "planning_ahead", label: "Planning ahead" },
  { value: "no_rush", label: "No rush — just looking" },
];

const BUDGET_OPTIONS = [
  { value: "under_500", label: "Under R500" },
  { value: "500_to_1500", label: "R500 – R1,500" },
  { value: "1500_to_3000", label: "R1,500 – R3,000" },
  { value: "3000_to_7000", label: "R3,000 – R7,000" },
  { value: "7000_plus", label: "R7,000+" },
];

const AGENCY_OPTIONS = [
  { value: "yes_didnt_work", label: "Yes — but it didn't work" },
  { value: "yes_too_expensive", label: "Yes — but too expensive" },
  { value: "never", label: "Never used one" },
  { value: "tried_diy", label: "Tried DIY" },
];

const CALL_TIME_OPTIONS = [
  { value: "morning", label: "Morning (08:00 – 12:00)" },
  { value: "lunch", label: "Lunch (12:00 – 14:00)" },
  { value: "afternoon", label: "Afternoon (14:00 – 17:00)" },
  { value: "evening", label: "Evening (17:00 – 20:00)" },
  { value: "weekend_only", label: "Weekends only" },
];

const ASSETS_OPTIONS = [
  { value: "website", label: "Working website" },
  { value: "whatsapp_automation", label: "WhatsApp automation" },
  { value: "active_social", label: "Active social media" },
  { value: "gmb_claimed", label: "Google Business Profile claimed" },
  { value: "paid_ads", label: "Running paid ads" },
  { value: "email_marketing", label: "Email marketing" },
  { value: "crm", label: "CRM in use" },
];

const CONTACT_CHANNEL_OPTIONS = [
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

function DF({ label, children }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function DSel({ label, value, onChange, options, placeholder = "Select…" }) {
  return (
    <DF label={label}>
      <Select value={value || ""} onValueChange={onChange}>
        <SelectTrigger className="bg-secondary/50 border-border/50">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </DF>
  );
}

function MultiCheckbox({ label, value = [], onChange, options }) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (v) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  };
  return (
    <DF label={label}>
      <div className="flex flex-wrap gap-2 mt-1">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`px-3 py-1 rounded-full text-xs border transition-all ${
              selected.includes(o.value)
                ? "bg-primary/20 border-primary text-primary"
                : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </DF>
  );
}

export default function DiscoveryTab({ client, clientId, onSaved }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildForm = (c) => ({
    industry: c.industry || "",
    years_in_business: c.years_in_business || "",
    number_of_employees: c.number_of_employees || "",
    business_city: c.business_city || "",
    business_address: c.business_address || "",
    business_province: c.business_province || "",
    twelve_month_goal: c.twelve_month_goal || "",
    biggest_challenge: c.biggest_challenge || "",
    founder_inspiration: c.founder_inspiration || "",
    competitor_envy: c.competitor_envy || "",
    monthly_revenue_range: c.monthly_revenue_range || "",
    new_customers_target: c.new_customers_target || "",
    urgency_level: c.urgency_level || "",
    current_marketing_assets: Array.isArray(c.current_marketing_assets) ? c.current_marketing_assets : [],
    agency_history: c.agency_history || "",
    monthly_marketing_budget: c.monthly_marketing_budget || "",
    preferred_contact_channels: Array.isArray(c.preferred_contact_channels) ? c.preferred_contact_channels : [],
    best_call_time: c.best_call_time || "",
    wants_consultation_call: c.wants_consultation_call ?? false,
    wants_personalized_proposal: c.wants_personalized_proposal ?? false,
  });

  const [form, setForm] = useState(() => buildForm(client));

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const handleEdit = () => {
    setForm(buildForm(client));
    setEditing(true);
  };

  const handleCancel = () => setEditing(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Client.update(clientId, form);
      await onSaved();
      setEditing(false);
      toast({ title: "Discovery info saved" });
    } catch (err) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const HUMAN = {
    industry: INDUSTRY_OPTIONS, years_in_business: YEARS_OPTIONS, number_of_employees: EMPLOYEES_OPTIONS,
    business_province: PROVINCE_OPTIONS, twelve_month_goal: GOAL_OPTIONS, biggest_challenge: CHALLENGE_OPTIONS,
    monthly_revenue_range: REVENUE_OPTIONS, new_customers_target: CUSTOMERS_OPTIONS, urgency_level: URGENCY_OPTIONS,
    monthly_marketing_budget: BUDGET_OPTIONS, agency_history: AGENCY_OPTIONS, best_call_time: CALL_TIME_OPTIONS,
  };
  const label = (key, val) => {
    if (!val) return "—";
    const opts = HUMAN[key];
    if (!opts) return val;
    const found = opts.find(o => o.value === val);
    return found ? found.label : val;
  };
  const labelList = (key, arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return "—";
    const opts = HUMAN[key] || [];
    return arr.map(v => opts.find(o => o.value === v)?.label || v).join(", ");
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg">Lead Discovery</h3>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={handleEdit} className="gap-2">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleCancel} className="gap-1"><X className="w-3.5 h-3.5" /> Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gradient-bg text-white gap-1">
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Business Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Business Info</h4>
              <DSel label="Industry" value={form.industry} onChange={set("industry")} options={INDUSTRY_OPTIONS} />
              <DSel label="Years in business" value={form.years_in_business} onChange={set("years_in_business")} options={YEARS_OPTIONS} />
              <DSel label="Team size" value={form.number_of_employees} onChange={set("number_of_employees")} options={EMPLOYEES_OPTIONS} />
              <DF label="City / Town">
                <Input value={form.business_city} onChange={e => set("business_city")(e.target.value)} className="bg-secondary/50 border-border/50" placeholder="e.g. Johannesburg" />
              </DF>
              <DF label="Physical Address">
                <Input value={form.business_address} onChange={e => set("business_address")(e.target.value)} className="bg-secondary/50 border-border/50" placeholder="Street address" />
              </DF>
              <DSel label="Province" value={form.business_province} onChange={set("business_province")} options={PROVINCE_OPTIONS} />
            </div>

            {/* Story */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Their Story</h4>
              <DSel label="12-month goal" value={form.twelve_month_goal} onChange={set("twelve_month_goal")} options={GOAL_OPTIONS} />
              <DSel label="Biggest challenge" value={form.biggest_challenge} onChange={set("biggest_challenge")} options={CHALLENGE_OPTIONS} />
              <DF label="What inspired them">
                <Textarea value={form.founder_inspiration} onChange={e => set("founder_inspiration")(e.target.value)} className="bg-secondary/50 border-border/50 h-20" placeholder="Free text…" />
              </DF>
              <DF label="Competitor envy">
                <Textarea value={form.competitor_envy} onChange={e => set("competitor_envy")(e.target.value)} className="bg-secondary/50 border-border/50 h-20" placeholder="Who do they admire or want to beat?" />
              </DF>
            </div>

            {/* Current State */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Current State</h4>
              <DSel label="Monthly revenue" value={form.monthly_revenue_range} onChange={set("monthly_revenue_range")} options={REVENUE_OPTIONS} />
              <DSel label="New customers wanted" value={form.new_customers_target} onChange={set("new_customers_target")} options={CUSTOMERS_OPTIONS} />
              <DSel label="Urgency" value={form.urgency_level} onChange={set("urgency_level")} options={URGENCY_OPTIONS} />
              <MultiCheckbox label="Marketing assets they have" value={form.current_marketing_assets} onChange={set("current_marketing_assets")} options={ASSETS_OPTIONS} />
              <DSel label="Agency history" value={form.agency_history} onChange={set("agency_history")} options={AGENCY_OPTIONS} />
            </div>

            {/* Preferences */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">How To Reach Them</h4>
              <DSel label="Marketing budget" value={form.monthly_marketing_budget} onChange={set("monthly_marketing_budget")} options={BUDGET_OPTIONS} />
              <MultiCheckbox label="Preferred contact channels" value={form.preferred_contact_channels} onChange={set("preferred_contact_channels")} options={CONTACT_CHANNEL_OPTIONS} />
              <DSel label="Best call time" value={form.best_call_time} onChange={set("best_call_time")} options={CALL_TIME_OPTIONS} />
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!form.wants_consultation_call} onChange={e => set("wants_consultation_call")(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">Wants consultation call</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={!!form.wants_personalized_proposal} onChange={e => set("wants_personalized_proposal")(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">Wants personalized proposal</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Business Info</h4>
              <dl className="space-y-2 text-sm">
                <DRow label="Industry" value={label("industry", client.industry)} />
                <DRow label="Years in business" value={label("years_in_business", client.years_in_business)} />
                <DRow label="Team size" value={label("number_of_employees", client.number_of_employees)} />
                <DRow label="City" value={client.business_city || "—"} />
                <DRow label="Address" value={client.business_address || "—"} />
                <DRow label="Province" value={label("business_province", client.business_province)} />
              </dl>
            </div>
            <div>
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Their Story</h4>
              <dl className="space-y-2 text-sm">
                <DRow label="12-month goal" value={label("twelve_month_goal", client.twelve_month_goal)} />
                <DRow label="Biggest challenge" value={label("biggest_challenge", client.biggest_challenge)} />
                <DRow label="What inspired them" value={client.founder_inspiration || "—"} multiline />
                <DRow label="Competitor envy" value={client.competitor_envy || "—"} multiline />
              </dl>
            </div>
            <div>
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Current State</h4>
              <dl className="space-y-2 text-sm">
                <DRow label="Monthly revenue" value={label("monthly_revenue_range", client.monthly_revenue_range)} />
                <DRow label="New customers wanted" value={label("new_customers_target", client.new_customers_target)} />
                <DRow label="Urgency" value={label("urgency_level", client.urgency_level)} />
                <DRow label="Marketing assets" value={labelList("current_marketing_assets", client.current_marketing_assets)} />
                <DRow label="Agency history" value={label("agency_history", client.agency_history)} />
              </dl>
            </div>
            <div>
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">How To Reach Them</h4>
              <dl className="space-y-2 text-sm">
                <DRow label="Marketing budget" value={label("monthly_marketing_budget", client.monthly_marketing_budget)} />
                <DRow label="Preferred channels" value={labelList("preferred_contact_channels", client.preferred_contact_channels)} />
                <DRow label="Best call time" value={label("best_call_time", client.best_call_time)} />
                <DRow label="Wants consultation call" value={client.wants_consultation_call ? "Yes" : "No"} />
                <DRow label="Wants personalized proposal" value={client.wants_personalized_proposal ? "Yes" : "No"} />
              </dl>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DRow({ label, value, multiline = false }) {
  return (
    <div className={multiline ? "" : "flex items-baseline justify-between gap-3"}>
      <dt className="text-xs text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-foreground ${multiline ? "mt-1 whitespace-pre-wrap" : "text-right"}`}>{value}</dd>
    </div>
  );
}