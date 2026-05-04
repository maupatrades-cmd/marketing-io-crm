import { getProductById } from "@/data/ProductCatalog";

const PACKAGE_IDS = ['ignite', 'accelerate', 'dominate'];

export default function LeadHero({ client, heroImageUrl, heroCopy, onEnquire }) {
  const firstName = client.contact_person?.split(' ')[0] || client.business_name;

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-primary/30 mb-8 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">

        {/* IMAGE SIDE — fully visible, no overlay */}
        <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[500px] order-1 lg:order-1">
          {heroImageUrl ? (
            <img
              src={heroImageUrl}
              alt="Your business future"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
              <div className="text-6xl opacity-50">🚀</div>
            </div>
          )}
          {/* Subtle gradient on edges only — for blend with text side */}
          <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-r from-transparent to-slate-950/40 hidden lg:block" />
        </div>

        {/* TEXT SIDE — readable, clean */}
        <div className="relative z-10 px-6 py-10 md:px-10 md:py-12 lg:py-16 flex flex-col justify-center order-2 lg:order-2">

          <p className="text-xs font-semibold tracking-[0.2em] text-purple-400 uppercase mb-3">
            Welcome, {firstName}
          </p>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 leading-tight">
            {heroCopy || `Let's grow ${client.business_name}.`}
          </h1>

          <p className="text-base text-slate-300 mb-8 leading-relaxed">
            Pick the marketing foundation that fits where you are right now. We handle the rest — strategy, content, growth.
          </p>

          {/* 3 package CTA cards — stacked vertically on this side */}
          <div className="space-y-3 mb-6">
            {PACKAGE_IDS.map(packageId => {
              const product = getProductById(packageId);
              if (!product) return null;
              return (
                <button
                  key={packageId}
                  onClick={() => onEnquire(product)}
                  className="group w-full bg-slate-800/60 hover:bg-slate-800 backdrop-blur border border-slate-700/50 hover:border-primary rounded-xl p-4 text-left transition-all hover:scale-[1.01] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-2xl shrink-0">{product.emoji || '🚀'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-white">{product.name}</p>
                      <p className="text-xs text-slate-400 line-clamp-1">{product.headline}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold gradient-text">
                      R{product.setup_price?.toLocaleString() || '—'}
                    </p>
                    {product.monthly_price > 0 && (
                      <p className="text-xs text-slate-500">+ R{product.monthly_price}/mo</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* "Not sure" link */}
          <p className="text-sm text-slate-400">
            Not sure which fits?{' '}
            <button
              onClick={() => window.location.href = '/client/messages'}
              className="text-primary hover:underline font-medium"
            >
              Talk to a consultant →
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
