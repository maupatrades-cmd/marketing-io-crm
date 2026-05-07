import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { isActivePackage } from "@/config/payfastPackages";

// ProductCatalog ids use underscores (`street_pulse`, `ai_chatbot`, …) but
// the PayFast package catalogue uses hyphens (`street-pulse`, `ai-chatbot`).
// Convert one to the other; returns null if the product doesn't map to a
// live PayFast package (e.g. `reputation_management` is sold via enquiry).
function toPayfastPackageId(productId) {
  const id = String(productId || '').replace(/_/g, '-');
  return isActivePackage(id) ? id : null;
}

function buyButtonLabel(product) {
  const setup = Number(product.setup_price || 0);
  const monthly = Number(product.monthly_price || 0);
  if (setup > 0 && monthly > 0) return `Get Started — R${setup.toLocaleString()} setup`;
  if (setup > 0 && monthly === 0) return `Buy Now — R${setup.toLocaleString()}`;
  if (setup === 0 && monthly > 0) return `Subscribe — R${monthly.toLocaleString()}/mo`;
  return null;
}

export default function ProductCard({ product, isActive, onEnquire, onContact, client, imageUrl }) {
  const [hovering, setHovering] = useState(false);
  const [imageLoading, setImageLoading] = useState(!!imageUrl);
  const [imageError, setImageError] = useState(false);

  const totalValue = product.setup_price + (product.monthly_price * (product.term_months || 0));

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`rounded-2xl bg-slate-900 border transition-all duration-300 ${
        hovering
          ? "border-purple-500/30 shadow-lg shadow-purple-500/20 translate-y-[-2px]"
          : "border-slate-800"
      } overflow-hidden`}
    >
      {/* Image Section */}
      <div className="w-full aspect-video bg-gradient-to-br from-purple-900/40 to-pink-900/40 relative overflow-hidden">
        {/* AI-Generated Image or Fallback */}
        {imageUrl && !imageError ? (
          <>
            <img
              src={imageUrl}
              alt={product.name}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoading ? "opacity-0" : "opacity-100"
              }`}
            />
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-6xl opacity-30">{product.emoji}</div>
          </div>
        )}

        {/* Active pulse indicator */}
        {isActive && (
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <Badge className="bg-green-500/20 text-green-400 text-xs border-green-500/40">ACTIVE</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {/* Header with emoji and name */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{product.emoji}</span>
          <h3 className="text-xl font-bold text-foreground">{product.name}</h3>
        </div>

        {/* Headline */}
        <p className="text-base font-medium text-slate-300">{product.headline}</p>

        {/* Pain Point */}
        <p className="text-sm italic text-slate-400">{product.pain_point}</p>

        {/* Benefit */}
        <p className="text-sm text-slate-200">{product.benefit}</p>

        {/* Price Block */}
        <div className="pt-3 border-t border-slate-700/50">
          <div className="mb-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Pricing</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold gradient-text">R{product.setup_price.toLocaleString()}</span>
              <span className="text-xs text-slate-400">setup</span>
            </div>
            {product.monthly_price > 0 && (
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold text-slate-200">R{product.monthly_price.toLocaleString()}</span>
                <span className="text-xs text-slate-400">/month</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes if present */}
        {product.notes && (
          <p className="text-xs text-slate-400 italic pt-2">{product.notes}</p>
        )}

        {/* CTA Button */}
        {renderCTA({
          product,
          isActive,
          client,
          onEnquire,
          onContact
        })}
      </div>
    </div>
  );
}

function renderCTA({ product, isActive, client, onEnquire, onContact }) {
  // Active plan view — unchanged.
  if (isActive) {
    return (
      <Button
        onClick={() => onEnquire?.(product)}
        className="w-full mt-4 bg-green-600/80 hover:bg-green-600 text-white transition-all duration-200 scale-100 hover:scale-[1.02]"
      >
        <CheckCircle2 className="w-4 h-4 mr-2" />
        View Active Plan
      </Button>
    );
  }

  // Resolve the matching PayFast package id, if any. Used by both the
  // logged-out and logged-in branches below so that a click goes straight
  // to checkout for products we can self-sell.
  const payfastId = toPayfastPackageId(product.id);

  // No client passed → ClientPortal's upgrade / add-on grid. If the product
  // is one we can self-sell (mapped to an active PayFast package), the CTA
  // routes to /portal/checkout/<id>. Otherwise we fall back to the legacy
  // enquire-modal flow so unmapped products (e.g. reputation_management)
  // still have a way for the visitor to engage.
  if (!client) {
    if (payfastId) {
      return (
        <Button asChild
          className="w-full mt-4 gradient-bg text-white hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-200 scale-100 hover:scale-[1.02]"
        >
          <Link to={`/portal/checkout/${payfastId}`}>
            {product.cta_text || buyButtonLabel(product) || 'Get Started'}
          </Link>
        </Button>
      );
    }
    return (
      <Button
        onClick={() => onEnquire?.(product)}
        className="w-full mt-4 gradient-bg text-white hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-200 scale-100 hover:scale-[1.02]"
      >
        {product.cta_text || "Enquire Now"}
      </Button>
    );
  }

  const setup = Number(product.setup_price || 0);
  const monthly = Number(product.monthly_price || 0);

  // No price → contact-for-pricing.
  if (setup === 0 && monthly === 0) {
    return (
      <button
        type="button"
        onClick={() => onContact?.(product)}
        className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-slate-200 hover:text-white border border-slate-700 hover:border-slate-500 transition"
      >
        Contact us for pricing
      </button>
    );
  }

  // Priced product. If it's a PayFast-self-sellable package, take the buyer
  // straight to /portal/checkout/<id> (authenticated checkout, pre-fills
  // their saved details). If not, fall back to the contact modal so the
  // sales team can take it from there.
  if (payfastId) {
    return (
      <Link
        to={`/portal/checkout/${payfastId}`}
        className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white gradient-bg hover:shadow-lg hover:shadow-purple-500/30 transition"
      >
        {buyButtonLabel(product)}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onContact?.(product)}
      className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white gradient-bg hover:shadow-lg hover:shadow-purple-500/30 transition"
    >
      {buyButtonLabel(product)}
    </button>
  );
}