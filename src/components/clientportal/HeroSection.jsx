import { useState, useEffect } from 'react';
import { MapPin, Globe, Users, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LogoUploadEditor from './LogoUploadEditor';

export default function HeroSection({ client, heroImageUrl, isLoadingImage, copy, onLogoUpdate }) {
  const [showLogoEditor, setShowLogoEditor] = useState(false);
  const [logoFile, setLogoFile] = useState(client?.logo_file);
  return (
    <div className="relative rounded-2xl overflow-hidden mb-12 glass border-primary/30 border-2">
      {/* Hero Image Background */}
      <div className="relative h-80 sm:h-96 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950">
        {isLoadingImage ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : heroImageUrl ? (
          <img 
            src={heroImageUrl} 
            alt={client?.business_name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 gradient-bg-subtle flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🚀</div>
              <p className="text-muted-foreground">Generating your branded hero...</p>
            </div>
          </div>
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

        {copy && (
          <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-8 sm:px-10 sm:pb-12">
            <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white max-w-3xl drop-shadow-lg leading-tight">
              {copy}
            </p>
          </div>
        )}
      </div>

      {/* Client Branding Section */}
      <div className="relative -mt-20 mx-6 mb-6 z-10">
        <div className="glass rounded-xl p-6 border border-border/50 backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Logo + Name */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="w-20 h-20 rounded-lg bg-white p-2 flex items-center justify-center shadow-lg">
                  {logoFile ? (
                    <img 
                      src={logoFile} 
                      alt={client.business_name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center text-white font-bold text-2xl">
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
              <div>
                <h2 className="text-2xl font-bold text-foreground">{client?.business_name}</h2>
                <p className="text-sm text-muted-foreground">{client?.industry || 'Business'}</p>
              </div>
            </div>

            {/* Address */}
            {client?.address && (
              <div className="flex gap-3">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Business Address</p>
                  <p className="text-sm text-foreground">{client.address}</p>
                </div>
              </div>
            )}

            {/* Contact Info */}
            <div className="flex gap-3">
              <Users className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Primary Contact</p>
                <p className="text-sm text-foreground">{client?.contact_person}</p>
                <a href={`mailto:${client?.email}`} className="text-xs text-primary hover:underline">
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
    </div>
  );
}