import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Mail, Zap, Lock, Send, CheckCircle2, AlertCircle } from "lucide-react";
import LaunchReadinessModal from "@/components/owner/LaunchReadinessModal";
import { useToast } from "@/components/ui/use-toast";

const TABS = ["users", "packages", "commissions", "emails", "integrations", "audit"];

export default function OwnerSettings() {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailForm, setEmailForm] = useState({ recipients: "clients", subject: "", body: "" });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const [u, t] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.EmailTemplate.list(),
      ]);
      setUsers(Array.isArray(u) ? u : u ? [u] : []);
      setTemplates(Array.isArray(t) ? t : t ? [t] : []);
      setLoading(false);
    })();
  }, []);

  const sendBulkEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.body.trim()) {
      toast({ title: "Missing fields", description: "Subject and body are required", variant: "destructive" });
      return;
    }

    setSendingEmail(true);
    try {
      let recipients = [];

      if (emailForm.recipients === "clients") {
        const clients = await base44.entities.Client.list();
        recipients = (Array.isArray(clients) ? clients : clients ? [clients] : [])
          .filter(c => c.email)
          .map(c => ({ email: c.email, name: c.contact_person }));
      } else if (emailForm.recipients === "staff") {
        recipients = (Array.isArray(users) ? users : users ? [users] : [])
          .filter(u => u.email)
          .map(u => ({ email: u.email, name: u.full_name }));
      }

      let successCount = 0;
      let failCount = 0;

      for (const recipient of recipients) {
        try {
          await base44.integrations.Core.SendEmail({
            to: recipient.email,
            subject: emailForm.subject,
            body: emailForm.body,
            from_name: "Marketing iO"
          });
          successCount += 1;
        } catch (err) {
          failCount += 1;
        }
      }

      setEmailResult({ success: successCount, fail: failCount, total: recipients.length });
      toast({ title: "Emails sent", description: `${successCount}/${recipients.length} emails delivered` });
      setEmailForm({ recipients: "clients", subject: "", body: "" });
    } catch (err) {
      toast({ title: "Error sending emails", description: err.message, variant: "destructive" });
    }
    setSendingEmail(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold gradient-text">Settings</h1>
          <LaunchReadinessModal />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-secondary text-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* TAB: Users */}
        {activeTab === "users" && (
          <div className="glass rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Team Members ({users.length})</h3>
              <Button size="sm" asChild>
                <a href="/onboarding-form">Add User</a>
              </Button>
            </div>
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                  <div>
                    <p className="font-semibold text-sm">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-primary/15 text-primary capitalize">{u.role}</Badge>
                    <Button size="sm" variant="ghost">Edit</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Packages */}
        {activeTab === "packages" && (
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Service Packages & Add-ons</h3>
            <p className="text-sm text-muted-foreground mb-4">Edit these in Products page</p>
            <Button asChild variant="outline" size="sm">
              <a href="/products">Manage Packages →</a>
            </Button>
          </div>
        )}

        {/* TAB: Commissions */}
        {activeTab === "commissions" && (
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Commission Rates</h3>
            <p className="text-sm text-muted-foreground mb-4">These rates are locked per company policy. Contact founder to change.</p>
            <div className="bg-secondary/30 rounded-lg p-4 text-xs space-y-1">
              <p>Field Agent: Commission rates per package from compensationPackages.js</p>
              <p>CPC: Rates per package based on deal value</p>
              <p>All rates locked — no changes via UI</p>
            </div>
          </div>
        )}

        {/* TAB: Emails */}
        {activeTab === "emails" && (
          <div className="space-y-4">
            <div className="glass rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">{templates.length} Templates Active</h3>
                <Button asChild size="sm" variant="outline">
                  <a href="/email-templates">Manage Templates →</a>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Transactional + nurture templates managed in Email Templates page</p>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-semibold">Send Campaign</h3>
                  <p className="text-xs text-muted-foreground">Fire emails to all clients or staff</p>
                </div>
                <Button onClick={() => setShowEmailDialog(true)} className="gap-2 gradient-bg text-white">
                  <Send className="w-4 h-4" /> Fire Email
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Integrations */}
        {activeTab === "integrations" && (
          <div className="space-y-4">
            <div className="glass rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">OpenAI API</p>
                  <p className="text-xs text-muted-foreground">For image generation & LLM features</p>
                </div>
              </div>
              <Badge className="bg-warning/15 text-warning">Not Configured</Badge>
            </div>

            <div className="glass rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">Google Workspace</p>
                  <p className="text-xs text-muted-foreground">Email accounts: info@, support@, no-reply@, admin@</p>
                </div>
              </div>
              <Badge className="bg-success/15 text-success">Configured</Badge>
            </div>

            <div className="glass rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-semibold text-sm">Yoco Payments</p>
                  <p className="text-xs text-muted-foreground">For online invoice payments</p>
                </div>
              </div>
              <Badge className="bg-warning/15 text-warning">Not Configured</Badge>
            </div>
          </div>
        )}

        {/* TAB: Audit */}
        {activeTab === "audit" && (
          <div className="glass rounded-xl p-6">
            <h3 className="font-semibold mb-4">Security & Audit Log</h3>
            <p className="text-sm text-muted-foreground">Recent system actions and security events will be logged here.</p>
          </div>
        )}
      </div>

      {/* Email Campaign Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="bg-card border-border/50 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="gradient-text">Fire Email Campaign</DialogTitle>
          </DialogHeader>

          {emailResult ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-success/10 border border-success/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Emails Sent Successfully</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {emailResult.success} out of {emailResult.total} recipients received the email
                  </p>
                  {emailResult.fail > 0 && (
                    <p className="text-xs text-destructive mt-1">{emailResult.fail} failed to deliver</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailResult(null);
                    setShowEmailDialog(false);
                  }}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => setEmailResult(null)}
                  className="flex-1 gradient-bg text-white"
                >
                  Send Another
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Recipients</label>
                <Select value={emailForm.recipients} onValueChange={(v) => setEmailForm({ ...emailForm, recipients: v })}>
                  <SelectTrigger className="bg-secondary/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clients">All Clients</SelectItem>
                    <SelectItem value="staff">All Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  placeholder="Email subject line"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                  className="bg-secondary/50 border-border/50"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Body</label>
                <Textarea
                  placeholder="Email body text"
                  value={emailForm.body}
                  onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                  className="bg-secondary/50 border-border/50 min-h-32"
                />
              </div>

              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <p className="text-xs text-warning flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  This will send to all {emailForm.recipients === "clients" ? "active clients" : "staff members"}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowEmailDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={sendBulkEmail}
                  disabled={sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim()}
                  className="flex-1 gradient-bg text-white gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Fire Emails
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}