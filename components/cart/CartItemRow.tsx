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
  // `selectedVariant` is only hydrated when the cart payload embeds
  // product.variants. The dashboard RPC (the login path) does not, so it is
  // undefined on first load while `variant_id` is still set — and passing
  // undefined made remove/quantity silently target the wrong row and no-op.
  // Always prefer the resolved variant, but fall back to the raw id.
  const variantId = variant?.id ?? item.variant_id;
  const stock = variant?.stock ?? item.stock ?? 0;
  const isStockLow = stock > 0 && stock < 5;
  const variantLabel = variant ? Object.values(variant.attributes ?? {}).join(' / ') : null;
  const image = variant?.image_url || item.images?.[0] || FALLBACK_IMG;
  const itemKey = variantId ? `${item.id}-${variantId}` : `${item.id}-no-variant`;
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
        onDragEnd={(_: any, info: any) => { if (info.offset.x < -60) onRemove(item, variantId); }}
        className="flex flex-col sm:flex-row gap-5 p-5 sm:p-6 group hover:bg-foreground/[0.02] bg-background transition-colors relative"
        style={{ touchAction: 'pan-y' }}
      >
        {/* Image */}
        <div
          className="w-full sm:w-28 aspect-square rounded-2xl overflow-hidden bg-foreground/[0.06] shrink-0 border border-foreground/8 relative cursor-pointer group/img"
          onClick={() => onNavigate(productPath)}
        >
          <img
            src={image}
            alt={item.name}
            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
          {isStockLow && (
            <div className="absolute bottom-0 left-0 right-0 bg-rose-500/90 backdrop-blur-sm text-white text-[8px] font-bold uppercase tracking-wider text-center py-1">
              Low stock
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div className="space-y-2.5">
            <div className="flex justify-between items-start gap-4">
              <h3
                className="font-bold text-[15px] text-foreground leading-snug line-clamp-2 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                onClick={() => onNavigate(productPath)}
              >
                {item.name}
              </h3>
              <div className="text-right shrink-0">
                <p className="font-bold text-[15px] text-foreground tabular-nums whitespace-nowrap">{formatTZS(price)}</p>
                {originalPrice && originalPrice > price && (
                  <p className="text-[11px] text-foreground/35 line-through tabular-nums">{formatTZS(originalPrice)}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-wider bg-foreground/[0.05] text-foreground/45">
                {item.category}
              </Badge>
              {variantLabel && (
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider border-foreground/10 text-foreground/45">
                  {variantLabel}
                </Badge>
              )}
              {offer && (
                <Badge className={`${offer.campaign_type === 'bogo' ? 'bg-indigo-500' : 'bg-rose-500'} text-white border-none text-[9px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                  {offer.campaign_type === 'bogo' ? <Gift className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5 fill-current" />}
                  {offer.title}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex justify-between items-end mt-4">
            <div className="flex items-center gap-0.5 bg-foreground/[0.05] p-1 rounded-full">
              <button
                onClick={() => onUpdateQuantity(item.id, -1, variantId)}
                disabled={item.quantity <= 1}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-background shadow-sm hover:scale-95 transition-all disabled:opacity-40 text-foreground/60"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-bold w-8 text-center tabular-nums text-foreground">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.id, 1, variantId)}
                disabled={item.quantity >= stock}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-background shadow-sm hover:scale-95 transition-all disabled:opacity-40 text-foreground"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {item.quantity > 1 && (
                <p className="text-[11px] font-semibold text-foreground/40 tabular-nums">{formatTZS(price * item.quantity)} total</p>
              )}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onSaveForLater(item, variantId)}
                  className="w-9 h-9 flex items-center justify-center text-foreground/25 hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all"
                  title="Save for later"
                  aria-label="Save for later"
                >
                  <Heart className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemove(item, variantId)}
                  className="w-9 h-9 flex items-center justify-center text-foreground/25 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                  title="Remove"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
