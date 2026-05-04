import { useState } from 'react';
import { MapPin, Users, Edit2 } from 'lucide-react';
import LogoUploadEditor from './LogoUploadEditor';

export default function HeroSection({ client, heroImageUrl, isLoadingImage, heroCopy, onLogoUpdate }) {
  const [showLogoEditor, setShowLogoEditor] = useState(false);
  const [logoFile, setLogoFile] = useState(client?.logo_file);

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-primary/30 mb-12 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

        {/* IMAGE SIDE — fully visible, no overlay */}
        <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[420px] order-1 lg:order-1 bg-gradient-to-br from-slate-900 to-slate-950">
          {isLoadingImage ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : heroImageUrl ? (
            <img
              src={heroImageUrl}
              alt={client?.business_name || 'Your business'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 gradient-bg-subtle flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🚀</div>
                <p className="text-muted-foreground">Generating your branded hero…</p>
              </div>
            </div>
          )}
          {/* Subtle gradient on right edge only — soft transition into text panel */}
          <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-r from-transparent to-slate-950/40 hidden lg:block" />
        </div>

        {/* TEXT SIDE — emotional copy + branding */}
        <div className="relative z-10 px-6 py-10 md:px-10 md:py-12 lg:py-14 flex flex-col justify-center order-2 lg:order-2">
          <p className="text-xs font-semibold tracking-[0.2em] text-purple-400 uppercase mb-3">
            Welcome back
          </p>

          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-6 leading-tight">
            {heroCopy || `Let's keep growing ${client?.business_name}.`}
          </h2>

          {/* Branding card — logo + name + address + contact */}
          <div className="bg-slate-800/40 backdrop-blur border border-slate-700/50 rounded-xl p-5 space-y-5">
            {/* Logo + Name */}
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-lg bg-white p-2 flex items-center justify-center shadow-lg">
                  {logoFile ? (
                    <img
                      src={logoFile}
                      alt={client?.business_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center text-white font-bold text-xl">
                      {client?.business_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowLogoEditor(true)}
                  className="absolute -top-2 -right-2 bg-primary text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-white truncate">{client?.business_name}</h3>
                <p className="text-xs text-slate-400">{client?.industry || 'Business'}</p>
              </div>
            </div>

            {/* Address */}
            {client?.address && (
              <div className="flex gap-3">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Business Address</p>
                  <p className="text-sm text-slate-200 break-words">{client.address}</p>
                </div>
              </div>
            )}

            {/* Contact Info */}
            <div className="flex gap-3">
              <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Primary Contact</p>
                <p className="text-sm text-slate-200">{client?.contact_person}</p>
                <a href={`mailto:${client?.email}`} className="text-xs text-primary hover:underline break-all">
                  {client?.email}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logo Upload Modal */}
      {showLogoEditor && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-md w-full border border-border/50 p-6 sm:rounded-xl">
            <h3 className="text-lg font-bold text-foreground mb-4">Upload Business Logo</h3>
            <LogoUploadEditor
              client={client}
              onLogoUpdate={(url) => {
                setLogoFile(url);
                setShowLogoEditor(false);
                onLogoUpdate?.(url);
              }}
            />
            <button
              onClick={() => setShowLogoEditor(false)}
              className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
