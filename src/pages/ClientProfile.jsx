import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Save } from "lucide-react";

export default function ClientProfile() {
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [activeTab, setActiveTab] = useState("business");
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        setClient(clients[0]);
        setFormData(clients[0]);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Client.update(client.id, formData);
    setClient(formData);
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;

  const TABS = [
    { id: "business", label: "Business Info" },
    { id: "contact", label: "Contact Info" },
    { id: "notifications", label: "Notifications" },
    { id: "security", label: "Security" },
    { id: "subscription", label: "Subscription" },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-6">Your Profile</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border/40">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass rounded-xl p-6">
          {activeTab === "business" && (
            <div className="space-y-4">
              <FormField label="Business Name" value={formData.business_name} onChange={(v) => setFormData({ ...formData, business_name: v })} />
              <FormField label="Industry" value={formData.industry} onChange={(v) => setFormData({ ...formData, industry: v })} />
              <FormField label="Address" value={formData.address} onChange={(v) => setFormData({ ...formData, address: v })} />
              <FormField label="Email" type="email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
              <FormField label="Phone" value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} />
            </div>
          )}

          {activeTab === "contact" && (
            <div className="space-y-4">
              <FormField label="Primary Contact Name" value={formData.contact_person} onChange={(v) => setFormData({ ...formData, contact_person: v })} />
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Preferred Communication</label>
                <select value={formData.preferred_communication_channel || "email"} onChange={(e) => setFormData({ ...formData, preferred_communication_channel: e.target.value })} className="w-full p-2 bg-secondary/50 border border-border/50 rounded-lg text-sm">
                  {["email", "whatsapp", "phone", "sms"].map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Email on file: {client.email}</p>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-3">
              {[
                { key: "email_deliverable_ready", label: "Email when deliverable is ready" },
                { key: "email_invoice_issued", label: "Email when invoice is issued" },
                { key: "email_monthly_report", label: "Email when monthly report is ready" },
                { key: "email_payment_received", label: "Email when payment is received" },
              ].map(n => (
                <label key={n.key} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="rounded" />
                  <span className="text-sm text-foreground">{n.label}</span>
                </label>
              ))}
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                <p className="text-sm font-semibold text-primary">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground mt-1">Required for all accounts — already enabled</p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Recent Logins</label>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>•Last login: {new Date().toLocaleDateString("en-ZA")}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "subscription" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Package</p>
                <p className="text-lg font-bold capitalize text-foreground">{formData.package}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contract Dates</p>
                {formData.contract_start_date && <p className="text-sm text-foreground">{new Date(formData.contract_start_date).toLocaleDateString("en-ZA")} to {new Date(formData.contract_end_date).toLocaleDateString("en-ZA")}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Save Button */}
        {["business", "contact"].includes(activeTab) && (
          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gradient-bg text-white">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormField({ label, type = "text", value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} className="bg-secondary/50 border-border/50" />
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}