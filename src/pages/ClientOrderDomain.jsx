import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle2, Globe } from "lucide-react";

const EXTENSIONS = [".co.za", ".com", ".africa", ".net", ".org"];
const USES = ["business website", "email only", "both", "future use"];

export default function ClientOrderDomain() {
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [extensions, setExtensions] = useState({});
  const [backup, setBackup] = useState("");
  const [use, setUse] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        setClient(Array.isArray(clients) ? clients[0] : clients);
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const domainFull = domain + Object.keys(extensions).filter(k => extensions[k]).map(k => k).join(", ");

      await base44.entities.ServiceOrder.create({
        client_id: client.id,
        requested_by_id: user.id,
        order_type: "domain_registration",
        product_name: "Domain Registration",
        price_zar_setup: 150,
        price_zar_recurring: 150,
        domain_requested: domainFull,
        additional_notes: `Use case: ${use}\nBackup options: ${backup}\n${notes}`,
      });

      // Create task for Head of Tech
      const staffMembers = await base44.entities.User.list();
      const headOfTech = staffMembers.find(u => u.role === "head_of_tech");
      
      if (headOfTech) {
        await base44.entities.Task.create({
          title: `Domain registration request from ${client.business_name}: ${domainFull}`,
          client_id: client.id,
          assigned_to: headOfTech.id,
          priority: "high",
          status: "open",
        });
      }

      // Create notification
      await base44.entities.ClientNotification.create({
        client_id: client.id,
        notification_type: "onboarding_step_complete",
        title: "Domain Request Received",
        body: `We'll check availability for ${domainFull} and email you within 1 business day with options.`,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      
      // Reset form
      setDomain("");
      setExtensions({});
      setBackup("");
      setUse("");
      setNotes("");
    } catch (err) {
      console.error("Domain order error:", err);
    }
    setSubmitting(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Register a Domain Through Marketing iO</h1>
        <p className="text-muted-foreground mb-6">We'll search availability, register on your behalf, and configure DNS.</p>

        {success && (
          <div className="glass rounded-xl p-4 border border-success/30 mb-6 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="font-semibold text-foreground">Request submitted!</p>
              <p className="text-xs text-muted-foreground">We'll email you within 1 business day with availability and pricing.</p>
            </div>
          </div>
        )}

        <div className="glass rounded-xl p-6 border border-primary/20 mb-6 bg-primary/5">
          <p className="text-sm mb-2"><strong>Pricing:</strong> R150 setup + R150/year recurring</p>
          <p className="text-xs text-muted-foreground">Domain registration, DNS setup, and yearly renewal included.</p>
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          {/* Preferred Domain */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Preferred Domain Name</label>
            <div className="flex gap-2">
              <Input 
                value={domain} 
                onChange={(e) => setDomain(e.target.value)} 
                placeholder="e.g., mycompany" 
                className="bg-secondary/50 border-border/50" 
              />
              <span className="text-muted-foreground text-sm pt-2">.(extension)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Don't include the extension below — just the name.</p>
          </div>

          {/* Extensions */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Preferred Extensions</label>
            <div className="space-y-2">
              {EXTENSIONS.map(ext => (
                <div key={ext} className="flex items-center gap-2">
                  <Checkbox 
                    checked={extensions[ext] || false} 
                    onCheckedChange={(checked) => setExtensions({ ...extensions, [ext]: checked })}
                  />
                  <span className="text-sm">{ext}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Backup Options */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Backup Options (if preferred unavailable)</label>
            <Textarea 
              value={backup} 
              onChange={(e) => setBackup(e.target.value)} 
              placeholder="e.g., mycompany2, myco, etc." 
              rows={2} 
              className="bg-secondary/50 border-border/50" 
            />
          </div>

          {/* Intended Use */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Intended Use</label>
            <div className="space-y-2">
              {USES.map(u => (
                <div key={u} className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    id={u} 
                    name="use" 
                    value={u} 
                    checked={use === u}
                    onChange={(e) => setUse(e.target.value)}
                    className="w-4 h-4"
                  />
                  <label htmlFor={u} className="text-sm capitalize cursor-pointer">{u}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Additional Notes (Optional)</label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Any special requirements or questions?" 
              rows={3} 
              className="bg-secondary/50 border-border/50" 
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => window.history.back()}>Cancel</Button>
            <Button onClick={handleSubmit} className="gradient-bg text-white" disabled={submitting || !domain || Object.values(extensions).length === 0 || !use}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}