import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Users, DollarSign, Minus, Phone, Laptop, Shirt, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";

// Compensation packages from V2 document
const PACKAGES = {
  field_agent: {
    label: "Field Agent",
    components: [
      { name: "Basic Salary", amount: 4410 },
      { name: "Travel Allowance", amount: 1200 },
      { name: "Airtime Allowance", amount: 500 },
      { name: "Meal Allowance", amount: 390 },
    ],
    deductions: [],
    total_ctc: 6500,
    nett: 6500,
  },
  cpc: {
    label: "CPC",
    components: [
      { name: "Basic Salary", amount: 2500 },
      { name: "Airtime Allowance", amount: 500 },
      { name: "Performance Allowance", amount: 2890 },
    ],
    deductions: [
      { name: "PC / Software", amount: 650 },
      { name: "Work Phone", amount: 350 },
      { name: "Airtime", amount: 250 },
      { name: "Uniform", amount: 150 },
    ],
    total_ctc: 5890,
    nett: 4490,
  },
  admin: {
    label: "Admin",
    components: [
      { name: "Basic Salary", amount: 4890 },
      { name: "Office Allowance", amount: 1000 },
    ],
    deductions: [],
    total_ctc: 5890,
    nett: 5890,
  },
  founder: {
    label: "Founder / Owner",
    components: [
      { name: "Owner CTC", amount: 10000 },
    ],
    deductions: [],
    total_ctc: 10000,
    nett: 10000,
  },
};

const ROLE_COLORS = {
  field_agent: "bg-primary/15 text-primary border-primary/30",
  cpc: "bg-[#00ccff]/15 text-[#00ccff] border-[#00ccff]/30",
  admin: "bg-warning/15 text-warning border-warning/30",
  user: "bg-muted/40 text-muted-foreground border-border",
};

export default function StaffHR() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHire, setShowHire] = useState(false);
  const [selected, setSelected] = useState(null);
  const [hireForm, setHireForm] = useState({ email: "", role: "field_agent" });
  const [hiring, setHiring] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.User.list().then(d => { setStaff(d); setLoading(false); });
  }, []);

  const handleHire = async () => {
    if (!hireForm.email) return;
    setHiring(true);
    await base44.users.inviteUser(hireForm.email, hireForm.role === "admin" ? "admin" : "user");
    toast({ title: `Invite sent to ${hireForm.email}` });
    setShowHire(false);
    setHireForm({ email: "", role: "field_agent" });
    setHiring(false);
  };

  const pkg = selected ? PACKAGES[selected.role] : null;

  return (
    <AppLayout title="Staff & HR" subtitle="Team members, compensation packages & hiring">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" /> {staff.length} team member{staff.length !== 1 ? "s" : ""}
        </div>
        <Button onClick={() => setShowHire(true)} className="gradient-bg text-white border-0">
          <UserPlus className="w-4 h-4 mr-2" /> Hire Staff
        </Button>
      </div>

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
                {PACKAGES[s.role] && (
                  <span className="text-xs text-success font-semibold">R{PACKAGES[s.role].nett.toLocaleString()} nett</span>
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
                    {pkg.deductions.map(d => (
                      <div key={d.name} className="flex justify-between items-center px-4 py-2.5">
                        <span className="text-sm text-foreground flex items-center gap-1.5">
                          <Minus className="w-3 h-3 text-destructive" />{d.name}
                        </span>
                        <span className="text-sm text-destructive font-medium">- R{d.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3 bg-white/5">
                      <span className="text-sm font-bold text-foreground">Gross CTC</span>
                      <span className="text-sm font-bold text-foreground">R{pkg.total_ctc.toLocaleString()}</span>
                    </div>
                    {pkg.deductions.length > 0 && (
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
                  <SelectItem value="field_agent">Field Agent — R6,500 CTC</SelectItem>
                  <SelectItem value="cpc">CPC — R5,890 gross / R4,490 nett</SelectItem>
                  <SelectItem value="admin">Admin — R5,890 CTC</SelectItem>
                  <SelectItem value="user">User (other)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Package preview */}
            {PACKAGES[hireForm.role] && (
              <div className="glass rounded-xl p-4 text-sm space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Package Preview</p>
                {PACKAGES[hireForm.role].components.map(c => (
                  <div key={c.name} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="text-success">R{c.amount.toLocaleString()}</span>
                  </div>
                ))}
                {PACKAGES[hireForm.role].deductions.map(d => (
                  <div key={d.name} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{d.name} (deduction)</span>
                    <span className="text-destructive">-R{d.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold pt-1 border-t border-white/10 mt-1">
                  <span className="text-foreground">Nett Take-Home</span>
                  <span className="text-success">R{PACKAGES[hireForm.role].nett.toLocaleString()}</span>
                </div>
              </div>
            )}

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