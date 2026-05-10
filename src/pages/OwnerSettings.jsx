import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Mail, Zap, Lock } from "lucide-react";
import LaunchReadinessModal from "@/components/owner/LaunchReadinessModal";
import BackButton from "@/components/BackButton";

const TABS = ["users", "packages", "commissions", "emails", "integrations", "audit"];

export default function OwnerSettings() {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <BackButton to="/" />
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
          <div className="glass rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">{templates.length} Templates Active</h3>
              <Button asChild size="sm" variant="outline">
                <a href="/email-templates">Manage Templates →</a>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Transactional + nurture templates managed in Email Templates page</p>
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
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}