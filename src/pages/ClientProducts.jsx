import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentUser } from '@/lib/customAuth';
import ProductCard from '@/components/clientportal/ProductCard';
import ContactCenterModal from '@/components/clientportal/ContactCenterModal';
import { PRODUCT_CATALOG } from '@/data/ProductCatalog';

const FILTERS = [
  { id: 'all',      label: 'All',            test: () => true },
  { id: 'packages', label: 'Core Packages',  test: p => p.type === 'package' || p.type === 'physical' },
  { id: 'addons',   label: 'Add-Ons',        test: p => p.type === 'addon' }
];

export default function ClientProducts() {
  const { user: authUser } = useAuth();
  const [client, setClient] = useState(null);
  const [productImages, setProductImages] = useState({});
  const [filter, setFilter] = useState('all');
  const [contactProduct, setContactProduct] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = authUser || await getCurrentUser();
      if (!me) return;
      try {
        const clients = await base44.entities.Client.filter({ email: me.email });
        const c = Array.isArray(clients) ? clients[0] : clients;
        if (!cancelled) setClient(c || null);
      } catch (err) {
        console.error('[ClientProducts] client lookup failed:', err);
      }
      try {
        const images = await base44.functions.invoke('get-product-images', {});
        if (!cancelled) setProductImages(images?.data || images || {});
      } catch (err) {
        console.error('[ClientProducts] product images failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  const visibleProducts = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter) || FILTERS[0];
    return PRODUCT_CATALOG.filter(f.test);
  }, [filter]);

  return (
    <div className="min-h-full p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Products & Services</h1>
            <p className="text-sm text-slate-400">Buy any product directly — no consultant call required.</p>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Filter</label>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white"
            >
              {FILTERS.map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              client={client}
              imageUrl={productImages[product.id]}
              onContact={(p) => setContactProduct(p || product)}
            />
          ))}
        </div>

        {visibleProducts.length === 0 && (
          <p className="text-center text-slate-500 py-12">No products in this category.</p>
        )}
      </div>

      {contactProduct && (
        <ContactCenterModal
          client={client}
          isOpen={!!contactProduct}
          onClose={() => setContactProduct(null)}
        />
      )}
    </div>
  );
}
