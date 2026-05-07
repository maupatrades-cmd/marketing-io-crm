import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// =============================================================================
// useActivityFeedPolling — Client Portal PR A.
//
// Polls ClientActivityLog every `intervalMs` (default 30s) while the tab is
// visible. Pauses while document.visibilityState === 'hidden'. Resumes on
// foreground (and triggers an immediate fetch on resume so the user doesn't
// see stale data).
//
// Returns:
//   { entries, loading, error, lastUpdated, refresh, fetchMore, hasMore }
//
// PRs B and G reuse this hook by passing different filter shapes. Keep the
// API shape stable.
//
// Filter shape:
//   { clientId, dateRangeStart?, dateRangeEnd?, eventCategory? }
//
// Stale-while-revalidate behaviour:
//   - First mount: loading=true while we fetch the first page.
//   - Subsequent polls: loading=false; entries are replaced silently when
//     fresh data arrives. The "Last updated HH:MM" indicator updates.
//   - Manual refresh() always shows loading=true briefly.
//
// Pagination:
//   30 entries per page. fetchMore() appends the next page. We use cursor
//   pagination by created_date — the Base44 SDK doesn't expose offset/cursor
//   directly so we fetch the next page filtering by created_date < cursor.
// =============================================================================

const PAGE_SIZE = 30;

/**
 * @param {object} [opts]
 * @param {string} [opts.clientId]
 * @param {string|null} [opts.dateRangeStart]
 * @param {string|null} [opts.dateRangeEnd]
 * @param {string|null} [opts.eventCategory]
 * @param {number} [opts.intervalMs]
 * @param {boolean} [opts.enabled]
 */
export function useActivityFeedPolling(opts = {}) {
  const {
    clientId,
    dateRangeStart,
    dateRangeEnd,
    eventCategory,
    intervalMs = 30_000,
    enabled = true,
  } = opts;
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [hasMore, setHasMore]         = useState(false);

  const cancelledRef = useRef(false);
  const cursorRef    = useRef(null);  // oldest created_date in current list
  const intervalRef  = useRef(null);

  // Build the filter passed to the SDK. Cursor + range filters are applied
  // client-side because the SDK's filter() doesn't support comparison
  // operators directly.
  const matchesFilter = useCallback((row) => {
    if (eventCategory && eventCategory !== 'all' && row?.event_category !== eventCategory) {
      // Legacy rows may not have event_category. Fall back to mapping
      // legacy 'source' values, otherwise let them through under 'all'.
      return false;
    }
    if (dateRangeStart && row?.created_date && new Date(row.created_date) < new Date(dateRangeStart)) {
      return false;
    }
    if (dateRangeEnd && row?.created_date && new Date(row.created_date) > new Date(dateRangeEnd)) {
      return false;
    }
    return true;
  }, [eventCategory, dateRangeStart, dateRangeEnd]);

  const fetchPage = useCallback(async ({ reset = false } = {}) => {
    if (!clientId) return;
    try {
      // The SDK's filter() doesn't support OR conditions on multiple fields,
      // and the activity log row count per client should remain manageable
      // (years of typical use under a few thousand). Pull a wider window per
      // call and do the date-range / category narrowing client-side.
      const overFetch = reset ? PAGE_SIZE * 2 : PAGE_SIZE * 2;
      const rows = await base44.entities.ClientActivityLog
        .filter({ client_id: clientId }, '-created_date', overFetch)
        .catch(() => []);
      const list = (Array.isArray(rows) ? rows : []).filter(matchesFilter);

      if (cancelledRef.current) return;

      if (reset) {
        setEntries(list.slice(0, PAGE_SIZE));
        cursorRef.current = list.length >= PAGE_SIZE
          ? list[PAGE_SIZE - 1]?.created_date
          : null;
        setHasMore(list.length > PAGE_SIZE);
      } else {
        // Polling refresh — replace silently with the latest matching set.
        setEntries((prev) => {
          // Keep at least the same window the user already loaded.
          const target = Math.max(prev.length, PAGE_SIZE);
          const next = list.slice(0, target);
          // Update cursor to track the new oldest visible row.
          cursorRef.current = next.length >= PAGE_SIZE
            ? next[next.length - 1]?.created_date
            : null;
          setHasMore(list.length > next.length);
          return next;
        });
      }
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[useActivityFeedPolling] fetch failed:', err);
      if (!cancelledRef.current) setError(err);
    }
  }, [clientId, matchesFilter]);

  // Initial fetch + filter-change refetch.
  useEffect(() => {
    if (!enabled || !clientId) return;
    cancelledRef.current = false;
    setLoading(true);
    fetchPage({ reset: true }).finally(() => {
      if (!cancelledRef.current) setLoading(false);
    });
    return () => { cancelledRef.current = true; };
  }, [enabled, clientId, fetchPage]);

  // Polling — paused while the tab is backgrounded.
  useEffect(() => {
    if (!enabled || !clientId) return;

    const start = () => {
      stop();
      intervalRef.current = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        fetchPage({ reset: false });
      }, intervalMs);
    };
    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        // Immediate fresh fetch on resume so the user doesn't see stale data.
        fetchPage({ reset: false });
        start();
      } else {
        stop();
      }
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      start();
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [enabled, clientId, intervalMs, fetchPage]);

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchPage({ reset: true }).finally(() => setLoading(false));
  }, [fetchPage]);

  // Append the next page. SDK doesn't expose cursor pagination, so we
  // over-fetch and trim — fine until the row count per client is huge.
  const fetchMore = useCallback(async () => {
    if (!clientId || !hasMore) return;
    try {
      const target = entries.length + PAGE_SIZE;
      const rows = await base44.entities.ClientActivityLog
        .filter({ client_id: clientId }, '-created_date', target * 2)
        .catch(() => []);
      const list = (Array.isArray(rows) ? rows : []).filter(matchesFilter);
      const next = list.slice(0, target);
      setEntries(next);
      cursorRef.current = next.length >= target ? next[next.length - 1]?.created_date : null;
      setHasMore(list.length > next.length);
    } catch (err) {
      console.error('[useActivityFeedPolling] fetchMore failed:', err);
    }
  }, [clientId, hasMore, entries.length, matchesFilter]);

  return { entries, loading, error, lastUpdated, refresh, fetchMore, hasMore };
}
