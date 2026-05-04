import { getProductById } from "@/data/ProductCatalog";

const PACKAGE_IDS = ['ignite', 'accelerate', 'dominate'];

export default function LeadHero({ client, heroImageUrl, onEnquire }) {
  const firstName = client.contact_person?.split(' ')[0] || client.business_name;

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-primary/30 mb-8">
      <div className="absolute inset-0">
        {heroImageUrl && (
          <img
            src={heroImageUrl}
            alt=""
            className="w-full h-full object-cover opacity-40"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/85 to-purple-900/60" />
      </div>

      <div className="relative z-10 px-6 py-12 md:px-12 md:py-16 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-purple-400 uppercase mb-3">
          Welcome, {firstName}
        </p>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
          Let's grow {client.business_name}.
        </h1>
        <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-8">
          Pick the marketing foundation that fits where you are right now. We'll handle the rest — strategy, content, growth.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-6">
          {PACKAGE_IDS.map(packageId => {
            const product = getProductById(packageId);
            if (!product) return null;
            return (
              <button
                key={packageId}
                onClick={() => onEnquire(product)}
                className="group bg-slate-800/60 hover:bg-slate-800 backdrop-blur border border-slate-700/50 hover:border-primary rounded-xl p-5 text-left transition-all hover:scale-[1.02]"
              >
                <div className="text-3xl mb-2">{product.emoji}</div>
                <p className="text-lg font-bold text-white mb-1">{product.name}</p>
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{product.headline}</p>
                <p className="text-sm font-semibold gradient-text">
                  R{product.setup_price.toLocaleString()} setup
                  {product.monthly_price > 0 && ` + R${product.monthly_price}/mo`}
                </p>
              </button>
            );
          })}
        </div>

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
    </section>
  );
}
