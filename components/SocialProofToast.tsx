import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Heart, Eye } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { formatTZS } from '../constants';

const NAMES = ['Amina', 'Fatuma', 'Juma', 'Zawadi', 'Baraka', 'Neema', 'Salim', 'Rehema', 'Hassan', 'Sifa', 'Bahati', 'Tumaini', 'Imani', 'Kibwe', 'Zuberi', 'Pendo', 'Upendo', 'Furaha'];
const CITIES = ['Dar es Salaam', 'Mwanza', 'Arusha', 'Zanzibar', 'Moshi', 'Tanga', 'Iringa', 'Morogoro', 'Dodoma', 'Tabora', 'Mtwara'];
const ACTIONS = [
  { text: 'just purchased', past: 'bought', icon: ShoppingBag, color: 'text-emerald-500' },
  { text: 'just saved to wishlist', past: 'saved', icon: Heart, color: 'text-rose-500' },
  { text: 'is viewing this now', past: 'viewed', icon: Eye, color: 'text-blue-500' },
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

interface Toast {
  id: number;
  name: string;
  city: string;
  action: typeof ACTIONS[0];
  product: any;
}

export const SocialProofToast: React.FC = () => {
  const { products } = useAppState();
  const [toast, setToast] = useState<Toast | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const eligible = products.filter(p => p.status !== 'inactive' && p.images?.length && p.price > 0);
    if (eligible.length === 0) return;

    const fire = () => {
      const product = rand(eligible);
      idRef.current += 1;
      setToast({ id: idRef.current, name: rand(NAMES), city: rand(CITIES), action: rand(ACTIONS), product });
      timerRef.current = setTimeout(() => setToast(null), 5500);
    };

    // First fire: 10–18s after mount
    const initDelay = 10000 + Math.random() * 8000;
    timerRef.current = setTimeout(() => {
      fire();
      // Subsequent fires: every 22–40s
      intervalRef.current = setInterval(fire, 22000 + Math.random() * 18000);
    }, initDelay);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(intervalRef.current);
    };
  }, [products]);

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
          {/* Product thumbnail */}
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-foreground/[0.06] flex-shrink-0">
            <img
              src={toast.product.images?.[0]}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>

          {/* Text */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 mb-0.5">
              <toast.action.icon className={`w-2.5 h-2.5 flex-shrink-0 ${toast.action.color}`} />
              <p className="text-[10px] font-bold text-foreground/55 truncate">
                {toast.name} · {toast.city}
              </p>
            </div>
            <p className="text-[12px] font-semibold text-foreground line-clamp-1 leading-tight">
              {toast.product.name}
            </p>
            <p className="text-[10px] text-foreground/40 mt-0.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {toast.action.text}
            </p>
          </div>

          {/* Price */}
          <div className="flex-shrink-0 text-right">
            <p className="text-[11px] font-black text-foreground tabular-nums">
              {formatTZS(Math.round(toast.product.price))}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
