import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Mail } from "lucide-react";

export default function ClientOrderEmail() {
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [mailboxCount, setMailboxCount] = useState(1);
  const [mailboxes, setMailboxes] = useState(["info"]);
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

  const handleMailboxCountChange = (count) => {
    setMailboxCount(count);
    setMailboxes(Array(count).fill(null).map((_, i) => mailboxes[i] || ""));
  };

  const handleMailboxChange = (idx, val) => {
    const updated = [...mailboxes];
    updated[idx] = val;
    setMailboxes(updated);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const emailAddresses = mailboxes.map(m => `${m}@${domain}`).join(", ");
      const setupPrice = mailboxCount * 130;
      const recurringPrice = mailboxCount * 130;

      await base44.entities.ServiceOrder.create({
        client_id: client.id,
        requested_by_id: user.id,
        order_type: "business_email_setup",
        product_name: "Business Email Setup",
        price_zar_setup: setupPrice,
        price_zar_recurring: recurringPrice,
        email_addresses_requested: emailAddresses,
        additional_notes: notes,
      });

      // Create task for Head of Tech
      const staffMembers = await base44.entities.User.list();
      const headOfTech = staffMembers.find(u => u.role === "head_of_tech");
      
      if (headOfTech) {
        await base44.entities.Task.create({
          title: `Business email setup request from ${client.business_name}: ${mailboxCount} mailbox(es)`,
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
        title: "Email Setup Request Received",
        body: `Quote for ${mailboxCount} mailbox(es) will be sent within 1 business day. Setup begins after approval.`,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      
      // Reset form
      setDomain("");
      setMailboxCount(1);
      setMailboxes(["info"]);
      setNotes("");
    } catch (err) {
      console.error("Email order error:", err);
    }
    setSubmitting(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Set Up Business Email</h1>
        <p className="text-muted-foreground mb-6">Professional email on your domain via Google Workspace.</p>

        {success && (
          <div className="glass rounded-xl p-4 border border-success/30 mb-6 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="font-semibold text-foreground">Request submitted!</p>
              <p className="text-xs text-muted-foreground">Quote will be sent within 1 business day. Setup begins after approval.</p>
            </div>
          </div>
        )}

        <div className="glass rounded-xl p-6 border border-primary/20 mb-6 bg-primary/5">
          <p className="text-sm mb-2"><strong>Pricing:</strong> R130 per mailbox per month (billed annually)</p>
          <p className="text-xs text-muted-foreground">Google Workspace setup, domain configuration, and ongoing support included.</p>
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          {/* Domain */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Domain to Use</label>
            <Input 
              value={domain} 
              onChange={(e) => setDomain(e.target.value)} 
              placeholder="e.g., mycompany.co.za" 
              className="bg-secondary/50 border-border/50" 
            />
            <p className="text-xs text-muted-foreground mt-1">Use your registered domain or one you're registering with us.</p>
          </div>

          {/* Mailbox Count */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Number of Mailboxes Needed</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 5, 10].map(count => (
                <button
                  key={count}
                  onClick={() => handleMailboxCountChange(count)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    mailboxCount === count
                      ? "gradient-bg text-white"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Mailbox Addresses */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Mailbox Addresses</label>
            <div className="space-y-2">
              {mailboxes.map((mb, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input 
                    value={mb} 
                    onChange={(e) => handleMailboxChange(idx, e.target.value)} 
                    placeholder={["info", "support", "sales", "hello", "contact"][idx] || "mailbox name"} 
                    className="bg-secondary/50 border-border/50 flex-1" 
                  />
                  <span className="text-sm text-muted-foreground">@{domain || "domain.com"}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total: {mailboxCount} × R130/month = <strong>R{(mailboxCount * 130).toLocaleString()}/month</strong></p>
          </div>

          {/* Special Requirements */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Special Requirements (Optional)</label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Any forwarding rules, auto-responders, or other configurations needed?" 
              rows={3} 
              className="bg-secondary/50 border-border/50" 
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={() => window.history.back()}>Cancel</Button>
            <Button onClick={handleSubmit} className="gradient-bg text-white" disabled={submitting || !domain || mailboxes.some(m => !m)}>
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