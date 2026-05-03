import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentUser } from "@/lib/customAuth";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronLeft, Upload, Loader2, FileText } from "lucide-react";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import MandateSigningStep from "@/components/onboarding/MandateSigningStep";
import BrandAssetsStep from "@/components/onboarding/BrandAssetsStep";

export default function ClientOnboardingWizard() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [progress, setProgress] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [mandateSigned, setMandateSigned] = useState(false);
  const [brandAssetsUploaded, setBrandAssetsUploaded] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      const me = authUser || await getCurrentUser();
      if (!me) {
        window.location.href = "/login";
        return;
      }

      setUser(me);

      const clients = await base44.entities.Client.filter({ email: me.email });
      const c = Array.isArray(clients) ? clients[0] : clients;

      if (!c) {
        setLoading(false);
        return;
      }

      setClient(c);

      // Get latest onboarding progress
      const progressList = await base44.entities.ClientOnboardingProgress.filter({
        client_id: c.id,
        status: ["in_progress", "not_started"]
      });

      if (progressList?.length > 0) {
        const p = Array.isArray(progressList) ? progressList[0] : progressList;
        setProgress(p);

        // Get steps
        const stepsList = await base44.entities.OnboardingStep.filter({ client_id: c.id });
        const sortedSteps = (Array.isArray(stepsList) ? stepsList : []).sort((a, b) => a.step_number - b.step_number);
        setSteps(sortedSteps);

        // Set first incomplete step as selected
        const incomplete = sortedSteps.find(s => !s.is_completed);
        if (incomplete) {
          setSelectedStep(incomplete);
        }
      }

      setLoading(false);
    };
    load();
  }, [authUser]);

  const handleFileUpload = async (file) => {
    if (!selectedStep || !file) return;

    setUploading(true);
    setError(null);

    try {
      // Upload file
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.url;

      // Update step
      await base44.entities.OnboardingStep.update(selectedStep.id, {
        file_url: fileUrl,
        file_name: file.name,
        is_completed: true,
        completed_at: new Date().toISOString()
      });

      // Refresh steps
      const stepsList = await base44.entities.OnboardingStep.filter({ client_id: client.id });
      const sortedSteps = (Array.isArray(stepsList) ? stepsList : []).sort((a, b) => a.step_number - b.step_number);
      setSteps(sortedSteps);

      // Update progress
      const completedCount = sortedSteps.filter(s => s.is_completed).length;
      const newPercentage = Math.round((completedCount / sortedSteps.length) * 100);
      const newStatus = newPercentage === 100 ? 'completed' : 'in_progress';

      await base44.entities.ClientOnboardingProgress.update(progress.id, {
        completed_steps: completedCount,
        progress_percentage: newPercentage,
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null
      });

      // Update progress state
      setProgress({
        ...progress,
        completed_steps: completedCount,
        progress_percentage: newPercentage,
        status: newStatus
      });

      // Move to next incomplete step
      const nextIncomplete = sortedSteps.find(s => !s.is_completed);
      if (nextIncomplete) {
        setSelectedStep(nextIncomplete);
      } else {
        setSelectedStep(null);
      }
    } catch (err) {
      console.error("[OnboardingWizard] Upload error:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleMandateSign = async () => {
    if (!client) return;
    setMandateSigned(true);
    // Auto-complete mandate step if exists
    const mandateStep = steps.find(s => s.category === "approval");
    if (mandateStep && !mandateStep.is_completed) {
      await base44.entities.OnboardingStep.update(mandateStep.id, {
        is_completed: true,
        completed_at: new Date().toISOString()
      });
    }
  };

  const handleBrandAssetUpload = async (assetId, file) => {
    if (!client || !file) return;
    setUploading(true);
    setError(null);

    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      
      // Create upload record
      await base44.entities.ClientUpload.create({
        client_id: client.id,
        uploaded_by_id: user.id,
        file_url: uploadRes.url,
        file_name: file.name,
        file_type: assetId
      });

      setBrandAssetsUploaded(prev => new Set([...prev, assetId]));
    } catch (err) {
      console.error("[OnboardingWizard] Brand asset upload error:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!progress || steps.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">No Onboarding in Progress</h2>
          <p className="text-sm text-muted-foreground">Your onboarding will start once your package is approved.</p>
          <a href="/client-portal" className="mt-4 block text-primary text-sm hover:underline">Back to Portal →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-foreground">
      {/* Header */}
      <div className="border-b border-slate-700/40 backdrop-blur-md bg-slate-950/80 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/client-portal" className="p-2 hover:bg-secondary rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="text-xl font-bold">Your Onboarding Journey</h1>
            <p className="text-sm text-muted-foreground">{client?.business_name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Checklist */}
        <div className="lg:col-span-2">
          <div className="glass rounded-2xl p-6 border border-slate-700/40">
            <OnboardingChecklist
              steps={steps}
              onStepClick={setSelectedStep}
            />
          </div>
        </div>

        {/* Right Panel: Progress + Detail View */}
        <div className="space-y-6">
          {/* Progress Card */}
          <div className="glass rounded-2xl p-6 border border-slate-700/40">
            <OnboardingProgress
              completed={progress.completed_steps}
              total={progress.total_steps}
              status={progress.status}
            />
          </div>

          {/* Detail Card */}
           {selectedStep ? (
             <div className="glass rounded-2xl p-6 border border-slate-700/40 space-y-4">
               {selectedStep.category === "approval" ? (
                 <MandateSigningStep
                   step={selectedStep}
                   onComplete={handleMandateSign}
                   isCompleted={mandateSigned}
                   submitting={uploading}
                 />
               ) : selectedStep.category === "brand_assets" ? (
                 <BrandAssetsStep
                   step={selectedStep}
                   onUpload={handleBrandAssetUpload}
                   completedAssets={Array.from(brandAssetsUploaded)}
                   uploading={uploading}
                 />
               ) : (
                 <>
                   <h3 className="font-semibold text-foreground">{selectedStep.title}</h3>
                   <p className="text-sm text-muted-foreground leading-relaxed">{selectedStep.description}</p>

                   {/* File Upload Section */}
                   <div className="space-y-3 pt-4 border-t border-slate-700/40">
                     <p className="text-xs font-semibold text-muted-foreground uppercase">Upload Document</p>

                     <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                       <input
                         type="file"
                         id="file-upload"
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) handleFileUpload(file);
                         }}
                         disabled={uploading}
                         className="hidden"
                       />
                       <label
                         htmlFor="file-upload"
                         className="cursor-pointer flex flex-col items-center gap-2"
                       >
                         {uploading ? (
                           <>
                             <Loader2 className="w-5 h-5 text-primary animate-spin" />
                             <span className="text-xs text-muted-foreground">Uploading...</span>
                           </>
                         ) : (
                           <>
                             <Upload className="w-5 h-5 text-slate-600" />
                             <span className="text-xs text-muted-foreground">Click to upload</span>
                           </>
                         )}
                       </label>
                     </div>

                     {selectedStep.file_name && (
                       <p className="text-xs text-green-400">✓ Uploaded: {selectedStep.file_name}</p>
                     )}
                   </div>

                   {/* Error Message */}
                   {error && (
                     <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                       <p className="text-xs text-destructive">{error}</p>
                     </div>
                   )}

                   {/* Notes */}
                   {selectedStep.notes && (
                     <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                       <p className="text-xs text-primary">Staff note: {selectedStep.notes}</p>
                     </div>
                   )}
                 </>
               )}
             </div>
           ) : (
             <div className="glass rounded-2xl p-6 border border-slate-700/40 text-center space-y-3">
               <div className="text-4xl">🎉</div>
               <h3 className="font-semibold text-foreground">All Done!</h3>
               <p className="text-sm text-muted-foreground">Your setup is complete. Our team is finalizing everything.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}