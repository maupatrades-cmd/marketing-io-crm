import { Phone, Mail, Globe } from 'lucide-react';

export default function PortalFooter() {
  return (
    <footer className="border-t border-border bg-muted/40 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <a href="tel:0101020534" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <span>010 102 0534</span>
          </a>
          <a href="mailto:info@marketingio.co.za" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition">
            <Mail className="w-4 h-4 text-primary shrink-0" />
            <span>info@marketingio.co.za</span>
          </a>
          <a
            href="https://www.marketingio.co.za"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
          >
            <Globe className="w-4 h-4 text-primary shrink-0" />
            <span>www.marketingio.co.za</span>
          </a>
        </div>
        <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
          <p>Marketing iO (Pty) Ltd · CIPC 2026303502 · 75 Marshall Street, Polokwane 0699</p>
        </div>
      </div>
    </footer>
  );
}