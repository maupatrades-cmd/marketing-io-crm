import { useState } from "react";
import { base44 } from "@/api/base44Client";
import FormSection from "@/components/onboarding/FormSection";
import FormField from "@/components/onboarding/FormField";
import FileUploadField from "@/components/onboarding/FileUploadField";
import { validateSAId } from "@/lib/saIdValidation";
import { CheckCircle2, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";

const STEPS = [
  "Personal Identity",
  "Contact Details",
  "Next of Kin",
  "Employment",
  "Banking",
  "Tax & Education",
  "Work Experience",
  "Documents",
  "Consent & Sign-Off",
];

const INITIAL = {
  full_legal_name: "", preferred_name: "", id_number: "", date_of_birth: "",
  gender: "", race: "", nationality: "South African", marital_status: "", number_of_dependants: 0,
  cell_phone_primary: "", cell_phone_alternative: "", personal_email: "", whatsapp_number: "",
  residential_address: "", postal_address: "", postal_same_as_residential: true,
  nok1_full_name: "", nok1_relationship: "", nok1_cell_phone: "", nok1_alternative_phone: "", nok1_address: "", nok1_email: "",
  nok2_full_name: "", nok2_relationship: "", nok2_cell_phone: "",
  position_role: "", start_date: "", employment_type: "", monthly_ctc: "", probation_months: 3, hours_per_week: 45, reporting_to: "Founder / GM",
  bank_name: "", branch_code: "", account_number: "", account_type: "", account_holder_name: "",
  tax_number: "", tax_status: "", uif_number: "", has_medical_aid: false, medical_aid_provider: "", has_pension: false,
  highest_qualification: "", institution_name: "", year_completed: "", additional_qualifications: "",
  languages_spoken: [], has_drivers_licence: false, drivers_licence_code: "None", has_own_vehicle: false,
  prev_employer_1_name: "", prev_employer_1_role: "", prev_employer_1_start_date: "", prev_employer_1_end_date: "", prev_employer_1_reason_for_leaving: "",
  prev_employer_2_name: "", prev_employer_2_role: "", prev_employer_2_start_date: "", prev_employer_2_end_date: "",
  sales_marketing_experience_summary: "", notable_achievements: "",
  id_copy_file: null, bank_confirmation_file: null, qualification_certificate_file: null,
  drivers_licence_file: null, recent_payslip_file: null, reference_letter_1_file: null, reference_letter_2_file: null, profile_photo_file: null,
  information_is_true: false, consent_to_background_check: false, popia_consent: false,
  digital_signature_name: "", signature_date: new Date().toISOString().split("T")[0],
  application_status: "Submitted",
};

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-gray-900 placeholder:text-gray-400";
const sel = inp + " appearance-none";
const ta = inp + " resize-none";

function Txt({ name, form, onChange, placeholder, type = "text", ...props }) {
  return <input type={type} className={inp} value={form[name] || ""} onChange={e => onChange(name, e.target.value)} placeholder={placeholder} {...props} />;
}
function Sel({ name, form, onChange, options, placeholder }) {
  return (
    <select className={sel} value={form[name] || ""} onChange={e => onChange(name, e.target.value)}>
      <option value="">{placeholder || "Select…"}</option>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}
function Ta({ name, form, onChange, placeholder, rows = 3 }) {
  return <textarea className={ta} rows={rows} value={form[name] || ""} onChange={e => onChange(name, e.target.value)} placeholder={placeholder} />;
}
function Check({ name, label, form, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" className="w-4 h-4 rounded accent-purple-600" checked={!!form[name]} onChange={e => onChange(name, e.target.checked)} />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function StaffOnboardingForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => { const n = { ...e }; delete n[name]; return n; });
  };

  const setFile = (name) => (url) => set(name, url);

  const toggleLanguage = (lang) => {
    setForm(f => ({
      ...f,
      languages_spoken: f.languages_spoken.includes(lang)
        ? f.languages_spoken.filter(l => l !== lang)
        : [...f.languages_spoken, lang],
    }));
  };

  // Per-step validation
  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!form.full_legal_name) e.full_legal_name = "Required";
      if (!form.id_number) { e.id_number = "Required"; }
      else { const r = validateSAId(form.id_number); if (!r.valid) e.id_number = r.error; }
      if (!form.date_of_birth) e.date_of_birth = "Required";
    }
    if (step === 1) {
      if (!form.cell_phone_primary) e.cell_phone_primary = "Required";
      if (!form.personal_email) e.personal_email = "Required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personal_email)) e.personal_email = "Invalid email address";
      if (!form.residential_address) e.residential_address = "Required";
    }
    if (step === 2) {
      if (!form.nok1_full_name) e.nok1_full_name = "Required";
      if (!form.nok1_relationship) e.nok1_relationship = "Required";
      if (!form.nok1_cell_phone) e.nok1_cell_phone = "Required";
    }
    if (step === 4) {
      if (!form.account_number) e.account_number = "Required";
      if (!form.account_holder_name) e.account_holder_name = "Required";
    }
    if (step === 7) {
      if (!form.id_copy_file) e.id_copy_file = "Required";
      if (!form.bank_confirmation_file) e.bank_confirmation_file = "Required";
      if (!form.profile_photo_file) e.profile_photo_file = "Required";
    }
    if (step === 8) {
      if (!form.information_is_true) e.information_is_true = "You must confirm the information is true";
      if (!form.consent_to_background_check) e.consent_to_background_check = "Required";
      if (!form.popia_consent) e.popia_consent = "Required";
      if (!form.digital_signature_name) e.digital_signature_name = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    const payload = { ...form };
    if (payload.monthly_ctc) payload.monthly_ctc = Number(payload.monthly_ctc);
    if (payload.year_completed) payload.year_completed = Number(payload.year_completed);
    await base44.entities.StaffRecord.create(payload);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
          <p className="text-gray-500 text-sm mb-4">Thank you, <strong>{form.preferred_name || form.full_legal_name}</strong>. Your application has been received. Our team will review it and be in touch soon.</p>
          <p className="text-xs text-gray-400">Application reference: {form.id_number?.slice(-4)}-{Date.now().toString().slice(-6)}</p>
        </div>
      </div>
    );
  }

  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Marketing iO</p>
              <h1 className="text-base font-bold text-gray-900">Staff Onboarding Application</h1>
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1 scrollbar-hide">
            {STEPS.map((s, i) => (
              <span key={i} className={`text-xs shrink-0 px-2 py-0.5 rounded-full transition-all ${i === step ? "bg-purple-100 text-purple-700 font-semibold" : i < step ? "text-green-600 font-medium" : "text-gray-400"}`}>
                {i < step ? "✓" : `${i + 1}.`} {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {/* STEP 0: Personal Identity */}
        {step === 0 && (
          <FormSection title="Personal Identity" subtitle="Enter your details exactly as they appear on your ID document">
            <FormField label="Full Legal Name" required error={errors.full_legal_name} fullWidth>
              <Txt name="full_legal_name" form={form} onChange={set} placeholder="As per ID document" />
            </FormField>
            <FormField label="Preferred Name">
              <Txt name="preferred_name" form={form} onChange={set} placeholder="Nickname / first name" />
            </FormField>
            <FormField label="SA ID Number" required error={errors.id_number} hint="13-digit South African ID number">
              <Txt name="id_number" form={form} onChange={set} placeholder="0001015009087" maxLength={13} />
            </FormField>
            <FormField label="Date of Birth" required error={errors.date_of_birth}>
              <Txt name="date_of_birth" form={form} onChange={set} type="date" />
            </FormField>
            <FormField label="Gender">
              <Sel name="gender" form={form} onChange={set} options={["male","female","other","prefer_not_to_say"].map(v => ({ value: v, label: v.replace(/_/g," ") }))} />
            </FormField>
            <FormField label="Race" hint="Required for BBBEE compliance reporting">
              <Sel name="race" form={form} onChange={set} options={["African","Coloured","Indian","White","Other","Prefer not to say"]} />
            </FormField>
            <FormField label="Nationality">
              <Txt name="nationality" form={form} onChange={set} placeholder="South African" />
            </FormField>
            <FormField label="Marital Status">
              <Sel name="marital_status" form={form} onChange={set} options={["single","married","divorced","widowed","life_partner"].map(v => ({ value: v, label: v.replace(/_/g," ") }))} />
            </FormField>
            <FormField label="Number of Dependants">
              <Txt name="number_of_dependants" form={form} onChange={set} type="number" placeholder="0" />
            </FormField>
          </FormSection>
        )}

        {/* STEP 1: Contact Details */}
        {step === 1 && (
          <FormSection title="Contact Details" subtitle="How we'll reach you">
            <FormField label="Primary Cell Phone" required error={errors.cell_phone_primary}>
              <Txt name="cell_phone_primary" form={form} onChange={set} placeholder="082 000 0000" type="tel" />
            </FormField>
            <FormField label="Alternative Cell Phone">
              <Txt name="cell_phone_alternative" form={form} onChange={set} placeholder="082 000 0000" type="tel" />
            </FormField>
            <FormField label="Personal Email" required error={errors.personal_email}>
              <Txt name="personal_email" form={form} onChange={set} placeholder="you@email.com" type="email" />
            </FormField>
            <FormField label="WhatsApp Number">
              <Txt name="whatsapp_number" form={form} onChange={set} placeholder="Same as cell or different" type="tel" />
            </FormField>
            <FormField label="Residential Address" required error={errors.residential_address} fullWidth>
              <Ta name="residential_address" form={form} onChange={set} placeholder="Full street address, suburb, city, postal code" />
            </FormField>
            <FormField label="" fullWidth>
              <Check name="postal_same_as_residential" label="Postal address is the same as residential" form={form} onChange={set} />
            </FormField>
            {!form.postal_same_as_residential && (
              <FormField label="Postal Address" fullWidth>
                <Ta name="postal_address" form={form} onChange={set} placeholder="Postal address if different" />
              </FormField>
            )}
          </FormSection>
        )}

        {/* STEP 2: Next of Kin */}
        {step === 2 && (
          <>
            <FormSection title="Next of Kin — Primary" subtitle="Required emergency contact">
              <FormField label="Full Name" required error={errors.nok1_full_name}>
                <Txt name="nok1_full_name" form={form} onChange={set} />
              </FormField>
              <FormField label="Relationship" required error={errors.nok1_relationship}>
                <Txt name="nok1_relationship" form={form} onChange={set} placeholder="e.g. Spouse, Parent" />
              </FormField>
              <FormField label="Cell Phone" required error={errors.nok1_cell_phone}>
                <Txt name="nok1_cell_phone" form={form} onChange={set} type="tel" />
              </FormField>
              <FormField label="Alternative Phone">
                <Txt name="nok1_alternative_phone" form={form} onChange={set} type="tel" />
              </FormField>
              <FormField label="Email">
                <Txt name="nok1_email" form={form} onChange={set} type="email" />
              </FormField>
              <FormField label="Address">
                <Ta name="nok1_address" form={form} onChange={set} rows={2} />
              </FormField>
            </FormSection>
            <FormSection title="Next of Kin — Secondary" subtitle="Optional second emergency contact">
              <FormField label="Full Name">
                <Txt name="nok2_full_name" form={form} onChange={set} />
              </FormField>
              <FormField label="Relationship">
                <Txt name="nok2_relationship" form={form} onChange={set} />
              </FormField>
              <FormField label="Cell Phone">
                <Txt name="nok2_cell_phone" form={form} onChange={set} type="tel" />
              </FormField>
            </FormSection>
          </>
        )}

        {/* STEP 3: Employment */}
        {step === 3 && (
          <FormSection title="Employment Details" subtitle="Your role at Marketing iO">
            <FormField label="Position / Role">
              <Sel name="position_role" form={form} onChange={set} options={["Field Agent","CPC","Admin","Driver","Head of Tech","Other"]} />
            </FormField>
            <FormField label="Employment Type">
              <Sel name="employment_type" form={form} onChange={set} options={["Permanent","Fixed-term contract","Independent contractor"]} />
            </FormField>
            <FormField label="Start Date">
              <Txt name="start_date" form={form} onChange={set} type="date" />
            </FormField>
            <FormField label="Monthly CTC (ZAR)">
              <Txt name="monthly_ctc" form={form} onChange={set} type="number" placeholder="0" />
            </FormField>
            <FormField label="Probation Period (months)">
              <Txt name="probation_months" form={form} onChange={set} type="number" />
            </FormField>
            <FormField label="Hours per Week">
              <Txt name="hours_per_week" form={form} onChange={set} type="number" />
            </FormField>
            <FormField label="Reporting To" fullWidth>
              <Txt name="reporting_to" form={form} onChange={set} placeholder="Founder / GM" />
            </FormField>
          </FormSection>
        )}

        {/* STEP 4: Banking */}
        {step === 4 && (
          <FormSection title="Banking Details" subtitle="For salary payment — must match your ID">
            <FormField label="Bank Name">
              <Sel name="bank_name" form={form} onChange={set} options={["ABSA","Standard Bank","FNB","Nedbank","Capitec","TymeBank","Discovery Bank","Other"]} />
            </FormField>
            <FormField label="Account Type">
              <Sel name="account_type" form={form} onChange={set} options={["Cheque","Savings","Transmission"]} />
            </FormField>
            <FormField label="Account Holder Name" required error={errors.account_holder_name}>
              <Txt name="account_holder_name" form={form} onChange={set} placeholder="As per bank records" />
            </FormField>
            <FormField label="Account Number" required error={errors.account_number}>
              <Txt name="account_number" form={form} onChange={set} placeholder="Bank account number" />
            </FormField>
            <FormField label="Branch Code">
              <Txt name="branch_code" form={form} onChange={set} placeholder="e.g. 632005" />
            </FormField>
          </FormSection>
        )}

        {/* STEP 5: Tax & Education */}
        {step === 5 && (
          <>
            <FormSection title="Tax & Compliance" subtitle="SARS and UIF information">
              <FormField label="Tax Number">
                <Txt name="tax_number" form={form} onChange={set} placeholder="SARS tax reference number" />
              </FormField>
              <FormField label="Tax Status">
                <Sel name="tax_status" form={form} onChange={set} options={["Registered","Not registered","Exempt"]} />
              </FormField>
              <FormField label="UIF Number">
                <Txt name="uif_number" form={form} onChange={set} placeholder="UIF reference number" />
              </FormField>
              <FormField label="">
                <Check name="has_medical_aid" label="I have medical aid" form={form} onChange={set} />
              </FormField>
              {form.has_medical_aid && (
                <FormField label="Medical Aid Provider">
                  <Txt name="medical_aid_provider" form={form} onChange={set} placeholder="e.g. Discovery, Bonitas" />
                </FormField>
              )}
              <FormField label="">
                <Check name="has_pension" label="I have a pension / provident fund" form={form} onChange={set} />
              </FormField>
            </FormSection>
            <FormSection title="Education & Skills" subtitle="Highest qualification and languages">
              <FormField label="Highest Qualification">
                <Sel name="highest_qualification" form={form} onChange={set} options={["Below Matric","Matric","Certificate","Diploma","Degree","Honours","Masters","Doctorate"]} />
              </FormField>
              <FormField label="Institution Name">
                <Txt name="institution_name" form={form} onChange={set} placeholder="School or university name" />
              </FormField>
              <FormField label="Year Completed">
                <Txt name="year_completed" form={form} onChange={set} type="number" placeholder="e.g. 2018" />
              </FormField>
              <FormField label="Additional Qualifications" fullWidth>
                <Ta name="additional_qualifications" form={form} onChange={set} placeholder="Other qualifications, certifications, courses…" />
              </FormField>
              <FormField label="Languages Spoken" fullWidth>
                <div className="flex flex-wrap gap-2">
                  {["English","Sepedi","Afrikaans","isiZulu","isiXhosa","Setswana","Sesotho","Tshivenda","Xitsonga","isiNdebele","siSwati","Other"].map(lang => (
                    <button key={lang} type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`px-3 py-1 rounded-full text-xs border transition-all ${form.languages_spoken.includes(lang) ? "bg-purple-600 text-white border-purple-600" : "border-gray-200 text-gray-600 hover:border-purple-300"}`}>
                      {lang}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="">
                <Check name="has_drivers_licence" label="I have a driver's licence" form={form} onChange={set} />
              </FormField>
              {form.has_drivers_licence && (
                <FormField label="Licence Code">
                  <Sel name="drivers_licence_code" form={form} onChange={set} options={["Code A","Code B","Code C1","Code C","Code EB","Code EC"]} />
                </FormField>
              )}
              <FormField label="">
                <Check name="has_own_vehicle" label="I have my own vehicle" form={form} onChange={set} />
              </FormField>
            </FormSection>
          </>
        )}

        {/* STEP 6: Work Experience */}
        {step === 6 && (
          <>
            <FormSection title="Previous Employment — Employer 1" subtitle="Most recent employer">
              <FormField label="Company Name">
                <Txt name="prev_employer_1_name" form={form} onChange={set} />
              </FormField>
              <FormField label="Role / Position">
                <Txt name="prev_employer_1_role" form={form} onChange={set} />
              </FormField>
              <FormField label="Start Date">
                <Txt name="prev_employer_1_start_date" form={form} onChange={set} type="date" />
              </FormField>
              <FormField label="End Date">
                <Txt name="prev_employer_1_end_date" form={form} onChange={set} type="date" />
              </FormField>
              <FormField label="Reason for Leaving" fullWidth>
                <Ta name="prev_employer_1_reason_for_leaving" form={form} onChange={set} />
              </FormField>
            </FormSection>
            <FormSection title="Previous Employment — Employer 2" subtitle="Optional second employer">
              <FormField label="Company Name">
                <Txt name="prev_employer_2_name" form={form} onChange={set} />
              </FormField>
              <FormField label="Role / Position">
                <Txt name="prev_employer_2_role" form={form} onChange={set} />
              </FormField>
              <FormField label="Start Date">
                <Txt name="prev_employer_2_start_date" form={form} onChange={set} type="date" />
              </FormField>
              <FormField label="End Date">
                <Txt name="prev_employer_2_end_date" form={form} onChange={set} type="date" />
              </FormField>
            </FormSection>
            <FormSection title="Sales & Marketing Experience" subtitle="Tell us about your relevant experience">
              <FormField label="Sales & Marketing Experience Summary" fullWidth>
                <Ta name="sales_marketing_experience_summary" form={form} onChange={set} rows={4} placeholder="Describe your sales and marketing background…" />
              </FormField>
              <FormField label="Notable Achievements" fullWidth>
                <Ta name="notable_achievements" form={form} onChange={set} rows={3} placeholder="Awards, targets exceeded, campaigns run…" />
              </FormField>
            </FormSection>
          </>
        )}

        {/* STEP 7: Documents */}
        {step === 7 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-base font-semibold text-gray-900">Document Uploads</h2>
              <p className="text-xs text-gray-500 mt-0.5">Max 5MB per file · JPG, PNG or PDF only</p>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FileUploadField label="SA ID Copy" required value={form.id_copy_file} onChange={setFile("id_copy_file")} error={errors.id_copy_file} />
              <FileUploadField label="Profile Photo" required accept="image/*" value={form.profile_photo_file} onChange={setFile("profile_photo_file")} error={errors.profile_photo_file} />
              <FileUploadField label="Bank Confirmation Letter" required value={form.bank_confirmation_file} onChange={setFile("bank_confirmation_file")} error={errors.bank_confirmation_file} />
              <FileUploadField label="Highest Qualification Certificate" value={form.qualification_certificate_file} onChange={setFile("qualification_certificate_file")} />
              <FileUploadField label="Driver's Licence Copy" value={form.drivers_licence_file} onChange={setFile("drivers_licence_file")} />
              <FileUploadField label="Most Recent Payslip" value={form.recent_payslip_file} onChange={setFile("recent_payslip_file")} />
              <FileUploadField label="Reference Letter 1" value={form.reference_letter_1_file} onChange={setFile("reference_letter_1_file")} />
              <FileUploadField label="Reference Letter 2" value={form.reference_letter_2_file} onChange={setFile("reference_letter_2_file")} />
            </div>
          </div>
        )}

        {/* STEP 8: Consent & Sign-Off */}
        {step === 8 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-base font-semibold text-gray-900">Consent & Declaration</h2>
              <p className="text-xs text-gray-500 mt-0.5">Please read carefully before signing</p>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 leading-relaxed space-y-2 border border-gray-100">
                <p><strong>Declaration of True Information:</strong> I declare that all information provided in this form is true, correct and complete to the best of my knowledge. I understand that any false or misleading information may result in the termination of my application or employment.</p>
                <p><strong>Background Check Consent:</strong> I hereby consent to Marketing iO conducting a background verification check, including criminal record, credit, and reference checks, as part of the hiring process.</p>
                <p><strong>POPIA Consent:</strong> I consent to Marketing iO collecting, processing and storing my personal information in accordance with the Protection of Personal Information Act (POPIA) No. 4 of 2013, for the purposes of employment and HR administration.</p>
              </div>
              <div className="space-y-3">
                <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all ${errors.information_is_true ? "border-red-300 bg-red-50" : "border-gray-100 hover:border-purple-200"}`}>
                  <input type="checkbox" className="w-4 h-4 mt-0.5 accent-purple-600 shrink-0" checked={!!form.information_is_true} onChange={e => set("information_is_true", e.target.checked)} />
                  <span className="text-sm text-gray-700">I confirm that all information provided is true and accurate <span className="text-red-500">*</span></span>
                </label>
                {errors.information_is_true && <p className="text-xs text-red-500 -mt-2 ml-1">⚠ {errors.information_is_true}</p>}

                <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all ${errors.consent_to_background_check ? "border-red-300 bg-red-50" : "border-gray-100 hover:border-purple-200"}`}>
                  <input type="checkbox" className="w-4 h-4 mt-0.5 accent-purple-600 shrink-0" checked={!!form.consent_to_background_check} onChange={e => set("consent_to_background_check", e.target.checked)} />
                  <span className="text-sm text-gray-700">I consent to a background & reference verification check <span className="text-red-500">*</span></span>
                </label>
                {errors.consent_to_background_check && <p className="text-xs text-red-500 -mt-2 ml-1">⚠ {errors.consent_to_background_check}</p>}

                <label className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all ${errors.popia_consent ? "border-red-300 bg-red-50" : "border-gray-100 hover:border-purple-200"}`}>
                  <input type="checkbox" className="w-4 h-4 mt-0.5 accent-purple-600 shrink-0" checked={!!form.popia_consent} onChange={e => set("popia_consent", e.target.checked)} />
                  <span className="text-sm text-gray-700">I consent to the processing of my personal information under POPIA <span className="text-red-500">*</span></span>
                </label>
                {errors.popia_consent && <p className="text-xs text-red-500 -mt-2 ml-1">⚠ {errors.popia_consent}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <FormField label="Digital Signature (Type full name)" required error={errors.digital_signature_name}>
                  <input className={inp} value={form.digital_signature_name} onChange={e => set("digital_signature_name", e.target.value)} placeholder="Type your full legal name" style={{ fontFamily: "Georgia, serif", fontSize: "1rem", letterSpacing: "0.05em" }} />
                </FormField>
                <FormField label="Date">
                  <input type="date" className={inp} value={form.signature_date} onChange={e => set("signature_date", e.target.value)} />
                </FormField>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button type="button" onClick={back} disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/20 text-white text-sm font-medium disabled:opacity-30 hover:bg-white/10 transition-all">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? "bg-purple-400 w-4" : i < step ? "bg-green-400" : "bg-white/20"}`} />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-60">
              {submitting ? "Submitting…" : "Submit Application"}
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {Object.keys(errors).length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-500/20 rounded-xl border border-red-400/30 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> Please fix the highlighted errors before continuing.
          </div>
        )}
      </div>
    </div>
  );
}