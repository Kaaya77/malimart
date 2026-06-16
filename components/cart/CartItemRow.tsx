import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Trash2, Minus, Plus, Gift, Zap } from 'lucide-react';
import { Badge } from '../UI';
import { CartItem, Offer } from '../../types';
import { formatTZS } from '../../constants';

interface CartItemRowProps {
  item: CartItem;
  index: number;
  price: number;
  originalPrice: number | null;
  offer: Offer | null;
  onUpdateQuantity: (id: string, delta: number, variantId?: string) => void;
  onRemove: (item: CartItem, variantId?: string) => void;
  onSaveForLater: (item: CartItem, variantId?: string) => void;
  onNavigate: (path: string) => void;
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

const FALLBACK_IMG = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 600 800%27%3E%3Crect width=%27600%27 height=%27800%27 fill=%27%23f1f0ec%27/%3E%3Cg fill=%27%23c8c5bc%27%3E%3Ccircle cx=%27300%27 cy=%27340%27 r=%2770%27/%3E%3Cpath d=%27M170 560 q60 -110 130 -40 q40 -70 130 30 l0 50 l-260 0 z%27/%3E%3C/g%3E%3C/svg%3E";

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item, index, price, originalPrice, offer,
  onUpdateQuantity, onRemove, onSaveForLater, onNavigate,
}) => {
  const variant = item.selectedVariant;
  const stock = variant?.stock ?? item.stock ?? 0;
  const isStockLow = stock > 0 && stock < 5;
  const variantLabel = variant ? Object.values(variant.attributes ?? {}).join(' / ') : null;
  const image = variant?.image_url || item.images?.[0] || FALLBACK_IMG;
  const itemKey = variant?.id ? `${item.id}-${variant.id}` : `${item.id}-no-variant`;
  const productPath = `/product/${(item as any).product_id || item.id}`;

  return (
    <motion.div
      key={`${itemKey}-${index}`}
      variants={itemVariants}
      className="relative overflow-hidden"
    >
      {/* Swipe-to-delete reveal layer (mobile) */}
      <div className="sm:hidden absolute inset-y-0 right-0 w-20 bg-red-500 flex flex-col items-center justify-center gap-1 pointer-events-none select-none">
        <Trash2 className="w-5 h-5 text-white" />
        <span className="text-[9px] font-black text-white uppercase tracking-wider">Delete</span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_: any, info: any) => { if (info.offset.x < -60) onRemove(item, variant?.id); }}
        className="flex flex-col sm:flex-row gap-6 p-6 group hover:bg-foreground/[0.02] bg-background transition-colors relative"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Image */}
        <div
          className="w-full sm:w-32 aspect-square rounded-[1.5rem] overflow-hidden bg-foreground/[0.06] shrink-0 border border-foreground/10 relative cursor-pointer group/img"
          onClick={() => onNavigate(productPath)}
        >
          <img
            src={image}
            alt={item.name}
            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700"
            loading="lazy"
            decoding="async"
          />
          {isStockLow && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-500 text-white text-[7px] font-black uppercase text-center py-1">
              Low Stock
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <h3
                className="font-bold text-sm sm:text-base text-foreground leading-tight truncate pr-4 cursor-pointer hover:text-brand-600 transition-colors uppercase"
                onClick={() => onNavigate(productPath)}
              >
                {item.name}
              </h3>
              <div className="text-right">
                <p className="font-black text-sm sm:text-base whitespace-nowrap">{formatTZS(price)}</p>
                {originalPrice && originalPrice > price && (
                  <p className="text-[10px] text-foreground/40 line-through">{formatTZS(originalPrice)}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-foreground/[0.06] text-foreground/50">
                {item.category}
              </Badge>
              {variantLabel && (
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-foreground/10">
                  {variantLabel}
                </Badge>
              )}
              {offer && (
                <Badge className={`${offer.campaign_type === 'bogo' ? 'bg-indigo-600' : 'bg-red-500'} text-white border-none text-[10px] font-black uppercase tracking-widest flex items-center gap-1`}>
                  {offer.campaign_type === 'bogo' ? <Gift className="w-3 h-3" /> : <Zap className="w-3 h-3 fill-current" />}
                  {offer.title}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex justify-between items-end mt-6">
            <div className="flex items-center gap-1 bg-foreground/[0.05] p-1 rounded-xl border border-foreground/8">
              <button
                onClick={() => onUpdateQuantity(item.id, -1, variant?.id)}
                disabled={item.quantity <= 1}
                className="w-11 h-11 rounded-lg flex items-center justify-center bg-background shadow-sm hover:scale-95 transition-all disabled:opacity-50 text-foreground/60"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-black w-10 text-center tabular-nums">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.id, 1, variant?.id)}
                disabled={item.quantity >= stock}
                className="w-11 h-11 rounded-lg flex items-center justify-center bg-background shadow-sm hover:scale-95 transition-all text-foreground"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-foreground/40">Total</p>
                <p className="text-sm font-black text-foreground">{formatTZS(price * item.quantity)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSaveForLater(item, variant?.id)}
                  className="w-11 h-11 flex items-center justify-center text-foreground/25 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                  title="Save for later"
                  aria-label="Save for later"
                >
                  <Heart className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onRemove(item, variant?.id)}
                  className="w-11 h-11 flex items-center justify-center text-foreground/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  title="Remove"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
