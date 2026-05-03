import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";

const BRAND_ASSETS = [
  { id: "logo", label: "Logo (PNG/SVG)", description: "Your business logo, transparent background preferred" },
  { id: "brand_guidelines", label: "Brand Guidelines", description: "Color codes, fonts, usage rules (PDF/DOC)" },
  { id: "business_photos", label: "Business Photos", description: "5-10 photos of your premises, team, products" },
];

export default function BrandAssetsStep({ step, onUpload, completedAssets, uploading }) {
  const [activeAsset, setActiveAsset] = useState(null);

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
        <p className="text-sm text-primary">
          These assets help us create cohesive marketing materials. You can upload more later!
        </p>
      </div>

      <div className="space-y-3">
        {BRAND_ASSETS.map((asset) => {
          const isComplete = completedAssets?.includes(asset.id);
          return (
            <div
              key={asset.id}
              className="glass rounded-lg p-4 border border-slate-700/40 hover:border-slate-600/60 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground">{asset.label}</h4>
                    {isComplete && <CheckCircle2 className="w-4 h-4 text-success" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{asset.description}</p>
                </div>
              </div>

              {!isComplete && (
                <input
                  type="file"
                  id={`file-${asset.id}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(asset.id, file);
                  }}
                  disabled={uploading}
                  className="hidden"
                />
              )}

              {!isComplete ? (
                <label
                  htmlFor={`file-${asset.id}`}
                  className="mt-3 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="w-4 h-4 text-slate-600" />
                  <span className="text-xs text-muted-foreground">
                    {uploading ? "Uploading..." : "Click to upload"}
                  </span>
                </label>
              ) : (
                <div className="mt-3 p-3 bg-success/10 border border-success/30 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span className="text-xs text-success">Uploaded</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-lg bg-secondary/30 border border-slate-700/40">
        <div className="flex gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            At minimum, upload your logo. Other assets help us design faster.
          </p>
        </div>
      </div>
    </div>
  );
}