import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentUser } from "@/lib/customAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, LogOut } from "lucide-react";
import ProductCard from "@/components/clientportal/ProductCard";
import EnquiryModal from "@/components/clientportal/EnquiryModal";
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
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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
        const enqs = await base44.entities.EnquiryEvent.filter({ client_id: c.id });
        setEnquiries(Array.isArray(enqs) ? enqs : []);
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

  // Determine current package and upgrades
  const currentPackage = getProductById(client.package);
  const upgradeProducts = currentPackage?.upgrade_path?.map(pid => getProductById(pid)) || [];
  const allAddOns = getProductsByType("addon");
  const physicalProducts = getProductsByType("physical");

  // Active enquiries count
  const newEnquiries = enquiries.filter(e => e.status === "new").length;

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
          <button
            onClick={logout}
            className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        {/* Section A — Upgrade Package (if not on Dominate) */}
        {client.package !== "dominate" && upgradeProducts.length > 0 && (
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold text-foreground">Take it to the next level</h2>
              <p className="text-muted-foreground">You're growing. Here's what comes next.</p>
            </div>
            <div className="h-1 w-20 gradient-bg rounded-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {upgradeProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isActive={false}
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
                isActive={false}
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
                isActive={false}
                imageUrl={productImages[product.id]}
                onEnquire={handleEnquire}
              />
            ))}
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
    </div>
  );
}