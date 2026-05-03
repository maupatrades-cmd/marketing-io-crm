import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentUser } from "@/lib/customAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, LogOut, ChevronRight, MessageSquare, FileText, BarChart3, Settings, ShoppingCart, Files, Calendar, Download, Eye } from "lucide-react";
import ProductCard from "@/components/clientportal/ProductCard";
import EnquiryModal from "@/components/clientportal/EnquiryModal";
import DeliverableTimeline from "@/components/clientportal/DeliverableTimeline";
import RequestUpdateModal from "@/components/clientportal/RequestUpdateModal";
import { PRODUCT_CATALOG, getProductsByType, getProductById } from "@/data/ProductCatalog";

const PACKAGE_LABELS = {
  ignite: "Ignite",
  accelerate: "Accelerate",
  dominate: "Dominate",
  none: "No Package",
};

export default function ClientPortal() {
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState(null);
  const [client, setClient] = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [productImages, setProductImages] = useState({});
  const [onboarding, setOnboarding] = useState(null);
  const [deliverables, setDeliverables] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [communications, setCommunications] = useState([]);
  const [deal, setDeal] = useState(null);
  const [staffCards, setStaffCards] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = authUser || await getCurrentUser();
      if (!me) {
        setLoading(false);
        window.location.href = "/login";
        return;
      }

      setUser(me);

      // Fetch product images
      try {
        const images = await base44.functions.invoke("get-product-images", {});
        setProductImages(images.data || {});
      } catch (err) {
        console.error("Failed to load product images:", err);
      }

      const clients = await base44.entities.Client.filter({ email: me.email });
      const c = Array.isArray(clients) ? clients[0] : clients;

      if (c) {
        setClient(c);

        // Fetch hub data in parallel
         try {
           const [enqs, onb, dels, invs, comms, deals, contracts] = await Promise.all([
             base44.entities.EnquiryEvent.filter({ client_id: c.id }).catch(() => []),
             base44.entities.ClientOnboarding.filter({ client_id: c.id }, "-created_date", 1).catch(() => []),
             base44.entities.Deliverable.filter({ client_id: c.id }, "-created_date", 50).catch(() => []),
             base44.entities.Invoice.filter({ client_id: c.id, status: 'issued' }, "due_date", 5).catch(() => []),
             base44.entities.ClientCommunication.filter({ client_id: c.id }, "-created_date", 20).catch(() => []),
             base44.entities.Deal.filter({ client_id: c.id, stage: 'closed_won' }, "-created_date", 1).catch(() => []),
             base44.entities.Contract.filter({ client_id: c.id }, "-created_date", 10).catch(() => [])
           ]);

           setEnquiries(Array.isArray(enqs) ? enqs : []);
           const onbRecord = Array.isArray(onb) ? onb[0] : onb;
           setOnboarding(onbRecord);
           setDeliverables(Array.isArray(dels) ? dels : []);
           setInvoices(Array.isArray(invs) ? invs : []);
           setCommunications(Array.isArray(comms) ? comms : []);
           setContracts(Array.isArray(contracts) ? contracts : []);
          
          const dealRecord = Array.isArray(deals) ? deals[0] : deals;
          setDeal(dealRecord);

          // Fetch staff if deal exists
          if (dealRecord) {
            const staffData = [];
            const userIds = [dealRecord.closer_id, onbRecord?.assigned_admin_id, c.assigned_field_agent].filter(Boolean);
            
            for (const userId of userIds) {
              try {
                const users = await base44.entities.User.filter({ id: userId });
                if (users && users[0]) staffData.push(users[0]);
              } catch (err) {
                console.error('Failed to fetch user:', userId, err);
              }
            }
            setStaffCards(staffData);
          }
        } catch (err) {
          console.error('Hub data fetch error:', err);
        }
      }
      setLoading(false);
    };
    load();
  }, [authUser]);

  const handleEnquire = (product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const handleSubmitted = async () => {
    if (client) {
      const enqs = await base44.entities.EnquiryEvent.filter({ client_id: client.id });
      setEnquiries(Array.isArray(enqs) ? enqs : []);
    }
  };

  const handleRequestUpdate = (deliverable) => {
    setSelectedDeliverable(deliverable);
    setUpdateModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">No Client Account Found</h2>
          <p className="text-sm text-muted-foreground">Contact support for access.</p>
          <a href="mailto:info@marketingio.co.za" className="mt-4 block text-primary text-sm">info@marketingio.co.za</a>
        </div>
      </div>
    );
  }

  const pendingDeliverables = deliverables.filter(d => d.status === 'awaiting_client');
  const activeDeliverables = deliverables.filter(d => d.status === 'in_progress' || d.status === 'awaiting_client');
  const recentMessages = communications.filter(c => c.response_message && new Date(c.created_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const nextInvoice = invoices[0];
  const pendingContract = contracts.find(c => c.status === 'sent' && !c.signed_by_client);
  const activeContract = contracts.find(c => ['signed', 'active'].includes(c.status));

  // Determine current package and upgrades
  const currentPackage = getProductById(client.package);
  const upgradeProducts = (!client.package || client.package === 'none') 
    ? getProductsByType("package") 
    : (currentPackage?.upgrade_path?.map(pid => getProductById(pid)) || []);
  const allAddOns = getProductsByType("addon");
  const physicalProducts = getProductsByType("physical");

  const onboardingPhases = ['Contract Signed', 'Welcome & Invoicing', 'Pre-Onboarding', 'Onboarding Call', 'Asset Collection', 'Delivery Started'];
  const phaseIndex = onboarding ? onboardingPhases.indexOf(onboarding.current_phase) : -1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-foreground">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-slate-700/40 backdrop-blur-md bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back!</p>
            <h1 className="text-xl font-bold flex items-center gap-2">
              🚀 {client.business_name}
              <Badge className="bg-primary/15 text-primary border-primary/30 text-xs capitalize">
                {client.package?.replace(/_/g, " ") || "No Package"}
              </Badge>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/client/subscription'}
              className="text-xs"
            >
              💳 Billing
            </Button>
            <button
              onClick={logout}
              className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        {/* SECTION 2 — ACTION REQUIRED */}
        {pendingDeliverables.length > 0 && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-foreground">Action Required</h2>
              <p className="text-muted-foreground">Deliverables awaiting your approval</p>
            </div>
            <div className="h-1 w-20 gradient-bg rounded-full" />
            <div className="space-y-3 mt-6">
              {pendingDeliverables.map(d => {
                const daysAgo = Math.floor((Date.now() - new Date(d.submitted_date)) / (1000 * 60 * 60 * 24));
                const daysUntilDeadline = Math.ceil((new Date(d.review_deadline) - Date.now()) / (1000 * 60 * 60 * 24));
                const urgency = daysUntilDeadline < 2 ? 'bg-red-500/10 border-red-500/30' : daysUntilDeadline < 5 ? 'bg-yellow-500/10 border-yellow-500/30' : '';
                return (
                  <div key={d.id} className={`glass rounded-lg p-4 border ${urgency}`}>
                    <h3 className="font-semibold text-foreground">{d.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {daysAgo} day{daysAgo !== 1 ? 's' : ''} ago · Review by {new Date(d.review_deadline).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => window.location.href = '/client/deliverables'}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => window.location.href = '/client/deliverables'}>Request Changes</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SECTION 2.3 — DELIVERABLES TIMELINE */}
        <DeliverableTimeline 
          deliverables={deliverables}
          onRequestUpdate={handleRequestUpdate}
        />

        {/* SECTION 2.5 — CONTRACTS */}
        {pendingContract && (
          <section className="space-y-4">
            <div className="relative glass rounded-lg p-6 border-2 border-primary/50 animate-pulse-glow">
              <div className="space-y-2 mb-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">🖊️ Action Required: Sign Your Contract</h3>
                <p className="text-sm text-muted-foreground">
                  {PACKAGE_LABELS[pendingContract.package] || pendingContract.package} contract · R{pendingContract.setup_fee_zar?.toLocaleString() || 0} setup + R{pendingContract.monthly_retainer_zar?.toLocaleString() || 0}/month
                </p>
                <p className="text-xs text-destructive/80">
                  This link expires on {new Date(pendingContract.signing_link_expires_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {pendingContract.document_url && (
                  <Button size="sm" variant="outline" onClick={() => window.open(pendingContract.document_url, '_blank')}>
                    <Eye className="w-4 h-4 mr-1" /> Preview Contract
                  </Button>
                )}
                {new Date(pendingContract.signing_link_expires_at) > new Date() ? (
                  <Button size="sm" onClick={() => window.open(`/sign-contract?token=${pendingContract.signing_token}`, '_blank')} className="gradient-bg text-white">
                    Sign Now →
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => window.location.href = 'mailto:info@marketingio.co.za'}>
                    Contact us for a new link
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {activeContract && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-foreground">Your Contracts</h2>
            </div>
            <div className="h-1 w-20 gradient-bg rounded-full" />
            <div className="glass rounded-lg p-6 mt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-foreground">Your {PACKAGE_LABELS[activeContract.package] || activeContract.package} Contract</h3>
                  <Badge className="mt-2 bg-success/15 text-success border-success/30">
                    {activeContract.status === 'signed' && `Signed ${new Date(activeContract.signed_date).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}`}
                    {activeContract.status === 'active' && 'Active'}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Term: {new Date(activeContract.contract_start_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })} → {new Date(activeContract.contract_end_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <div className="flex gap-2 flex-wrap">
                {activeContract.final_signed_pdf_url && (
                  <Button size="sm" variant="outline" onClick={() => window.open(activeContract.final_signed_pdf_url, '_blank')}>
                    <Download className="w-4 h-4 mr-1" /> Download Signed Copy
                  </Button>
                )}
                {activeContract.document_url && (
                  <Button size="sm" variant="outline" onClick={() => window.open(activeContract.document_url, '_blank')}>
                    <Eye className="w-4 h-4 mr-1" /> View Original
                  </Button>
                )}
                <Button size="sm" variant="link" className="ml-auto" onClick={() => window.location.href = '/client/messages'}>
                  Need to make changes? Contact your account admin →
                </Button>
              </div>
              {contracts.length > 1 && (
                <p className="text-xs text-muted-foreground mt-4">
                  <a href="/client/contracts" className="text-primary hover:underline">View all {contracts.length} contracts →</a>
                </p>
              )}
            </div>
          </section>
        )}

        {/* SECTION 3 — PROJECT JOURNEY */}
        {onboarding && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-foreground">Your Project Journey</h2>
              <p className="text-muted-foreground">Track your onboarding progress</p>
            </div>
            <div className="h-1 w-20 gradient-bg rounded-full" />
            <div className="glass rounded-lg p-6 mt-6">
              <div className="flex items-center justify-between mb-6">
                {onboardingPhases.map((phase, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      i < phaseIndex ? 'bg-primary text-primary-foreground' :
                      i === phaseIndex ? 'bg-primary text-primary-foreground animate-pulse-glow' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {i < phaseIndex ? '✓' : i + 1}
                    </div>
                    <span className="text-xs text-muted-foreground text-center">{phase}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={onboarding.trigger_setup_fee_paid} disabled className="rounded" />
                  <span className="text-sm">Setup fee paid</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={onboarding.trigger_onboarding_form_returned} disabled className="rounded" />
                  <span className="text-sm">Onboarding form returned</span>
                  {!onboarding.trigger_onboarding_form_returned && <Button size="sm" variant="link" className="ml-auto" onClick={() => window.location.href = '/client/onboarding-form'}>Complete →</Button>}
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={onboarding.trigger_debit_mandate_signed} disabled className="rounded" />
                  <span className="text-sm">Debit mandate signed</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={onboarding.trigger_brand_assets_received} disabled className="rounded" />
                  <span className="text-sm">Brand assets received</span>
                  {!onboarding.trigger_brand_assets_received && <Button size="sm" variant="link" className="ml-auto" onClick={() => window.location.href = '/client/uploads'}>Upload →</Button>}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 4 — QUICK STATS */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Quick Stats</h2>
          </div>
          <div className="h-1 w-20 gradient-bg rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <button onClick={() => window.location.href = '/client/deliverables'} className="glass rounded-lg p-4 hover:border-primary/50 transition text-left">
              <p className="text-2xl font-bold text-primary">{activeDeliverables.length}</p>
              <p className="text-sm text-muted-foreground">in production</p>
            </button>
            <button onClick={() => window.location.href = '/client/invoices'} className="glass rounded-lg p-4 hover:border-primary/50 transition text-left">
              {nextInvoice ? (
                <>
                  <p className="text-2xl font-bold text-primary">R{nextInvoice.amount_zar?.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Due {new Date(nextInvoice.due_date).toLocaleDateString()}</p>
                </>
              ) : (
                <p className="text-sm text-success">All paid up ✓</p>
              )}
            </button>
            <button onClick={() => window.location.href = '/client/messages'} className="glass rounded-lg p-4 hover:border-primary/50 transition text-left">
              <p className="text-2xl font-bold text-primary">{recentMessages.length}</p>
              <p className="text-sm text-muted-foreground">from your team</p>
            </button>
            <button onClick={() => window.location.href = '/client/project-status'} className="glass rounded-lg p-4 hover:border-primary/50 transition text-left">
              <p className="text-sm font-semibold text-primary">{onboarding ? `Phase ${phaseIndex + 1}` : deal?.stage.replace(/_/g, ' ') || 'Pending'}</p>
              <p className="text-xs text-muted-foreground mt-1">{onboarding ? onboardingPhases[phaseIndex] : 'Project status'}</p>
            </button>
          </div>
        </section>

        {/* SECTION 5 — YOUR TEAM */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Your Marketing iO Team</h2>
          </div>
          <div className="h-1 w-20 gradient-bg rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {staffCards.length > 0 ? staffCards.map(staff => (
              <div key={staff.id} className="glass rounded-lg p-4">
                <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white font-bold mb-3">
                  {(staff.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <h3 className="font-semibold text-foreground">{staff.full_name}</h3>
                <p className="text-xs text-muted-foreground">
                  {deal?.closer_id === staff.id && 'Sales Consultant'}
                  {onboarding?.assigned_admin_id === staff.id && 'Account Admin'}
                  {client.assigned_field_agent === staff.id && 'Field Agent'}
                </p>
                <div className="flex gap-2 mt-3">
                  {staff.phone && <a href={`https://wa.me/${staff.phone}`} className="text-sm text-primary hover:underline">WhatsApp</a>}
                  {staff.email && <a href={`mailto:${staff.email}`} className="text-sm text-primary hover:underline">Email</a>}
                </div>
                <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => window.location.href = '/client/messages'}>Send Message</Button>
              </div>
            )) : (
              <div className="glass rounded-lg p-4 md:col-span-2 lg:col-span-3">
                <p className="text-sm text-muted-foreground">Your team will be assigned once your deal is finalised.</p>
                <p className="text-sm text-muted-foreground mt-2">In the meantime: <a href="mailto:info@marketingio.co.za" className="text-primary hover:underline">info@marketingio.co.za</a> · 010 102 0534</p>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 6 — PROFILE SNAPSHOT */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Profile</h2>
          </div>
          <div className="h-1 w-20 gradient-bg rounded-full" />
          <div className="glass rounded-lg p-6 mt-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Business Name</p>
                <p className="text-sm text-foreground">{client.business_name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Contact Person</p>
                <p className="text-sm text-foreground">{client.contact_person}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Email</p>
                <p className="text-sm text-foreground">{client.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Phone</p>
                <p className="text-sm text-foreground">{client.phone}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Industry</p>
                <p className="text-sm text-foreground">{client.industry || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Debit Date</p>
                <p className="text-sm text-foreground">{client.debit_order_date || '—'}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/client/profile'}>Edit Profile →</Button>
          </div>
        </section>

        {/* SECTION 7 — SHORTCUTS */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Quick Links</h2>
          </div>
          <div className="h-1 w-20 gradient-bg rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
            <button onClick={() => window.location.href = '/client/contracts'} className="glass rounded-lg p-4 text-center hover:border-primary/50 transition">
              <FileText className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-xs font-semibold">Contracts</span>
            </button>
            <button onClick={() => window.location.href = '/client/uploads'} className="glass rounded-lg p-4 text-center hover:border-primary/50 transition">
              <Files className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-xs font-semibold">Uploads</span>
            </button>
            <button onClick={() => window.location.href = '/client/reports'} className="glass rounded-lg p-4 text-center hover:border-primary/50 transition">
              <BarChart3 className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-xs font-semibold">Reports</span>
            </button>
            <button onClick={() => window.location.href = '/client/onboarding-form'} className="glass rounded-lg p-4 text-center hover:border-primary/50 transition">
              <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-xs font-semibold">Onboarding</span>
            </button>
            <button onClick={() => window.location.href = '/client/subscription'} className="glass rounded-lg p-4 text-center hover:border-primary/50 transition">
              <Settings className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-xs font-semibold">Billing</span>
            </button>
            <button onClick={() => window.location.href = '/client/orders'} className="glass rounded-lg p-4 text-center hover:border-primary/50 transition">
              <ShoppingCart className="w-6 h-6 text-primary mx-auto mb-2" />
              <span className="text-xs font-semibold">Orders</span>
            </button>
          </div>
        </section>

        {/* SECTION 8 — SALES FLOOR */}
        {/* Section A — Upgrade Package (if not on Dominate or no package) */}
        {(client.package !== "dominate" && upgradeProducts.length > 0) && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-foreground">{client.package === 'none' || !client.package ? 'Get Started' : 'Take it to the next level'}</h2>
              <p className="text-muted-foreground">{client.package === 'none' || !client.package ? 'Choose your marketing foundation.' : "You're growing. Here's what comes next."}</p>
            </div>
            <div className="h-1 w-20 gradient-bg rounded-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {upgradeProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isActive={product.id === client.package}
                  imageUrl={productImages[product.id]}
                  onEnquire={handleEnquire}
                />
              ))}
            </div>
          </section>
        )}

        {/* Section B — Add-Ons */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Power Up With Add-Ons</h2>
            <p className="text-muted-foreground">Most successful clients add 3-5 of these. Pick what's missing.</p>
          </div>
          <div className="h-1 w-20 gradient-bg rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {allAddOns.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                isActive={product.id === client.package}
                imageUrl={productImages[product.id]}
                onEnquire={handleEnquire}
              />
            ))}
          </div>
        </section>

        {/* Section C — Physical Products */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Be Seen In The Real World</h2>
            <p className="text-muted-foreground">Online matters. So does walking past your shop.</p>
          </div>
          <div className="h-1 w-20 gradient-bg rounded-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {physicalProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                isActive={product.id === client.package}
                imageUrl={productImages[product.id]}
                onEnquire={handleEnquire}
              />
            ))}
          </div>
        </section>

        {/* SECTION 7.5 — FREQUENTLY ASKED QUESTIONS */}
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-foreground">Common Questions</h2>
            <p className="text-muted-foreground">Quick answers. If yours isn't here, message your team.</p>
          </div>
          <div className="h-1 w-20 gradient-bg rounded-full" />
          <div className="mt-6 space-y-6">
            {/* BILLING & PAYMENTS */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Billing & Payments</h3>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="debit-date" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    When is my debit order processed?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Your debit runs on the <span className="font-semibold text-foreground">{client.debit_order_date || "1st"}</span> of every month. If your account isn't funded, we'll retry within 3 business days.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="failed-debit" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    What happens if a debit fails?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    We'll email you immediately and retry once. After 3 failed debits in 12 months, your contract may be subject to acceleration. Contact us early if you anticipate any issue.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="change-debit-date" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    Can I change my debit date?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Yes — message your account admin. Changes take effect from the following month.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="download-invoice" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    How do I download an invoice?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Go to <button onClick={() => window.location.href = '/client/invoices'} className="text-primary hover:underline">Billing & Subscription</button>. All invoices are downloadable as PDF.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* CONTRACTS & CANCELLATION */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Contracts & Cancellation</h3>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="contract-length" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    How long is my contract?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Core packages (Ignite/Accelerate/Dominate) are 12 months. Street Pulse is 3 months. Add-ons are month-to-month unless specified.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="cancel" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    How do I cancel?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Submit a cancellation via the Manage Your Products section. Notice periods apply per your contract — typically 30 days.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="signed-contract" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    Where's my signed contract?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Available in <button onClick={() => window.location.href = '/client/contracts'} className="text-primary hover:underline">Your Contracts</button>. If missing, contact your admin.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* DELIVERABLES & APPROVALS */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Deliverables & Approvals</h3>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="approval-time" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    How long do I have to approve a deliverable?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    5 business days from submission. After that, deliverables are deemed approved automatically.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="request-changes" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    How do I request changes?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    On any deliverable awaiting review, click 'Request Changes' and tell us what's not right. Our team will revise within 2 business days.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="unhappy-work" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    What if I'm unhappy with the work?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Tell us early. We revise until it's right. Use <button onClick={() => window.location.href = '/client/messages'} className="text-primary hover:underline">Messages</button> to escalate if standard feedback isn't enough.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* PORTAL & ACCESS */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Portal & Access</h3>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="multi-user" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    Can multiple people from my team access this portal?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Currently one login per business. Multi-user access is coming soon.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="forgot-password" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    I forgot my password
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    <Button size="sm" variant="outline" onClick={() => window.location.href = '/forgot-password'}>Reset Password</Button>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="update-business-info" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    How do I update my business info?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Go to <button onClick={() => window.location.href = '/client/profile'} className="text-primary hover:underline">Profile Settings</button> and edit your details.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* MARKETING IO SERVICES */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Marketing iO Services</h3>
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="packages-difference" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    What's the difference between Ignite, Accelerate, and Dominate?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    <div className="space-y-2">
                      <p><span className="font-semibold text-foreground">Ignite:</span> Foundation package — website, content & social media setup.</p>
                      <p><span className="font-semibold text-foreground">Accelerate:</span> Growth package — adds video, paid ads & advanced analytics.</p>
                      <p><span className="font-semibold text-foreground">Dominate:</span> Premium package — includes everything + reputation management & AI tools.</p>
                      <Button size="sm" variant="link" className="mt-2 p-0" onClick={() => document.querySelector('[id*="sales"]')?.scrollIntoView({ behavior: 'smooth' })}>
                        View full breakdown →
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="add-services" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    Can I add services later?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Yes — that's what the Sales Floor below is for. Click Enquire on anything you want.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="custom-packages" className="glass rounded-lg border-0">
                  <AccordionTrigger className="px-4 py-3 hover:bg-secondary/30">
                    Do you offer custom packages?
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 pt-0 text-muted-foreground text-sm">
                    Yes — for serious growth. Reach out to the owner directly via <button onClick={() => window.location.href = '/client/messages'} className="text-primary hover:underline">Messages</button>.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>

          {/* CTA to contact */}
          <div className="mt-8 p-4 glass rounded-lg border-border/50 text-center">
            <p className="text-sm text-muted-foreground mb-3">Still stuck?</p>
            <Button 
              onClick={() => window.location.href = '/client/messages'}
              className="gradient-bg text-white"
            >
              Message your team →
            </Button>
          </div>
        </section>

        {/* Section D — Custom Packages */}
        <section className="glass rounded-2xl p-8 border border-slate-700/40 text-center space-y-4">
          <h3 className="text-2xl font-bold text-foreground">Need Something Custom?</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Don't see what you need? We build custom packages for serious growth. Reach out directly.
          </p>
          <Button
            onClick={() => window.location.href = "mailto:info@marketingio.co.za"}
            className="gradient-bg text-white hover:shadow-lg hover:shadow-purple-500/30 mt-4"
          >
            Contact Owner Direct →
          </Button>
        </section>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-slate-700/40">
          <p className="text-sm text-muted-foreground">
            Questions? Reply to any email or{" "}
            <a href="mailto:info@marketingio.co.za" className="text-primary hover:underline">
              contact us
            </a>
          </p>
        </div>
      </div>

      {/* Enquiry Modal */}
      {selectedProduct && (
        <EnquiryModal
          product={selectedProduct}
          client={client}
          user={user}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmitted={handleSubmitted}
        />
      )}

      {/* Request Update Modal */}
      {selectedDeliverable && (
        <RequestUpdateModal
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          deliverable={selectedDeliverable}
          client={client}
          user={user}
        />
      )}
    </div>
  );
}