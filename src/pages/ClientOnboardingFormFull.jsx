import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, Upload } from "lucide-react";

const STEPS = [
  { id: 1, title: "Business Basics", subtitle: "Your company details" },
  { id: 2, title: "Overview", subtitle: "Vision and strategy" },
  { id: 3, title: "Goals & Challenges", subtitle: "What you want to achieve" },
  { id: 4, title: "Brand Assets", subtitle: "Upload logos and materials" },
  { id: 5, title: "Brand Identity", subtitle: "Voice, colors, tone" },
  { id: 6, title: "Digital Footprint", subtitle: "Existing accounts and logins" },
  { id: 7, title: "Payment Methods", subtitle: "How you accept payment" },
  { id: 8, title: "Review & Submit", subtitle: "Final check before sending" },
];

export default function ClientOnboardingFormFull() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = clients[0];
        setClient(c);
        const subs = await base44.entities.ClientOnboardingSubmission.filter({ client_id: c.id });
        if (subs.length > 0) {
          setSubmission(subs[0]);
          setFormData(subs[0]);
        }
      }
      setLoading(false);
    });
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!submission || !client) return;
    const timer = setInterval(async () => {
      await base44.entities.ClientOnboardingSubmission.update(submission.id, formData);
      setLastSaved(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, [submission, formData]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (field, files) => {
    if (!files.length) return;
    const file = files[0];
    const uploaded = await base44.integrations.Core.UploadFile({ file });
    handleInputChange(field, uploaded.file_url);
  };

  const handleSubmit = async () => {
    await base44.entities.ClientOnboardingSubmission.update(submission.id, {
      ...formData,
      submission_status: "submitted",
      submitted_at: new Date().toISOString(),
    });
    // Create notification
    await base44.entities.ClientNotification.create({
      client_id: client.id,
      notification_type: "onboarding_step_complete",
      title: "Onboarding form submitted",
      body: "Thank you! We're putting your campaign together.",
      related_entity_type: "ClientOnboarding",
      related_entity_id: submission.id,
    });
    // Create task for admin
    if (submission.deal_id) {
      await base44.entities.Task.create({
        title: `Review ${client.business_name} onboarding submission`,
        description: "Client completed full onboarding form - review and proceed with delivery planning",
        deal_id: submission.deal_id,
        client_id: client.id,
        status: "open",
        priority: "high",
        assigned_to: client.assigned_field_agent,
      });
    }
    setFormData({ ...formData, submission_status: "submitted" });
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold gradient-text mb-2">Marketing iO Onboarding</h1>
          <p className="text-muted-foreground">Let's get to know your business better</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {STEPS.map(s => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(s.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  s.id === currentStep
                    ? "bg-primary text-white"
                    : s.id < currentStep
                    ? "bg-success/20 text-success"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {s.id < currentStep ? <Check className="w-4 h-4" /> : s.id}
              </button>
            ))}
          </div>
          <h2 className="text-xl font-bold text-foreground">{STEPS[currentStep - 1].title}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].subtitle}</p>
        </div>

        {/* Form Content */}
        <div className="glass rounded-xl p-6 mb-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              <FormField label="Business Name" value={formData.business_legal_name || ""} onChange={(v) => handleInputChange("business_legal_name", v)} />
              <FormField label="Trading Name" value={formData.trading_name || ""} onChange={(v) => handleInputChange("trading_name", v)} />
              <FormField label="CIPC Registration" value={formData.cipc_registration_number || ""} onChange={(v) => handleInputChange("cipc_registration_number", v)} />
              <FormField label="VAT Number" value={formData.vat_number || ""} onChange={(v) => handleInputChange("vat_number", v)} optional />
              <FormField label="Years in Business" type="number" value={formData.section_years_in_business || ""} onChange={(v) => handleInputChange("section_years_in_business", v)} />
              <FormField label="Team Size" type="number" value={formData.section_team_size || ""} onChange={(v) => handleInputChange("section_team_size", v)} />
              <FormField label="Business Hours" value={formData.section_business_hours || ""} onChange={(v) => handleInputChange("section_business_hours", v)} placeholder="e.g., Mon-Fri 09:00-17:00" />
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <TextAreaField label="Business Vision" value={formData.section_business_overview || ""} onChange={(v) => handleInputChange("section_business_overview", v)} rows={4} />
              <TextAreaField label="Target Audience" value={formData.section_target_audience || ""} onChange={(v) => handleInputChange("section_target_audience", v)} rows={3} />
              <TextAreaField label="Unique Selling Points" value={formData.section_unique_selling_points || ""} onChange={(v) => handleInputChange("section_unique_selling_points", v)} rows={3} />
              <TextAreaField label="Top 3 Competitors (with notes)" value={formData.section_competitors || ""} onChange={(v) => handleInputChange("section_competitors", v)} rows={4} />
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <TextAreaField label="12-Month Revenue/Growth Goals" value={formData.section_goals_12_months || ""} onChange={(v) => handleInputChange("section_goals_12_months", v)} rows={3} />
              <TextAreaField label="Primary Marketing Pain Points" value={formData.section_pain_points || ""} onChange={(v) => handleInputChange("section_pain_points", v)} rows={3} />
              <TextAreaField label="What's Currently Working in Your Marketing" value={formData.section_existing_marketing || ""} onChange={(v) => handleInputChange("section_existing_marketing", v)} rows={3} />
              <TextAreaField label="Seasonal Factors (busy months, events, etc.)" value={formData.section_seasonal_factors || ""} onChange={(v) => handleInputChange("section_seasonal_factors", v)} rows={3} />
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <FileUploadField label="Logo" value={formData.uploaded_logo_url} onChange={(f) => handleFileUpload("uploaded_logo_url", f)} />
              <FileUploadField label="Logo Dark Variant" value={formData.uploaded_logo_dark_url} onChange={(f) => handleFileUpload("uploaded_logo_dark_url", f)} optional />
              <FileUploadField label="Brand Guidelines PDF" value={formData.uploaded_brand_guidelines_url} onChange={(f) => handleFileUpload("uploaded_brand_guidelines_url", f)} optional />
              <FileUploadField label="Business Photos (up to 20)" value={formData.uploaded_business_photos_urls} onChange={(f) => handleFileUpload("uploaded_business_photos_urls", f)} optional />
              <FileUploadField label="Team Photos" value={formData.uploaded_team_photos_urls} onChange={(f) => handleFileUpload("uploaded_team_photos_urls", f)} optional />
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              <SelectField
                label="Brand Voice"
                value={formData.section_brand_voice || ""}
                options={["professional", "friendly", "premium", "casual", "technical"]}
                onChange={(v) => handleInputChange("section_brand_voice", v)}
              />
              <FormField label="Brand Primary Colour (hex)" value={formData.section_brand_colours || ""} onChange={(v) => handleInputChange("section_brand_colours", v)} placeholder="#A764E6" />
              <TextAreaField label="Brand Tone Preferences" value={formData.brand_voice_tone || ""} onChange={(v) => handleInputChange("brand_voice_tone", v)} rows={3} />
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-4">
              <FormField label="Website URL" value={formData.existing_website_url || ""} onChange={(v) => handleInputChange("existing_website_url", v)} optional />
              <FormField label="Google Business Profile URL" value={formData.section_existing_accounts || ""} onChange={(v) => handleInputChange("section_existing_accounts", v)} optional />
              <FormField label="Facebook Page URL" placeholder="facebook.com/yourpage" onChange={(v) => handleInputChange("facebook_url", v)} optional />
              <FormField label="Instagram Handle" placeholder="@yourhandle" onChange={(v) => handleInputChange("instagram_handle", v)} optional />
              <TextAreaField label="Other Social Handles & Logins" value={formData.existing_social_media_handles || ""} onChange={(v) => handleInputChange("existing_social_media_handles", v)} rows={3} optional />
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-foreground">Payment Methods Accepted</label>
              <div className="space-y-2">
                {["cash", "eft", "card", "snapscan", "zapper", "payfast", "yoco"].map(m => (
                  <label key={m} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.section_payment_methods_accepted?.includes(m) || false}
                      onChange={(e) => {
                        const arr = formData.section_payment_methods_accepted || [];
                        const updated = e.target.checked ? [...arr, m] : arr.filter(x => x !== m);
                        handleInputChange("section_payment_methods_accepted", updated);
                      }}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{m.replace("_", " ")}</span>
                  </label>
                ))}
              </div>
              <TextAreaField label="Additional Notes" value={formData.section_additional_notes || ""} onChange={(v) => handleInputChange("section_additional_notes", v)} rows={4} optional />
            </div>
          )}

          {currentStep === 8 && (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <p className="text-sm text-success font-semibold">Review complete</p>
                <p className="text-xs text-muted-foreground mt-1">Click submit below to send your onboarding form to the team.</p>
              </div>
              <div className="max-h-64 overflow-y-auto text-xs text-muted-foreground space-y-2 p-3 bg-muted/20 rounded-lg">
                <p><strong>Summary:</strong></p>
                <p>Business: {formData.business_legal_name}</p>
                <p>Team Size: {formData.section_team_size}</p>
                <p>Goals: {formData.section_goals_12_months?.substring(0, 100)}...</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation & Save Indicator */}
        <div className="flex items-center justify-between">
          <div>
            {lastSaved && <p className="text-xs text-muted-foreground">Last saved: {lastSaved.toLocaleTimeString()}</p>}
          </div>
          <div className="flex gap-3">
            {currentStep > 1 && (
              <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            {currentStep < 8 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)} className="gradient-bg text-white">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="gradient-bg text-white" disabled={formData.submission_status === "submitted"}>
                {formData.submission_status === "submitted" ? "Submitted ✓" : "Submit Onboarding"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, type = "text", value, onChange, placeholder, optional = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {optional && <span className="text-muted-foreground">(optional)</span>}
      </label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-secondary/50 border-border/50" />
    </div>
  );
}

function TextAreaField({ label, value, onChange, rows = 4, optional = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {optional && <span className="text-muted-foreground">(optional)</span>}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full p-2 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground" />
    </div>
  );
}

function FileUploadField({ label, value, onChange, optional = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {optional && <span className="text-muted-foreground">(optional)</span>}
      </label>
      <div className="border-2 border-dashed border-border/40 rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
        <input type="file" onChange={(e) => onChange(e.target.files)} hidden id={label} />
        <label htmlFor={label} className="cursor-pointer">
          {value ? (
            <div className="text-sm text-success">✓ Uploaded</div>
          ) : (
            <>
              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
            </>
          )}
        </label>
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full p-2 bg-secondary/50 border border-border/50 rounded-lg text-sm text-foreground">
        <option value="">Select {label.toLowerCase()}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
        ))}
      </select>
    </div>
  );
}