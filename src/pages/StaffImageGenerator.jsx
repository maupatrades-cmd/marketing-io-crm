import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Download, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { PRODUCT_CATALOG } from "@/data/ProductCatalog";

export default function StaffImageGenerator() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        const allClients = await base44.entities.Client.list();
        setClients(Array.isArray(allClients) ? allClients : []);
      } catch (err) {
        console.error("Failed to load clients:", err);
      }
    };
    loadClients();
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setSuccess(null);

    if (!selectedClient) {
      setError("Please select a client");
      return;
    }

    const prompt = customPrompt || getDefaultPrompt(selectedProduct);
    if (!prompt) {
      setError("Please provide a prompt or select a product");
      return;
    }

    setGenerating(true);
    try {
      const result = await base44.integrations.Core.GenerateImage({
        prompt: prompt
      });

      if (result?.url) {
        setGeneratedImage({ url: result.url, prompt });
      } else {
        setError("Image generation failed. Please try again.");
      }
    } catch (err) {
      console.error("[StaffImageGenerator] Error:", err);
      setError(err.message || "Generation error");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToClient = async () => {
    if (!generatedImage || !selectedClient) {
      setError("Missing image or client selection");
      return;
    }

    setSaving(true);
    try {
      // Create ClientUpload record
      const fileName = `${selectedProduct || 'custom'}_${Date.now()}.png`;
      await base44.entities.ClientUpload.create({
        client_id: selectedClient,
        uploaded_by_id: "staff", // Would be actual user ID in production
        file_url: generatedImage.url,
        file_name: fileName,
        file_type: "marketing_asset",
        mime_type: "image/png",
        description: `AI-generated creative${selectedProduct ? ` for ${selectedProduct}` : ""}`
      });

      setSuccess(`Saved to client library!`);
      setGeneratedImage(null);
      setCustomPrompt("");
      setSelectedProduct("");
    } catch (err) {
      console.error("[StaffImageGenerator] Save error:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const getDefaultPrompt = (productId) => {
    if (!productId) return null;
    const product = PRODUCT_CATALOG.find(p => p.id === productId);
    if (!product) return null;

    return `Professional marketing mockup for "${product.name}": ${product.headline}
    Marketing iO brand colors: deep purple #a764e6 and pink #ec4899. 
    South African small business context. Cinematic, aspirational, premium.
    16:9 aspect ratio. High-quality advertising creative.`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">AI Image Generator</h1>
          <p className="text-muted-foreground mt-2">Create branded creatives for your clients</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-2xl p-6 border border-slate-700/40 space-y-6">
              {/* Client Select */}
              <div>
                <label className="text-sm font-semibold block mb-2">Select Client</label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger className="bg-secondary/50 border-slate-700/50">
                    <SelectValue placeholder="Choose a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Template */}
              <div>
                <label className="text-sm font-semibold block mb-2">Product Template (Optional)</label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-secondary/50 border-slate-700/50">
                    <SelectValue placeholder="Or create custom..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATALOG.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.emoji} {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Prompt */}
              <div>
                <label className="text-sm font-semibold block mb-2">Custom Prompt</label>
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe the image you want to create..."
                  rows={4}
                  className="bg-secondary/50 border-slate-700/50"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {customPrompt ? "Using custom prompt" : selectedProduct ? "Using product template" : "Define either template or custom prompt"}
                </p>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-green-400">{success}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !selectedClient}
                  className="flex-1 gradient-bg text-white"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Image"
                  )}
                </Button>
                {generatedImage && (
                  <Button
                    onClick={() => setShowPreview(true)}
                    variant="outline"
                    className="flex-1"
                  >
                    Preview
                  </Button>
                )}
              </div>

              {/* Save to Client */}
              {generatedImage && (
                <Button
                  onClick={handleSaveToClient}
                  disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save to Client Library
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Recent Generations */}
          <div className="glass rounded-2xl p-6 border border-slate-700/40">
            <h3 className="font-semibold text-foreground mb-4">Quick Tips</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>• Use product templates for brand consistency</li>
              <li>• Customize prompts for unique creatives</li>
              <li>• Add specific colors, styles, or elements</li>
              <li>• Images save to client's asset library</li>
              <li>• Generated images are high-res for print</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {generatedImage && (
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="bg-card border-border/50 max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generated Image Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img
                src={generatedImage.url}
                alt="Generated"
                className="w-full rounded-lg"
              />
              <div className="p-3 bg-secondary/30 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Prompt used:</p>
                <p className="text-xs text-foreground">{generatedImage.prompt}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(generatedImage.url)}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  onClick={handleSaveToClient}
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {saving ? "Saving..." : "Save to Client"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}