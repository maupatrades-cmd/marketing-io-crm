import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getCurrentUser, destroySession } from '@/lib/customAuth';
import { validatePassword, getPasswordStrength } from '@/lib/passwordValidator';
import { Loader2, Save, ShieldCheck, Bell, Trash2, AlertTriangle, KeyRound, LogOut } from 'lucide-react';

const NOTIFICATION_KEYS = [
  { key: 'email_invoice_issued',     label: 'Email when an invoice is issued' },
  { key: 'email_deliverable_ready',  label: 'Email when a deliverable is ready for review' },
  { key: 'email_monthly_report',     label: 'Email when a monthly report is ready' },
  { key: 'email_payment_received',   label: 'Email when a payment is received' }
];

const SA_PHONE_RE = /^(\+27\d{9}|0\d{9})$/;

function parseNotificationPrefs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-ZA', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

function Section({ icon: Icon, title, subtitle, accent = 'default', children }) {
  const accentBorder = {
    default: 'border-slate-700/60',
    danger:  'border-rose-500/40'
  }[accent];
  return (
    <section className={`glass rounded-2xl p-6 border ${accentBorder}`}>
      <div className="flex items-start gap-3 mb-4">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${accent === 'danger' ? 'text-rose-400' : 'text-primary'}`} />
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', readOnly = false, hint, error }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/60 ${
          error ? 'border-rose-500/60' : 'border-slate-700/60'
        } ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
      />
      {hint && !error && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`flex items-center justify-between gap-3 py-2 ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-sm text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-primary' : 'bg-slate-700'
        }`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}

export default function ClientSettings() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  // Account
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Security
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);
  const [recentLogins, setRecentLogins] = useState([]);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

  // Notifications
  const [prefs, setPrefs] = useState({});
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Danger Zone
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await getCurrentUser();
      if (!me) { setLoading(false); return; }
      if (cancelled) return;
      setUser(me);
      setFullName(me.full_name || '');
      setMobileNumber(me.mobile_number || '');

      try {
        const clients = await base44.entities.Client.filter({ email: me.email });
        const c = Array.isArray(clients) ? clients[0] : clients;
        if (cancelled) return;
        if (c) {
          setClient(c);
          setPrefs(parseNotificationPrefs(c.notification_preferences));
        }
      } catch (err) {
        console.error('[ClientSettings] client load failed:', err);
      }

      try {
        const attempts = await base44.entities.LoginAttempt
          .filter({ email_attempted: me.email }, '-created_date', 5)
          .catch(() => []);
        if (!cancelled) setRecentLogins(Array.isArray(attempts) ? attempts : []);
      } catch (err) {
        console.error('[ClientSettings] login attempts load failed:', err);
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const mobileError = useMemo(() => {
    if (!mobileNumber) return null;
    return SA_PHONE_RE.test(mobileNumber) ? null : 'Use SA format: 0XXXXXXXXX or +27XXXXXXXXX';
  }, [mobileNumber]);

  const pwStrength = useMemo(() => newPw ? getPasswordStrength(newPw) : null, [newPw]);
  const pwIssues = useMemo(() => newPw ? validatePassword(newPw).errors : [], [newPw]);

  // ------ Account save ----------------------------------------------------
  const handleSaveAccount = async () => {
    if (!user?.id) return;
    if (mobileError) {
      toast.error(mobileError);
      return;
    }
    if (!fullName.trim()) {
      toast.error('Full name is required.');
      return;
    }
    setSavingAccount(true);
    try {
      const payload = { full_name: fullName.trim(), mobile_number: mobileNumber || '' };
      await base44.entities.AppUser.update(user.id, payload);
      // Mirror into Client.contact_person + phone for consistency.
      if (client?.id) {
        try {
          await base44.entities.Client.update(client.id, {
            contact_person: fullName.trim(),
            phone: mobileNumber || client.phone || ''
          });
        } catch (err) {
          console.error('[ClientSettings] client mirror update failed:', err);
        }
      }
      setUser(prev => prev ? { ...prev, ...payload } : prev);
      toast.success('Account details saved');
    } catch (err) {
      console.error('[ClientSettings] account save failed:', err);
      toast.error('Could not save. Please try again.');
    } finally {
      setSavingAccount(false);
    }
  };

  // ------ Change password ------------------------------------------------
  const handleChangePassword = async () => {
    if (!user?.id) return;
    if (!currentPw || !newPw || !confirmPw) {
      toast.error('Fill in all password fields.');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('New passwords do not match.');
      return;
    }
    const v = validatePassword(newPw);
    if (!v.valid) {
      toast.error(v.errors[0]);
      return;
    }
    setChangingPw(true);
    try {
      const res = await base44.functions.invoke('change-password', {
        user_id: user.id,
        current_password: currentPw,
        new_password: newPw
      });
      const data = res?.data ?? res;
      if (data?.error) {
        const map = {
          wrong_current_password: 'Current password is incorrect.',
          same_as_old: 'New password must be different from the current one.',
          invalid_new_password: data.detail?.[0] || 'New password is invalid.',
          user_not_found: 'Account not found. Please sign in again.'
        };
        toast.error(map[data.error] || 'Could not change password.');
        return;
      }
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      toast.success('Password changed successfully');
    } catch (err) {
      console.error('[ClientSettings] change-password failed:', err);
      toast.error('Could not change password. Please try again.');
    } finally {
      setChangingPw(false);
    }
  };

  // ------ Sign out everywhere -------------------------------------------
  const handleSignOutEverywhere = async () => {
    if (!user?.id) return;
    setSigningOutEverywhere(true);
    try {
      await base44.functions.invoke('sign-out-everywhere', { user_id: user.id });
      try { await destroySession(user.id); } catch (_) {}
      toast.success('Signed out everywhere. Other devices will log out shortly.');
      setTimeout(() => { window.location.href = '/login'; }, 800);
    } catch (err) {
      console.error('[ClientSettings] sign-out-everywhere failed:', err);
      toast.error('Could not sign out everywhere. Please try again.');
    } finally {
      setSigningOutEverywhere(false);
    }
  };

  // ------ Notifications save --------------------------------------------
  const togglePref = (key, value) => setPrefs(prev => ({ ...prev, [key]: value }));

  const handleSavePrefs = async () => {
    if (!client?.id) return;
    setSavingPrefs(true);
    try {
      await base44.entities.Client.update(client.id, {
        notification_preferences: JSON.stringify(prefs)
      });
      toast.success('Notification preferences saved');
    } catch (err) {
      console.error('[ClientSettings] prefs save failed:', err);
      toast.error('Could not save preferences. Please try again.');
    } finally {
      setSavingPrefs(false);
    }
  };

  // ------ Delete account ------------------------------------------------
  const canConfirmDelete = confirmDeleteText.trim().toUpperCase() === 'DELETE';
  const handleDeleteAccount = async () => {
    if (!user?.id || !canConfirmDelete) return;
    setDeleting(true);
    try {
      const res = await base44.functions.invoke('request-account-deletion', {
        user_id: user.id,
        token: localStorage.getItem('mio_session_token'),
      });
      const data = res?.data ?? res;
      if (data?.success) {
        toast.success('Deletion requested. You will be signed out.');
        try { await destroySession(user.id); } catch (_) {}
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else {
        toast.error('Could not request deletion. Please try again.');
      }
    } catch (err) {
      console.error('[ClientSettings] deletion failed:', err);
      toast.error('Could not request deletion. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-10">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-400">Account, security, notifications and account controls.</p>
        </header>

        {/* 1. Account ---------------------------------------------------- */}
        <Section icon={Save} title="Account" subtitle="Your login identity and contact details.">
          <Field label="Email" value={user?.email || ''} readOnly hint="Contact support to change. Email is your login key and the address we send updates to." />
          <Field label="Full name" value={fullName} onChange={setFullName} />
          <Field
            label="Mobile number"
            value={mobileNumber}
            onChange={setMobileNumber}
            hint="SA format: 0XXXXXXXXX or +27XXXXXXXXX"
            error={mobileError || undefined}
          />
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSaveAccount}
              disabled={savingAccount}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white gradient-bg disabled:opacity-60"
            >
              {savingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingAccount ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Section>

        {/* 2. Security --------------------------------------------------- */}
        <Section icon={ShieldCheck} title="Security" subtitle="Password, 2FA, and recent activity.">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-200">Two-factor authentication: <strong>Enabled (mandatory)</strong></span>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-white flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> Change password</p>
            <Field label="Current password" type="password" value={currentPw} onChange={setCurrentPw} />
            <Field label="New password" type="password" value={newPw} onChange={setNewPw} />
            {newPw && (
              <div className="text-[11px] -mt-1 space-y-0.5">
                <p className={pwStrength?.color || 'text-slate-500'}>Strength: {pwStrength?.level || ''}</p>
                {pwIssues.map(e => <p key={e} className="text-rose-400">• {e}</p>)}
              </div>
            )}
            <Field label="Confirm new password" type="password" value={confirmPw} onChange={setConfirmPw}
              error={confirmPw && confirmPw !== newPw ? 'Does not match new password' : undefined} />
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={changingPw}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white gradient-bg disabled:opacity-60"
            >
              {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {changingPw ? 'Updating…' : 'Update password'}
            </button>
          </div>

          <div className="pt-3 border-t border-slate-700/40">
            <p className="text-sm font-semibold text-white mb-2">Recent activity</p>
            {recentLogins.length === 0 && (
              <p className="text-xs text-slate-500">No recent login attempts on record.</p>
            )}
            {recentLogins.length > 0 && (
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left py-1">Date</th>
                    <th className="text-left py-1">IP</th>
                    <th className="text-left py-1">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentLogins.map(a => (
                    <tr key={a.id}>
                      <td className="py-1.5 text-slate-300">{fmtDate(a.created_date)}</td>
                      <td className="py-1.5 text-slate-400">{a.ip_address || '—'}</td>
                      <td className="py-1.5">
                        {a.success ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-700/40 text-emerald-100">success</span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-rose-900/40 text-rose-200">{a.failure_reason || 'failed'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="pt-3 border-t border-slate-700/40">
            <button
              type="button"
              onClick={handleSignOutEverywhere}
              disabled={signingOutEverywhere}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60"
            >
              {signingOutEverywhere ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              {signingOutEverywhere ? 'Signing out…' : 'Sign out everywhere'}
            </button>
            <p className="text-[11px] text-slate-500 mt-1">Invalidates all active sessions. Other devices may take a moment to log out.</p>
          </div>
        </Section>

        {/* 3. Notifications --------------------------------------------- */}
        <Section icon={Bell} title="Notifications" subtitle="Choose which events email you. WhatsApp / SMS coming soon.">
          {NOTIFICATION_KEYS.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={prefs[key] !== false}
              onChange={(v) => togglePref(key, v)}
            />
          ))}
          <div className="pt-2 border-t border-slate-700/40 mt-2">
            <Toggle label="WhatsApp / SMS notifications" checked={false} disabled onChange={() => {}} />
            <p className="text-[11px] text-slate-500 -mt-1">Coming soon — channel not wired yet.</p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSavePrefs}
              disabled={savingPrefs || !client?.id}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white gradient-bg disabled:opacity-60"
            >
              {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingPrefs ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </Section>

        {/* 4. Danger Zone ----------------------------------------------- */}
        <Section icon={AlertTriangle} title="Danger zone" subtitle="Irreversible actions." accent="danger">
          {!confirmDeleteOpen && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-rose-200 bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/40"
            >
              <Trash2 className="w-4 h-4" />
              Delete account
            </button>
          )}

          {confirmDeleteOpen && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 space-y-3">
              <p className="text-sm text-rose-100">
                <strong>This starts a 30-day grace period.</strong> Your account is marked for deletion and you'll be signed out. Sign back in any time within 30 days to cancel — after that, the account is permanently deleted per POPIA.
              </p>
              <Field
                label="Type DELETE to confirm"
                value={confirmDeleteText}
                onChange={setConfirmDeleteText}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={!canConfirmDelete || deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {deleting ? 'Requesting…' : 'Permanently delete account'}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirmDeleteOpen(false); setConfirmDeleteText(''); }}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}