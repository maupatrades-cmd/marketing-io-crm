import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";

export default function LeadQualificationForm({ initialData = {}, onSave }) {
  const [expanded, setExpanded] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [criteria, setCriteria] = useState(
    initialData.warm_lead_criteria_v2 || {
      has_business_premises: { answer: null, notes: "" },
      has_trading_history: { answer: null, notes: "" },
      decision_maker_contacted: { answer: null, notes: "" },
      has_budget_indication: { answer: null, notes: "" },
      expressed_interest: { answer: null, notes: "" },
      follow_up_agreed: { answer: null, notes: "" },
      permission_to_contact: { answer: null, notes: "" },
    }
  );

  const [extras, setExtras] = useState(
    initialData.qualification_extras || {
      monthly_revenue_band: "",
      industry_vertical: "",
      employee_band: "",
      decision_timeline: "",
      marketing_situation: [],
      package_interest: [],
      lead_temperature: null,
      best_followup_time: "",
      best_followup_days: [],
      qualifier_notes: "",
    }
  );

  const CRITERIA_DEFINITIONS = [
    {
      key: "has_business_premises",
      label: "Business premises",
      question: "Does the lead have a registered or operational business location?",
      placeholder: "e.g., Owns a storefront in Polokwane CBD, owns the building, been operating 4 years...",
    },
    {
      key: "has_trading_history",
      label: "Trading history",
      question: "Has the lead been operating for at least 6 months?",
      placeholder: "e.g., Started 2020, grew through delivery, now has ~400 regular customers...",
    },
    {
      key: "decision_maker_contacted",
      label: "Decision-maker present",
      question: "Are you speaking to the owner or someone with budget authority?",
      placeholder: "e.g., Sipho is sole owner, no partners, makes all marketing decisions...",
    },
    {
      key: "has_budget_indication",
      label: "Budget readiness",
      question: "Has the lead indicated they have or can access budget for marketing?",
      placeholder: "e.g., Has saved R30k for marketing this quarter, considering FNC funding...",
    },
    {
      key: "expressed_interest",
      label: "Specific pain identified",
      question: "Has the lead articulated a specific problem they need solved?",
      placeholder: "e.g., Wants to expand catering side, needs visibility outside current area...",
    },
    {
      key: "follow_up_agreed",
      label: "Follow-up agreed",
      question: "Did the lead agree to a follow-up conversation or meeting?",
      placeholder: "e.g., Agreed to in-person visit Friday 14 May at 10am at the butchery...",
    },
    {
      key: "permission_to_contact",
      label: "Permission to contact",
      question: "Did the lead grant permission to contact them via phone, email, WhatsApp?",
      placeholder: "e.g., WhatsApp preferred for quick questions, phone calls 8am-4pm Mon-Fri...",
    },
  ];

  const handleCriterionAnswer = (key, answer) => {
    setCriteria((prev) => ({
      ...prev,
      [key]: { ...prev[key], answer },
    }));
  };

  const handleCriterionNotes = (key, notes) => {
    setCriteria((prev) => ({
      ...prev,
      [key]: { ...prev[key], notes },
    }));
  };

  const handleExtraChange = (field, value) => {
    setExtras((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMultiselectToggle = (field, item) => {
    setExtras((prev) => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item],
      };
    });
  };

  const handleDayToggle = (day) => {
    handleMultiselectToggle("best_followup_days", day);
  };

  const completedCriteria = Object.values(criteria).filter((c) => c.answer !== null).length;
  const totalCriteria = Object.keys(criteria).length;
  const isFullyQualified =
    completedCriteria === totalCriteria && extras.lead_temperature !== null;

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await onSave({
        warm_lead_criteria_v2: criteria,
        qualification_extras: extras,
        qualified_at: new Date().toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass rounded-xl border border-border/50">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="font-semibold text-foreground">Lead Qualification</p>
            <p className="text-xs text-muted-foreground">
              {completedCriteria}/{totalCriteria} criteria completed
              {extras.lead_temperature && ` • Temperature: ${extras.lead_temperature}`}
            </p>
          </div>
          {isFullyQualified && (
            <Badge className="ml-2 bg-success/20 text-success border-0">Fully Qualified</Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Form Content */}
      {expanded && (
        <div className="border-t border-border/50 p-6 space-y-6">
          {/* 7 Qualification Criteria */}
          <div className="space-y-6">
            <p className="text-sm font-semibold text-foreground">The 7 Qualification Criteria</p>

            {CRITERIA_DEFINITIONS.map(({ key, label, question, placeholder }) => (
              <div
                key={key}
                className="bg-secondary/20 rounded-lg p-4 space-y-3 border border-border/30"
              >
                {/* Question + Yes/No */}
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">{question}</p>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={key}
                        value="yes"
                        checked={criteria[key]?.answer === "yes"}
                        onChange={() => handleCriterionAnswer(key, "yes")}
                        className="rounded-full"
                      />
                      <span className="text-sm text-foreground">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={key}
                        value="no"
                        checked={criteria[key]?.answer === "no"}
                        onChange={() => handleCriterionAnswer(key, "no")}
                        className="rounded-full"
                      />
                      <span className="text-sm text-foreground">No</span>
                    </label>
                  </div>
                </div>

                {/* Notes Field */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Details (optional but encouraged)
                  </label>
                  <Textarea
                    placeholder={placeholder}
                    value={criteria[key]?.notes || ""}
                    onChange={(e) => handleCriterionNotes(key, e.target.value)}
                    className="min-h-20 bg-secondary/50 border-border/50 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Additional Context Fields */}
          <div className="space-y-6 pt-4 border-t border-border/50">
            <p className="text-sm font-semibold text-foreground">Additional Context (optional)</p>

            {/* Monthly Revenue */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Estimated monthly revenue
              </label>
              <select
                value={extras.monthly_revenue_band || ""}
                onChange={(e) => handleExtraChange("monthly_revenue_band", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-secondary/50 text-foreground text-sm"
              >
                <option value="">Select...</option>
                <option value="under_20k">Under R20k</option>
                <option value="20k_50k">R20k - R50k</option>
                <option value="50k_150k">R50k - R150k</option>
                <option value="150k_500k">R150k - R500k</option>
                <option value="500k_plus">R500k+</option>
                <option value="prefer_not_say">Prefer not to say</option>
              </select>
            </div>

            {/* Industry */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Industry vertical
              </label>
              <select
                value={extras.industry_vertical || ""}
                onChange={(e) => handleExtraChange("industry_vertical", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-secondary/50 text-foreground text-sm"
              >
                <option value="">Select...</option>
                <option value="retail">Retail</option>
                <option value="food_beverage">Food & Beverage</option>
                <option value="beauty_salons">Beauty & Salons</option>
                <option value="construction">Construction</option>
                <option value="professional_services">Professional Services</option>
                <option value="health_wellness">Health & Wellness</option>
                <option value="education">Education</option>
                <option value="automotive">Automotive</option>
                <option value="township_sme">Township SME</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Employees */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Number of employees
              </label>
              <select
                value={extras.employee_band || ""}
                onChange={(e) => handleExtraChange("employee_band", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-secondary/50 text-foreground text-sm"
              >
                <option value="">Select...</option>
                <option value="just_me">Just me</option>
                <option value="2_5">2-5</option>
                <option value="6_10">6-10</option>
                <option value="11_25">11-25</option>
                <option value="26_50">26-50</option>
                <option value="50_plus">50+</option>
              </select>
            </div>

            {/* Decision Timeline */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Decision timeline
              </label>
              <select
                value={extras.decision_timeline || ""}
                onChange={(e) => handleExtraChange("decision_timeline", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-secondary/50 text-foreground text-sm"
              >
                <option value="">Select...</option>
                <option value="this_week">This week</option>
                <option value="this_month">This month</option>
                <option value="30_60_days">Next 30-60 days</option>
                <option value="just_exploring">Just exploring</option>
                <option value="unsure">Unsure</option>
              </select>
            </div>

            {/* Marketing Situation */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Current marketing situation
              </label>
              <div className="space-y-2">
                {[
                  { id: "no_marketing", label: "No marketing at all" },
                  { id: "diy_social", label: "DIY social media" },
                  { id: "has_marketing_person", label: "Has a marketing person" },
                  { id: "used_agency_before", label: "Used another agency before" },
                  { id: "has_website", label: "Has a website" },
                  { id: "has_logo", label: "Has a logo" },
                  { id: "other", label: "Other" },
                ].map(({ id, label }) => (
                  <label key={id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(extras.marketing_situation || []).includes(id)}
                      onChange={() => handleMultiselectToggle("marketing_situation", id)}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Package Interest */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Package interest indicated
              </label>
              <div className="space-y-2">
                {[
                  { id: "ignite", label: "Ignite" },
                  { id: "accelerate", label: "Accelerate" },
                  { id: "dominate", label: "Dominate" },
                  { id: "street_pulse", label: "Street Pulse" },
                  { id: "township_pulse", label: "Township Pulse" },
                  { id: "addons", label: "Add-ons" },
                  { id: "not_sure", label: "Not sure yet" },
                ].map(({ id, label }) => (
                  <label key={id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(extras.package_interest || []).includes(id)}
                      onChange={() => handleMultiselectToggle("package_interest", id)}
                      className="rounded"
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Lead Temperature - REQUIRED */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <label className="text-sm font-medium text-foreground block mb-3">
                Lead temperature *
              </label>
              <div className="space-y-2">
                {[
                  { value: "cold", label: "Cold (just researching)", color: "bg-blue-500/20 text-blue-400" },
                  { value: "warm", label: "Warm (showing interest)", color: "bg-amber-500/20 text-amber-400" },
                  { value: "hot", label: "Hot (ready to buy)", color: "bg-rose-500/20 text-rose-400" },
                ].map(({ value, label, color }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lead_temperature"
                      value={value}
                      checked={extras.lead_temperature === value}
                      onChange={() => handleExtraChange("lead_temperature", value)}
                      className="rounded-full"
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Best Follow-up Time */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground block">
                Best follow-up time
              </label>
              <Input
                type="time"
                value={extras.best_followup_time || ""}
                onChange={(e) => handleExtraChange("best_followup_time", e.target.value)}
                className="bg-secondary/50 border-border/50"
                placeholder="e.g., 10:00"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Days</p>
                <div className="flex flex-wrap gap-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <button
                      key={day}
                      onClick={() => handleDayToggle(day)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        (extras.best_followup_days || []).includes(day)
                          ? "bg-primary text-white"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Free-text Notes */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Additional qualifier notes
              </label>
              <Textarea
                placeholder="Anything else worth noting: lead's tone, family circumstances, related referrals, language preference, accessibility needs, etc."
                value={extras.qualifier_notes || ""}
                onChange={(e) => handleExtraChange("qualifier_notes", e.target.value)}
                className="min-h-24 bg-secondary/50 border-border/50 text-sm"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
            <Button
              onClick={handleSave}
              disabled={submitting || (!completedCriteria && !extras.lead_temperature)}
              className="gap-2"
            >
              {isFullyQualified ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Save Qualification
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  Save Progress
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}