import { useState } from 'react';
import { Phone, User, AlertTriangle, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ContactCenterModal({ client, onClose }) {
  const [view, setView] = useState('main');

  const firstName = client?.contact_person?.split(' ')[0] || 'there';

  const handleContactOwner = () => {
    const subject = encodeURIComponent(`Direct from ${client?.business_name || 'a client'} — ${client?.contact_person || ''}`);
    const body = encodeURIComponent(`Hi Thapelo,\n\n`);
    window.location.href = `mailto:head@marketingio.co.za?subject=${subject}&body=${body}`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-2xl font-bold text-white">
            {view === 'main' ? `How can we help, ${firstName}?` : 'Get in touch'}
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
                <p className="text-sm text-slate-400">Direct line to Thapelo Maupa, Founder</p>
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
