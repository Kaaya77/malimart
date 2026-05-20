import React from 'react';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button } from './UI';
import { Magnetic } from './Effects';
import { CURRENCY, getEffectiveUnitPrice } from '../constants';

// ───────────────────────────────────────────────
// CartDrawer — mobile-first bottom sheet
//
// FIX #1: Converted from fixed-width desktop dropdown (w-[420px]) to a
// full-width bottom sheet on mobile, and a right-side panel on md+.
// FIX #2: Quantity stepper buttons bumped from w-6 h-6 (24px) to w-11 h-11
// (44px) to meet minimum touch target guidelines.
// FIX #3: Trash button tap area expanded with p-2 padding.
// FIX #4: Added swipe-to-dismiss drag handle and backdrop overlay.
// FIX #5: Footer gains safe-area-inset-bottom so it clears the iOS home bar.
// ───────────────────────────────────────────────
export const CartDrawer = () => {
 const { isCartOpen, closeCart, cart, updateQuantity, removeFromCart, clearCart } = useAppState();
 const navigate = useNavigate();
 const [isClearing, setIsClearing] = React.useState(false);
 const [removingId, setRemovingId] = React.useState<string | null>(null);

 const handleClearCart = async () => {
 setIsClearing(true);
 await clearCart();
 setIsClearing(false);
 };

 const handleRemoveFromCart = async (productId: string, variantId?: string) => {
 const id = variantId ? `${productId}-${variantId}` : productId;
 setRemovingId(id);
 await removeFromCart(productId, variantId);
 setRemovingId(null);
 };

 const subtotal = cart.reduce((acc, item) => {
 const price = getEffectiveUnitPrice(item);
 return acc + price * item.quantity;
 }, 0);

 const FREE_SHIPPING_THRESHOLD = 500000;
 const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
 const remainingForFree = FREE_SHIPPING_THRESHOLD - subtotal;

 // Swipe-to-dismiss: close if dragged down >80px or flicked fast
 const handleDragEnd = (_: any, info: PanInfo) => {
 if (info.offset.y > 80 || info.velocity.y > 400) {
 closeCart();
 }
 };

 return (
 <AnimatePresence>
 {isCartOpen && (
 <>
 {/* ── Backdrop overlay (tap to close) ── */}
 <motion.div
 key="cart-backdrop"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.2 }}
 onClick={closeCart}
 className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]"
 />

 {/* ── Bottom sheet (mobile) / right panel (md+) ── */}
 <motion.div
 key="cart-sheet"
 initial={{ y: '100%' }}
 animate={{ y: 0 }}
 exit={{ y: '100%' }}
 transition={{ type: 'spring', damping: 30, stiffness: 300 }}
 drag="y"
 dragConstraints={{ top: 0, bottom: 0 }}
 dragElastic={{ top: 0, bottom: 0.5 }}
 onDragEnd={handleDragEnd}
 className={`
 fixed inset-x-0 bottom-0 z-[201]
 bg-background/95 backdrop-blur-xl
 border-t border-foreground/10
 rounded-t-3xl shadow-2xl
 flex flex-col
 max-h-[90dvh]
 md:inset-x-auto md:inset-y-0 md:right-0 md:top-0 md:bottom-0
 md:w-[420px] md:max-h-none md:rounded-none md:rounded-l-3xl
 md:border-t-0 md:border-l
 `}
 >
 {/* Drag handle (mobile only) */}
 <div className="flex-shrink-0 flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing md:hidden">
 <div className="w-10 h-1 rounded-full bg-foreground/20" />
 </div>

 {/* Header */}
 <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-foreground/10">
 <div className="flex justify-between items-center mb-4">
 <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-foreground">
 Bag <span className="opacity-60">({cart.length})</span>
 </h2>
 <div className="flex items-center gap-4">
 {cart.length > 0 && (
 <button
 onClick={handleClearCart}
 disabled={isClearing}
 className="text-[9px] uppercase tracking-[0.2em] font-semibold opacity-60 hover:opacity-100 transition-opacity disabled:opacity-30"
 >
 {isClearing ? 'Clearing...' : 'Clear'}
 </button>
 )}
 <button
 onClick={closeCart}
 aria-label="Close cart"
 className="w-9 h-9 flex items-center justify-center hover:opacity-60 transition-opacity rounded-full"
 >
 <X className="w-4 h-4 stroke-[1] text-foreground"/>
 </button>
 </div>
 </div>

 {/* Free Shipping Progress */}
 {cart.length > 0 && (
 <div className="bg-foreground/[0.04] p-3.5 rounded-2xl border border-foreground/8">
 <p className="text-[9px] uppercase tracking-[0.2em] font-semibold opacity-80 mb-3">
 {progress < 100 ? (
 <>Add <span className="font-bold">{remainingForFree.toLocaleString()} {CURRENCY}</span> for Free Delivery</>
 ) : (
 <span className="flex items-center gap-2">
 <Check className="w-3 h-3 stroke-[1]" /> Free Delivery Unlocked
 </span>
 )}
 </p>
 <div className="h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
 <div
 className="h-full transition-all duration-1000 ease-out relative bg-emerald-500 rounded-full"
 style={{ width: `${progress}%` }}
 />
 </div>
 </div>
 )}
 </div>

 {/* Items List */}
 <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
 {cart.length === 0 ? (
 <div className="h-48 flex flex-col items-center justify-center text-center space-y-6 opacity-60">
 <ShoppingBag className="w-8 h-8 stroke-[1]"/>
 <h3 className="font-serif text-lg font-light">Your bag is empty</h3>
 <button onClick={closeCart} className="text-[9px] uppercase tracking-[0.2em] font-semibold border-b border-current pb-1 hover:opacity-60 transition-opacity">
 Continue Shopping
 </button>
 </div>
 ) : (
 cart.map((item, index) => {
 const price = getEffectiveUnitPrice(item);
 const variant = item.selectedVariant;
 const variantId = variant?.id;
 const stock = variant?.stock ?? item.stock ?? 0;
 const isLowStock = stock > 0 && stock < 5;
 const variantLabel = variant ? Object.values(variant.attributes ?? {}).join(' / ') : null;
 const image = variant?.image_url || item.images?.[0] || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?q=80&w=2000&auto=format&fit=crop';

 const itemKey = variantId
 ? `${item.id}-${variantId}`
 : `${item.id}-no-variant`;

 return (
 <div
 key={`${itemKey}-${index}`}
 className="flex gap-4 group transition-all"
 >
 <div
 className="w-20 h-24 bg-foreground/[0.04] overflow-hidden flex-shrink-0 relative cursor-pointer border border-foreground/10"
 onClick={() => navigate(`/shop?search=${encodeURIComponent(item.name)}`)}
 >
 <img
 src={image}
 alt={item.name}
 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
 />
 {isLowStock && (
 <div className="absolute bottom-0 left-0 right-0 bg-foreground text-background text-[8px] uppercase tracking-[0.2em] font-semibold text-center py-1">
 Only {stock} Left
 </div>
 )}
 </div>

 <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
 <div>
 <div className="flex justify-between items-start gap-2">
 <h4
 className="font-serif text-sm line-clamp-1 cursor-pointer hover:opacity-60 transition-opacity"
 onClick={() => navigate(`/shop?search=${encodeURIComponent(item.name)}`)}
 >
 {item.name}
 </h4>
 {/* FIX #3: Enlarged trash button tap area */}
 <button
 onClick={() => handleRemoveFromCart(item.id, variantId)}
 disabled={removingId === (variantId ? `${item.id}-${variantId}` : item.id)}
 aria-label="Remove item"
 className="opacity-40 hover:opacity-100 transition-opacity p-2 -m-2 disabled:opacity-20 flex-shrink-0"
 >
 <Trash2 className="w-3.5 h-3.5 stroke-[1]"/>
 </button>
 </div>

 {variantLabel ? (
 <p className="text-[9px] uppercase tracking-[0.2em] font-semibold opacity-60 mt-2 truncate">
 {variantLabel}
 </p>
 ) : (
 <p className="text-[9px] uppercase tracking-[0.2em] font-semibold opacity-60 mt-2 truncate">
 {item.category}
 </p>
 )}
 </div>

 <div className="flex justify-between items-end mt-4">
 <div className="text-sm">
 {price.toLocaleString()} <span className="text-[9px] uppercase tracking-[0.2em] opacity-60">{CURRENCY}</span>
 </div>

 {/* FIX #2: Stepper buttons enlarged to 44px (w-11 h-11) */}
 <div className="flex items-center gap-1 border border-foreground/20">
 <button
 onClick={() => updateQuantity(item.id, -1, variantId)}
 disabled={item.quantity <= 1}
 aria-label="Decrease quantity"
 className="w-11 h-11 flex items-center justify-center hover:opacity-60 transition-opacity disabled:opacity-30"
 >
 <Minus className="w-3 h-3 stroke-[1]"/>
 </button>
 <span className="text-[10px] uppercase tracking-[0.2em] font-semibold w-6 text-center select-none">{item.quantity}</span>
 <button
 onClick={() => updateQuantity(item.id, 1, variantId)}
 disabled={item.quantity >= stock}
 aria-label="Increase quantity"
 className="w-11 h-11 flex items-center justify-center hover:opacity-60 transition-opacity disabled:opacity-30"
 >
 <Plus className="w-3 h-3 stroke-[1]"/>
 </button>
 </div>
 </div>
 </div>
 </div>
 );
 })
 )}
 </div>

 {cart.length > 0 && (
 // FIX #5: Safe-area padding so footer clears iOS home indicator
 <div
 className="flex-shrink-0 px-6 pt-4 border-t border-foreground/10 bg-transparent"
 style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
 >
 <div className="space-y-3 mb-6">
 <div className="flex justify-between items-center text-sm">
 <span className="opacity-60">Subtotal</span>
 <span>{subtotal.toLocaleString()} {CURRENCY}</span>
 </div>
 <div className="flex justify-between items-center text-sm">
 <span className="opacity-60">Delivery</span>
 <span className="text-[9px] uppercase tracking-[0.2em] font-semibold opacity-60">Calculated at checkout</span>
 </div>
 </div>

 <motion.button
 whileHover={{ scale: 1.01 }}
 whileTap={{ scale: 0.97 }}
 onClick={() => { closeCart(); navigate('/cart'); }}
 className="w-full h-14 bg-foreground text-background rounded-2xl text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-2 shadow-lg group active:scale-[0.98] transition-all"
 >
 <span>Checkout</span>
 <span className="opacity-60">·</span>
 <span>{subtotal.toLocaleString()} {CURRENCY}</span>
 <ArrowRight className="w-4 h-4 stroke-[2] ml-1 group-hover:translate-x-0.5 transition-transform"/>
 </motion.button>

 <div className="mt-4 flex justify-center items-center gap-2 text-[9px] uppercase tracking-[0.2em] font-semibold opacity-40">
 <AlertCircle className="w-3 h-3 stroke-[1]" /> Secure Transaction
 </div>
 </div>
 )}
 </motion.div>
 </>
 )}
 </AnimatePresence>
 );
};
