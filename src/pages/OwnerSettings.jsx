import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Package, DollarSign, Mail, Zap, Lock, Shield, Settings as SettingsIcon } from "lucide-react";

const COMPENSATION_PACKAGES = {
  field_agent: { salary: "R8,000 - R15,000", commissionRate: "5-8% setup + 2% recurring" },
  cpc: { salary: "R10,000 - R18,000", commissionRate: "6-10% setup + 2.5% recurring" },
  admin: { salary: "R18,000 - R28,000", commissionRate: "3% setup + 1% recurring" },
  head_of_tech: { salary: "R25,000 - R40,000", commissionRate: "2% setup + 0.5% recurring" },
};

const PACKAGES = [
  { name: "Ignite", type: "Core", setupFee: "R5,000", monthly: "R1,500" },
  { name: "Accelerate", type: "Core", setupFee: "R8,000", monthly: "R2,500" },
  { name: "Dominate", type: "Core", setupFee: "R12,000", monthly: "R4,000" },
  { name: "Street Pulse", type: "Core", setupFee: "R4,000", monthly: "R1,200" },
  { name: "Township Pulse", type: "Core", setupFee: "R4,000", monthly: "R1,200" },
];

const INTEGRATIONS = [
  { name: "OpenAI API", status: false, icon: Zap, configurable: true },
  { name: "Yoco Payments", status: false, icon: DollarSign, configurable: true },
  { name: "Resend Email", status: false, icon: Mail, configurable: true },
  { name: "Google Workspace", status: true, email: "info@, support@, no-reply@, admin@", configurable: false },
];

export default function OwnerSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [fulfilmentTemplates, setFulfilmentTemplates] = useState([]);
  const [systemSettings, setSystemSettings] = useState(null);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      if (user?.role !== "owner") {
        navigate("/");
        return;
      }
      const [u, templates, settings] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.FulfilmentTemplate.list(),
        base44.entities.SystemSettings.list(),
      ]);
      setUsers(Array.isArray(u) ? u : [u]);
      setFulfilmentTemplates(Array.isArray(templates) ? templates : [templates]);
      const s = Array.isArray(settings) ? settings[0] : settings;
      setSystemSettings(s);
      setLoading(false);
    };
    load();
  }, [navigate]);

  if (loading) return <AppLayout title="Settings"><div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div></AppLayout>;

  const allAddOns = fulfilmentTemplates.filter(t => t.bucket !== "bucket_a_once_off").length;

  return (
    <AppLayout title="Settings" subtitle="Organization & Integration Setup">
      <Tabs defaultValue="users" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users"><Users className="w-4 h-4 mr-2" /> Users</TabsTrigger>
          <TabsTrigger value="packages"><Package className="w-4 h-4 mr-2" /> Packages</TabsTrigger>
          <TabsTrigger value="commissions"><DollarSign className="w-4 h-4 mr-2" /> Commissions</TabsTrigger>
          <TabsTrigger value="templates"><Mail className="w-4 h-4 mr-2" /> Templates</TabsTrigger>
          <TabsTrigger value="integrations"><Zap className="w-4 h-4 mr-2" /> Integrations</TabsTrigger>
          <TabsTrigger value="audit"><Lock className="w-4 h-4 mr-2" /> Audit</TabsTrigger>
        </TabsList>

        {/* TAB 1: Users */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold">Users ({users.length})</h3>
              <p className="text-xs text-muted-foreground">Team members & access control</p>
            </div>
            <Button size="sm" className="gap-2">Add New User</Button>
          </div>
          <div className="space-y-2">
            {users.map(u => (
              <Card key={u.id} className="glass border-white/10 p-4 flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="capitalize">{u.role}</Badge>
                  <Button variant="outline" size="sm">Edit</Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: Packages */}
        <TabsContent value="packages" className="space-y-4">
          <div>
            <h3 className="font-semibold mb-4">Core Packages (5)</h3>
            <div className="grid grid-cols-2 gap-4">
              {PACKAGES.map((p, idx) => (
                <Card key={idx} className="glass border-white/10 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.setupFee} setup • {p.monthly}/mo</p>
                    </div>
                    <Button variant="outline" size="sm">Edit</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Add-ons ({allAddOns})</h3>
            <p className="text-sm text-muted-foreground">Go to <Button variant="link" size="sm" className="p-0 h-auto">Products page</Button> to manage add-ons</p>
          </div>
        </TabsContent>

        {/* TAB 3: Commissions */}
        <TabsContent value="commissions" className="space-y-4">
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-accent">⚠️ Commission rates locked per company policy</p>
            <p className="text-xs text-muted-foreground mt-1">Contact founder if changes are needed</p>
          </div>
          <div className="space-y-4">
            {Object.entries(COMPENSATION_PACKAGES).map(([role, comp]) => (
              <Card key={role} className="glass border-white/10 p-4">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold capitalize text-sm">{role.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground mt-1">Base Salary: {comp.salary}</p>
                    <p className="text-xs text-muted-foreground">Commission: {comp.commissionRate}</p>
                  </div>
                  <Badge variant="outline">Locked</Badge>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 4: Email Templates */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="glass border-white/10 p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold mb-1">Email Templates</p>
                <p className="text-sm text-muted-foreground">15 transactional + 4 nurture templates</p>
              </div>
              <Button size="sm" variant="outline">Manage →</Button>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 5: Integrations */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="space-y-3">
            {INTEGRATIONS.map((int, idx) => {
              const Icon = int.icon;
              return (
                <Card key={idx} className="glass border-white/10 p-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">{int.name}</p>
                        {int.email && <p className="text-xs text-muted-foreground">{int.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {int.status ? (
                        <Badge className="bg-green-600">Configured</Badge>
                      ) : (
                        <Badge variant="outline">Not configured</Badge>
                      )}
                      {int.configurable && <Button variant="outline" size="sm">Configure</Button>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* TAB 6: Audit */}
        <TabsContent value="audit" className="space-y-4">
          <Card className="glass border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold mb-1">Security & Audit Log</p>
                <p className="text-sm text-muted-foreground">View system actions & security events</p>
              </div>
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-4">Security events, login attempts, & permission changes tracked for compliance.</p>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}