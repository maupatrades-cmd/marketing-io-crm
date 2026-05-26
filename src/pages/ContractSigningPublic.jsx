import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ContractSigningPublic() {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  const [fullName, setFullName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [capacity, setCapacity] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState("typed");
  const [typedSignature, setTypedSignature] = useState("");
  const [drawnSignature, setDrawnSignature] = useState(null);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    async function loadContract() {
      if (!token) {
        setError("No signing token provided. Invalid signing link.");
        setLoading(false);
        return;
      }
      try {
        // LB-281 fix: the page is intentionally unauthenticated (client arrives
        // from an email link with no session). Direct base44.entities.Contract
        // .filter() fails RLS for anonymous callers, so we route through a
        // public token-validating function that runs asServiceRole server-side.
        const res = await base44.functions.invoke("get-contract-for-signing", { token });
        const data = res?.data ?? res;

        if (!data?.success) {
          // Generic message for missing / malformed / expired / not-found.
          // Backend deliberately doesn't distinguish the cases (no info leak).
          setError("Contract signing link not found or has expired.");
          setLoading(false);
          return;
        }

        setContract(data.contract);
        // Client metadata is in data.client; the PDF already shows it on
        // the Parties page so we don't separately render it here.

        // PDF transport switched to UploadFile-backed HTTPS URL — sidesteps
        // the megabyte-base64 response that was causing 502s on the chained
        // get-contract-for-signing invoke.
        if (data.pdf_url) {
          setPdfUrl(String(data.pdf_url));
        }
        setLoading(false);
      } catch (err) {
        console.error("[ContractSigningPublic] load failed:", err);
        // Generic — never echo the raw error message (LB-239).
        setError("Contract signing link not found or has expired.");
        setLoading(false);
      }
    }

    loadContract();
  }, [token]);

  const handleCanvasStart = (e) => {
    if (signatureMethod !== "drawn") return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleCanvasMove = (e) => {
    if (!isDrawing || signatureMethod !== "drawn") return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const handleCanvasEnd = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    setDrawnSignature(canvas.toDataURL());
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnSignature(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!signerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!capacity.trim()) {
      toast.error("Please enter your capacity / position");
      return;
    }
    if (!idNumber.trim()) {
      toast.error("Please enter your ID number");
      return;
    }
    if (!agreed) {
      toast.error("You must confirm you have read and understood the agreement");
      return;
    }
    if (signatureMethod === "typed" && !typedSignature.trim()) {
      toast.error("Please type your name as a signature");
      return;
    }
    if (signatureMethod === "drawn" && !drawnSignature) {
      toast.error("Please draw your signature");
      return;
    }

    setSigning(true);

    // LB-281 fix on the write side: the page is unauthenticated, so direct
    // ContractSignature.create + Contract.update from the browser were
    // rejected by RLS ("permission denied for update operation on Contract").
    // Route through the public submit function which validates the
    // signing_token server-side and does both writes via asServiceRole.
    try {
      const res = await base44.functions.invoke("submit-contract-signature", {
        signing_token:            token,
        signer_full_name:         fullName.trim(),
        signer_email:             signerEmail.trim().toLowerCase(),
        signer_capacity:          capacity.trim(),
        signer_id_number:         idNumber.trim(),
        signature_method:         signatureMethod,
        typed_signature:          signatureMethod === "typed" ? typedSignature.trim() : "",
        drawn_signature_data_url: signatureMethod === "drawn" ? drawnSignature : "",
      });
      const data = res?.data ?? res;

      if (data?.success) {
        setSigned(true);
        toast.success("Contract signed successfully! A copy has been sent to your email.");
        return;
      }

      // Map the backend error codes to user-friendly messages.
      const code = data?.error || "submit_failed";
      const friendly = {
        already_signed:       "This contract has already been signed.",
        not_found_or_expired: "Signing link not found or has expired.",
        invalid_signature:    "Please check your signature details and try again.",
        rate_limited:         "Too many attempts. Please try again in a few minutes.",
      }[code] || `Could not sign the contract (${code}).`;
      toast.error(friendly);
    } catch (err) {
      console.error("Contract signing error:", err);
      toast.error("Could not sign the contract. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Signing Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Contract not found.</p>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-success/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" />
              Contract Signed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Thank you for signing the agreement. You will receive a copy of the signed contract via email.
            </p>
            <p className="text-sm text-muted-foreground">
              If you don't receive the email within a few minutes, please check your spam folder or contact info@marketingio.co.za.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <img
            src="https://media.base44.com/images/public/69f52863b2b733d922d90b62/d623fa72e_marketingiomainlogo.png"
            alt="Marketing iO"
            className="h-8 object-contain"
            style={{ filter: "invert(1) brightness(2)", mixBlendMode: "screen" }}
          />
          <h1 className="text-3xl font-bold mt-4">Contract Signature Portal</h1>
          <p className="text-muted-foreground mt-2">
            Please review and sign the Marketing iO Master Service Agreement below.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MSA V3.0 PDF preview — full 22-page document, generated server-side. */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Master Service Agreement — please review all 22 pages before signing
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    title="Marketing iO Master Service Agreement V3.0"
                    className="w-full rounded border border-border"
                    style={{ height: "800px" }}
                  />
                ) : (
                  <div className="bg-muted aspect-video rounded border border-border flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Preparing your agreement…</p>
                  </div>
                )}
                <div className="mt-4 p-4 bg-card rounded border border-border">
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Contract summary</strong>
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>Setup Fee: R{(contract.setup_fee || 0).toLocaleString()}</p>
                    <p>Monthly Retainer: R{(contract.monthly_retainer || 0).toLocaleString()}</p>
                    <p>Status: {contract.signing_status || "not_sent"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Signing Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sign Agreement</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Confirmation Checkbox */}
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1"
                      />
                      <span className="text-xs text-muted-foreground">
                        I confirm I have read and understood this Master Service Agreement and agree to its terms.
                      </span>
                    </label>
                  </div>

                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Full Legal Name *</label>
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      disabled={signing}
                    />
                  </div>

                  {/* Email Address — used for the audit trail + signed-copy delivery. */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Email Address *</label>
                    <Input
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      placeholder="you@example.co.za"
                      disabled={signing}
                    />
                  </div>

                  {/* Capacity / Position — populates the MSA Parties + Execution pages. */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Capacity / Position *</label>
                    <Input
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="e.g. Director, Sole Proprietor"
                      disabled={signing}
                    />
                  </div>

                  {/* ID Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium">ID Number *</label>
                    <Input
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="Enter your ID number"
                      disabled={signing}
                    />
                  </div>

                  {/* Signature Method */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Signature Method *</label>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          value="typed"
                          checked={signatureMethod === "typed"}
                          onChange={(e) => setSignatureMethod(e.target.value)}
                          disabled={signing}
                        />
                        Type
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="radio"
                          value="drawn"
                          checked={signatureMethod === "drawn"}
                          onChange={(e) => setSignatureMethod(e.target.value)}
                          disabled={signing}
                        />
                        Draw
                      </label>
                    </div>
                  </div>

                  {/* Typed Signature */}
                  {signatureMethod === "typed" && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Type your name as signature *</label>
                      <Input
                        value={typedSignature}
                        onChange={(e) => setTypedSignature(e.target.value)}
                        placeholder="Type your name"
                        disabled={signing}
                        style={{ fontFamily: "cursive", fontSize: "24px" }}
                      />
                    </div>
                  )}

                  {/* Drawn Signature */}
                  {signatureMethod === "drawn" && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Draw your signature *</label>
                      <canvas
                        ref={canvasRef}
                        width={250}
                        height={80}
                        onMouseDown={handleCanvasStart}
                        onMouseMove={handleCanvasMove}
                        onMouseUp={handleCanvasEnd}
                        onMouseLeave={handleCanvasEnd}
                        className="border border-border rounded bg-white cursor-crosshair w-full"
                        disabled={signing}
                      />
                      {drawnSignature && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={clearCanvas}
                          disabled={signing}
                        >
                          Clear Signature
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    type="submit"
                    className="w-full mt-6"
                    disabled={signing || !agreed}
                  >
                    {signing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      "Sign Contract"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}