import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { Loader2, AlertCircle } from "lucide-react";

export default function EnquiryModal({ product, client, user, isOpen, onClose, onSubmitted }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    const token = localStorage.getItem('mio_session_token');
    if (!token) {
      setError("Session expired. Please refresh and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await base44.functions.invoke("submit-enquiry", {
        session_token: token,
        product_id: product.id,
        client_message: message || null
      });

      if (response.data?.success) {
        onSubmitted();
        onClose();
        setMessage("");
      } else {
        setError(response.data?.error || "Failed to submit enquiry");
      }
    } catch (err) {
      console.error("[EnquiryModal] Error:", err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setMessage("");
        setError(null);
        onClose();
      }
    }}>
      <DialogContent className="bg-card border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{product?.emoji}</span>
            Enquire about {product?.name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-2">We'll be in touch within 4 hours.</p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Pre-filled info */}
          <div className="space-y-3 bg-secondary/30 rounded-lg p-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Your Business</label>
              <p className="text-sm text-foreground">{client?.business_name || "—"}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Your Email</label>
              <p className="text-sm text-foreground">{user?.email || "—"}</p>
            </div>
          </div>

          {/* Message textarea */}
          <div>
            <label className="text-sm font-semibold block mb-2">What outcome do you want? (optional)</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your goals, current challenges, or specific questions..."
              rows={4}
              className="bg-secondary/50 border-border/50"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 gradient-bg text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Enquiry"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}