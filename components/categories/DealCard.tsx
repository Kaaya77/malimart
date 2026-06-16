import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Tag, Sparkles, Package, Gift, Zap, Clock } from 'lucide-react';
import { useCountdown } from './useCountdown';
import { formatTZS } from '../../constants';

export const DealCard: React.FC<{ offer: any }> = ({ offer }) => {
  const navigate = useNavigate();
  const countdown = useCountdown(offer.end_date);
  const isFlash = offer.is_flash_sale;

  const badgeColor = offer.campaign_type === 'bogo'
    ? 'bg-indigo-500'
    : offer.campaign_type === 'shipping'
    ? 'bg-sky-500'
    : 'bg-rose-500';

  const icon = offer.campaign_type === 'bogo'
    ? <Gift className="w-4 h-4" />
    : offer.campaign_type === 'shipping'
    ? <Package className="w-4 h-4" />
    : <Zap className="w-4 h-4 fill-current" />;

  const label = offer.type === 'percentage'
    ? `${offer.value}% OFF`
    : offer.campaign_type === 'bogo'
    ? `Buy ${offer.buy_quantity} Get ${offer.get_quantity}`
    : offer.campaign_type === 'shipping'
    ? 'Free Delivery'
    : `${formatTZS(offer.value)} OFF`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl overflow-hidden border ${isFlash ? 'border-rose-200 dark:border-rose-900/50' : 'border-foreground/8'} bg-background group`}
    >
      {isFlash && <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-orange-500/5 pointer-events-none" />}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className={`${badgeColor} text-white rounded-2xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-black`}>
            {icon}
            {label}
          </div>
          {isFlash && countdown && countdown !== 'Ended' && (
            <div className="flex items-center gap-1.5 text-rose-500 text-[10px] font-black uppercase tracking-wider">
              <Clock className="w-3 h-3" /> {countdown}
            </div>
          )}
        </div>

        <h3 className="font-bold text-foreground text-sm mb-1">{offer.title || label}</h3>

        {offer.code && !offer.is_auto_apply && (
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-3 h-3 text-foreground/40" />
            <span className="font-mono text-xs font-bold tracking-widest bg-foreground/[0.06] px-3 py-1 rounded-lg text-foreground/70 select-all">
              {offer.code}
            </span>
          </div>
        )}

        {offer.is_auto_apply && (
          <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold mb-3">
            <Sparkles className="w-3 h-3" /> Auto-applied at checkout
          </div>
        )}

        {offer.min_order_value && (
          <p className="text-[10px] text-foreground/40 mb-3">Min. order: {formatTZS(offer.min_order_value)}</p>
        )}

        {offer.end_date && (
          <p className="text-[10px] text-foreground/35">
            Ends {new Date(offer.end_date).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}
          </p>
        )}

        <button
          onClick={() => navigate(
            offer.target_type === 'category' && offer.target_ids?.[0]
              ? `/shop?category=${encodeURIComponent(offer.target_ids[0])}`
              : '/shop'
          )}
          className="mt-4 w-full h-9 rounded-xl bg-foreground text-background text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity active:scale-95"
        >
          Shop now <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};
