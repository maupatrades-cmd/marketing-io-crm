import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default function ProductCard({ product, isActive, onEnquire, imageUrl }) {
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
        <Button
          onClick={() => onEnquire(product)}
          className={`w-full mt-4 ${
            isActive
              ? "bg-green-600/80 hover:bg-green-600 text-white"
              : "gradient-bg text-white hover:shadow-lg hover:shadow-purple-500/30"
          } transition-all duration-200 scale-100 hover:scale-[1.02]`}
        >
          {isActive ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              View Active Plan
            </>
          ) : (
            product.cta_text || "Enquire Now"
          )}
        </Button>
      </div>
    </div>
  );
}