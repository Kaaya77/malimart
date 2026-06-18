import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Zap } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

type EventType = 'purchase' | 'new';

interface LiveEvent {
  id: string;
  type: EventType;
  name: string;
  location: string;
  ago: string;
}

const EVENT_CONFIG: Record<EventType, { icon: typeof ShoppingBag; label: string; color: string; bg: string }> = {
  purchase: { icon: ShoppingBag, label: 'Purchased', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  new:      { icon: Zap,         label: 'Just listed', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const EventPill: React.FC<{ event: LiveEvent }> = ({ event }) => {
  const cfg = EVENT_CONFIG[event.type];
  const Icon = cfg.icon;
  return (
    <div className="flex-shrink-0 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-foreground/[0.08] bg-background/80 backdrop-blur-sm select-none whitespace-nowrap">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.bg }}
      >
        <Icon className="w-3 h-3" style={{ color: cfg.color }} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-foreground/80">{event.name}</span>
        {event.location && <>
          <span className="text-[10px] text-foreground/35">in</span>
          <span className="text-[11px] font-medium text-foreground/60">{event.location}</span>
        </>}
        <span className="text-[10px] text-foreground/30">·</span>
        <span className="text-[10px] text-foreground/40">{event.ago}</span>
      </div>
    </div>
  );
};

export const LivePulseStrip: React.FC = () => {
  const [events, setEvents] = useState<LiveEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [activityRes, productsRes] = await Promise.all([
        supabase
          .from('public_recent_activity')
          .select('product_id, product_name, city, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('products')
          .select('id, name, created_at')
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      const list: LiveEvent[] = [];

      for (const row of activityRes.data ?? []) {
        if (!row.product_name) continue;
        list.push({
          id: `buy-${row.product_id}`,
          type: 'purchase',
          name: row.product_name,
          location: row.city ?? '',
          ago: timeAgo(row.created_at),
        });
      }

      const existingNames = new Set(list.map(e => e.name));
      for (const p of productsRes.data ?? []) {
        if (existingNames.has(p.name)) continue;
        list.push({
          id: `new-${p.id}`,
          type: 'new',
          name: p.name,
          location: '',
          ago: timeAgo(p.created_at),
        });
      }

      setEvents(list);
    })();
    return () => { cancelled = true; };
  }, []);

  if (events.length === 0) return null;

  const doubled = [...events, ...events];

  return (
    <div className="py-5 md:py-6 overflow-hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-background to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-background to-transparent" />

      <div className="flex items-center gap-2 mb-3 px-5 md:px-8 container mx-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">Live activity</span>
      </div>

      <motion.div
        className="flex gap-3"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 35, ease: 'linear', repeat: Infinity }}
        style={{ width: 'max-content' }}
      >
        {doubled.map((event, i) => (
          <EventPill key={`${event.id}-${i}`} event={event} />
        ))}
      </motion.div>
    </div>
  );
};
