import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Lock, Unlock, PlayCircle, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PHASES = [
  {
    key: "phase1_contract_signed",
    label: "Phase 1 — Contract Signed",
    target: "Within 1 hour of deal won",
    items: [
      { field: "p1_contract_filed_in_drive", label: "Contract filed in Drive" },
      { field: "p1_signed_pdf_uploaded", label: "Signed PDF uploaded to CRM" },
      { field: "p1_client_added_to_crm", label: "Client added to CRM" },
      { field: "p1_assigned_to_admin", label: "Assigned to admin" },
    ],
    completedAt: "p1_completed_at",
  },
  {
    key: "phase2_welcome_invoicing",
    label: "Phase 2 — Welcome & Invoicing",
    target: "Within 24 hours",
    items: [
      { field: "p2_welcome_pack_emailed", label: "Welcome pack emailed to client" },
      { field: "p2_welcome_whatsapp_sent", label: "Welcome WhatsApp sent" },
      { field: "p2_setup_invoice_issued", label: "Setup invoice issued" },
      { field: "p2_debit_mandate_emailed", label: "Debit mandate emailed" },
      { field: "p2_onboarding_form_emailed", label: "Onboarding form emailed" },
    ],
    completedAt: "p2_completed_at",
  },
  {
    key: "phase3_pre_onboarding",
    label: "Phase 3 — Pre-Onboarding",
    target: "Days 2–6",
    items: [
      { field: "p3_setup_fee_payment_followup", label: "Setup fee payment follow-up done" },
      { field: "p3_form_completion_followup", label: "Form completion follow-up done" },
      { field: "p3_onboarding_call_scheduled", label: "Onboarding call scheduled" },
    ],
    completedAt: "p3_completed_at",
  },
  {
    key: "phase4_onboarding_call",
    label: "Phase 4 — Onboarding Call",
    target: "Days 5–7",
    items: [
      { field: "p4_call_held", label: "Onboarding call held" },
      { field: "p4_brand_kit_brief_completed", label: "Brand kit brief completed" },
    ],
    completedAt: "p4_completed_at",
    extras: ["p4_call_date", "p4_call_notes"],
  },
  {
    key: "phase5_asset_collection",
    label: "Phase 5 — Asset Collection",
    target: "Days 7–14",
    items: [
      { field: "p5_logo_received", label: "Logo received" },
      { field: "p5_brand_colours_confirmed", label: "Brand colours confirmed" },
      { field: "p5_existing_photos_received", label: "Existing photos received" },
      { field: "p5_login_access_received", label: "Login access received (social, GBP, website)" },
      { field: "p5_target_audience_brief_done", label: "Target audience brief completed" },
    ],
    completedAt: "p5_completed_at",
  },
  {
    key: "phase6_delivery_start",
    label: "Phase 6 — Delivery Start",
    target: "All 4 triggers must be green",
    items: [
      { field: "p6_first_deliverable_scheduled", label: "First deliverable scheduled" },
    ],
    completedAt: "p6_completed_at",
  },
];

const PHASE_ORDER = PHASES.map(p => p.key);

const TRIGGERS = [
  { field: "trigger_setup_fee_paid", label: "Setup Fee Paid", dateField: "trigger_setup_fee_paid_date" },
  { field: "trigger_onboarding_form_returned", label: "Onboarding Form Returned", dateField: "trigger_onboarding_form_returned_date" },
  { field: "trigger_debit_mandate_signed", label: "Debit Mandate Signed", dateField: "trigger_debit_mandate_signed_date" },
  { field: "trigger_brand_assets_received", label: "Brand Assets Received", dateField: "trigger_brand_assets_received_date" },
];

export default function OnboardingDetail({ record, onUpdate, onClose }) {
  const [data, setData] = useState({ ...record });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const now = () => new Date().toISOString();
  const today = () => new Date().toISOString().split("T")[0];

  const allTriggersGreen = TRIGGERS.every(t => data[t.field]);

  const createAutoTask = async (title, adminId, adminName, daysFromNow = 0) => {
    const due = new Date();
    due.setDate(due.getDate() + daysFromNow);
    await base44.entities.Task.create({
      title,
      client_id: record.client_id,
      client_name: record.client_name,
      onboarding_id: record.id,
      assigned_to: adminId || record.assigned_admin_id,
      assigned_to_name: adminName || record.assigned_admin_name,
      status: "open",
      priority: "high",
      due_date: due.toISOString().split("T")[0],
      auto_generated: true,
    }).catch(() => {});
  };

  const save = async (updates) => {
    setSaving(true);
    const merged = { ...data, ...updates };

    // Check if all items in the current phase are now ticked → auto-advance
    const currentPhaseConfig = PHASES.find(p => p.key === merged.current_phase);
    if (currentPhaseConfig) {
      const allDone = currentPhaseConfig.items.every(item => merged[item.field]);
      if (allDone && !merged[currentPhaseConfig.completedAt]) {
        merged[currentPhaseConfig.completedAt] = now();
        const nextIndex = PHASE_ORDER.indexOf(merged.current_phase) + 1;
        if (nextIndex < PHASE_ORDER.length) {
          const nextPhase = PHASE_ORDER[nextIndex];
          if (nextPhase !== "phase6_delivery_start" || allTriggersGreen) {
            merged.current_phase = nextPhase;
            toast({ title: "Phase complete!", description: `Advanced to ${PHASES[nextIndex].label}` });
            // Auto-task for phase 4: schedule onboarding call
            if (nextPhase === "phase4_onboarding_call") {
              createAutoTask(`Schedule onboarding call with ${record.client_name}`, record.assigned_admin_id, record.assigned_admin_name, 3);
            }
            // Auto-task for any phase change
            createAutoTask(`Move ${record.client_name} to ${PHASES[nextIndex].label}`, record.assigned_admin_id, record.assigned_admin_name, 1);
          } else if (nextPhase === "phase6_delivery_start") {
            toast({ title: "Phase 5 complete", description: "Waiting for all 4 triggers to unlock Phase 6." });
          }
        } else {
          merged.overall_status = "completed";
        }
      }
    }

    await base44.entities.ClientOnboarding.update(record.id, merged);
    setData(merged);
    setSaving(false);
    onUpdate(merged);
  };

  const tick = (field, checked) => {
    const updates = { [field]: checked };
    if (checked) {
      // If it's a trigger, also set the date
      const trigger = TRIGGERS.find(t => t.field === field);
      if (trigger) updates[trigger.dateField] = today();
    }
    save(updates);
  };

  const handleStartDelivery = async () => {
    const updates = {
      current_phase: "phase6_delivery_start",
      p6_delivery_started_date: today(),
    };
    // Create onboarding task
    await base44.entities.Task.create({
      title: `Begin client deliverables for ${record.client_name}`,
      description: "All 4 triggers confirmed. Delivery phase has started.",
      client_id: record.client_id,
      client_name: record.client_name,
      assigned_to: record.assigned_admin_id,
      assigned_to_name: record.assigned_admin_name,
      status: "todo",
      priority: "high",
    });
    await save(updates);
    toast({ title: "Delivery started!", description: `Deliverables task created for ${record.client_name}` });
  };

  const currentPhaseIndex = PHASE_ORDER.indexOf(data.current_phase);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-8 px-4">
      <div className="w-full max-w-2xl glass rounded-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold gradient-text">{data.client_name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Admin: {data.assigned_admin_name || "Unassigned"}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Trigger Gate */}
        <div className={`rounded-xl border p-4 ${allTriggersGreen ? "border-success/40 bg-success/8" : "border-warning/30 bg-warning/5"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {allTriggersGreen ? <Unlock className="w-4 h-4 text-success" /> : <Lock className="w-4 h-4 text-warning" />}
              <span className="text-sm font-semibold text-foreground">Phase 6 Gate — 4 Required Triggers</span>
            </div>
            {allTriggersGreen && data.current_phase !== "phase6_delivery_start" && (
              <Button size="sm" onClick={handleStartDelivery} className="gradient-bg text-white text-xs">
                <PlayCircle className="w-3 h-3 mr-1" /> Start Delivery
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TRIGGERS.map(t => (
              <button
                key={t.field}
                onClick={() => tick(t.field, !data[t.field])}
                disabled={saving}
                className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs ${data[t.field] ? "border-success/40 bg-success/10 text-success" : "border-border/40 text-muted-foreground hover:border-border"}`}
              >
                {data[t.field] ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phase Checklists */}
        {PHASES.map((phase, phaseIndex) => {
          const isActive = phaseIndex <= currentPhaseIndex;
          const isComplete = !!data[phase.completedAt];
          const isPhase6 = phase.key === "phase6_delivery_start";
          const isLocked = isPhase6 && !allTriggersGreen && data.current_phase !== "phase6_delivery_start";

          return (
            <div key={phase.key} className={`rounded-xl border p-4 transition-all ${isComplete ? "border-success/30 bg-success/5" : isLocked ? "border-border/20 opacity-50" : isActive ? "border-primary/30 bg-primary/5" : "border-border/20 opacity-60"}`}>
              <div className="flex items-center gap-3 mb-3">
                {isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                ) : isLocked ? (
                  <Lock className="w-5 h-5 text-muted-foreground shrink-0" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 shrink-0 ${isActive ? "border-primary" : "border-border/40"}`} />
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{phase.label}</p>
                  <p className="text-xs text-muted-foreground">{phase.target}</p>
                </div>
                {isComplete && (
                  <Badge className="ml-auto text-xs border bg-success/15 text-success border-success/30">Done</Badge>
                )}
              </div>

              {!isLocked && (
                <div className="space-y-2">
                  {phase.items.map(item => (
                    <label key={item.field} className="flex items-center gap-3 cursor-pointer group">
                      <Checkbox
                        checked={!!data[item.field]}
                        onCheckedChange={v => tick(item.field, !!v)}
                        disabled={saving}
                        className="shrink-0"
                      />
                      <span className={`text-sm ${data[item.field] ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
                    </label>
                  ))}

                  {/* Phase 4 extras */}
                  {phase.key === "phase4_onboarding_call" && (
                    <div className="pt-2 space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Call Date</Label>
                        <Input type="date" value={data.p4_call_date || ""} onChange={e => save({ p4_call_date: e.target.value })} className="bg-secondary/50 border-border/50 text-sm h-8" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Call Notes</Label>
                        <Textarea value={data.p4_call_notes || ""} onChange={e => setData(d => ({ ...d, p4_call_notes: e.target.value }))} onBlur={e => save({ p4_call_notes: e.target.value })} className="bg-secondary/50 border-border/50 text-sm h-20" placeholder="Notes from the onboarding call…" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}