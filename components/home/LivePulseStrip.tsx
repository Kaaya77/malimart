import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Eye, Heart, Zap } from 'lucide-react';

/**
 * LivePulseStrip — Animated social proof / activity feed.
 *
 * Shows a horizontally auto-scrolling marquee of "live" marketplace activity.
 * Events are generated from a mix of real product data + plausible fake events.
 * This gives the homepage a "alive" feeling — like a real busy marketplace.
 *
 * Zero external state deps. Purely presentational.
 */

type EventType = 'purchase' | 'view' | 'wishlist' | 'new';

interface LiveEvent {
  id: string;
  type: EventType;
  name: string;
  location: string;
  ago: string;
}

const EVENTS_POOL: Omit<LiveEvent, 'id'>[] = [
  { type: 'purchase', name: 'Kikoi Beach Wrap Set', location: 'Dar es Salaam', ago: '2m ago' },
  { type: 'view', name: 'Zanzibar Clove Masala', location: 'Arusha', ago: '45s ago' },
  { type: 'wishlist', name: 'Maasai Beaded Bracelet', location: 'Dodoma', ago: '1m ago' },
  { type: 'purchase', name: 'Tanzanite Pendant', location: 'Mwanza', ago: '4m ago' },
  { type: 'new', name: 'Mchonga Wooden Sculpture', location: 'Moshi', ago: 'just now' },
  { type: 'view', name: 'Safari Hat – Wide Brim', location: 'Serengeti area', ago: '3m ago' },
  { type: 'purchase', name: 'Organic Baobab Powder', location: 'Tabora', ago: '6m ago' },
  { type: 'wishlist', name: 'Batik Print Dress', location: 'Tanga', ago: '2m ago' },
  { type: 'new', name: 'Handwoven Sisal Basket', location: 'Kilimanjaro', ago: 'just now' },
  { type: 'purchase', name: 'Arabica Coffee Beans', location: 'Iringa', ago: '8m ago' },
  { type: 'view', name: 'Tingatinga Art Print', location: 'Morogoro', ago: '1m ago' },
  { type: 'purchase', name: 'Mkeka Woven Mat', location: 'Lindi', ago: '5m ago' },
];

const EVENT_CONFIG: Record<EventType, { icon: typeof ShoppingBag; label: string; color: string; bg: string }> = {
  purchase: { icon: ShoppingBag, label: 'Purchased', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  view: { icon: Eye, label: 'Viewing now', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  wishlist: { icon: Heart, label: 'Wishlisted', color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
  new: { icon: Zap, label: 'Just listed', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

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
        <span className="text-[10px] text-foreground/35">in</span>
        <span className="text-[11px] font-medium text-foreground/60">{event.location}</span>
        <span className="text-[10px] text-foreground/30">·</span>
        <span className="text-[10px] text-foreground/40">{event.ago}</span>
      </div>
    </div>
  );
};

export const LivePulseStrip: React.FC = () => {
  const events = EVENTS_POOL.map((e, i) => ({ ...e, id: String(i) }));
  // Duplicate for seamless loop
  const doubled = [...events, ...events];

  return (
    <div className="py-5 md:py-6 overflow-hidden relative">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-background to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-background to-transparent" />

      {/* Live dot header */}
      <div className="flex items-center gap-2 mb-3 px-5 md:px-8 container mx-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">Live activity</span>
      </div>

      {/* Marquee */}
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
