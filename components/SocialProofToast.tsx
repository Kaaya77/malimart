import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Heart, Eye } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';

// Tanzanian names used to anonymise real buyers (privacy-safe social proof)
const NAMES = ['Amina', 'Fatuma', 'Juma', 'Zawadi', 'Baraka', 'Neema', 'Salim', 'Rehema',
               'Hassan', 'Sifa', 'Bahati', 'Tumaini', 'Imani', 'Kibwe', 'Zuberi', 'Pendo', 'Upendo', 'Furaha'];

const ACTIONS = [
  { text: 'just purchased', icon: ShoppingBag, color: 'text-emerald-500' },
  { text: 'just saved to wishlist', icon: Heart, color: 'text-rose-500' },
  { text: 'is viewing this now', icon: Eye, color: 'text-blue-500' },
] as const;

function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface RecentActivity {
  product_id: string;
  product_name: string;
  product_image: string;
  product_price: number;
  city: string | null;
}

interface Toast {
  id: number;
  name: string;
  city: string;
  action: typeof ACTIONS[number];
  product: RecentActivity;
}

export const SocialProofToast: React.FC = () => {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Fetch real recent purchase activity from the public_recent_activity view
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('public_recent_activity')
        .select('product_id, product_name, product_images, price_at_purchase, city')
        .limit(50);

      if (!data?.length) return;

      const seen = new Set<string>();
      const unique: RecentActivity[] = [];
      for (const row of data) {
        if (seen.has(row.product_id) || !row.product_images?.[0] || !row.price_at_purchase) continue;
        seen.add(row.product_id);
        unique.push({
          product_id: row.product_id,
          product_name: row.product_name,
          product_image: row.product_images[0],
          product_price: row.price_at_purchase,
          city: row.city,
        });
      }
      setActivities(unique);
    })();
  }, []);

  useEffect(() => {
    if (activities.length === 0) return;

    const fire = () => {
      const product = rand(activities);
      idRef.current += 1;
      setToast({
        id: idRef.current,
        name: rand(NAMES),
        city: product.city || 'Tanzania',
        action: rand(ACTIONS),
        product,
      });
      timerRef.current = setTimeout(() => setToast(null), 5500);
    };

    const initDelay = 10000 + Math.random() * 8000;
    timerRef.current = setTimeout(() => {
      fire();
      intervalRef.current = setInterval(fire, 22000 + Math.random() * 18000);
    }, initDelay);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(intervalRef.current);
    };
  }, [activities]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: -24, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -24, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onClick={() => setToast(null)}
          className="fixed bottom-24 md:bottom-8 left-4 z-[88] max-w-[270px] bg-background/95 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-xl shadow-black/10 p-3 flex items-center gap-3 cursor-pointer select-none"
        >
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-foreground/[0.06] flex-shrink-0">
            <img src={toast.product.product_image} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 mb-0.5">
              <toast.action.icon className={`w-2.5 h-2.5 flex-shrink-0 ${toast.action.color}`} />
              <p className="text-[10px] font-bold text-foreground/55 truncate">
                {toast.name} · {toast.city}
              </p>
            </div>
            <p className="text-[12px] font-semibold text-foreground line-clamp-1 leading-tight">
              {toast.product.product_name}
            </p>
            <p className="text-[10px] text-foreground/40 mt-0.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {toast.action.text}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] font-black text-foreground tabular-nums">
              {formatTZS(Math.round(toast.product.product_price))}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
