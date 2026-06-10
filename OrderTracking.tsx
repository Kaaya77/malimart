import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, MapPin, Truck, ShieldCheck, X,
  Plus, Smartphone, Banknote, Home, Receipt,
  ShoppingBag, Store, Info, ChevronLeft, ChevronDown, ChevronUp,
  Package, ArrowRight, CheckCircle2, Clock, Wallet,
  Zap, Hash, Ban, Loader2, Copy, Calendar, Gift, MessageSquare,
  CreditCard, Landmark, PenLine, Locate, Navigation, ShoppingCart,
  HelpCircle, Phone, Lock, Sparkles, AlertCircle
} from 'lucide-react';
import { Button, Input, Label, Card, useToast, Badge, Switch, Textarea } from '../UI';
import { formatTZS, CURRENCY } from '../../constants';
import { useAppState } from '../../context/AppContext';
import { Order, OrderStatus, Address, VendorProfile, CartItem } from '../../types';
import { supabase } from '../../services/supabaseClient';

const OrderProgressVisual = ({ status }: { status: string }) => {
  const steps = [
    { id: 'placed', icon: ShoppingBag, label: 'Placed', color: '#3b82f6' },
    { id: 'confirmed', icon: CheckCircle2, label: 'Confirmed', color: '#6366f1' },
    { id: 'processing', icon: Package, label: 'Processing', color: '#f59e0b' },
    { id: 'shipped', icon: Truck, label: 'On the Way', color: '#8b5cf6' },
    { id: 'delivered', icon: Home, label: 'Delivered', color: '#10b981' },
  ];

  const statusMap: Record<string, number> = { pending: 0, placed: 0, confirmed: 1, paid: 1, processing: 2, shipped: 3, in_transit: 3, ready_for_pickup: 3, delivered: 4 };
  const currentIdx = statusMap[status] ?? 0;

  return (
    <div className="py-8 px-4">
      <div className="relative flex justify-between items-center">
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-foreground/8">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="h-full bg-foreground"
          />
        </div>
        {steps.map((step, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.2, duration: 0.4, type: 'spring' }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted || isCurrent ? 'bg-foreground border-foreground' : 'bg-background border-foreground/15'}`}
              >
                <Icon className={`w-4 h-4 ${isCompleted || isCurrent ? 'text-background' : 'text-foreground/25'}`} />
                {isCurrent && <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 rounded-full bg-foreground" />}
              </motion.div>
              <p className={`text-[8px] font-black uppercase tracking-wider text-center whitespace-nowrap ${isCurrent ? 'text-foreground' : 'text-foreground/30'}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};


export const OrderTracking = ({ order }: { order: Order }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);

  useEffect(() => {
    const fetchTracking = async () => {
      const { data: shipment } = await supabase.from('shipments').select('*').eq('order_id', order.id).single();
      if (shipment) {
        setTrackingNumber(shipment.tracking_number);
        setCarrier(shipment.carrier);
        const { data: evts } = await supabase.from('shipment_events').select('*').eq('shipment_id', shipment.id).order('occurred_at', { ascending: false });
        if (evts) setEvents(evts);
      }
    };
    fetchTracking();
  }, [order.id]);

  const isCancelled = ['cancelled', 'refunded', 'failed'].includes(order.status);
  if (isCancelled) return (
    <div className="p-5 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center gap-4">
      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center"><Ban className="w-5 h-5 text-red-500" /></div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-red-500">Order {order.status}</p>
        <p className="text-[9px] text-red-400 font-bold mt-0.5">{order.cancel_reason || order.reject_reason || "Transaction terminated."}</p>
      </div>
    </div>
  );

  return (
    <div>
      <OrderProgressVisual status={order.status} />
      {events.length > 0 && (
        <div className="mt-6 bg-foreground/[0.03] rounded-2xl p-5 border border-foreground/8">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-4">Live Updates</p>
          <div className="space-y-4">
            {events.map((ev, idx) => (
              <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex gap-3 relative">
                {idx !== events.length - 1 && <div className="absolute left-1.5 top-4 bottom-0 w-px bg-foreground/10" />}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 z-10 ${idx === 0 ? 'bg-foreground animate-pulse' : 'bg-foreground/20'}`} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-foreground">{ev.status.replace(/_/g, ' ')}</p>
                  {ev.notes && <p className="text-[9px] text-foreground/50 font-bold mt-0.5">{ev.notes}</p>}
                  <p className="text-[8px] font-mono text-foreground/30 mt-1">{new Date(ev.occurred_at).toLocaleString()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      {(trackingNumber || carrier) && (
        <div className="mt-4 bg-foreground rounded-2xl p-5 flex justify-between items-center text-background">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-background/40 mb-1">Carrier</p>
            <p className="font-black text-sm">{carrier || 'Standard Delivery'}</p>
          </div>
          {trackingNumber && (
            <div className="text-right">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-background/40 mb-1">Tracking</p>
              <p className="font-mono font-black text-sm tracking-widest">{trackingNumber}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// PaymentInstructions
// ─────────────────────────────────────────────