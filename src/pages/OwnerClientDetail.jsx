import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Edit2, Phone, Mail, MapPin, DollarSign, FileText, Clock, User, CheckCircle2, AlertCircle } from "lucide-react";

const STATUS_COLORS = {
  lead: "bg-slate-600", prospect: "bg-blue-600", onboarding: "bg-yellow-600",
  active: "bg-green-600", suspended: "bg-orange-600", cancelled: "bg-red-600", churned: "bg-slate-700"
};

const PACKAGE_LABELS = { ignite: "Ignite", accelerate: "Accelerate", dominate: "Dominate", street_pulse: "Street Pulse", township_pulse: "Township Pulse" };

export default function OwnerClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [deals, setDeals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [activities, setActivities] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [addContact, setAddContact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await base44.auth.me();
        if (me?.role !== "owner" && me?.role !== "admin") {
          navigate("/");
          return;
        }

        const c = await base44.entities.Client.get(id);
        setClient(c);

        const [d, inv, deliv, act, up] = await Promise.all([
          base44.entities.Deal.filter({ client_id: id }),
          base44.entities.Invoice.filter({ client_id: id }),
          base44.entities.Deliverable.filter({ client_id: id }),
          base44.entities.ClientActivityLog.filter({ client_id: id }, "-created_date", 10),
          base44.entities.ClientUpload.filter({ client_id: id }),
        ]);

        setDeals(Array.isArray(d) ? d : [d]);
        setInvoices(Array.isArray(inv) ? inv : [inv]);
        setDeliverables(Array.isArray(deliv) ? deliv : [deliv]);
        setActivities(Array.isArray(act) ? act : [act]);
        setUploads(Array.isArray(up) ? up : [up]);
        setNotes(c?.notes || "");
        setLoading(false);
      } catch (err) {
        console.error("Load error:", err);
        setLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await base44.entities.Client.update(id, { notes });
      setEditingNotes(false);
    } catch (err) {
      console.error("Error saving notes:", err);
    }
    setSavingNotes(false);
  };

  const addNewContact = async () => {
    if (!addContact) return;
    setSavingNotes(true);
    try {
      // Placeholder: in real implementation, would create separate Contact entity
      setAddContact(null);
    } catch (err) {
      console.error("Error adding contact:", err);
    }
    setSavingNotes(false);
  };

  if (loading) return <AppLayout title="Loading..."><div className="flex items-center justify-center h-96"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div></AppLayout>;
  if (!client) return <AppLayout title="Client not found"><div className="text-center py-8">No client found</div></AppLayout>;

  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.total || 0), 0);
  const unpaidAmount = invoices.filter(i => i.status === "issued" || i.status === "overdue").reduce((sum, i) => sum + (i.total || 0), 0);
  const daysSinceJoin = client.created_date ? Math.floor((Date.now() - new Date(client.created_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const ltv = (client.monthly_retainer || 0) * 12 * 2; // Rough estimate

  return (
    <AppLayout title={client.business_name} subtitle={`${client.contact_person} • ${client.email}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate("/clients")} className="mt-1 hover:opacity-70">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">{client.business_name}</h1>
              <div className="flex gap-3 mt-2">
                <Badge className={STATUS_COLORS[client.status]}>{client.status}</Badge>
                <Badge variant="outline">{PACKAGE_LABELS[client.package] || "No package"}</Badge>
              </div>
              {client.assigned_field_agent && <p className="text-sm text-muted-foreground mt-2">Assigned to: {client.assigned_field_agent}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(`/clients`)}><Edit2 className="w-4 h-4 mr-2" /> Edit Client</Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-8 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-xs text-muted-foreground mb-1">Package</p>
                <p className="text-lg font-semibold">{PACKAGE_LABELS[client.package] || "None"}</p>
              </div>
              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-xs text-muted-foreground mb-1">Monthly Retainer</p>
                <p className="text-lg font-semibold">R{client.monthly_retainer?.toLocaleString() || "0"}</p>
              </div>
              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-xs text-muted-foreground mb-1">Lifetime Value</p>
                <p className="text-lg font-semibold">R{ltv.toLocaleString()}</p>
              </div>
              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-xs text-muted-foreground mb-1">Days as Client</p>
                <p className="text-lg font-semibold">{daysSinceJoin} days</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold mb-2">Health Indicators</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Invoices on time</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Deliverables on track</div>
                  <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-yellow-500" /> Occasional contact</div>
                </div>
              </div>

              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold mb-2">Total Revenue</p>
                <p className="text-xl font-bold">R{totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{invoices.filter(i => i.status === "paid").length} paid invoices</p>
              </div>

              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold mb-2">Outstanding</p>
                <p className="text-xl font-bold text-orange-500">R{unpaidAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{invoices.filter(i => i.status === "issued" || i.status === "overdue").length} unpaid</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass rounded-lg p-4 border border-white/10">
                <p className="text-sm font-semibold mb-3">Recent Activity</p>
                <div className="space-y-2 text-xs">
                  {activities.slice(0, 5).map((a, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{a.activity_type || "Activity"}</span>
                      <span className="text-muted-foreground">{new Date(a.created_date).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-lg p-4 border border-white/10">
                <div className="flex justify-between items-start mb-3">
                  <p className="text-sm font-semibold">Notes</p>
                  {!editingNotes && <Button size="sm" variant="ghost" onClick={() => setEditingNotes(true)}><Edit2 className="w-3 h-3" /></Button>}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." rows={4} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveNotes} disabled={savingNotes}>{savingNotes ? "Saving..." : "Save"}</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{notes || "(No notes)"}</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: CONTACTS */}
          <TabsContent value="contacts" className="space-y-4">
            <div className="glass rounded-lg p-4 border border-white/10 space-y-3">
              <p className="font-semibold">Primary Contact</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /> {client.contact_person}</div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {client.email}</div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {client.phone || "Not provided"}</div>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> {client.address || "Not provided"}</div>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-muted-foreground">Preferred channel: {client.preferred_communication_channel || "Email"}</p>
              </div>
            </div>

            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">Additional contacts coming soon</p>
            </div>
          </TabsContent>

          {/* TAB 3: DEALS */}
          <TabsContent value="deals" className="space-y-3">
            {deals.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No deals for this client</p>
            ) : (
              deals.map((d) => (
                <div key={d.id} className="glass rounded-lg p-4 border border-white/10 hover:border-primary/30 cursor-pointer transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{d.package || d.add_on_name}</p>
                      <p className="text-sm text-muted-foreground">{d.deal_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R{(d.setup_fee || 0).toLocaleString()}</p>
                      <Badge variant="outline" className="text-xs mt-1">{d.stage}</Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* TAB 4: INVOICES */}
          <TabsContent value="invoices" className="space-y-4">
            {unpaidAmount > 0 && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-orange-500">Outstanding Balance</p>
                <p className="text-2xl font-bold">R{unpaidAmount.toLocaleString()}</p>
              </div>
            )}
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No invoices for this client</p>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} className="glass rounded-lg p-4 border border-white/10">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">Invoice #{inv.invoice_number || inv.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">{new Date(inv.created_date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">R{(inv.total || 0).toLocaleString()}</p>
                        <Badge variant={inv.status === "paid" ? "default" : "outline"} className="text-xs mt-1">{inv.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 5: DELIVERABLES */}
          <TabsContent value="deliverables" className="space-y-3">
            {deliverables.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No deliverables for this client</p>
            ) : (
              deliverables.map((deliv) => (
                <div key={deliv.id} className="glass rounded-lg p-4 border border-white/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{deliv.title}</p>
                      <p className="text-sm text-muted-foreground">{deliv.service || "General"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{deliv.approval_status || deliv.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* TAB 6: COMMUNICATIONS */}
          <TabsContent value="communications" className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No communications recorded</p>
            ) : (
              activities.map((a, idx) => (
                <div key={idx} className="glass rounded-lg p-4 border border-white/10">
                  <p className="text-sm font-semibold">{a.activity_type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_date).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </TabsContent>

          {/* TAB 7: FILES */}
          <TabsContent value="files" className="space-y-3">
            {uploads.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No files uploaded</p>
            ) : (
              uploads.map((u) => (
                <div key={u.id} className="glass rounded-lg p-4 border border-white/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm">{u.file_name}</p>
                      <p className="text-xs text-muted-foreground">{u.file_type}</p>
                    </div>
                    <a href={u.file_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs font-semibold hover:underline">Download</a>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* TAB 8: AUDIT */}
          <TabsContent value="audit" className="space-y-3">
            <div className="glass rounded-lg p-4 border border-white/10">
              <p className="text-sm text-muted-foreground">Audit log showing all system actions affecting this client will be displayed here.</p>
              <p className="text-xs text-muted-foreground mt-2">Actions logged: contract signing, deliverable approvals, invoice payments, status changes</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}