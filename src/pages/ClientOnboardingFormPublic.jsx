import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PROVINCES = ["Limpopo", "Gauteng", "Western Cape", "KZN", "Eastern Cape", "Mpumalanga", "North West", "Free State", "Northern Cape"];
const EMPLOYEE_RANGES = ["1-5", "6-10", "11-20", "21-50", "51+"];
const VOICE_TONES = ["Professional", "Friendly", "Bold", "Premium", "Casual", "Authoritative", "Caring"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SECTIONS = [
  { id: 0, title: "Business Info", fields: ["business_legal_name", "trading_name", "cipc_registration_number", "vat_number", "year_business_started", "number_of_employees"] },
  { id: 1, title: "Business Overview", fields: ["business_description", "target_customer_description", "main_competitors", "biggest_business_challenge", "growth_goals_12_months"] },
  { id: 2, title: "Location & Hours", fields: ["physical_address", "city", "province", "operating_hours"] },
  { id: 3, title: "Contact Details", fields: ["primary_contact_name", "primary_contact_role", "primary_contact_phone", "primary_contact_email", "primary_contact_whatsapp", "billing_contact_name", "billing_contact_email"] },
  { id: 4, title: "Brand Info", fields: ["has_logo", "logo_file", "brand_colours_primary", "brand_colours_secondary", "brand_voice_tone", "existing_brand_guidelines_file", "example_content_you_like"] },
];

export default function ClientOnboardingFormPublic() {
  const { token } = useParams();
  const { toast } = useToast();
  const [submission, setSubmission] = useState(null);
  const [client, setClient] = useState(null);
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadSubmission();
  }, [token]);

  const loadSubmission = async () => {
    try {
      const subs = await base44.entities.ClientOnboardingSubmission.filter({ submission_token: token });
      const sub = Array.isArray(subs) ? subs[0] : subs;

      if (!sub) {
        toast({ title: "Form not found", description: "Invalid or expired link", variant: "destructive" });
        setLoading(false);
        return;
      }

      setSubmission(sub);

      // Load client and deal
      const [clients, deals] = await Promise.all([
        base44.entities.Client.filter({ id: sub.client_id }),
        base44.entities.Deal.filter({ id: sub.deal_id }),
      ]);

      setClient(Array.isArray(clients) ? clients[0] : clients);
      setDeal(Array.isArray(deals) ? deals[0] : deals);

      if (sub.submission_status === "submitted" || sub.submission_status === "reviewed") {
        setSubmitted(true);
      }

      setLoading(false);
    } catch (err) {
      toast({ title: "Error loading form", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setSubmission(prev => ({ ...prev, [field]: value }));
  };

  const autoSave = async (formData) => {
    try {
      await base44.entities.ClientOnboardingSubmission.update(submission.id, {
        ...formData,
        submission_status: "in_progress"
      });
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  };

  const handleFieldChange = (field, value) => {
    updateField(field, value);
    autoSave({ [field]: value, submission_status: "in_progress" });
  };

  const submitForm = async () => {
    // Validate required fields
    if (!submission.information_accurate_and_complete || !submission.popia_consent_for_data_processing || !submission.digital_signature_full_name) {
      toast({ title: "Please complete the declaration", description: "All declaration fields are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Update submission status
      await base44.entities.ClientOnboardingSubmission.update(submission.id, {
        submission_status: "submitted",
        submitted_at: new Date().toISOString(),
        submission_date: new Date().toISOString().split("T")[0],
      });

      // Update client with form data (matching fields)
      const clientUpdate = {
        business_name: submission.business_legal_name || client.business_name,
        contact_person: submission.primary_contact_name || client.contact_person,
        email: submission.primary_contact_email || client.email,
        phone: submission.primary_contact_phone || client.phone,
        address: submission.physical_address || client.address,
        industry: submission.business_description?.substring(0, 100) || client.industry,
      };
      await base44.entities.Client.update(client.id, clientUpdate);

      // Update ClientOnboarding trigger
      const onboardings = await base44.entities.ClientOnboarding.filter({ client_id: client.id });
      const onboarding = Array.isArray(onboardings) ? onboardings[0] : onboardings;
      if (onboarding) {
        await base44.entities.ClientOnboarding.update(onboarding.id, {
          trigger_onboarding_form_returned: true,
          trigger_onboarding_form_returned_date: new Date().toISOString().split("T")[0],
        });
      }

      // Send notification to admin
      await base44.functions.invoke("notifyAdminFormSubmitted", {
        clientId: client.id,
        clientName: client.business_name,
      });

      setSubmitted(true);
      toast({ title: "Success!", description: "Your onboarding form has been submitted" });
    } catch (err) {
      toast({ title: "Error submitting form", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!submission) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold text-foreground mb-2">Form Not Found</h1><p className="text-muted-foreground">This link has expired or is invalid</p></div></div>;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Thank You!</h1>
          <p className="text-muted-foreground mb-4">Your onboarding form has been submitted successfully.</p>
          <p className="text-sm text-muted-foreground">Our team will be in touch within 24 hours to guide you through the next steps.</p>
        </div>
      </div>
    );
  }

  const section = SECTIONS[currentStep];
  const progress = ((currentStep + 1) / SECTIONS.length) * 100;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <img src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png" alt="Marketing iO" className="h-8 mb-6" style={{ filter: "invert(1)" }} />
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome {client?.business_name}!</h1>
          <p className="text-muted-foreground">Complete your onboarding form in just a few minutes</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Step {currentStep + 1} of {SECTIONS.length}</p>
            <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full gradient-bg transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-bold text-foreground mb-6">{section.title}</h2>
          <div className="space-y-5">
            {section.fields.map(field => <FormField key={field} field={field} value={submission[field] || ""} onChange={(v) => handleFieldChange(field, v)} />)}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 justify-between">
          <Button variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0}>
            Back
          </Button>
          {currentStep < SECTIONS.length - 1 ? (
            <Button onClick={() => setCurrentStep(currentStep + 1)} className="gap-1 gradient-bg text-white hover:opacity-90">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={submitForm} disabled={saving} className="gradient-bg text-white hover:opacity-90">
              {saving ? "Submitting..." : "Submit Form"}
            </Button>
          )}
        </div>

        {/* Declaration (final step) */}
        {currentStep === SECTIONS.length - 1 && (
          <div className="mt-8 glass rounded-2xl p-6">
            <h3 className="font-bold text-foreground mb-4">Declaration</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox checked={submission.information_accurate_and_complete} onCheckedChange={(v) => handleFieldChange("information_accurate_and_complete", v)} />
                <label className="text-sm text-muted-foreground">I confirm that the information provided is accurate and complete</label>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox checked={submission.popia_consent_for_data_processing} onCheckedChange={(v) => handleFieldChange("popia_consent_for_data_processing", v)} />
                <label className="text-sm text-muted-foreground">I consent to Marketing iO processing this data in accordance with POPIA regulations</label>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Full Name (Digital Signature)</Label>
                <Input value={submission.digital_signature_full_name || ""} onChange={(e) => handleFieldChange("digital_signature_full_name", e.target.value)} placeholder="Type your full name" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ field, value, onChange }) {
  const labels = {
    business_legal_name: "Business Legal Name *",
    trading_name: "Trading Name",
    cipc_registration_number: "CIPC Registration Number *",
    vat_number: "VAT Number (optional)",
    year_business_started: "Year Business Started *",
    number_of_employees: "Number of Employees *",
    business_description: "Business Description *",
    target_customer_description: "Who is your target customer?",
    main_competitors: "Who are your main competitors?",
    biggest_business_challenge: "What's your biggest business challenge?",
    growth_goals_12_months: "What are your growth goals for the next 12 months?",
    physical_address: "Physical Address *",
    city: "City *",
    province: "Province *",
    operating_hours: "Operating Hours",
    primary_contact_name: "Primary Contact Name *",
    primary_contact_role: "Role",
    primary_contact_phone: "Phone Number *",
    primary_contact_email: "Email *",
    primary_contact_whatsapp: "WhatsApp Number",
    billing_contact_name: "Billing Contact Name",
    billing_contact_email: "Billing Contact Email",
    has_logo: "Do you have a logo?",
    logo_file: "Upload Logo",
    brand_colours_primary: "Primary Brand Colour (hex or description)",
    brand_colours_secondary: "Secondary Brand Colour",
    brand_voice_tone: "Brand Voice Tone *",
    existing_brand_guidelines_file: "Brand Guidelines (optional)",
    example_content_you_like: "Share examples of content you like",
  };

  const fieldType = {
    number_of_employees: "select",
    province: "select",
    brand_voice_tone: "select",
    year_business_started: "number",
    has_logo: "checkbox",
    logo_file: "file",
  };

  const type = fieldType[field] || "text";

  if (type === "select") {
    const options = {
      number_of_employees: EMPLOYEE_RANGES,
      province: PROVINCES,
      brand_voice_tone: VOICE_TONES,
    }[field] || [];

    return (
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">{labels[field]}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="bg-secondary/50 border-border/50">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (type === "checkbox") {
    return <div className="flex items-center gap-2"><Checkbox checked={value} onCheckedChange={onChange} /><label className="text-sm text-muted-foreground">{labels[field]}</label></div>;
  }

  if (type === "file") {
    return (
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">{labels[field]}</Label>
        <Input type="file" onChange={(e) => onChange(e.target.files?.[0]?.name || "")} />
      </div>
    );
  }

  const isLongText = ["business_description", "target_customer_description", "main_competitors", "biggest_business_challenge", "growth_goals_12_months", "example_content_you_like", "physical_address"].includes(field);

  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-2 block">{labels[field]}</Label>
      {isLongText ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="bg-secondary/50 border-border/50 h-24" placeholder="Enter details..." />
      ) : (
        <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="bg-secondary/50 border-border/50" placeholder="Enter..." />
      )}
    </div>
  );
}