import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Package, ShoppingBag, MapPin, CreditCard, Clock, Share2, Download, ChevronRight, Sparkles, Truck, ArrowRight, Store } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Order, Address, VendorProfile } from '../types';
import { formatTZS } from '../constants';
import { OrderTracking } from '../components/CheckoutComponents';
import { fetchVendorProfile } from '../services/shopService';
import { ProductShare } from '../components/ProductShare';

// Animated confetti effect
const ConfettiParticle = ({ delay, x, color }: { delay: number, x: number, color: string }) => (
  <motion.div
    initial={{ y: -20, x, opacity: 1, rotate: 0, scale: 1 }}
    animate={{ y: '110vh', opacity: 0, rotate: 720, scale: 0.3 }}
    transition={{ duration: 3 + Math.random() * 2, delay, ease: 'easeIn' }}
    className="fixed top-0 z-50 w-2 h-3 rounded-sm pointer-events-none"
    style={{ left: `${x}%`, backgroundColor: color }}
  />
);

const Confetti = () => {
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
  const [particles] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
  );
  return (
    <>
      {particles.map(p => <ConfettiParticle key={p.id} x={p.x} delay={p.delay} color={p.color} />)}
    </>
  );
};

export const OrderConfirmationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { orders, user } = useAppState();
  const orderId = location.state?.order?.id || location.state?.id;
  const [showConfetti, setShowConfetti] = useState(true);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, VendorProfile | null>>({});

  // Find the confirmed order from context (loaded via RPC after placing)
  const confirmedOrder = orderId
    ? (orders as any[]).find((o: any) => o.id === orderId) || null
    : (orders as any[])[0] || null;

  // Sellers are per ITEM (orders has no seller_id column) — group the order's
  // items by order_items.seller_id, keeping the seller name/logo the RPC embeds
  // on each item as a fallback if the public profile fetch fails.
  const sellerGroups = useMemo(() => {
    const items = ((confirmedOrder as any)?.items || []) as any[];
    const groups: Record<string, { name: string; logo: string | null; items: any[] }> = {};
    items.forEach(it => {
      const product = it.products || it.product;
      const sid = it.seller_id || product?.seller_id || 'unknown';
      if (!groups[sid]) {
        groups[sid] = {
          name: it.seller?.store_name || product?.seller_name || 'MaliMart Seller',
          logo: it.seller?.logo_url || null,
          items: [],
        };
      }
      groups[sid].items.push(it);
    });
    return groups;
  }, [confirmedOrder]);

  const sellerCount = Object.keys(sellerGroups).length;

  // Enrich with the public vendor profile (store name, logo, region, verified)
  useEffect(() => {
    const ids = Object.keys(sellerGroups).filter(id => id !== 'unknown');
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(ids.map(async id => [id, await fetchVendorProfile(id)] as const))
      .then(entries => { if (!cancelled) setSellerProfiles(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [sellerGroups]);

  useEffect(() => {
    if (!orderId && orders.length === 0) {
      setTimeout(() => navigate('/'), 4000);
    }
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, [orderId, orders, navigate]);

  // Unified share sheet (same popup as product/store shares).
  const [shareOpen, setShareOpen] = useState(false);
  const handleShare = () => setShareOpen(true);

  if (!confirmedOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="w-12 h-12 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto mb-6" />
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-foreground/40">Loading your order...</p>
        </motion.div>
      </div>
    );
  }

  const addr = (confirmedOrder as any).shipping_address as Address | null;
  const userName = user?.user_metadata?.full_name || user?.full_name || user?.name || 'there';

  return (
    <div className="min-h-screen bg-background font-sans" style={{ paddingTop: 'max(72px, env(safe-area-inset-top) + 56px)' }}>
      {showConfetti && <Confetti />}

      <div className="max-w-2xl mx-auto px-4 pb-24 pt-6 md:pt-12">

        {/* ── Success hero ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10"
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.15 }}
            className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30"
          >
            <CheckCircle2 className="w-10 h-10 text-white stroke-[2]" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-2">
              Order Confirmed!
            </h1>
            <p className="text-foreground/50 font-medium mb-3">
              Hey {userName}, your items are on their way.
            </p>
            <div className="inline-flex items-center gap-2 bg-foreground/[0.04] border border-foreground/10 rounded-full px-4 py-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Order ID</span>
              <span className="font-mono font-black text-[11px] text-foreground tracking-wider">#{confirmedOrder.id.slice(0, 8).toUpperCase()}</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── What happens next strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-0 mb-8 overflow-hidden rounded-2xl border border-foreground/8"
        >
          {[
            { icon: CreditCard, label: 'Payment', desc: 'Being verified', color: 'text-blue-500' },
            { icon: Package, label: 'Packing', desc: 'Preparing items', color: 'text-amber-500' },
            { icon: Truck, label: 'Dispatch', desc: 'En route to you', color: 'text-purple-500' },
          ].map((step, i) => (
            <div key={i} className={`flex-1 p-4 text-center border-r last:border-r-0 border-foreground/8 ${i === 0 ? 'bg-emerald-50 dark:bg-emerald-900/10' : ''}`}>
              <step.icon className={`w-5 h-5 mx-auto mb-1.5 ${i === 0 ? 'text-emerald-500' : step.color + ' opacity-40'}`} />
              <p className="text-[9px] font-black uppercase tracking-wider text-foreground">{step.label}</p>
              <p className="text-[8px] text-foreground/40 font-bold mt-0.5">{i === 0 ? 'In Progress' : step.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Order tracking ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-6">
          <div className="bg-background border border-foreground/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-foreground/8 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-foreground/40" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Live Order Progress</p>
            </div>
            <div className="px-5 pb-5">
              <OrderTracking order={confirmedOrder} />
            </div>
          </div>
        </motion.div>

        {/* ── Items & sellers ── */}
        {sellerCount > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mb-6">
            <div className="bg-background border border-foreground/10 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-foreground/8 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Your Items</p>
                {sellerCount > 1 && (
                  <span className="text-[10px] font-black uppercase tracking-wider text-foreground/40">{sellerCount} Sellers</span>
                )}
              </div>

              {Object.entries(sellerGroups).map(([sid, group]) => {
                const profile = sid !== 'unknown' ? sellerProfiles[sid] : null;
                const storeName = profile?.store_name || group.name;
                const logo = profile?.logo_url || group.logo;
                const header = (
                  <>
                    {logo ? (
                      <img src={logo} alt="" className="w-9 h-9 rounded-xl object-cover border border-foreground/10 flex-shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center flex-shrink-0">
                        <Store className="w-4 h-4 text-foreground/40" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-black text-sm text-foreground truncate flex items-center gap-1.5">
                        {storeName}
                        {profile?.is_verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/40">
                        {profile?.region ? `${profile.region} · ` : ''}Sold by this store
                      </p>
                    </div>
                  </>
                );
                return (
                  <div key={sid} className="border-b last:border-b-0 border-foreground/8">
                    {sid !== 'unknown' ? (
                      <Link
                        to={`/store/${sid}`}
                        aria-label={`Visit ${storeName} store`}
                        className="px-5 pt-4 pb-3 flex items-center gap-3 min-h-[44px] hover:bg-foreground/[0.02] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg"
                      >
                        {header}
                      </Link>
                    ) : (
                      <div className="px-5 pt-4 pb-3 flex items-center gap-3">{header}</div>
                    )}
                    <div className="px-5 pb-4 space-y-2">
                      {group.items.map((it: any) => {
                        const product = it.products || it.product;
                        return (
                          <div key={it.id} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-foreground/[0.06] border border-foreground/8 flex-shrink-0">
                              {product?.images?.[0] ? (
                                <img src={product.images[0]} alt={product?.name || 'Product'} className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-4 h-4 text-foreground/25" />
                                </div>
                              )}
                            </div>
                            <p className="flex-1 min-w-0 text-[11px] font-bold text-foreground/70 truncate">
                              {product?.name || 'Item'}
                            </p>
                            <p className="text-[11px] font-black text-foreground/50 tabular-nums whitespace-nowrap">
                              {it.quantity} × {formatTZS(it.price_at_purchase || 0)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Order summary ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mb-6">
          <div className="bg-background border border-foreground/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-foreground/8">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Order Summary</p>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Subtotal', value: formatTZS(confirmedOrder.subtotal || 0) },
                ...(((confirmedOrder as any).vat_amount || 0) > 0
                  ? [{ label: 'VAT', value: formatTZS((confirmedOrder as any).vat_amount) }]
                  : []),
                { label: 'Delivery', value: formatTZS(confirmedOrder.delivery_fee || 0) },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-[11px] font-bold text-foreground/50">
                  <span>{row.label}</span><span className="text-foreground/70">{row.value}</span>
                </div>
              ))}
              {((confirmedOrder as any).discount_amount || 0) > 0 && (
                <div className="flex justify-between text-[11px] font-black text-emerald-500">
                  <span>Discount</span><span>-{formatTZS((confirmedOrder as any).discount_amount)}</span>
                </div>
              )}
              <div className="border-t border-foreground/8 pt-3 flex justify-between items-center">
                {/* Fresh orders start payment_status='unpaid' (payment verified after
                    placement) — only claim "Paid" when the DB says so. */}
                <span className="text-[11px] font-black uppercase tracking-wider text-foreground/60">
                  {(confirmedOrder as any).payment_status === 'paid' ? 'Total Paid' : 'Total'}
                </span>
                <span className="text-xl font-black tracking-tight text-foreground">{formatTZS(confirmedOrder.total)}</span>
              </div>
              {(confirmedOrder as any).payment_status === 'refund_due' && (
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/40 rounded-xl px-3 py-2">
                  <Clock className="w-3.5 h-3.5" /> Refund due — your payment will be returned
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Delivery info ── */}
        {addr && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }} className="mb-6">
            <div className="bg-background border border-foreground/10 rounded-2xl p-5 flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-foreground/40" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-1.5">Shipping To</p>
                <p className="font-black text-sm text-foreground">{addr.label || 'Delivery Address'}</p>
                <p className="text-[11px] text-foreground/60 font-medium mt-0.5">{addr.street}</p>
                <p className="text-[11px] text-foreground/50 font-medium">{addr.city}{addr.postal_code ? `, ${addr.postal_code}` : ''}</p>
                {addr.phone && <p className="text-[11px] font-mono text-foreground/40 mt-0.5">{addr.phone}</p>}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Payment method ── */}
        {confirmedOrder.payment_method && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mb-8">
            <div className="bg-background border border-foreground/10 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-foreground/[0.05] flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-foreground/40" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-1">Payment</p>
                <p className="font-black text-sm text-foreground">{confirmedOrder.payment_method}</p>
                {confirmedOrder.payment_ref && (
                  <p className="text-[10px] font-mono text-foreground/40 mt-0.5">Ref: {confirmedOrder.payment_ref}</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Actions ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }} className="space-y-3">
          <Link to={user?.role === 'buyer' ? '/account?tab=orders' : '/orders'}>
            <motion.button whileTap={{ scale: 0.97 }} className="w-full h-13 bg-foreground text-background rounded-xl text-[10px] font-black uppercase tracking-[0.22em] flex items-center justify-center gap-2 group" style={{ height: '52px' }}>
              <Package className="w-4 h-4 stroke-[2]" />
              Track My Order
              <ArrowRight className="w-4 h-4 stroke-[2] group-hover:translate-x-0.5 transition-transform" />
            </motion.button>
          </Link>

          <div className="flex gap-3">
            <Link to="/shop" className="flex-1">
              <button className="w-full h-11 rounded-xl border border-foreground/12 text-[9px] font-black uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground hover:border-foreground/25 transition-all flex items-center justify-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5" />
                Continue Shopping
              </button>
            </Link>
            <button
              onClick={handleShare}
              className="h-11 px-4 rounded-xl border border-foreground/12 text-foreground/60 hover:text-foreground hover:border-foreground/25 transition-all flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-wider hidden sm:block">Share</span>
            </button>
          </div>

          <p className="text-center text-[9px] font-bold text-foreground/25 uppercase tracking-wider pt-2">
            A confirmation has been recorded • Order #{confirmedOrder.id.slice(0, 8).toUpperCase()}
          </p>
        </motion.div>
      </div>

      <ProductShare
        share={{
          title: 'My MaliMart Order',
          text: `Order #${confirmedOrder.id.slice(0, 8)} placed successfully on MaliMart!`,
          url: window.location.origin,
        }}
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
};
