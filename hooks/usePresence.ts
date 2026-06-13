import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * MaliMart presence — "who's here right now" on a given topic.
 *
 * Scales because presence is per-resource, never global: a `product:{id}` or
 * `store:{sellerId}` topic only ever holds the handful of people currently
 * looking at THAT product/store — never the whole user base. One Supabase
 * channel per topic, torn down on unmount.
 *
 * Examples:
 *   const { count } = usePresence({ topic: `product:${id}`, key: viewerId });
 *   const { others } = usePresence({ topic: `store:${sellerId}`, key: me, meta: { role } });
 */

export interface UsePresenceArgs {
  /** Presence topic, e.g. `product:abc`. Pass null/undefined to stay disconnected. */
  topic: string | null | undefined;
  /** Stable identity for this client (a user id, or a sticky guest id). */
  key: string;
  /** Metadata shared with everyone on the topic (role, name, avatar…). */
  meta?: Record<string, unknown>;
  /** If false, this client observes presence without announcing itself. */
  track?: boolean;
}

export interface PresenceResult {
  /** Distinct clients present (deduped by `key`); includes self when tracking. */
  count: number;
  /** Flattened metadata for everyone currently present. */
  others: Array<Record<string, unknown>>;
  /** True once the presence channel has synced at least once. */
  ready: boolean;
}

export function usePresence({ topic, key, meta, track = true }: UsePresenceArgs): PresenceResult {
  const [result, setResult] = useState<PresenceResult>({ count: 0, others: [], ready: false });
  // Keep meta fresh without forcing a resubscribe on every render.
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    if (!topic || !key) return;

    const channel = supabase.channel(`presence:${topic}`, {
      config: { presence: { key } },
    });

    const sync = () => {
      const raw = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
      setResult({
        count: Object.keys(raw).length,
        others: Object.values(raw).flat(),
        ready: true,
      });
    };

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && track) {
          channel.track(metaRef.current ?? {});
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [topic, key, track]);

  return result;
}
