import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

const PREF_LABELS = {
  marketing_opted_in:    'Welcome & onboarding emails',
  newsletter_opted_in:   'Monthly newsletter',
  spotlight_opted_in:    'Service spotlights',
  anniversary_opted_in:  'Anniversary & milestone emails',
  reengagement_opted_in: 'Re-engagement reminders',
};

// Two distinct token sources resolve to two different UIs:
//   - 'email_preferences' → checkbox grid (logged-in marketing prefs)
//   - 'abandoned_cart'    → single confirm step for the abandoned-cart sequence
export default function Unsubscribe() {
  const [token,   setToken]   = useState('');
  const [kind,    setKind]    = useState(null); // 'email_preferences' | 'abandoned_cart'
  const [email,   setEmail]   = useState('');
  const [packageId, setPackageId] = useState('');
  const [prefs,   setPrefs]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    setToken(t || '');
    if (t) loadToken(t);
    else { setError('Invalid unsubscribe link.'); setLoading(false); }
  }, []);

  const loadToken = async (t) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('unsubscribe', { token: t });
      const data = res?.data ?? res;
      if (data?.error) {
        setError('This unsubscribe link is invalid or has expired.');
        setLoading(false);
        return;
      }
      setKind(data.kind || 'email_preferences');
      setEmail(data.email || '');

      if (data.kind === 'abandoned_cart') {
        setPackageId(data.package_id || '');
        // Buyer clicked the link a second time — already unsubscribed.
        // Render success state immediately.
        if (data.already_unsubscribed) setSaved(true);
      } else {
        setPrefs({
          marketing_opted_in:    data.marketing_opted_in    !== false,
          newsletter_opted_in:   data.newsletter_opted_in   !== false,
          spotlight_opted_in:    data.spotlight_opted_in    !== false,
          anniversary_opted_in:  data.anniversary_opted_in  !== false,
          reengagement_opted_in: data.reengagement_opted_in !== false,
        });
      }
    } catch (err) {
      setError('This unsubscribe link is invalid or has expired.');
    }
    setLoading(false);
  };

  const handleUnsubscribeAll = () => {
    setPrefs({
      marketing_opted_in:    false,
      newsletter_opted_in:   false,
      spotlight_opted_in:    false,
      anniversary_opted_in:  false,
      reengagement_opted_in: false,
    });
  };

  const handleSavePrefs = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('unsubscribe', { token, preferences: prefs });
      setSaved(true);
    } catch (err) {
      setError('Failed to save preferences. Please try again.');
    }
    setSaving(false);
  };

  const handleConfirmAbandonedCart = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('unsubscribe', {
        token,
        confirm_unsubscribe: true,
      });
      const data = res?.data ?? res;
      if (data?.error) {
        setError('Failed to unsubscribe. Please try again.');
      } else {
        setSaved(true);
      }
    } catch (err) {
      setError('Failed to unsubscribe. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #1c1030 50%, #0a0a14 100%)' }}>
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="h-10 object-contain mx-auto mb-4"
            style={{ filter: 'invert(1) brightness(2)', mixBlendMode: 'screen' }}
          />
          <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.5)' }}>Too good to stay hidden.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(28,28,48,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Gradient bar */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, #a764e6 0%, #ec4899 100%)' }} />

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
                <p className="text-destructive font-medium">{error}</p>
              </div>
            ) : saved && kind === 'abandoned_cart' ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">You're unsubscribed</h2>
                <p className="text-sm" style={{ color: '#a8a8c0' }}>
                  We won't send any more recovery emails to <strong>{email}</strong>.
                </p>
              </div>
            ) : saved ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Preferences saved</h2>
                <p className="text-sm" style={{ color: '#a8a8c0' }}>
                  Your email preferences for <strong>{email}</strong> have been updated.
                </p>
              </div>
            ) : kind === 'abandoned_cart' ? (
              <>
                <h2 className="text-xl font-bold text-white mb-2">Stop these emails?</h2>
                <p className="text-sm mb-6" style={{ color: '#a8a8c0' }}>
                  We've been emailing <strong className="text-white">{email}</strong> about
                  the {packageId ? <strong className="text-white">{packageId}</strong> : 'package'} you started checking out.
                  Confirm below and we'll stop.
                </p>

                <div className="space-y-3">
                  <Button
                    onClick={handleConfirmAbandonedCart}
                    disabled={saving}
                    className="w-full gradient-bg font-semibold"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Yes, unsubscribe me
                  </Button>
                  <p className="text-xs text-center" style={{ color: '#6b6b85' }}>
                    This only stops abandoned-cart emails. You'll still get receipts and other transactional messages if you place an order.
                  </p>
                </div>
              </>
            ) : prefs ? (
              <>
                <h2 className="text-xl font-bold text-white mb-2">Email Preferences</h2>
                <p className="text-sm mb-6" style={{ color: '#a8a8c0' }}>
                  Manage what Marketing iO sends to <strong className="text-white">{email}</strong>
                </p>

                <div className="space-y-3 mb-6">
                  {Object.entries(PREF_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer group">
                      <div
                        onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          prefs[key]
                            ? 'border-primary bg-primary'
                            : 'border-gray-600 bg-transparent'
                        }`}
                      >
                        {prefs[key] && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm" style={{ color: prefs[key] ? '#f4f4fa' : '#6b6b85' }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleSavePrefs}
                    disabled={saving}
                    className="w-full gradient-bg font-semibold"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Save Preferences
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleUnsubscribeAll}
                    className="w-full text-xs"
                    style={{ color: '#6b6b85' }}
                  >
                    Unsubscribe from all marketing emails
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#475569' }}>
          Marketing iO (Pty) Ltd · 75 Marshall Street, Polokwane 0699
        </p>
      </div>
    </div>
  );
}
