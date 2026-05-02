import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, FileText, Phone, Clock, AlertCircle } from "lucide-react";

const TABS = [
  "overview", "contacts", "deals", "invoices", "deliverables", "communications", "files", "audit"
];

export default function OwnerClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [activity, setActivity] = useState([]);
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, d, inv, del, act, f] = await Promise.all([
        base44.entities.Client.list().then(res => Array.isArray(res) ? res.find(x => x.id === id) : res),
        base44.entities.Deal.filter({ client_id: id }),
        base44.entities.Invoice.filter({ client_id: id }),
        base44.entities.Deliverable.filter({ client_id: id }),
        base44.entities.ClientActivityLog.filter({ client_id: id }, "-created_date", 10),
        base44.entities.ClientUpload.filter({ client_id: id }),
      ]);
      
      setClient(c);
      setDeals(Array.isArray(d) ? d : d ? [d] : []);
      setInvoices(Array.isArray(inv) ? inv : inv ? [inv] : []);
      setDeliverables(Array.isArray(del) ? del : del ? [del] : []);
      setActivity(Array.isArray(act) ? act : act ? [act] : []);
      setFiles(Array.isArray(f) ? f : f ? [f] : []);
      setNotes(c?.notes || "");
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!client) return <div className="p-6 text-center text-muted-foreground">Client not found</div>;

  const outstanding = invoices.filter(i => ["issued", "overdue"].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0);
  const monthsAsClient = client.contract_start_date ? Math.floor((new Date() - new Date(client.contract_start_date)) / (1000 * 60 * 60 * 24 * 30)) : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text">{client.business_name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className={client.status === "active" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>
                {client.status}
              </Badge>
              {client.assigned_field_agent && <span className="text-sm text-muted-foreground">Assigned: User {client.assigned_field_agent}</span>}
            </div>
          </div>
          <Button variant="outline">Edit Client</Button>
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

        {/* TAB: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Package</p>
                  <p className="text-lg font-bold capitalize">{client.package}</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Monthly Retainer</p>
                  <p className="text-lg font-bold">R{(client.monthly_retainer || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">As Client</p>
                  <p className="text-lg font-bold">{monthsAsClient} months</p>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Next Renewal</p>
                  <p className="text-lg font-bold">{client.contract_end_date ? new Date(client.contract_end_date).toLocaleDateString("en-ZA") : "N/A"}</p>
                </CardContent>
              </Card>
            </div>

            <div className="glass rounded-xl p-6">
              <h3 className="font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {activity.map(a => (
                  <div key={a.id} className="text-sm pb-2 border-b border-border/20 last:border-0">
                    <p className="text-muted-foreground text-xs">{new Date(a.created_date).toLocaleDateString("en-ZA")}</p>
                    <p className="text-foreground">{a.event_label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Internal Notes</h3>
                {!editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                  <Button size="sm" onClick={() => { setEditing(false); base44.entities.Client.update(id, { notes }); }}>Save</Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{notes || "No notes yet"}</p>
              )}
            </div>
          </div>
        )}

        {/* TAB: Contacts */}
        {activeTab === "contacts" && (
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="pb-4 border-b border-border/40">
              <p className="text-xs text-muted-foreground mb-1">Primary Contact</p>
              <p className="font-semibold">{client.contact_person}</p>
              <p className="text-sm text-muted-foreground">{client.email} • {client.phone}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Communication Preference</p>
              <p className="text-sm capitalize">{client.preferred_communication_channel}</p>
            </div>
          </div>
        )}

        {/* TAB: Deals */}
        {activeTab === "deals" && (
          <div className="space-y-3">
            {deals.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">No deals</div>
            ) : (
              deals.map(d => (
                <div key={d.id} className="glass rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{d.package}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.stage}</p>
                    </div>
                    <span className="font-bold">R{(d.setup_fee + d.monthly_retainer * 12).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Closed: {d.created_date ? new Date(d.created_date).toLocaleDateString("en-ZA") : "pending"}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Invoices */}
        {activeTab === "invoices" && (
          <div className="space-y-4">
            {outstanding > 0 && (
              <div className="glass rounded-xl p-4 border border-destructive/30 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-semibold">R{outstanding.toLocaleString()} outstanding</p>
                  <p className="text-xs text-muted-foreground">{invoices.filter(i => ["issued", "overdue"].includes(i.status)).length} unpaid</p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {invoices.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground">No invoices</div>
              ) : (
                invoices.map(inv => (
                  <div key={inv.id} className="glass rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inv.created_date).toLocaleDateString("en-ZA")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">R{(inv.total || 0).toLocaleString()}</p>
                      <Badge className={inv.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"} variant="outline" className="text-xs mt-1">
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: Deliverables */}
        {activeTab === "deliverables" && (
          <div className="space-y-3">
            {deliverables.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">No deliverables</div>
            ) : (
              deliverables.map(d => (
                <div key={d.id} className="glass rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{d.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.approval_status}</p>
                    </div>
                    <Badge className="bg-primary/15 text-primary text-xs">{d.service}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Communications */}
        {activeTab === "communications" && (
          <div className="space-y-3">
            {activity.length === 0 ? (
              <div className="glass rounded-xl p-8 text-center text-muted-foreground">No communications</div>
            ) : (
              activity.map(a => (
                <div key={a.id} className="glass rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-1">{new Date(a.created_date).toLocaleDateString("en-ZA")}</p>
                  <p className="text-sm">{a.event_label}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Files */}
        {activeTab === "files" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {files.length === 0 ? (
              <div className="col-span-3 glass rounded-xl p-8 text-center text-muted-foreground">No files</div>
            ) : (
              files.map(f => (
                <div key={f.id} className="glass rounded-xl p-4">
                  <p className="font-semibold text-sm mb-2 truncate">{f.file_name}</p>
                  <p className="text-xs text-muted-foreground mb-3 capitalize">{f.file_type}</p>
                  <Button size="sm" variant="outline" className="w-full text-xs" asChild>
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer">Download</a>
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB: Audit */}
        {activeTab === "audit" && (
          <div className="glass rounded-xl p-6">
            <p className="text-sm text-muted-foreground">Audit log: all system actions affecting this client will be tracked here for compliance.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
}