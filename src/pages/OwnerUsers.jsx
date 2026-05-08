import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Loader2, Copy, CheckCircle2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useToast } from "@/components/ui/use-toast";

// Round 5 — Owner → staff user provisioning.
//
// Lists existing AppUser staff records. "Create staff user" form invokes
// provision-staff-user which creates the AppUser + legacy User rows and
// emails the recipient a one-time setup link. After success, owner sees
// a copyable setup URL as a fallback in case the email didn't deliver.

const ROLES = [
  { value: "admin",        label: "Admin" },
  { value: "field_agent",  label: "Field Agent" },
  { value: "cpc",          label: "CPC" },
  { value: "head_of_tech", label: "Head of Tech" },
  { value: "driver",       label: "Driver" },
];

const ROLE_BADGE = {
  owner:        "bg-amber-500/15 text-amber-300 border-amber-500/30",
  admin:        "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  field_agent:  "bg-purple-500/15 text-purple-300 border-purple-500/30",
  cpc:          "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  head_of_tech: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  driver:       "bg-slate-500/15 text-slate-300 border-slate-500/30",
  client:       "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

function getSessionToken() {
  try { return localStorage.getItem("mio_session_token") || ""; } catch { return ""; }
}

function fmtDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return s; }
}

export default function OwnerUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [provisionResult, setProvisionResult] = useState(null);

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formRole, setFormRole] = useState("admin");
  const [formPhone, setFormPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.AppUser.list("-created_date", 200).catch(() => []);
      setUsers(Array.isArray(rows) ? rows : []);
    } catch (err) {
      toast({ title: "Could not load users", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setFormEmail("");
    setFormFullName("");
    setFormRole("admin");
    setFormPhone("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!formEmail.trim() || !formFullName.trim() || !formRole) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("provision-staff-user", {
        token:     getSessionToken(),
        email:     formEmail.trim(),
        full_name: formFullName.trim(),
        role:      formRole,
        phone:     formPhone.trim() || undefined,
      });
      const payload = res?.data ?? res;
      if (payload?.success) {
        setCreateOpen(false);
        setProvisionResult({
          email:      formEmail.trim(),
          full_name:  formFullName.trim(),
          role:       formRole,
          setup_url:  payload.setup_url,
          email_sent: payload.email_sent,
        });
        setResultOpen(true);
        await loadUsers();
      } else {
        toast({
          title: "Could not create user",
          description: payload?.message || payload?.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Could not create user", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const copySetupUrl = async () => {
    try {
      await navigator.clipboard.writeText(provisionResult?.setup_url || "");
      toast({ title: "Setup link copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <AppLayout title="Users" subtitle="Provision and manage staff accounts">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">{users.length} accounts</div>
          <Button onClick={openCreate}>
            <UserPlus className="w-4 h-4 mr-2" />
            Create staff user
          </Button>
        </div>

        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b border-border/40">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Last login</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No users yet.</td></tr>
              )}
              {!loading && users.map((u) => (
                <tr key={u.id} className="border-b border-border/20 hover:bg-muted/10">
                  <td className="px-4 py-3">{u.full_name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={ROLE_BADGE[u.role] || ROLE_BADGE.client}>{(u.role || "client").replace(/_/g, " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.email_verified
                      ? <span className="text-success">Verified</span>
                      : u.pending_verification
                        ? <span className="text-warning">Pending verification</span>
                        : <span className="text-muted-foreground">—</span>}
                    {u.lockout_until && new Date(u.lockout_until) > new Date() && (
                      <span className="ml-2 text-destructive">Locked</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.created_date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(u.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create staff user</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="name@marketingio.co.za"
                autoFocus
              />
            </div>
            <div>
              <Label>Full name *</Label>
              <Input
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="Thandi Mokoena"
              />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="+27 71 520 5334"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The recipient will receive an email with a one-time setup link to choose their own password (24-hour expiry).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
            <Button
              onClick={submitCreate}
              disabled={submitting || !formEmail.trim() || !formFullName.trim()}
            >
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create & send setup email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provisioning result modal */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <CheckCircle2 className="w-5 h-5 inline-block text-success mr-2" />
              {provisionResult?.full_name} created
            </DialogTitle>
          </DialogHeader>
          {provisionResult && (
            <div className="space-y-4 text-sm">
              <div className="rounded-md bg-muted/20 p-3 text-xs space-y-1">
                <div><strong>Email:</strong> {provisionResult.email}</div>
                <div><strong>Role:</strong> {provisionResult.role.replace(/_/g, " ")}</div>
                <div><strong>Setup email:</strong> {provisionResult.email_sent
                  ? <span className="text-success">Delivered</span>
                  : <span className="text-warning">Not delivered (Resend likely misconfigured — share the link below manually)</span>}</div>
              </div>
              <div>
                <Label>Setup link (24h expiry)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input value={provisionResult.setup_url} readOnly className="font-mono text-xs" />
                  <Button size="sm" variant="outline" onClick={copySetupUrl}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Forward this link if the email didn't arrive. The recipient sets their password via the standard reset-password page.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
