import React from 'react';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Check, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { CURRENCY, getEffectiveUnitPrice } from '../constants';
import { useFocusTrap } from '../hooks/useFocusTrap';

export const CartDrawer = () => {
  const { isCartOpen, closeCart, cart, updateQuantity, removeFromCart, clearCart } = useAppState();
  const navigate = useNavigate();
  const [isClearing, setIsClearing] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isCartOpen);

  const handleClearCart = async () => { setIsClearing(true); await clearCart(); setIsClearing(false); };
  const handleRemove = async (productId: string, variantId?: string) => {
    const id = variantId ? `${productId}-${variantId}` : productId;
    setRemovingId(id); await removeFromCart(productId, variantId); setRemovingId(null);
  };

  const subtotal = cart.reduce((acc, item) => acc + getEffectiveUnitPrice(item) * item.quantity, 0);
  const FREE_THRESHOLD = 500000;
  const progress = Math.min(100, (subtotal / FREE_THRESHOLD) * 100);
  const remaining = FREE_THRESHOLD - subtotal;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 400) closeCart();
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeCart}
            className="fixed inset-0 z-[200]"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          />

          {/* Sheet */}
          <motion.div
            key="cart-sheet"
            ref={panelRef} role="dialog" aria-modal="true" aria-label="Shopping cart" tabIndex={-1}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className="fixed inset-x-0 bottom-0 z-[201] flex flex-col bg-background border-t border-foreground/10 rounded-t-[2rem] shadow-2xl outline-none"
            style={{ maxHeight: '90dvh' }}
          >
            {/* ── Drag pill ── */}
            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0">
              <div className="w-10 h-[3px] rounded-full bg-foreground/20" />
            </div>

            {/* ── Header ── */}
            <div className="flex-shrink-0 px-5 pt-3 pb-4 border-b border-foreground/8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 stroke-[1.5] text-foreground" />
                  <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">
                    Bag
                  </h2>
                  {cart.length > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-foreground text-background text-[9px] font-black">
                      {cart.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {cart.length > 0 && (
                    <button
                      onClick={handleClearCart} disabled={isClearing}
                      className="text-[9px] uppercase tracking-[0.18em] font-black text-foreground/40 hover:text-foreground transition-colors disabled:opacity-30"
                    >
                      {isClearing ? '...' : 'Clear'}
                    </button>
                  )}
                  <button
                    onClick={closeCart} aria-label="Close"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] transition-colors"
                  >
                    <X className="w-3.5 h-3.5 stroke-[2] text-foreground" />
                  </button>
                </div>
              </div>

              {/* Free shipping bar */}
              {cart.length > 0 && (
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[9px] uppercase tracking-[0.18em] font-black text-foreground/50">
                      {progress >= 100
                        ? <span className="flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Free delivery unlocked</span>
                        : <><span className="text-foreground font-black">{remaining.toLocaleString()} {CURRENCY}</span> from free delivery</>
                      }
                    </p>
                    <span className="text-[9px] font-black text-foreground/30">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-[2px] w-full bg-foreground/8 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-foreground'}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Items ── */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-foreground/[0.04] flex items-center justify-center">
                    <ShoppingBag className="w-7 h-7 stroke-[1] text-foreground/30" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] font-black text-foreground/40">Your bag is empty</p>
                    <button onClick={closeCart} className="mt-3 text-[9px] uppercase tracking-[0.2em] font-black border-b border-foreground/30 text-foreground/50 hover:text-foreground hover:border-foreground transition-colors pb-px">
                      Continue Shopping
                    </button>
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cart.map((item, index) => {
                    const price = getEffectiveUnitPrice(item);
                    const variant = item.selectedVariant;
                    // Fall back to the raw variant_id: the dashboard RPC used on
                    // login does not embed product.variants, so selectedVariant
                    // is undefined there and remove/quantity would silently
                    // no-op against a variant line.
                    const variantId = variant?.id ?? item.variant_id;
                    const stock = variant?.stock ?? item.stock ?? 0;
                    const variantLabel = variant ? Object.values(variant.attributes ?? {}).join(' / ') : null;
                    const image = variant?.image_url || item.images?.[0] || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?q=80&w=800&auto=format&fit=crop';
                    const itemKey = variantId ? `${item.id}-${variantId}` : `${item.id}-${index}`;
                    const isRemoving = removingId === (variantId ? `${item.id}-${variantId}` : item.id);

                    return (
                      <motion.div
                        key={itemKey}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: isRemoving ? 0.4 : 1, y: 0 }}
                        exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                        transition={{ duration: 0.3 }}
                        className="flex gap-3 group"
                      >
                        {/* Image */}
                        <div className="w-[72px] h-[88px] rounded-xl overflow-hidden bg-foreground/[0.04] flex-shrink-0 border border-foreground/8 relative">
                          <img src={image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          {stock > 0 && stock < 5 && (
                            <div className="absolute bottom-0 left-0 right-0 bg-amber-500 text-white text-[7px] font-black uppercase text-center py-0.5">
                              Only {stock} left
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="text-[12px] font-black text-foreground leading-tight line-clamp-2 uppercase tracking-tight">
                                {item.name}
                              </h4>
                              <button
                                onClick={() => handleRemove(item.id, variantId)}
                                disabled={isRemoving}
                                aria-label="Remove"
                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-foreground/30 hover:text-red-500 transition-colors -mr-1 disabled:opacity-30"
                              >
                                <Trash2 className="w-3.5 h-3.5 stroke-[1.5]" />
                              </button>
                            </div>
                            {(variantLabel || item.category) && (
                              <p className="text-[9px] uppercase tracking-[0.16em] font-bold text-foreground/40 mt-1">
                                {variantLabel || item.category}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[12px] font-black text-foreground">
                              {(price * item.quantity).toLocaleString()}
                              <span className="text-[8px] ml-1 font-bold text-foreground/40">{CURRENCY}</span>
                            </p>
                            {/* Stepper */}
                            <div className="flex items-center gap-0 border border-foreground/15 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.id, -1, variantId)}
                                disabled={item.quantity <= 1}
                                aria-label="Decrease"
                                className="w-11 h-11 flex items-center justify-center text-foreground/60 hover:bg-foreground/[0.06] disabled:opacity-30 transition-colors"
                              >
                                <Minus className="w-3 h-3 stroke-[2]" />
                              </button>
                              <span className="w-8 text-center text-[11px] font-black text-foreground select-none">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, 1, variantId)}
                                disabled={item.quantity >= stock}
                                aria-label="Increase"
                                className="w-11 h-11 flex items-center justify-center text-foreground hover:bg-foreground/[0.06] disabled:opacity-30 transition-colors"
                              >
                                <Plus className="w-3 h-3 stroke-[2]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {/* ── Footer ── */}
            {cart.length > 0 && (
              <div
                className="flex-shrink-0 px-5 pt-4 border-t border-foreground/8 bg-background"
                style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
              >
                {/* Totals */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] font-black text-foreground/40">Subtotal</p>
                    <p className="text-lg font-black text-foreground leading-tight">{subtotal.toLocaleString()} <span className="text-[10px] font-bold text-foreground/40">{CURRENCY}</span></p>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.15em] font-black text-foreground/40">
                    <Sparkles className="w-3 h-3" />
                    Secure
                  </div>
                </div>

                {/* CTA */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { closeCart(); navigate('/cart'); }}
                  className="w-full h-[52px] bg-foreground text-background rounded-xl text-[10px] uppercase tracking-[0.22em] font-black flex items-center justify-center gap-2 group active:scale-[0.98] transition-transform"
                >
                  Review & Checkout
                  <ArrowRight className="w-4 h-4 stroke-[2] group-hover:translate-x-0.5 transition-transform" />
                </motion.button>

                <button
                  onClick={closeCart}
                  className="w-full mt-3 text-center text-[9px] uppercase tracking-[0.18em] font-black text-foreground/30 hover:text-foreground/60 transition-colors py-1"
                >
                  Continue Shopping
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
