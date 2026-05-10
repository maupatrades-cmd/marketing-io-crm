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
  const [error, setError] = useState(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  
  const [fullName, setFullName] = useState("");
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
      try {
        if (!token) {
          setError("No signing token provided. Invalid signing link.");
          setLoading(false);
          return;
        }

        // Find contract by signing_token
         let contracts = [];
         try {
           contracts = await base44.entities.Contract.filter({ signing_token: token });
         } catch (e) {
           console.error("Filter error:", e);
         }

         if (!contracts || (Array.isArray(contracts) && contracts.length === 0)) {
           setError("Contract signing link not found or has expired.");
           setLoading(false);
           return;
         }

         if (!Array.isArray(contracts)) {
           contracts = [contracts];
         }

        const contractData = contracts[0];
        
        // Check expiration
        if (contractData.signing_link_expires_at) {
          const expiryDate = new Date(contractData.signing_link_expires_at);
          if (expiryDate < new Date()) {
            setError("This signing link has expired. Please request a new one from Marketing iO.");
            setLoading(false);
            return;
          }
        }

        setContract(contractData);
        setLoading(false);
      } catch (err) {
        setError(`Error loading contract: ${err.message}`);
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

    try {
      // Create ContractSignature record (triggering automation)
      await base44.entities.ContractSignature.create({
        contract_id: contract.id,
        signer_role: "client",
        signer_full_name: fullName,
        signer_id_number: idNumber,
        typed_signature: signatureMethod === "typed" ? typedSignature : fullName,
        signature_method: signatureMethod,
        drawn_signature_data_url: drawnSignature,
        signed_date: new Date().toISOString(),
        signed_user_agent: navigator.userAgent
      });

      // Update Contract status
      await base44.entities.Contract.update(contract.id, {
        signing_status: "fully_signed",
        client_signed_at: new Date().toISOString(),
        signed_by_client: true,
        signed_date: new Date().toISOString().split('T')[0]
      });

      setSigned(true);
      toast.success("Contract signed successfully! A copy has been sent to your email.");
    } catch (err) {
      console.error("Contract signing error:", err);
      toast.error(`Error signing contract: ${err.message}`);
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
          {/* PDF Preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {contract.package ? contract.package.toUpperCase() : "AGREEMENT"} - Master Service Agreement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted aspect-video rounded border border-border flex items-center justify-center">
                  <p className="text-muted-foreground text-center">
                    📄 PDF Preview<br/>
                    <span className="text-sm">(Full contract embedded viewer would display here)</span>
                  </p>
                </div>
                <div className="mt-4 p-4 bg-card rounded border border-border">
                  <p className="text-sm text-muted-foreground mb-2">
                    <strong>Contract Details:</strong>
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