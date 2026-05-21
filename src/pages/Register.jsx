import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Phone, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { validatePassword, getPasswordStrength } from '@/lib/passwordValidator';

const TOTAL_STEPS = 5;

const INDUSTRIES = [
  ['retail', 'Retail / Shop'],
  ['services', 'Services'],
  ['construction', 'Construction / Trades'],
  ['hospitality', 'Hospitality / Food'],
  ['beauty', 'Beauty / Salon'],
  ['health', 'Health / Wellness'],
  ['professional', 'Professional Services'],
  ['education', 'Education / Training'],
  ['other', 'Other']
];
const YEARS_IN_BUSINESS = [
  ['starting', 'Just starting out'],
  ['less_than_1', 'Less than 1 year'],
  ['1_to_3', '1 – 3 years'],
  ['3_to_5', '3 – 5 years'],
  ['5_to_10', '5 – 10 years'],
  ['10_plus', '10+ years']
];
const EMPLOYEE_RANGES = [
  ['just_me', 'Just me'],
  ['2_to_5', '2 – 5'],
  ['6_to_15', '6 – 15'],
  ['16_to_50', '16 – 50'],
  ['50_plus', '50+']
];
const PROVINCES = [
  ['gauteng', 'Gauteng'],
  ['western_cape', 'Western Cape'],
  ['kwazulu_natal', 'KwaZulu-Natal'],
  ['eastern_cape', 'Eastern Cape'],
  ['free_state', 'Free State'],
  ['limpopo', 'Limpopo'],
  ['mpumalanga', 'Mpumalanga'],
  ['north_west', 'North West'],
  ['northern_cape', 'Northern Cape']
];
const TWELVE_MONTH_GOALS = [
  ['same_steady', 'Stay where I am — steady and stable'],
  ['double_revenue', 'Double my revenue'],
  ['five_x_growth', '5× growth'],
  ['sell_business', 'Sell the business'],
  ['open_branches', 'Open more branches']
];
const CHALLENGES = [
  ['not_enough_leads', "I'm not getting enough leads"],
  ['customers_dont_return', "Customers don't come back"],
  ['cant_compete', "I can't compete with bigger players"],
  ['dont_know_marketing', "I don't know where to start with marketing"],
  ['too_busy_doing_work', "I'm too busy doing the work to market"],
  ['bad_reputation', "My online reputation is hurting me"],
  ['all_above', 'All of the above']
];
const REVENUE_RANGES = [
  ['under_20k', 'Under R20,000'],
  ['20k_to_50k', 'R20,000 – R50,000'],
  ['50k_to_150k', 'R50,000 – R150,000'],
  ['150k_to_500k', 'R150,000 – R500,000'],
  ['500k_plus', 'R500,000+']
];
const NEW_CUSTOMER_TARGETS = [
  ['5_to_10', '5 – 10 new customers'],
  ['10_to_25', '10 – 25'],
  ['25_to_50', '25 – 50'],
  ['50_to_100', '50 – 100'],
  ['100_plus', '100+']
];
const URGENCY_LEVELS = [
  ['yesterday', 'I needed it yesterday'],
  ['within_1_month', 'Within 1 month'],
  ['within_3_months', 'Within 3 months'],
  ['planning_ahead', "I'm planning ahead"],
  ['no_rush', 'No rush — just looking']
];
const MARKETING_ASSETS = [
  ['website', 'A working website'],
  ['whatsapp_automation', 'WhatsApp automation / Business app'],
  ['active_social', 'Active social media (posting weekly)'],
  ['gmb_claimed', 'Claimed Google Business Profile'],
  ['paid_ads', 'Running paid ads'],
  ['email_marketing', 'Email newsletter / marketing'],
  ['crm', 'A CRM tracking my customers']
];
const AGENCY_HISTORY_OPTS = [
  ['yes_didnt_work', 'Yes — but it didn\'t work'],
  ['yes_too_expensive', 'Yes — but too expensive'],
  ['never', 'Never used one'],
  ['tried_diy', 'Tried to DIY']
];
const BUDGET_RANGES = [
  ['under_500', 'Under R500'],
  ['500_to_1500', 'R500 – R1,500'],
  ['1500_to_3000', 'R1,500 – R3,000'],
  ['3000_to_7000', 'R3,000 – R7,000'],
  ['7000_plus', 'R7,000+']
];
const CONTACT_CHANNELS = [
  ['phone', 'Phone call', Phone],
  ['whatsapp', 'WhatsApp', MessageSquare],
  ['email', 'Email', Mail],
  ['sms', 'SMS', Smartphone]
];
const CALL_TIMES = [
  ['morning', 'Morning (08:00 – 12:00)'],
  ['lunch', 'Lunch (12:00 – 14:00)'],
  ['afternoon', 'Afternoon (14:00 – 17:00)'],
  ['evening', 'Evening (17:00 – 20:00)'],
  ['weekend_only', 'Weekends only']
];

function makeCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}

function isValidSAMobile(value) {
  const v = (value || '').replace(/\s+/g, '');
  return /^0\d{9}$/.test(v) || /^\+27\d{9}$/.test(v);
}

const inputClass = "w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500";
const labelClass = "block text-xs font-medium text-slate-300 mb-1.5";

function ProgressBar({ step }) {
  const pct = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
        <span>Step {step} of {TOTAL_STEPS}</span>
        <span>{pct}% complete</span>
      </div>
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
        />
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, required }) {
  return (
    <div>
      <label className={labelClass}>{label}{required && ' *'}</label>
      <select value={value || ''} onChange={onChange} required={required} className={inputClass}>
        <option value="">Choose…</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function TextField({ label, type = 'text', value, onChange, required, placeholder, autoComplete }) {
  return (
    <div>
      <label className={labelClass}>{label}{required && ' *'}</label>
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClass}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, maxLength = 500 }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <textarea
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className={`${inputClass} resize-none`}
      />
      <p className="text-[10px] text-slate-500 mt-1 text-right">{(value || '').length}/{maxLength}</p>
    </div>
  );
}

function CheckboxList({ label, values = [], options, onToggle }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(opt => {
          const [v, l, Icon] = opt;
          const checked = values.includes(v);
          return (
            <label
              key={v}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition ${
                checked
                  ? 'bg-purple-500/15 border-purple-500/60 text-white'
                  : 'bg-slate-700/40 border-slate-600 text-slate-300 hover:border-slate-500'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(v)}
                className="accent-purple-500"
              />
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              <span className="flex-1">{l}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [captcha] = useState(makeCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [clientId, setClientId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [verificationEmail, setVerificationEmail] = useState('');

  const [form, setForm] = useState({
    // Step 1
    first_name: '', last_name: '', email: '', mobile_number: '',
    city: '', street_address: '',
    password: '', confirmPassword: '', agreed: false,
    // Step 2
    business_name: '', industry: '', years_in_business: '',
    number_of_employees: '', business_city: '', business_address: '', business_province: '',
    // Step 3
    twelve_month_goal: '', biggest_challenge: '',
    founder_inspiration: '', competitor_envy: '',
    // Step 4
    monthly_revenue_range: '', new_customers_target: '', urgency_level: '',
    current_marketing_assets: [], agency_history: '',
    // Step 5
    monthly_marketing_budget: '', preferred_contact_channels: [],
    best_call_time: '', wants_consultation_call: false,
    wants_personalized_proposal: false, popia_consent: false
  });

  const set = (field) => (e) => setForm(f => ({
    ...f,
    [field]: e?.target?.type === 'checkbox' ? e.target.checked : (e?.target ? e.target.value : e)
  }));

  const toggleArray = (field, value) => setForm(f => ({
    ...f,
    [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value]
  }));

  const pwStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const pwValidation = useMemo(() => validatePassword(form.password), [form.password]);

  // Persist whatever fields have values for steps 2-5 onto the existing Client record.
  // Skip silently if there's no client_id (shouldn't happen post-step-1).
  const saveClientPartial = async (extraFields, completedStep) => {
    if (!clientId) return;
    const payload = { ...extraFields, signup_completed_steps: completedStep };
    // Strip empties so we don't overwrite existing values with blanks on Skip.
    Object.keys(payload).forEach(k => {
      const v = payload[k];
      if (v === '' || v === undefined || v === null) delete payload[k];
      if (Array.isArray(v) && v.length === 0) delete payload[k];
    });
    try {
      await base44.entities.Client.update(clientId, payload);
    } catch (err) {
      console.error('[Register] Client.update partial failed:', err);
    }
  };

  // ──────────────────── STEP 1 ────────────────────
  const submitStep1 = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Please enter a valid email address.'); return; }
    if (!isValidSAMobile(form.mobile_number)) { setError('Mobile must be SA format: 0XXXXXXXXX or +27XXXXXXXXX.'); return; }
    if (!form.city.trim()) { setError('City is required.'); return; }
    if (!form.street_address.trim()) { setError('Street address is required.'); return; }
    if (!pwValidation.valid) { setError(pwValidation.errors[0]); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (parseInt(captchaInput) !== captcha.answer) { setError('Incorrect answer to the security question.'); return; }
    if (!form.agreed) { setError('Please agree to the Terms of Service to continue.'); return; }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('auth-register', {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        fullName: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
        email: form.email.toLowerCase().trim(),
        mobile_number: form.mobile_number.replace(/\s+/g, ''),
        businessName: form.business_name.trim() || `${form.first_name.trim()}'s business`,
        city: form.city.trim(),
        street_address: form.street_address.trim(),
        password: form.password
      });
      const data = res.data;
      setClientId(data.client_id);
      setUserId(data.user_id);
      setVerificationEmail(data.email);
      setStep(2);
    } catch (err) {
      console.error('[Register] Step 1 failed:', err?.response?.data || err);
      const status = err?.response?.status;
      const detail = err?.response?.data?.error;
      if (status === 409) setError('Account already exists with this email. Please sign in instead.');
      else setError(`Signup failed${detail ? ': ' + detail : '. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────── STEP 2 ────────────────────
  const submitStep2 = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (!form.business_name.trim()) { setError('Business name is required.'); return; }
    if (!form.industry) { setError('Please pick an industry.'); return; }
    if (!form.years_in_business) { setError('Please pick how long you\'ve been in business.'); return; }
    if (!form.number_of_employees) { setError('Please pick a team size.'); return; }
    if (!form.business_city.trim()) { setError('Business city is required.'); return; }
    if (!form.business_province) { setError('Please pick a province.'); return; }

    setLoading(true);
    await saveClientPartial({
      business_name: form.business_name.trim(),
      industry: form.industry,
      years_in_business: form.years_in_business,
      number_of_employees: form.number_of_employees,
      business_city: form.business_city.trim(),
      business_address: form.business_address.trim(),
      business_province: form.business_province
    }, 2);
    setLoading(false);
    setStep(3);
  };

  // ──────────────────── STEP 3 ────────────────────
  const advanceStep3 = async (skip = false) => {
    setError('');
    setLoading(true);
    await saveClientPartial(skip ? {} : {
      twelve_month_goal: form.twelve_month_goal,
      biggest_challenge: form.biggest_challenge,
      founder_inspiration: form.founder_inspiration.trim(),
      competitor_envy: form.competitor_envy.trim()
    }, 3);
    setLoading(false);
    setStep(4);
  };

  // ──────────────────── STEP 4 ────────────────────
  const advanceStep4 = async (skip = false) => {
    setError('');
    setLoading(true);
    await saveClientPartial(skip ? {} : {
      monthly_revenue_range: form.monthly_revenue_range,
      new_customers_target: form.new_customers_target,
      urgency_level: form.urgency_level,
      current_marketing_assets: form.current_marketing_assets,
      agency_history: form.agency_history
    }, 4);
    setLoading(false);
    setStep(5);
  };

  // ──────────────────── STEP 5 ────────────────────
  const submitStep5 = async (skip = false) => {
    setError('');
    if (!skip && !form.popia_consent) {
      setError('Please tick the consent box to receive communication. You can opt out anytime.');
      return;
    }
    setLoading(true);
    const consentFields = form.popia_consent
      ? { popia_consent_given: true, popia_consent_at: new Date().toISOString() }
      : {};
    // Persist what we have. On a "skip" without consent, only step bookkeeping
    // is saved — POPIA stays false so we cannot legally cold-call/email yet.
    await saveClientPartial(skip ? {} : {
      monthly_marketing_budget: form.monthly_marketing_budget,
      preferred_contact_channels: form.preferred_contact_channels,
      best_call_time: form.best_call_time,
      wants_consultation_call: form.wants_consultation_call,
      wants_personalized_proposal: form.wants_personalized_proposal
    }, 5);

    // Save POPIA consent on AppUser too (where the legal record lives) — best-effort.
    if (form.popia_consent && verificationEmail) {
      try {
        const users = await base44.entities.AppUser.filter({ email: verificationEmail });
        const u = users?.[0];
        if (u) await base44.entities.AppUser.update(u.id, consentFields);
      } catch (err) {
        console.error('[Register] AppUser consent update failed:', err);
      }
    }

    // Fire-and-forget lead scoring.
    if (clientId) {
      base44.functions.invoke('calculate-lead-score', { client_id: clientId }).catch(err => {
        console.error('[Register] calculate-lead-score failed:', err);
      });
    }

    setLoading(false);
    navigate(`/verify-otp?email=${encodeURIComponent(verificationEmail)}&purpose=signup_verification`);
  };

  const SkipButton = ({ onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
    >
      Skip — we'll learn more on a quick call
    </button>
  );

  const BackButton = ({ to }) => (
    <button
      type="button"
      onClick={() => setStep(to)}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
    >
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png"
            alt="Marketing iO"
            className="h-12 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-1 text-sm">Tell us about your business — even small answers help us help you.</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          <ProgressBar step={step} />

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {/* ─────────── STEP 1 ─────────── */}
          {step === 1 && (
            <form onSubmit={submitStep1} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Your account</h2>

              <div className="grid grid-cols-2 gap-3">
                <TextField label="First name" required value={form.first_name} onChange={set('first_name')} placeholder="Jane" autoComplete="given-name" />
                <TextField label="Last name" required value={form.last_name} onChange={set('last_name')} placeholder="Smith" autoComplete="family-name" />
              </div>

              <TextField label="Email address" type="email" required value={form.email} onChange={set('email')} placeholder="you@business.co.za" autoComplete="email" />

              <TextField label="Mobile number (SA: 0XXXXXXXXX or +27XXXXXXXXX)" type="tel" required value={form.mobile_number} onChange={set('mobile_number')} placeholder="082 123 4567" autoComplete="tel" />

              <TextField label="City" required value={form.city} onChange={set('city')} placeholder="Johannesburg" autoComplete="address-level2" />
              <TextField label="Street address" required value={form.street_address} onChange={set('street_address')} placeholder="75 Marshall Street" autoComplete="street-address" />

              <div>
                <label className={labelClass}>Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    required
                    autoComplete="new-password"
                    className={`${inputClass} pr-10`}
                    placeholder="Min 10 chars, upper, lower, number"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.password && (
                  <p className={`text-xs mt-1 ${pwStrength.color}`}>Strength: {pwStrength.level}</p>
                )}
              </div>

              <TextField label="Confirm password" type="password" required value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" autoComplete="new-password" />

              <TextField
                label={`Security check: ${captcha.question} = ?`}
                type="number"
                required
                value={captchaInput}
                onChange={e => setCaptchaInput(e.target.value)}
                placeholder="Answer"
              />

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={form.agreed} onChange={set('agreed')} className="mt-0.5 accent-purple-500" />
                <span className="text-xs text-slate-400">
                  I agree to Marketing iO's{' '}
                  <a href="/terms" className="text-purple-400 hover:text-purple-300" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
              >
                {loading ? 'Creating account…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>

              <p className="text-center text-sm text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium">Sign in</Link>
              </p>
            </form>
          )}

          {/* ─────────── STEP 2 ─────────── */}
          {step === 2 && (
            <form onSubmit={submitStep2} className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Your business</h2>
              <p className="text-xs text-slate-400 -mt-2">Helps us tailor the pitch.</p>

              <TextField label="Business name" required value={form.business_name} onChange={set('business_name')} placeholder="Acme Trading (Pty) Ltd" />

              <Select label="Industry" required value={form.industry} onChange={set('industry')} options={INDUSTRIES} />

              <div className="grid grid-cols-2 gap-3">
                <Select label="Years in business" required value={form.years_in_business} onChange={set('years_in_business')} options={YEARS_IN_BUSINESS} />
                <Select label="Team size" required value={form.number_of_employees} onChange={set('number_of_employees')} options={EMPLOYEE_RANGES} />
              </div>

              <TextField label="City" required value={form.business_city} onChange={set('business_city')} placeholder="Polokwane" />
              <TextField label="Full address" value={form.business_address} onChange={set('business_address')} placeholder="75 Marshall Street" />
              <Select label="Province" required value={form.business_province} onChange={set('business_province')} options={PROVINCES} />

              <div className="flex items-center justify-between gap-4 pt-2">
                <BackButton to={1} />
                <button type="submit" disabled={loading} className="flex-1 py-3 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}>
                  {loading ? 'Saving…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* ─────────── STEP 3 ─────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Your story</h2>
              <p className="text-xs text-slate-400 -mt-2">Help us understand your vision — skip if you'd rather we call you.</p>

              <Select label="Where do you want your business in 12 months?" value={form.twelve_month_goal} onChange={set('twelve_month_goal')} options={TWELVE_MONTH_GOALS} />
              <Select label="What's your BIGGEST challenge right now?" value={form.biggest_challenge} onChange={set('biggest_challenge')} options={CHALLENGES} />
              <TextArea label="What inspired you to start this business?" value={form.founder_inspiration} onChange={set('founder_inspiration')} placeholder="Optional — your why." />
              <TextArea label="What's your competitor doing that you wish you were?" value={form.competitor_envy} onChange={set('competitor_envy')} placeholder="Optional — be honest." />

              <div className="flex items-center justify-between gap-4 pt-2">
                <BackButton to={2} />
                <SkipButton onClick={() => advanceStep3(true)} />
                <button type="button" onClick={() => advanceStep3(false)} disabled={loading}
                  className="py-3 px-6 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}>
                  {loading ? 'Saving…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* ─────────── STEP 4 ─────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Where you are now</h2>
              <p className="text-xs text-slate-400 -mt-2">Help us tailor our pitch — skip and we'll ask on a call.</p>

              <Select label="Current monthly revenue range" value={form.monthly_revenue_range} onChange={set('monthly_revenue_range')} options={REVENUE_RANGES} />
              <Select label="How many NEW customers per month would change your life?" value={form.new_customers_target} onChange={set('new_customers_target')} options={NEW_CUSTOMER_TARGETS} />
              <Select label="How urgently do you need results?" value={form.urgency_level} onChange={set('urgency_level')} options={URGENCY_LEVELS} />

              <CheckboxList label="Do you currently have:" values={form.current_marketing_assets} options={MARKETING_ASSETS} onToggle={v => toggleArray('current_marketing_assets', v)} />

              <Select label="Have you worked with an agency before?" value={form.agency_history} onChange={set('agency_history')} options={AGENCY_HISTORY_OPTS} />

              <div className="flex items-center justify-between gap-4 pt-2">
                <BackButton to={3} />
                <SkipButton onClick={() => advanceStep4(true)} />
                <button type="button" onClick={() => advanceStep4(false)} disabled={loading}
                  className="py-3 px-6 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}>
                  {loading ? 'Saving…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* ─────────── STEP 5 ─────────── */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">How to reach you</h2>
              <p className="text-xs text-slate-400 -mt-2">Last step — how should we follow up?</p>

              <Select label="If you were to invest in marketing, what monthly budget feels right?" value={form.monthly_marketing_budget} onChange={set('monthly_marketing_budget')} options={BUDGET_RANGES} />
              <CheckboxList label="How can we reach you?" values={form.preferred_contact_channels} options={CONTACT_CHANNELS} onToggle={v => toggleArray('preferred_contact_channels', v)} />
              <Select label="Best time to call?" value={form.best_call_time} onChange={set('best_call_time')} options={CALL_TIMES} />

              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.wants_consultation_call} onChange={set('wants_consultation_call')} className="mt-0.5 accent-purple-500" />
                  <span className="text-sm text-slate-200">I want a free 15-min consultation call</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.wants_personalized_proposal} onChange={set('wants_personalized_proposal')} className="mt-0.5 accent-purple-500" />
                  <span className="text-sm text-slate-200">Send me a personalized proposal</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer pt-2 border-t border-slate-700/60">
                  <input type="checkbox" checked={form.popia_consent} onChange={set('popia_consent')} className="mt-1 accent-purple-500" />
                  <span className="text-xs text-slate-300">
                    <strong>Required:</strong> I agree to receive communication from Marketing iO. POPIA-compliant. Opt out anytime.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <BackButton to={4} />
                <SkipButton onClick={() => submitStep5(true)} />
                <button type="button" onClick={() => submitStep5(false)} disabled={loading}
                  className="py-3 px-6 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}>
                  {loading ? 'Submitting...' : <>Submit {'&'} Verify Email <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Need help?{' '}
          <a href="mailto:support@marketingio.co.za" className="text-slate-500 hover:text-slate-400">support@marketingio.co.za</a>
        </p>
      </div>
    </div>
  );
}