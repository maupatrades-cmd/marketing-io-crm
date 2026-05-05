import { useState } from 'react';
import { X, MessageCircle, Mail, AlertTriangle, Building2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import WhatsAppContactFlow, { buildMessage } from './WhatsAppContactFlow';

const HEAD_EMAIL = 'head@marketingio.co.za';
const MARKETING_EMAIL = 'marketing@marketingio.co.za';
const WHATSAPP_NUMBER = '27731539633';

function Card({ icon: Icon, title, subtitle, accent = 'primary', onClick }) {
  const accentClass = {
    primary: 'border-primary/40 hover:border-primary',
    success: 'border-emerald-500/40 hover:border-emerald-500',
    warning: 'border-orange-500/40 hover:border-orange-500',
    destructive: 'border-destructive/40 hover:border-destructive'
  }[accent];

  const iconAccent = {
    primary: 'text-primary',
    success: 'text-emerald-400',
    warning: 'text-orange-400',
    destructive: 'text-destructive'
  }[accent];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-slate-800/60 hover:bg-slate-800 border ${accentClass} rounded-xl p-4 min-h-[88px] transition flex items-start gap-3`}
    >
      <Icon className={`w-6 h-6 shrink-0 ${iconAccent}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>
      </div>
    </button>
  );
}

export default function ContactCenterModal({ client, user, isOpen, onClose }) {
  const [view, setView] = useState('cards'); // 'cards' | 'whatsapp_flow'

  if (!isOpen) return null;

  const handleContactOwner = () => {
    const subject = encodeURIComponent(`Contact request from ${client?.business_name || 'a client'}`);
    const body = encodeURIComponent(
      `Hi,\n\n${client?.contact_person || ''} from ${client?.business_name || ''} would like to speak with the owner.\n\n— Sent from Marketing iO Portal`
    );
    window.location.href = `mailto:${HEAD_EMAIL}?subject=${subject}&body=${body}`;
  };

  const handleHeadOfMarketing = () => {
    const subject = encodeURIComponent(`Marketing question from ${client?.business_name || 'a client'}`);
    const body = encodeURIComponent(
      `Hi Head of Marketing,\n\n${client?.contact_person || ''} from ${client?.business_name || ''} would like to discuss marketing strategy.\n\n— Sent from Marketing iO Portal`
    );
    window.location.href = `mailto:${MARKETING_EMAIL}?subject=${subject}&body=${body}`;
  };

  // Lodge Complaint — opens WhatsApp pre-filled with a complaint template AND
  // logs a high-priority complaint to ClientCommunication. We reuse the same
  // log-whatsapp-contact backend so the escalation email + audit trail are
  // identical to the guided flow.
  const handleLodgeComplaint = () => {
    const message = buildMessage(client, 'complaint', 'urgent', 'service_quality', '');
    if (client?.id) {
      base44.functions.invoke('log-whatsapp-contact', {
        client_id: client.id,
        category: 'complaint',
        urgency: 'urgent',
        specific: 'service_quality',
        free_text: 'Lodged via Lodge Complaint shortcut — please follow up.',
        message
      }).catch(err => {
        console.error('[ContactCenterModal] complaint log failed:', err);
      });
    }
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-auto">
        {view === 'cards' && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-slate-700/60 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">How can we help?</h2>
                <p className="text-xs text-slate-400 mt-0.5">Pick the option that fits your need.</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <Card
                icon={MessageCircle}
                title="Contact Us"
                subtitle="Guided WhatsApp flow — pick category, urgency, and specifics. Best for support, billing, updates."
                accent="success"
                onClick={() => setView('whatsapp_flow')}
              />
              <Card
                icon={Building2}
                title="Contact the Owner"
                subtitle="Direct email to the owner. Use for executive matters or partnership conversations."
                accent="primary"
                onClick={handleContactOwner}
              />
              <Card
                icon={Mail}
                title="Head of Marketing"
                subtitle="Email the marketing lead. Use for strategy, campaign direction, performance reviews."
                accent="warning"
                onClick={handleHeadOfMarketing}
              />
              <Card
                icon={AlertTriangle}
                title="Lodge a Complaint"
                subtitle="Formal complaint — sends WhatsApp + alerts the owner immediately. Use only for serious issues."
                accent="destructive"
                onClick={handleLodgeComplaint}
              />
            </div>

            <div className="px-5 py-3 border-t border-slate-700/60 text-center">
              <p className="text-[11px] text-slate-500">
                ☎ <a href="tel:0101020534" className="text-slate-400 hover:text-slate-200">010 102 0534</a>
                {' · '}
                <a href={`mailto:info@marketingio.co.za`} className="text-slate-400 hover:text-slate-200">info@marketingio.co.za</a>
              </p>
            </div>
          </div>
        )}

        {view === 'whatsapp_flow' && (
          <WhatsAppContactFlow
            client={client}
            user={user}
            onClose={() => { setView('cards'); onClose?.(); }}
          />
        )}
      </div>
    </div>
  );
}
