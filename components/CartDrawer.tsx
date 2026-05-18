import React from 'react';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button } from './UI';
import { Magnetic } from './Effects';
import { CURRENCY, getEffectiveUnitPrice } from '../constants';

// ───────────────────────────────────────────────
// Consistent price helper (same as CartPage & Checkout)
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

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeCart();
      }
    };
    if (isCartOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  return (
    <div className="absolute top-full right-0 mt-4 w-[420px] bg-background/95 dark:bg-background/95 backdrop-blur-xl border border-foreground/10 dark:border-background/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-4 duration-300" ref={containerRef}>
        
        {/* Header */}
        <div className="p-6 border-b border-foreground/10 dark:border-background/10 bg-transparent">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.2em] font-semibold text-foreground dark:text-background">
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
              <button onClick={closeCart} className="hover:opacity-60 transition-opacity">
                <X className="w-4 h-4 stroke-[1] text-foreground dark:text-background"/>
              </button>
            </div>
          </div>
          
          {/* Free Shipping Progress */}
          {cart.length > 0 && (
            <div className="bg-[#ebe8e3] dark:bg-[#0a0a0a] p-4 border border-foreground/10 dark:border-background/10">
                <p className="text-[9px] uppercase tracking-[0.2em] font-semibold opacity-80 mb-3">
                  {progress < 100 ? (
                    <>Add <span className="font-bold">{remainingForFree.toLocaleString()} {CURRENCY}</span> for Free Delivery</>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Check className="w-3 h-3 stroke-[1]" /> Free Delivery Unlocked
                    </span>
                  )}
                </p>
                <div className="h-1 w-full bg-primary/10 dark:bg-background/10 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out relative bg-primary dark:bg-background`} 
                    style={{ width: `${progress}%` }}
                  />
                </div>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[50vh] no-scrollbar">
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

              // Safe, unique key — fixes duplicate key error
              const itemKey = variantId 
                ? `${item.id}-${variantId}`
                : `${item.id}-no-variant`;

              return (
                <div 
                  key={`${itemKey}-${index}`}
                  className="flex gap-4 group transition-all"
                >
                  <div 
                    className="w-20 h-24 bg-[#ebe8e3] dark:bg-[#0a0a0a] overflow-hidden flex-shrink-0 relative cursor-pointer border border-foreground/10 dark:border-background/10"
                    onClick={() => navigate(`/shop?search=${encodeURIComponent(item.name)}`)}
                  >
                    <img 
                      src={image} 
                      alt={item.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {isLowStock && (
                      <div className="absolute bottom-0 left-0 right-0 bg-primary text-background dark:bg-background dark:text-foreground text-[8px] uppercase tracking-[0.2em] font-semibold text-center py-1">
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
                        <button 
                          onClick={() => handleRemoveFromCart(item.id, variantId)} 
                          disabled={removingId === (variantId ? `${item.id}-${variantId}` : item.id)}
                          className="opacity-40 hover:opacity-100 transition-opacity p-1 -m-1 disabled:opacity-20"
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
                      
                      <div className="flex items-center gap-3 border border-foreground/20 dark:border-background/20 px-2 py-1">
                        <button 
                          onClick={() => updateQuantity(item.id, -1, variantId)} 
                          disabled={item.quantity <= 1}
                          className="w-6 h-6 flex items-center justify-center hover:opacity-60 transition-opacity disabled:opacity-30"
                        >
                          <Minus className="w-3 h-3 stroke-[1]"/>
                        </button>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, 1, variantId)} 
                          disabled={item.quantity >= stock}
                          className="w-6 h-6 flex items-center justify-center hover:opacity-60 transition-opacity disabled:opacity-30"
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
          <div className="p-6 border-t border-foreground/10 dark:border-background/10 bg-transparent z-20">
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
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { closeCart(); navigate('/cart'); }} 
              className="w-full h-12 bg-primary text-background dark:bg-background dark:text-foreground text-[10px] uppercase tracking-[0.2em] font-semibold flex items-center justify-center gap-2 shadow-sm group"
            >
              Review & Checkout 
              <ArrowRight className="w-4 h-4 stroke-[1] group-hover:translate-x-1 transition-transform"/>
            </motion.button>

            <div className="mt-4 flex justify-center items-center gap-2 text-[9px] uppercase tracking-[0.2em] font-semibold opacity-40">
              <AlertCircle className="w-3 h-3 stroke-[1]" /> Secure Transaction
            </div>
          </div>
        )}
      </div>
  );
};