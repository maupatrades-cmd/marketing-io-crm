import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Users, Minus, ClipboardList, CheckCircle2, Bell } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { calcPackage, ROLE_LABELS } from "@/lib/compensationPackages";

const ROLE_COLORS = {
  field_agent: "bg-primary/15 text-primary border-primary/30",
  cpc: "bg-[#00ccff]/15 text-[#00ccff] border-[#00ccff]/30",
  admin: "bg-warning/15 text-warning border-warning/30",
  user: "bg-muted/40 text-muted-foreground border-border",
};

export default function StaffHR() {
  const [staff, setStaff] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHire, setShowHire] = useState(false);
  const [selected, setSelected] = useState(null);
  const [hireForm, setHireForm] = useState({ email: "", role: "field_agent" });
  const [hiring, setHiring] = useState(false);
  const [approvingId, setApprovingId] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      base44.entities.User.list(),
      base44.entities.StaffRecord.list("-created_date", 50),
    ]).then(([users, records]) => {
      setStaff(users);
      setApplications(records);
      setLoading(false);
    });
  }, []);

  // Approval workflow: fires when a StaffRecord is approved
  const handleApproveApplication = async (record) => {
    setApprovingId(record.id);

    // 1. Mark record as Approved
    await base44.entities.StaffRecord.update(record.id, {
      application_status: "Approved",
      approved_date: new Date().toISOString().split("T")[0],
    });

    // 2. Welcome + onboarding email to applicant
    await base44.integrations.Core.SendEmail({
      to: record.personal_email,
      subject: `Welcome to Marketing iO — Your Application Has Been Approved! 🎉`,
      body: `Dear ${record.preferred_name || record.full_legal_name},\n\nCongratulations! We are thrilled to inform you that your application to join Marketing iO has been approved.\n\nHere's what happens next:\n\n1. COMPANY EMAIL SETUP\nYour company email address will be created within 1–2 business days. You will receive login details separately.\n\n2. ONBOARDING DOCUMENTS\nPlease look out for your employment contract, POPIA agreement and company policy documents which will be sent to this email address.\n\n3. SYSTEM PROFILE SETUP\nOur payroll and operations team will set up your profile in our internal systems.\n\n4. START DATE\nYour confirmed start date: ${record.start_date || "To be confirmed by your manager"}.\n\nWelcome to the team! We're excited to have you on board.\n\nWarm regards,\nMarketing iO HR Team`,
    });

    // 3. Notify payroll / admin team
    await base44.integrations.Core.SendEmail({
      to: "admin@marketingio.co.za",
      subject: `[PAYROLL ACTION REQUIRED] New Employee Approved — ${record.full_legal_name}`,
      body: `Hi Team,\n\nA new staff member has been approved and requires immediate setup in our systems.\n\nEMPLOYEE DETAILS:\n- Name: ${record.full_legal_name} (${record.preferred_name || ""})\n- Role: ${record.position_role || "Not specified"}\n- Start Date: ${record.start_date || "TBC"}\n- Employment Type: ${record.employment_type || "TBC"}\n- Monthly CTC: R${record.monthly_ctc || "TBC"}\n- Personal Email: ${record.personal_email}\n- SA ID: ${record.id_number}\n\nACTION ITEMS:\n☐ Create company email account (firstname.lastname@marketingio.co.za)\n☐ Add employee to payroll system\n☐ Set up UIF registration\n☐ Issue employment contract\n☐ Send bank details to payroll\n☐ Add to company WhatsApp groups\n☐ Set up system access & credentials\n\nBanking Details:\n- Bank: ${record.bank_name || "See record"}\n- Account Holder: ${record.account_holder_name}\n- Account Number: ${record.account_number}\n- Account Type: ${record.account_type || "See record"}\n\nThis is an automated notification from Marketing iO CRM.\nPlease log in to view the full staff record.`,
    });

    // Update local state
    setApplications(prev => prev.map(a => a.id === record.id ? { ...a, application_status: "Approved" } : a));
    setApprovingId(null);
    toast({ title: `✓ ${record.preferred_name || record.full_legal_name} approved`, description: "Welcome email & payroll notification sent." });
  };

  const handleHire = async () => {
    if (!hireForm.email) return;
    setHiring(true);
    await base44.users.inviteUser(hireForm.email, hireForm.role === "admin" ? "admin" : "user");
    toast({ title: `Invite sent to ${hireForm.email}` });
    setShowHire(false);
    setHireForm({ email: "", role: "field_agent" });
    setHiring(false);
  };

  const pkg = selected ? calcPackage(selected.role) : null;

  return (
    <AppLayout title="Staff & HR" subtitle="Team members, compensation packages & hiring">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" /> {staff.length} team member{staff.length !== 1 ? "s" : ""}
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href="/onboarding-form"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 text-sm transition-all"
          >
            <ClipboardList className="w-4 h-4" /> Share Onboarding Form ↗
          </a>
          <Button onClick={() => setShowHire(true)} className="gradient-bg text-white border-0">
            <UserPlus className="w-4 h-4 mr-2" /> Hire Staff
          </Button>
        </div>
      </div>

      {/* Pending Applications */}
      {applications.filter(a => a.application_status !== "Approved" && a.application_status !== "Rejected").length > 0 && (
        <div className="mb-6 glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Bell className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-foreground">Pending Applications</span>
            <span className="ml-auto text-xs text-muted-foreground">{applications.filter(a => a.application_status !== "Approved" && a.application_status !== "Rejected").length} pending</span>
          </div>
          <div className="divide-y divide-white/5">
            {applications.filter(a => a.application_status !== "Approved" && a.application_status !== "Rejected").map(app => (
              <div key={app.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{app.full_legal_name?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{app.full_legal_name}</p>
                  <p className="text-xs text-muted-foreground">{app.position_role || "Role not specified"} · {app.personal_email}</p>
                </div>
                <Badge className={`border text-xs shrink-0 ${
                  app.application_status === "Under Review" ? "bg-warning/15 text-warning border-warning/30" :
                  app.application_status === "On Hold" ? "bg-muted/40 text-muted-foreground border-border" :
                  "bg-info/15 text-info border-info/30"
                }`}>{app.application_status}</Badge>
                <Button
                  size="sm"
                  disabled={approvingId === app.id}
                  onClick={() => handleApproveApplication(app)}
                  className="gradient-bg text-white border-0 text-xs shrink-0"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {approvingId === app.id ? "Approving…" : "Approve"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? [...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted/20 rounded-xl animate-pulse" />)
          : staff.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="glass rounded-xl p-4 text-left hover:border-primary/40 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                  {s.profile_photo_url
                    ? <img src={s.profile_photo_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-lg font-bold gradient-text">{(s.full_name || s.email)?.charAt(0)?.toUpperCase()}</span>
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{s.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge className={`border text-xs capitalize ${ROLE_COLORS[s.role] || ROLE_COLORS.user}`}>
                  {s.role?.replace(/_/g, " ")}
                </Badge>
                {calcPackage(s.role) && (
                  <span className="text-xs text-success font-semibold">R{calcPackage(s.role).nett.toLocaleString()} nett</span>
                )}
              </div>
              {s.job_title && <p className="text-xs text-muted-foreground mt-1">{s.job_title}</p>}
              {s.birthday && (
                <p className="text-xs text-muted-foreground mt-0.5">🎂 {format(new Date(s.birthday), "dd MMM")}</p>
              )}
            </button>
          ))
        }
      </div>

      {/* Staff Detail Drawer */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg" style={{ background: "#1c1c30", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selected?.full_name || selected?.email}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Profile */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                  {selected.profile_photo_url
                    ? <img src={selected.profile_photo_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-2xl font-bold gradient-text">{(selected.full_name || selected.email)?.charAt(0)?.toUpperCase()}</span>
                  }
                </div>
                <div>
                  <Badge className={`border text-xs capitalize ${ROLE_COLORS[selected.role] || ROLE_COLORS.user}`}>
                    {selected.role?.replace(/_/g, " ")}
                  </Badge>
                  {selected.job_title && <p className="text-sm text-muted-foreground mt-0.5">{selected.job_title}</p>}
                  {selected.phone && <p className="text-xs text-muted-foreground">{selected.phone}</p>}
                  {selected.birthday && <p className="text-xs text-muted-foreground">🎂 {format(new Date(selected.birthday), "dd MMMM")}</p>}
                </div>
              </div>

              {/* Social links */}
              {(selected.instagram || selected.facebook || selected.tiktok) && (
                <div className="flex gap-2 flex-wrap">
                  {selected.instagram && <a href={selected.instagram.startsWith("http") ? selected.instagram : `https://instagram.com/${selected.instagram}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/20 hover:bg-pink-500/25">📸 Instagram</a>}
                  {selected.facebook && <a href={selected.facebook} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25">Facebook</a>}
                  {selected.tiktok && <a href={selected.tiktok.startsWith("http") ? selected.tiktok : `https://tiktok.com/@${selected.tiktok}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-full bg-white/10 text-white border border-white/20 hover:bg-white/15">TikTok</a>}
                </div>
              )}

              {/* Compensation Package */}
              {pkg ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Compensation Package</p>
                  <div className="glass rounded-xl overflow-hidden divide-y divide-white/5">
                    {pkg.components.map(c => (
                      <div key={c.name} className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-sm text-foreground">{c.name}</span>
                        <span className="text-sm text-success font-medium">+ R{c.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {pkg.deductionItems.map(d => (
                      <div key={d.name} className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-sm text-foreground flex items-center gap-1.5">
                          <Minus className="w-3 h-3 text-destructive" />{d.name}
                        </span>
                        <span className="text-sm text-destructive font-medium">- R{d.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3 bg-white/5">
                      <span className="text-sm font-bold text-foreground">Gross CTC</span>
                      <span className="text-sm font-bold text-foreground">R{pkg.gross.toLocaleString()}</span>
                    </div>
                    {pkg.deductionItems.length > 0 && (
                      <div className="flex justify-between items-center px-4 py-3 bg-success/5">
                        <span className="text-sm font-bold text-success">Nett Take-Home</span>
                        <span className="text-sm font-bold text-success">R{pkg.nett.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">+ Commission earnings vary by performance. See Commissions page.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No standard compensation package assigned for role: {selected.role}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hire Dialog */}
      <Dialog open={showHire} onOpenChange={setShowHire}>
        <DialogContent className="max-w-md" style={{ background: "#1c1c30", border: "1px solid rgba(255,255,255,0.1)" }}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Hire New Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email Address</label>
              <Input
                type="email"
                placeholder="staff@example.com"
                value={hireForm.email}
                onChange={e => setHireForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Role</label>
              <Select value={hireForm.role} onValueChange={v => setHireForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["field_agent","cpc","admin"].map(r => {
                    const p = calcPackage(r);
                    return (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]} — R{p.gross.toLocaleString()} gross{p.totalDeductions > 0 ? ` / R${p.nett.toLocaleString()} nett` : ""}
                      </SelectItem>
                    );
                  })}
                  <SelectItem value="user">User (other)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Package preview */}
            {calcPackage(hireForm.role) && (() => {
              const p = calcPackage(hireForm.role);
              return (
                <div className="glass rounded-xl p-4 text-sm space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Package Preview</p>
                  {p.components.map(c => (
                    <div key={c.name} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span className="text-success">R{c.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  {p.deductionItems.map(d => (
                    <div key={d.name} className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Minus className="w-3 h-3 text-destructive" />{d.name}</span>
                      <span className="text-destructive">-R{d.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-white/10 mt-1">
                    <span className="text-foreground">Gross CTC</span>
                    <span className="text-foreground">R{p.gross.toLocaleString()}</span>
                  </div>
                  {p.totalDeductions > 0 && (
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-success">Nett Take-Home</span>
                      <span className="text-success">R{p.nett.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowHire(false)}>Cancel</Button>
              <Button onClick={handleHire} disabled={hiring || !hireForm.email} className="gradient-bg text-white border-0">
                <UserPlus className="w-4 h-4 mr-2" />
                {hiring ? "Sending…" : "Send Invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}