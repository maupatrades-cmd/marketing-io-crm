import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const LOGO_URL = 'https://media.base44.com/images/public/69f52863b2b733d922d90b62/ce0ebdea2_marketing_io_main_logo-removebg-preview.png';

export default function SplashScreen({ client, onDismiss }) {
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    const dismissTimer = setTimeout(() => {
      setShowSplash(false);
      onDismiss();
    }, 5500);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  if (!showSplash) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/40 rounded-full mix-blend-screen filter blur-3xl animate-blob" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/40 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000" />
      </div>

      <div className="relative z-10 text-center space-y-8">
        {/* Marketing iO Logo */}
        <div className="flex justify-center">
          <img 
            src={LOGO_URL} 
            alt="Marketing iO" 
            width={280}
            className="w-64 h-auto drop-shadow-2xl animate-fade-in"
          />
        </div>

        {/* Welcome text */}
        <div className="space-y-3 px-6">
          <h1 className="text-4xl font-bold text-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Welcome, {client?.contact_person?.split(' ')[0]}!
          </h1>
          <p className="text-lg text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
            {client?.business_name}
          </p>
        </div>

        {/* Animated loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Loading your dashboard...</span>
          </div>
        )}

        {/* Animated dots */}
        {!isLoading && (
          <div className="flex justify-center gap-2 animate-fade-in" style={{ animationDelay: '0.8s' }}>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0.1s' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
          </div>
        )}
      </div>
    </div>
  );
}