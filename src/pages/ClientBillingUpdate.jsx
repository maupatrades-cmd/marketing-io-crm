import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentUser } from "@/lib/customAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";

export default function ClientBillingUpdate() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    business_name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    debit_order_date: "1st",
  });

  useEffect(() => {
    const load = async () => {
      const me = authUser || (await getCurrentUser());
      if (!me) {
        window.location.href = "/login";
        return;
      }

      setUser(me);
      const clients = await base44.entities.Client.filter({ email: me.email });
      const c = Array.isArray(clients) ? clients[0] : clients;

      if (c) {
        setClient(c);
        setForm({
          business_name: c.business_name || "",
          contact_person: c.contact_person || "",
          email: c.email || "",
          phone: c.phone || "",
          address: c.address || "",
          debit_order_date: c.debit_order_date || "1st",
        });
      }
      setLoading(false);
    };
    load();
  }, [authUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!client) return;

    setError("");
    setSubmitting(true);

    try {
      await base44.entities.Client.update(client.id, {
        business_name: form.business_name,
        contact_person: form.contact_person,
        email: form.email,
        phone: form.phone,
        address: form.address,
        debit_order_date: form.debit_order_date,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate("/client/subscription");
      }, 2000);
    } catch (err) {
      setError("Failed to update billing information. Please try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-foreground">
      {/* Header */}
      <div className="border-b border-slate-700/40">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center gap-4">
          <button
            onClick={() => navigate("/client/subscription")}
            className="p-2 hover:bg-slate-800/50 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold">Update Billing Information</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400" />
            <p className="text-sm text-green-400">Billing information updated successfully. Redirecting...</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <Card className="glass border-slate-700/40 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Business Name *</label>
                <input
                  type="text"
                  name="business_name"
                  value={form.business_name}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Contact Person *</label>
                <input
                  type="text"
                  name="contact_person"
                  value={form.contact_person}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">Physical Address *</label>
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  required
                  rows={3}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">Debit Order Date</label>
                <select
                  name="debit_order_date"
                  value={form.debit_order_date}
                  onChange={handleChange}
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="1st">1st of every month</option>
                  <option value="15th">15th of every month</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-700/40 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/client/subscription")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" className="gradient-bg text-white" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}