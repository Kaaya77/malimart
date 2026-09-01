/**
 * queryCache.ts — stale-while-revalidate in-memory cache
 *
 * Cuts repeated Supabase egress by serving cached data instantly and only
 * hitting the network after the TTL expires. Works entirely in-memory so
 * it resets on page refresh (intentional — no stale data across sessions).
 *
 * TTLs chosen to balance freshness vs egress savings:
 *  - products/categories/trust_badges: 5 min  (slow-changing public data)
 *  - offers/social_posts:              2 min  (moderate change rate)
 *  - seller dashboard:                 3 min  (already snapshot-backed in DB)
 *  - user-specific data (orders etc):  30 sec (needs to be fresh)
 */

interface CacheEntry<T> {
    data: T;
    fetchedAt: number;
    ttl: number; // ms
}

const store = new Map<string, CacheEntry<any>>();

// Tracks in-flight fetches so concurrent callers for the same key
// share one network request instead of firing duplicates.
const inflight = new Map<string, Promise<any>>();

export const TTL = {
    PUBLIC_PRODUCTS:   5 * 60 * 1000,   // 5 min
    CATEGORIES:        5 * 60 * 1000,
    TRUST_BADGES:      5 * 60 * 1000,
    OFFERS:            2 * 60 * 1000,   // 2 min
    SOCIAL_POSTS:      2 * 60 * 1000,
    HERO:              3 * 60 * 1000,
    TICKER:            1 * 60 * 1000,   // 1 min
    SELLER_DASHBOARD:  3 * 60 * 1000,
    USER_DATA:         30 * 1000,       // 30 sec
    VENDOR_PROFILES:   5 * 60 * 1000,
} as const;

/** Returns cached data if fresh, null if stale/missing */
export function getCached<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > entry.ttl) return null;
    return entry.data as T;
}

/** Returns cached data even if stale (for stale-while-revalidate pattern) */
export function getStale<T>(key: string): T | null {
    const entry = store.get(key);
    return entry ? (entry.data as T) : null;
}

/** Returns true if the cache entry is stale (needs revalidation) */
export function isStale(key: string): boolean {
    const entry = store.get(key);
    if (!entry) return true;
    return Date.now() - entry.fetchedAt > entry.ttl;
}

/** Stores data in the cache */
export function setCached<T>(key: string, data: T, ttl: number): void {
    store.set(key, { data, fetchedAt: Date.now(), ttl });
    persistIfWhitelisted(key, data);
}

// ── Durable fallback (localStorage) ──────────────────────────────────────────
// A small whitelist of public, non-sensitive keys is mirrored to localStorage so
// a COLD load while the backend is unreachable can still show last-known content
// instead of a dead screen. In-memory cache stays the primary path; this is only
// a last-resort fallback, read explicitly via loadPersisted().
const PERSIST_PREFIX = 'mm_cache_';
const PERSIST_KEYS = new Set<string>(['public:products', 'public:categories']);

function persistIfWhitelisted<T>(key: string, data: T): void {
    if (!PERSIST_KEYS.has(key)) return;
    try {
        localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify({ data, at: Date.now() }));
    } catch { /* quota/availability — non-fatal, fallback just won't exist */ }
}

/** Reads a durable fallback copy (if present and not older than maxAgeMs). */
export function loadPersisted<T>(key: string, maxAgeMs = 24 * 60 * 60 * 1000): T | null {
    try {
        const raw = localStorage.getItem(PERSIST_PREFIX + key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { data: T; at: number };
        if (!parsed || typeof parsed.at !== 'number') return null;
        if (Date.now() - parsed.at > maxAgeMs) return null;
        return parsed.data;
    } catch { return null; }
}

/** Invalidates a cache entry (e.g. after a mutation) */
export function invalidate(key: string): void {
    store.delete(key);
}

/** Invalidates all entries matching a prefix */
export function invalidatePrefix(prefix: string): void {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key);
    }
}

/**
 * withCache — wraps any async fetcher with stale-while-revalidate logic.
 *
 * 1. If fresh cache exists → return it immediately, no network call.
 * 2. If stale cache exists → return stale data immediately AND kick off
 *    background revalidation (fire-and-forget).
 * 3. If no cache → await the fetch, cache result, return it.
 */
export async function withCache<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T | null>,
    onBackground?: (data: T) => void  // called when background refresh completes
): Promise<T | null> {
    const fresh = getCached<T>(key);
    if (fresh !== null) return fresh;

    const stale = getStale<T>(key);
    if (stale !== null) {
        // Serve stale immediately, revalidate in background — deduplicated
        if (!inflight.has(key)) {
            const bg = fetcher().then(data => {
                if (data !== null) { setCached(key, data, ttl); onBackground?.(data); }
            }).catch(() => {/* silent — stale data still served */})
              .finally(() => inflight.delete(key));
            inflight.set(key, bg);
        }
        return stale;
    }

    // No cache at all — deduplicate concurrent cold misses
    if (inflight.has(key)) return inflight.get(key) as Promise<T | null>;

    const promise = fetcher().then(data => {
        if (data !== null) setCached(key, data, ttl);
        return data;
    }).finally(() => inflight.delete(key));

    inflight.set(key, promise);
    return promise;
}
