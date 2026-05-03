import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { hashPassword, generateOTP } from '@/lib/customAuth';
import { validatePassword, getPasswordStrength } from '@/lib/passwordValidator';

function makeCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b}`, answer: a + b };
}

export default function Register() {
  const navigate = useNavigate();
  const [captcha] = useState(makeCaptcha);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', businessName: '', password: '', confirmPassword: '', agreed: false });
  const [captchaInput, setCaptchaInput] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const pwStrength = getPasswordStrength(form.password);
  const pwValidation = validatePassword(form.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (parseInt(captchaInput) !== captcha.answer) { setError('Incorrect answer to the security question.'); return; }
    if (!form.agreed) { setError('Please agree to the Terms of Service to continue.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!pwValidation.valid) { setError(pwValidation.errors[0]); return; }

    setLoading(true);
    let createdUserId = null;
    let createdClientId = null;

    try {
      const existing = await base44.entities.User.filter({ email: form.email.toLowerCase().trim() });
      if (existing && existing.length > 0) {
        setError('An account with this email already exists. Please sign in.');
        setLoading(false);
        return;
      }

      const passwordHash = hashPassword(form.password);

      const newUser = await base44.entities.User.create({
        email: form.email.toLowerCase().trim(),
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        role: 'client',
        password_hash: passwordHash,
        pending_verification: true,
        email_verified: false,
        failed_login_count: 0
      });
      createdUserId = newUser.id;

      const newClient = await base44.entities.Client.create({
        business_name: form.businessName.trim(),
        contact_person: form.fullName.trim(),
        email: form.email.toLowerCase().trim(),
        phone: form.phone.trim(),
        status: 'lead',
        client_user_id: newUser.id,
        portal_invitation_sent_at: new Date().toISOString()
      });
      createdClientId = newClient.id;

      const otp = generateOTP();
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await base44.entities.OTPCode.create({
        email: form.email.toLowerCase().trim(),
        code: otp,
        purpose: 'signup_verification',
        expires_at: expires,
        used: false,
        generated_at: new Date().toISOString(),
        user_id: newUser.id
      });

      try {
        await base44.integrations.Core.SendEmail({
          to: form.email,
          subject: 'Verify your Marketing iO account',
          body: `Hi ${form.fullName},\n\nWelcome to Marketing iO!\n\nYour verification code is: ${otp}\n\nThis code expires in 15 minutes.\n\n— The Marketing iO Team`
        });
      } catch (emailErr) {
        console.error('OTP email failed:', emailErr);
      }

      navigate(`/verify-otp?email=${encodeURIComponent(form.email.toLowerCase().trim())}&purpose=signup_verification`);
    } catch (err) {
      console.error('Signup error:', err);
      if (createdClientId) { try { await base44.entities.Client.delete(createdClientId); } catch (_) {} }
      if (createdUserId) { try { await base44.entities.User.delete(createdUserId); } catch (_) {} }
      setError('Something went wrong creating your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="h-10 mx-auto mb-4 object-contain"
            style={{ filter: 'invert(1) brightness(2)', mixBlendMode: 'screen' }}
          />
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-1 text-sm">Client portal access (staff are invited by admin)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Full name *</label>
              <input type="text" value={form.fullName} onChange={set('fullName')} required
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Business name *</label>
              <input type="text" value={form.businessName} onChange={set('businessName')} required
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Acme Ltd" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Email address *</label>
            <input type="email" value={form.email} onChange={set('email')} required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="you@business.co.za" />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Phone (SA format)</label>
            <input type="tel" value={form.phone} onChange={set('phone')}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="082 123 4567" />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Password *</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Min 10 chars, upper, lower, number" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.password && (
              <p className={`text-xs mt-1 ${pwStrength.color}`}>Strength: {pwStrength.level}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Confirm password *</label>
            <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Repeat password" />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Security check: {captcha.question} = ?</label>
            <input type="number" value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} required
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Answer" />
          </div>

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
            className="w-full py-2.5 rounded-lg font-semibold text-white text-sm transition disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium">Sign in</Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Need help?{' '}
          <a href="mailto:support@marketingio.co.za" className="text-slate-500 hover:text-slate-400">support@marketingio.co.za</a>
        </p>
      </div>
    </div>
  );
}