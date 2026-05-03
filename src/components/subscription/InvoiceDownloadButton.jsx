import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

export default function InvoiceDownloadButton({ invoiceId, invoiceNumber }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await base44.functions.invoke("generateSignedPDF", {
        entity: "Invoice",
        entityId: invoiceId,
        documentType: "invoice",
      });

      if (result.data?.download_url) {
        const link = document.createElement("a");
        link.href = result.data.download_url;
        link.download = `Invoice-${invoiceNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError("Failed to generate PDF. Please try again.");
      }
    } catch (err) {
      setError("Download failed. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDownload}
        disabled={loading}
        title="Download invoice PDF"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      </Button>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </>
  );
}