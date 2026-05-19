import { useEffect, useRef, useState } from 'react';
import { Phone, User, AlertTriangle, X, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useEscapeKey } from '@/lib/useEscapeKey';

const OWNER_EMAIL = 'head@marketingio.co.za';

export default function ContactCenterModal({ client, onClose }) {
  const [view, setView] = useState('main');
  const [fallbackReady, setFallbackReady] = useState(false);
  const fallbackTimerRef = useRef(null);

  const firstName = client?.contact_person?.split(' ')[0] || 'there';

  // Close on Escape (modal is always rendered when mounted by parent).
  useEscapeKey(true, onClose);

  useEffect(() => () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, []);

  const handleContactOwner = () => {
    const subject = encodeURIComponent('Direct message to Marketing iO Owner');
    const body = encodeURIComponent('Hi,\n\n');
    window.location.href = `mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`;
    setFallbackReady(false);
    setView('owner_fallback');
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setFallbackReady(true), 1500);
  };

  const copyOwnerEmail = async () => {
    try {
      await navigator.clipboard.writeText(OWNER_EMAIL);
      toast.success('Email address copied');
    } catch (err) {
      console.error('[ContactCenter] clipboard write failed:', err);
      toast.error('Could not copy. Please select the address manually.');
    }
  };

  const handleComplaint = () => {
    const message = `Hi Marketing iO, my name is ${client?.contact_person || 'a client'} from ${client?.business_name || 'my business'}. I would like to lodge a complaint about: `;
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/27731539633?text=${encoded}`, '_blank');

    try {
      base44.functions.invoke('log-complaint', { client_id: client?.id }).catch(err => {
        console.error('[ContactCenter] complaint log failed:', err);
      });
    } catch (err) {
      console.error('[ContactCenter] complaint trigger failed:', err);
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-2xl font-bold text-white">
            {view === 'main'
              ? `How can we help, ${firstName}?`
              : view === 'owner_fallback'
                ? 'Contact the Founder'
                : 'Get in touch'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {view === 'main' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <button
                onClick={() => setView('contact_info')}
                className="group bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-primary rounded-xl p-6 text-left transition-all"
              >
                <Phone className="w-8 h-8 text-primary mb-3" />
                <p className="text-lg font-bold text-white mb-1">Contact Us</p>
                <p className="text-sm text-slate-400">View our contact details</p>
              </button>

              <button
                onClick={handleContactOwner}
                className="group bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-primary rounded-xl p-6 text-left transition-all"
              >
                <User className="w-8 h-8 text-primary mb-3" />
                <p className="text-lg font-bold text-white mb-1">Contact Owner</p>
                <p className="text-sm text-slate-400">Send a direct message to the founder. Replies within 24 hours.</p>
              </button>

              <button
                onClick={handleComplaint}
                className="group bg-slate-800/60 hover:bg-red-950/30 border border-slate-700/50 hover:border-red-500/50 rounded-xl p-6 text-left transition-all"
              >
                <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
                <p className="text-lg font-bold text-white mb-1">Complaints</p>
                <p className="text-sm text-slate-400">Lodge a formal complaint</p>
              </button>
            </div>
          )}

          {view === 'owner_fallback' && (
            <div className="space-y-4">
              <button
                onClick={() => setView('main')}
                className="text-sm text-primary hover:underline mb-2"
              >
                ← Back
              </button>

              <div className="bg-slate-800/40 rounded-xl p-6 space-y-4">
                {!fallbackReady ? (
                  <p className="text-sm text-slate-300">Opening your email app…</p>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-slate-300 mb-1">If your email app didn't open, send a message to:</p>
                      <p className="text-base font-semibold text-white break-all">{OWNER_EMAIL}</p>
                    </div>
                    <button
                      type="button"
                      onClick={copyOwnerEmail}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-700 hover:bg-slate-600 transition"
                    >
                      <Copy className="w-4 h-4" />
                      Copy email address
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {view === 'contact_info' && (
            <div className="space-y-4">
              <button
                onClick={() => setView('main')}
                className="text-sm text-primary hover:underline mb-2"
              >
                ← Back
              </button>

              <div className="bg-slate-800/40 rounded-xl p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">☎</span>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Phone</p>
                    <a href="tel:0101020534" className="text-white hover:text-primary">010 102 0534</a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xl">✉</span>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Email</p>
                    <a href="mailto:info@marketingio.co.za" className="text-white hover:text-primary">info@marketingio.co.za</a>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xl">🌐</span>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Website</p>
                    <a href="https://www.marketingio.co.za" target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary">www.marketingio.co.za</a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-xl">📍</span>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Address</p>
                    <p className="text-white">75 Marshall Street<br/>Polokwane 0699</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xl">🕐</span>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider">Hours</p>
                    <p className="text-white">Monday - Friday, 8am - 5pm</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
