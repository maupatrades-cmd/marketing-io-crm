import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, MessageCircle, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const WHATSAPP_NUMBER = '27731539633';

export const ISSUE_CATEGORIES = {
  fulfillment: {
    icon: '🔧',
    label: 'Project / Fulfillment',
    specifics: [
      { id: 'no_movement', label: 'No movement on my project' },
      { id: 'missed_deadline', label: 'Missed deadline' },
      { id: 'quality', label: 'Quality concern' },
      { id: 'scope', label: 'Need clarification on scope' },
      { id: 'change_request', label: 'Want to add or change something' }
    ]
  },
  billing: {
    icon: '💳',
    label: 'Billing / Payment',
    specifics: [
      { id: 'debit_failed', label: 'Debit order failed' },
      { id: 'wrong_amount', label: 'Wrong amount charged' },
      { id: 'need_invoice', label: 'Need an invoice' },
      { id: 'change_package', label: 'Want to change package' },
      { id: 'cancel', label: 'Want to cancel' }
    ]
  },
  updates: {
    icon: '📊',
    label: 'Updates / Status',
    specifics: [
      { id: 'deliverables_status', label: 'Status of my deliverables' },
      { id: 'phase_question', label: 'Phase tracker question' },
      { id: 'performance', label: 'Performance / results report' },
      { id: 'campaign_start', label: 'When will my campaign start' }
    ]
  },
  complaint: {
    icon: '🚨',
    label: 'Complaint / Issue',
    specifics: [
      { id: 'service_quality', label: 'Service quality' },
      { id: 'response_time', label: 'Response time' },
      { id: 'communication', label: 'Communication issue' },
      { id: 'promised_vs_delivered', label: 'Promised vs delivered' },
      { id: 'staff_conduct', label: 'Staff conduct' }
    ]
  },
  new_request: {
    icon: '📝',
    label: 'New Request',
    specifics: [
      { id: 'add_product', label: 'Add another product' },
      { id: 'custom_package', label: 'Custom package' },
      { id: 'refer_friend', label: 'Refer a friend' },
      { id: 'partnership', label: 'Speak about partnership' }
    ]
  },
  general: {
    icon: '❓',
    label: 'General',
    specifics: [
      { id: 'just_question', label: 'Just have a question' },
      { id: 'want_advice', label: 'Want advice' },
      { id: 'best_practice', label: 'Marketing best practice' },
      { id: 'other', label: 'Other' }
    ]
  }
};

export const URGENCY_LEVELS = [
  { id: 'urgent', emoji: '🔴', label: 'URGENT', desc: 'Affecting my business now' },
  { id: 'high', emoji: '🟠', label: 'HIGH', desc: 'Need response within 24 hours' },
  { id: 'normal', emoji: '🟡', label: 'NORMAL', desc: 'Within a few days is fine' },
  { id: 'low', emoji: '🟢', label: 'LOW', desc: 'When convenient' }
];

export function buildMessage(client, category, urgency, specific, freeText) {
  const cat = ISSUE_CATEGORIES[category];
  const urg = URGENCY_LEVELS.find(u => u.id === urgency);
  const spec = cat?.specifics.find(s => s.id === specific);

  let msg = `Hi Marketing iO, my name is ${client?.contact_person || 'a client'} from ${client?.business_name || 'my business'}.\n\n`;
  msg += `${cat?.icon || ''} *${cat?.label || ''}* issue — ${urg?.emoji || ''} *${urg?.label || ''}* priority\n\n`;
  msg += `Specifically: *${spec?.label || ''}*\n\n`;
  if (freeText && freeText.trim()) {
    msg += `Additional details: ${freeText.trim()}\n\n`;
  }
  msg += `Please assist when you can. Thank you!`;
  return msg;
}

function ProgressDots({ step }) {
  // 4 dots, filled = completed steps. Review screen = all 4 filled.
  const filled = step === 'review' ? 4 : step;
  return (
    <div className="flex items-center justify-center gap-2 mb-1">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i <= filled ? 'bg-primary' : 'bg-slate-700'
          }`}
        />
      ))}
    </div>
  );
}

function StepHeader({ step, onBack, onClose }) {
  const labels = {
    1: 'Step 1 of 4',
    2: 'Step 2 of 4',
    3: 'Step 3 of 4',
    4: 'Step 4 of 4',
    review: 'Review & Send'
  };
  return (
    <div className="px-5 pt-4 pb-3 border-b border-slate-700/60">
      <div className="flex items-center justify-between mb-2">
        {step !== 1 ? (
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        ) : <div className="w-10" />}
        <ProgressDots step={step} />
        <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-center text-xs text-slate-500">{labels[step]}</p>
    </div>
  );
}

export default function WhatsAppContactFlow({ client, onClose }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [urgency, setUrgency] = useState(null);
  const [specific, setSpecific] = useState(null);
  const [freeText, setFreeText] = useState('');
  const [sending, setSending] = useState(false);

  const goBack = () => {
    if (step === 'review') return setStep(4);
    if (step > 1) return setStep(step - 1);
  };

  const restart = () => {
    setStep(1);
    setCategory(null);
    setUrgency(null);
    setSpecific(null);
    setFreeText('');
  };

  const message = useMemo(() => {
    if (!category || !urgency || !specific) return '';
    return buildMessage(client, category, urgency, specific, freeText);
  }, [client, category, urgency, specific, freeText]);

  const handleSend = () => {
    if (!message) return;
    setSending(true);
    // Fire-and-forget — never block opening WhatsApp on the log call.
    if (client?.id) {
      base44.functions.invoke('log-whatsapp-contact', {
        client_id: client.id,
        category,
        urgency,
        specific,
        free_text: freeText,
        message
      }).catch(err => {
        console.error('[WhatsAppContactFlow] log failed:', err);
      });
    }
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener');
    setSending(false);
    onClose?.();
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
      <StepHeader step={step} onBack={goBack} onClose={onClose} />

      <div className="p-5">
        {/* STEP 1 — Category */}
        {step === 1 && (
          <div>
            <h3 className="text-base font-bold text-white mb-1">What is this about?</h3>
            <p className="text-xs text-slate-400 mb-4">Pick the closest match.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(ISSUE_CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => { setCategory(key); setStep(2); }}
                  className="flex items-center gap-3 px-4 py-3 min-h-[56px] rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-primary text-left transition"
                >
                  <span className="text-2xl shrink-0">{cat.icon}</span>
                  <span className="text-sm font-medium text-white">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — Urgency */}
        {step === 2 && (
          <div>
            <h3 className="text-base font-bold text-white mb-1">How urgent is it?</h3>
            <p className="text-xs text-slate-400 mb-4">Helps us prioritise.</p>
            <div className="space-y-2">
              {URGENCY_LEVELS.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setUrgency(u.id); setStep(3); }}
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-primary text-left transition"
                >
                  <span className="text-2xl shrink-0">{u.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">{u.label}</p>
                    <p className="text-xs text-slate-400">{u.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3 — Specific */}
        {step === 3 && category && (
          <div>
            <h3 className="text-base font-bold text-white mb-1">
              {ISSUE_CATEGORIES[category].icon} {ISSUE_CATEGORIES[category].label} — what specifically?
            </h3>
            <p className="text-xs text-slate-400 mb-4">Pick the closest option.</p>
            <div className="space-y-2">
              {ISSUE_CATEGORIES[category].specifics.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSpecific(s.id); setStep(4); }}
                  className="w-full px-4 py-3 min-h-[44px] rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 hover:border-primary text-left text-sm text-white transition"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4 — Free text */}
        {step === 4 && (
          <div>
            <h3 className="text-base font-bold text-white mb-1">Add any details (optional)</h3>
            <p className="text-xs text-slate-400 mb-4">Anything specific that might help us prepare.</p>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value.slice(0, 200))}
              maxLength={200}
              rows={4}
              placeholder="Add any specifics that might help us prepare..."
              className="w-full bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/60 resize-none"
            />
            <p className="text-[10px] text-slate-500 text-right mt-1">{freeText.length}/200</p>

            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setStep('review')}
                className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
              >
                Skip
              </button>
              <button
                onClick={() => setStep('review')}
                className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white transition flex items-center justify-center gap-1"
                style={{ background: 'linear-gradient(135deg, #a764e6 0%, #ec4899 100%)' }}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* REVIEW */}
        {step === 'review' && (
          <div>
            <h3 className="text-base font-bold text-white mb-1">Ready to send</h3>
            <p className="text-xs text-slate-400 mb-3">Here's the message we'll send via WhatsApp.</p>

            <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
              <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={restart}
                className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
              >
                Edit
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-bold text-white transition flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}
              >
                <MessageCircle className="w-4 h-4" />
                Send via WhatsApp →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
