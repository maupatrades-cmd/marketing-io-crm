import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentUser } from '@/lib/customAuth';
import ActivityFeed from '@/components/activity/ActivityFeed';

// =============================================================================
// ClientActivity — Client Portal PR A.
//
// Replaces the old portal-feed view. Now backed by the comprehensive
// ClientActivityLog (auth, profile, payment, invoice, document, etc.).
// Real-time polling and filters live in the shared ActivityFeed component
// — this page just resolves the current user's Client.id and hands it off.
//
// Renders for the buyer (viewerRole='client'). Admin/Owner viewers reach
// the same component from /clients/:id with viewerRole='admin' | 'owner'.
// =============================================================================

export default function ClientActivity() {
  const { user: authUser } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = authUser || await getCurrentUser();
      if (!me) {
        if (!cancelled) {
          setError('Please sign in to see your activity.');
          setLoading(false);
        }
        return;
      }
      try {
        // Try the canonical mapping first (client_user_id), fall back to
        // email match for legacy rows that don't have the FK populated.
        const lookups = [
          { client_user_id: me.id },
          me.email ? { email: String(me.email).toLowerCase().trim() } : null,
        ].filter(Boolean);

        let found = null;
        for (const filter of lookups) {
          const list = await base44.entities.Client.filter(filter).catch(() => []);
          const arr = Array.isArray(list) ? list : (list?.data ?? []);
          if (arr[0]) { found = arr[0]; break; }
        }
        if (cancelled) return;
        if (!found) {
          setError("We couldn't find your account record. Contact support if this is unexpected.");
        } else {
          setClient(found);
        }
      } catch (err) {
        console.error('[ClientActivity] client lookup failed:', err);
        if (!cancelled) setError('Failed to load your account.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser]);

  return (
    <div className="min-h-full p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-white">Activity</h1>
          <p className="text-sm text-slate-400">Everything you've done on Marketing iO.</p>
        </header>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-900/20 p-6 text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && client && (
          <ActivityFeed
            clientId={client.id}
            clientName={client.business_name || client.contact_person || ''}
            viewerRole="client"
          />
        )}
      </div>
    </div>
  );
}
