import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ShoppingBag, CheckCircle2 } from "lucide-react";

const BUCKET_LABELS = {
  bucket_a_once_off: "Once-Off",
  bucket_b_setup_recurring: "Setup + Monthly",
  bucket_c_pure_recurring: "Monthly Recurring",
  bucket_d_paid_ads: "Paid Ads",
  bucket_e_passive: "Passive Income",
};

export default function ClientOrderAddOns() {
  const [templates, setTemplates] = useState([]);
  const [client, setClient] = useState(null);
  const [user, setUser] = useState(null);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (me) => {
      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      if (clients.length > 0) {
        const c = Array.isArray(clients) ? clients[0] : clients;
        setClient(c);
        
        // Fetch templates
        const temps = await base44.entities.FulfilmentTemplate.list();
        setTemplates(Array.isArray(temps) ? temps : [temps]);
        
        // Fetch active add-ons
        const addOns = await base44.entities.ClientAddOn.filter({ client_id: c.id, status: "active" });
        setActive(Array.isArray(addOns) ? addOns : addOns ? [addOns] : []);
      }
      setLoading(false);
    });
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Create service order
      const order = await base44.entities.ServiceOrder.create({
        client_id: client.id,
        requested_by_id: user.id,
        order_type: "addon",
        product_code: selected.code,
        product_name: selected.name,
        price_zar_setup: selected.pricing_setup_zar || 0,
        price_zar_recurring: selected.pricing_recurring_zar || 0,
        additional_notes: notes,
      });

      // Create task for staff
      const staffMembers = await base44.entities.User.list();
      const headOfTech = staffMembers.find(u => u.role === "head_of_tech");
      
      if (headOfTech) {
        await base44.entities.Task.create({
          title: `New add-on order from ${client.business_name}: ${selected.name}`,
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
        title: "Order Received",
        body: `Your order for ${selected.name} has been received. We'll process within 1 business day to confirm and send a contract addendum.`,
      });

      setSelected(null);
      setNotes("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error("Order submission error:", err);
    }
    setSubmitting(false);
  };

  const available = templates.filter(t => !active.some(a => a.add_on === t.code) && t.is_active);
  const grouped = {};
  available.forEach(t => {
    const bucket = t.bucket;
    if (!grouped[bucket]) grouped[bucket] = [];
    grouped[bucket].push(t);
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold gradient-text mb-2">Add to Your Service</h1>
        <p className="text-muted-foreground mb-6">Expand what Marketing iO is doing for {client?.business_name}</p>

        {success && (
          <div className="glass rounded-xl p-4 border border-success/30 mb-6 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <div>
              <p className="font-semibold text-foreground">Thank you! Order received.</p>
              <p className="text-xs text-muted-foreground">We'll be in touch within 1 business day to confirm and send a contract addendum.</p>
            </div>
          </div>
        )}

        {active.length > 0 && (
          <div className="glass rounded-xl p-4 mb-6 border border-primary/20">
            <p className="text-sm font-semibold mb-3">You're Already Getting These</p>
            <div className="flex flex-wrap gap-2">
              {active.map(a => (
                <Badge key={a.id} className="bg-success/15 text-success border border-success/30 capitalize">
                  {a.add_on.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {available.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground">All available add-ons are already part of your service.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([bucket, items]) => (
              <div key={bucket}>
                <h3 className="font-semibold text-lg mb-3">{BUCKET_LABELS[bucket] || bucket}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map(t => (
                    <div key={t.code} className="glass rounded-xl p-5 border border-white/10 hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-foreground">{t.name}</p>
                          <Badge className="bg-primary/15 text-primary text-xs mt-1">{BUCKET_LABELS[bucket]}</Badge>
                        </div>
                      </div>

                      <div className="mb-4 pb-4 border-b border-border/40">
                        <p className="text-2xl font-bold text-primary">
                          R{(t.pricing_setup_zar || 0).toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground ml-2">setup</span>
                        </p>
                        {t.pricing_recurring_zar > 0 && (
                          <p className="text-lg text-accent">
                            R{t.pricing_recurring_zar.toLocaleString()}<span className="text-xs text-muted-foreground">/month</span>
                          </p>
                        )}
                      </div>

                      {t.soft_sla_days && (
                        <p className="text-xs text-muted-foreground mb-3">
                          <strong>Delivery:</strong> {t.soft_sla_days} days (target) • {t.hard_sla_days} days (guaranteed)
                        </p>
                      )}

                      {/* Deliverables */}
                      {(t.setup_deliverables || t.recurring_deliverables) && (
                        <div className="mb-4">
                          <button
                            onClick={() => setExpanded({ ...expanded, [t.code]: !expanded[t.code] })}
                            className="text-xs font-semibold text-primary flex items-center gap-1 hover:text-primary/80 transition-colors"
                          >
                            <ChevronDown className={`w-3 h-3 transition-transform ${expanded[t.code] ? "rotate-180" : ""}`} />
                            View Deliverables
                          </button>
                          {expanded[t.code] && (
                            <div className="mt-2 ml-4 space-y-1 text-xs text-muted-foreground">
                              {t.setup_deliverables && JSON.parse(t.setup_deliverables).map((d, idx) => (
                                <p key={idx}>• {d}</p>
                              ))}
                              {t.recurring_deliverables && JSON.parse(t.recurring_deliverables).map((d, idx) => (
                                <p key={idx}>• {d} (monthly)</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <Button onClick={() => setSelected(t)} className="w-full gradient-bg text-white text-sm">
                        Order Now
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Order {selected?.name}</DialogTitle>
          </DialogHeader>
          
          {selected && (
            <div className="space-y-4 mt-4">
              <div className="glass rounded-lg p-4 border border-white/10">
                <div className="flex justify-between mb-2">
                  <span className="text-muted-foreground">Setup Fee:</span>
                  <span className="font-semibold">R{(selected.pricing_setup_zar || 0).toLocaleString()}</span>
                </div>
                {selected.pricing_recurring_zar > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Fee:</span>
                    <span className="font-semibold">R{selected.pricing_recurring_zar.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Contact Details</label>
                <div className="space-y-2 text-sm">
                  <p><strong>Business:</strong> {client?.business_name}</p>
                  <p><strong>Contact:</strong> {client?.contact_person}</p>
                  <p><strong>Email:</strong> {client?.email}</p>
                  <p><strong>Phone:</strong> {client?.phone}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Additional Notes (Optional)</label>
                <Textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Any specific requirements or questions?" 
                  rows={3} 
                  className="bg-secondary/50 border-border/50" 
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
                <Button onClick={handleSubmit} className="gradient-bg text-white" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Order"}
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