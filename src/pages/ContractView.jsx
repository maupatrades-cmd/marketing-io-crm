import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Copy, Mail, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ContractView() {
  const { id } = useParams();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingLink, setSendingLink] = useState(false);

  useEffect(() => {
    async function loadContract() {
      try {
        const data = await base44.entities.Contract.filter({ id });
        if (data && data.length > 0) {
          setContract(data[0]);
        }
        setLoading(false);
      } catch (err) {
        toast.error(`Error loading contract: ${err.message}`);
        setLoading(false);
      }
    }

    loadContract();
  }, [id]);

  const handleSendSigningLink = async () => {
    if (!contract) return;
    
    setSendingLink(true);
    try {
      // Generate 32-char token
      const token = Math.random().toString(36).substring(2, 34);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Update contract
      await base44.entities.Contract.update(contract.id, {
        signing_token: token,
        signing_status: "sent",
        signing_link_expires_at: expiresAt.toISOString()
      });

      // Get client info
      const clients = await base44.entities.Client.filter({ id: contract.client_id });
      const client = clients[0];

      // Build signing link
      const signingUrl = `${window.location.origin}/sign-contract?token=${token}`;

      // Send email to client (would use SendEmail integration)
      // TODO: await base44.integrations.Core.SendEmail({...})

      // Update UI
      setContract(prev => ({
        ...prev,
        signing_token: token,
        signing_status: "sent",
        signing_link_expires_at: expiresAt.toISOString()
      }));

      toast.success("Signing link sent to client");
    } catch (err) {
      toast.error(`Error sending signing link: ${err.message}`);
    } finally {
      setSendingLink(false);
    }
  };

  const copySigningLink = () => {
    if (!contract?.signing_token) {
      toast.error("No signing token generated yet");
      return;
    }
    const url = `${window.location.origin}/sign-contract?token=${contract.signing_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Signing link copied to clipboard");
  };

  const statusColors = {
    not_sent: "bg-slate-100 text-slate-800",
    sent: "bg-blue-100 text-blue-800",
    viewed: "bg-amber-100 text-amber-800",
    fully_signed: "bg-green-100 text-green-800"
  };

  if (loading) {
    return (
      <AppLayout title="Contract" subtitle="View and manage contract signing">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!contract) {
    return (
      <AppLayout title="Contract" subtitle="View and manage contract signing">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Contract Not Found
            </CardTitle>
          </CardHeader>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Contract #${contract.id?.slice(0, 8)}`} subtitle={contract.client_name || "Contract Details"}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contract Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Client</p>
                  <p className="font-medium">{contract.client_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Package</p>
                  <p className="font-medium capitalize">{contract.package || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Setup Fee</p>
                  <p className="font-medium">R{(contract.setup_fee || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monthly Retainer</p>
                  <p className="font-medium">R{(contract.monthly_retainer || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant="outline" className={statusColors[contract.status] || ""}>
                    {contract.status || "draft"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Signing Status</p>
                  <Badge variant="outline" className={statusColors[contract.signing_status] || ""}>
                    {contract.signing_status || "not_sent"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {contract.status === "signed" && (
            <Card>
              <CardHeader>
                <CardTitle>Signatures</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contract.client_signed_at && (
                  <div className="flex items-center justify-between p-3 bg-success/10 rounded border border-success/30">
                    <div>
                      <p className="text-sm font-medium">Client Signed</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(contract.client_signed_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-success text-lg">✓</div>
                  </div>
                )}
                {contract.marketing_io_signed_at && (
                  <div className="flex items-center justify-between p-3 bg-success/10 rounded border border-success/30">
                    <div>
                      <p className="text-sm font-medium">Marketing iO Signed</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(contract.marketing_io_signed_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-success text-lg">✓</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Signing Actions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Signing Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.signing_status === "not_sent" && (
                <>
                  <Button
                    className="w-full"
                    onClick={handleSendSigningLink}
                    disabled={sendingLink}
                  >
                    {sendingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send for Signature
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Client will receive a link to sign digitally
                  </p>
                </>
              )}

              {(contract.signing_status === "sent" || contract.signing_status === "viewed") && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={copySigningLink}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Signing Link
                  </Button>
                  <Button
                    className="w-full"
                    onClick={handleSendSigningLink}
                    disabled={sendingLink}
                    variant="secondary"
                  >
                    {sendingLink ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Resend Link
                      </>
                    )}
                  </Button>
                  {contract.signing_link_expires_at && (
                    <p className="text-xs text-muted-foreground text-center">
                      Link expires: {new Date(contract.signing_link_expires_at).toLocaleDateString()}
                    </p>
                  )}
                </>
              )}

              {contract.signing_status === "fully_signed" && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (contract.final_signed_pdf_url) {
                        window.open(contract.final_signed_pdf_url, "_blank");
                      } else {
                        toast.error("Signed PDF URL not available");
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    View Signed PDF
                  </Button>
                  {contract.client_signed_at && (
                    <p className="text-xs text-success text-center mt-2">
                      ✓ Contract fully signed
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {contract.signing_token && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">Signing Token</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {contract.signing_token}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}