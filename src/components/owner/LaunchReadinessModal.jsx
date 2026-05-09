import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Rocket } from "lucide-react";

const STATUS_CONFIG = {
  pass:  { icon: <CheckCircle2  className="w-4 h-4 text-success flex-shrink-0" />, bg: "bg-success/10 border-success/20" },
  warn:  { icon: <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />, bg: "bg-warning/10 border-warning/20" },
  fail:  { icon: <XCircle       className="w-4 h-4 text-destructive flex-shrink-0" />, bg: "bg-destructive/10 border-destructive/20" },
};

const OVERALL_CONFIG = {
  green: { label: "🟢 GO — All checks passed",     cls: "bg-success/15 text-success border-success/30" },
  amber: { label: "🟡 AMBER — Warnings to review", cls: "bg-warning/15 text-warning border-warning/30" },
  red:   { label: "🔴 NO-GO — Failures detected",  cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function LaunchReadinessModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await base44.functions.invoke("launch-readiness-check", {});
      setReport(res.data);
    } catch (e) {
      setError(e.message || "Check failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    runCheck();
  };

  return (
    <>
      <Button onClick={handleOpen} className="gradient-bg text-white gap-2">
        <Rocket className="w-4 h-4" />
        Run Launch Readiness Check
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Launch Readiness Report
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Running checks…</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {report && (
            <div className="space-y-4">
              {/* Overall banner */}
              <div className={`rounded-lg border px-4 py-3 font-semibold text-sm ${OVERALL_CONFIG[report.overall]?.cls}`}>
                {OVERALL_CONFIG[report.overall]?.label}
              </div>

              {/* Individual checks */}
              <div className="space-y-2">
                {report.checks?.map((c, i) => {
                  const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.warn;
                  return (
                    <div key={i} className={`flex gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                      <div className="mt-0.5">{cfg.icon}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">{c.check}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="sm" onClick={runCheck} disabled={loading}>
                  <Loader2 className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : "hidden"}`} />
                  Re-run
                </Button>
                <p className="text-xs text-muted-foreground">Run again after fixing items</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}