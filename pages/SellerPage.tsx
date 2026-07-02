import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Package, MessageSquare, Settings,
  Percent, ShoppingBag, RotateCcw, ExternalLink, Store,
  AlertCircle, ChevronRight, Bell, TrendingUp, Zap, X,
  Menu, Shield, Activity, Clock
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useSellerPendingOrders } from '../hooks/useSellerDashboard';
import { SellerDashboard } from '../components/SellerDashboard';
import { SellerInventory } from '../components/SellerInventory';
import { SellerOffers } from '../components/SellerOffers';
import { SellerOrders } from '../components/SellerOrders';
import { MessagingHub } from '../components/messaging/MessagingHub';
import { SellerSettingsPage } from './SellerSettingsPage';
import { SellerReturns } from '../components/SellerReturns';
import { CountBadge } from '../components/UI';
import { supabase } from '../services/supabaseClient';

// ─── Tab definitions ─────────────────────────────────────────────────────────
// One name per tab, used on both desktop sidebar and mobile tab bar.
const TABS = [
  { id: 'dashboard', label: 'Overview',  icon: LayoutGrid,    desc: 'Performance at a glance' },
  { id: 'products',  label: 'Inventory', icon: Package,       desc: 'Manage your products' },
  { id: 'orders',    label: 'Orders',    icon: ShoppingBag,   desc: 'Fulfil & track orders' },
  { id: 'messages',  label: 'Inbox',     icon: MessageSquare, desc: 'Buyer conversations' },
  { id: 'offers',    label: 'Campaigns', icon: Percent,       desc: 'Discounts & promotions' },
  { id: 'returns',   label: 'Returns',   icon: RotateCcw,     desc: 'Disputes & refunds' },
  { id: 'settings',  label: 'Settings',  icon: Settings,      desc: 'Store configuration' },
];

// Shared focus-ring treatment for every interactive element on this page.
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40';

// One place to decide which nav badge a tab shows, and whether it demands action.
const tabBadge = (tabId: string, pending: number, lowStock: number, unread: number): { count: number; urgent: boolean } => {
  if (tabId === 'orders') return { count: pending, urgent: true };
  if (tabId === 'products') return { count: lowStock, urgent: true };
  if (tabId === 'messages') return { count: unread, urgent: false };
  return { count: 0, urgent: false };
};

// ─── Floating alert pill ──────────────────────────────────────────────────────
const AlertPills = ({ pending, lowStock, onOrders, onInventory }: {
  pending: number; lowStock: number; onOrders: () => void; onInventory: () => void;
}) => {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const items = [
    pending > 0 && !dismissed.has('p') && {
      key: 'p', icon: Clock, color: 'bg-amber-500', text: `${pending} order${pending > 1 ? 's' : ''} awaiting confirmation`,
      action: onOrders, label: 'Review'
    },
    lowStock > 0 && !dismissed.has('s') && {
      key: 's', icon: AlertCircle, color: 'bg-rose-500', text: `${lowStock} item${lowStock > 1 ? 's' : ''} running low on stock`,
      action: onInventory, label: 'Restock'
    },
  ].filter(Boolean) as any[];

  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2 mb-6">
      <AnimatePresence>
        {items.map(item => {
          const Icon = item.icon;
          return (
            <motion.div key={item.key}
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, height: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.07] backdrop-blur-sm"
            >
              <span className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center shrink-0`}>
                <Icon className="w-3 h-3 text-white" />
              </span>
              <p className="flex-1 text-xs font-semibold text-foreground/70">{item.text}</p>
              <button onClick={item.action}
                className={`min-h-11 text-[10px] font-black uppercase tracking-widest text-foreground/50 hover:text-foreground px-3 py-1 rounded-xl hover:bg-foreground/[0.05] transition-all ${FOCUS_RING}`}>
                {item.label}
              </button>
              <button onClick={() => setDismissed(p => new Set(p).add(item.key))}
                aria-label="Dismiss alert"
                className={`w-11 h-11 -mr-2 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-colors ${FOCUS_RING}`}>
                <X className="w-3 h-3 text-foreground/30" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// ─── Vertical sidebar nav (desktop) ──────────────────────────────────────────
const SideNav = ({ tab, setTab, tabs, pending, lowStock, storeName, logoUrl, storeHref, unread }: any) => (
  <aside className="hidden lg:flex flex-col w-[220px] shrink-0 sticky top-[80px] self-start max-h-[calc(100vh-100px)] overflow-y-auto pr-2">
    {/* Store identity */}
    <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-2xl bg-foreground/[0.03] border border-foreground/[0.06]">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-foreground/10" />
      ) : (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shrink-0">
          <Store className="w-4 h-4 text-white" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">Store</p>
        <p className="text-xs font-bold text-foreground truncate">{storeName}</p>
      </div>
    </div>

    {/* Nav items */}
    <nav aria-label="Seller dashboard sections" className="flex flex-col gap-0.5">
      {tabs.map((t: any) => {
        const Icon = t.icon;
        const active = tab === t.id;
        const { count, urgent } = tabBadge(t.id, pending, lowStock, unread);
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            aria-current={active ? 'page' : undefined}
            className={`group relative flex items-center gap-3 px-3 py-2.5 min-h-11 rounded-2xl text-left transition-all duration-200 ${FOCUS_RING} ${
              active
                ? 'bg-foreground/[0.06] text-foreground'
                : 'text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04]'
            }`}
          >
            {active && (
              <motion.span layoutId="sidebar-pill"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-emerald-500"
              />
            )}
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              active ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.04] text-foreground/50 group-hover:text-foreground'
            }`}>
              <Icon className="w-3.5 h-3.5" strokeWidth={2} />
            </span>
            <span className="flex-1 text-[11px] font-bold tracking-wide">{t.label}</span>
            <CountBadge count={count} urgent={urgent} />
          </button>
        );
      })}
    </nav>

    {/* Footer links */}
    <div className="mt-auto pt-6 border-t border-foreground/[0.06] flex flex-col gap-1">
      <a href={storeHref} target="_blank" rel="noopener noreferrer"
        className={`flex items-center gap-2.5 px-3 py-2 min-h-11 rounded-2xl text-foreground/40 hover:text-foreground/70 hover:bg-foreground/[0.04] transition-all text-[11px] font-semibold ${FOCUS_RING}`}>
        <ExternalLink className="w-3.5 h-3.5" />
        View storefront
      </a>
      <div className="flex items-center gap-2.5 px-3 py-2 text-foreground/25 text-[10px] font-semibold">
        <Shield className="w-3 h-3" />
        Secured by MaliMart
      </div>
    </div>
  </aside>
);

// ─── Bottom tab bar (mobile) ──────────────────────────────────────────────────
const MobileTabBar = ({ tab, setTab, tabs, pending, lowStock, unread }: any) => {
  const primary = tabs.slice(0, 5);
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]
      bg-background/80 backdrop-blur-2xl border-t border-foreground/[0.08]">
      <nav aria-label="Seller dashboard sections" className="flex">
        {primary.map((t: any) => {
          const Icon = t.icon;
          const active = tab === t.id;
          const { count, urgent } = tabBadge(t.id, pending, lowStock, unread);
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] relative transition-colors ${FOCUS_RING}`}>
              {active && (
                <motion.span layoutId="mobile-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-emerald-500"
                />
              )}
              <span className="relative">
                <Icon className={`w-5 h-5 transition-colors ${active ? 'text-foreground' : 'text-foreground/50'}`}
                  strokeWidth={active ? 2.5 : 1.5} />
                <CountBadge count={count} urgent={urgent} className="absolute -top-2.5 -right-3 scale-[0.8] origin-bottom-left" />
              </span>
              <span className={`text-[10px] font-bold tracking-wide transition-colors ${active ? 'text-foreground' : 'text-foreground/50'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
        {/* More menu */}
        <MobileMore tab={tab} setTab={setTab} tabs={tabs.slice(5)} />
      </div>
    </div>
  );
};

const MobileMore = ({ tab, setTab, tabs }: any) => {
  const [open, setOpen] = useState(false);
  const hasActive = tabs.some((t: any) => t.id === tab);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-3">
        <Menu className={`w-5 h-5 ${hasActive ? 'text-foreground' : 'text-foreground/30'}`} strokeWidth={hasActive ? 2.5 : 1.5} />
        <span className={`text-[9px] font-bold tracking-wide ${hasActive ? 'text-foreground' : 'text-foreground/30'}`}>More</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-foreground/10 rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
              <div className="w-10 h-1 bg-foreground/15 rounded-full mx-auto mt-3 mb-4" />
              <div className="px-4 pb-6 grid grid-cols-3 gap-3">
                {tabs.map((t: any) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button key={t.id} onClick={() => { setTab(t.id); setOpen(false); }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                        active ? 'border-foreground/20 bg-foreground/[0.06]' : 'border-foreground/[0.07] bg-foreground/[0.02]'
                      }`}>
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${t.color}18`, color: t.color }}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <span className="text-[10px] font-bold text-foreground/60">{t.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Page header (mobile, above content) ─────────────────────────────────────
const PageHeader = ({ activeTab, storeName }: { activeTab: any; storeName: string }) => {
  const Icon = activeTab.icon;
  return (
    <motion.div key={activeTab.id}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 mb-6 lg:mb-8">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${activeTab.color}18`, color: activeTab.color }}>
        <Icon className="w-4.5 h-4.5" strokeWidth={2} />
      </span>
      <div>
        <h1 className="text-lg font-black text-foreground tracking-tight leading-none">{activeTab.label}</h1>
        <p className="text-[10px] text-foreground/35 mt-0.5 font-medium">{activeTab.desc}</p>
      </div>
    </motion.div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export const SellerPage = () => {
  const { user, products, refreshProducts, vendorProfile: contextVendor } = useAppState();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<string>(searchParams.get('tab') || 'dashboard');
  const [preselectedProduct, setPreselectedProduct] = useState<any>(null);
  const [selectedChatUser, setSelectedChatUser] = useState<string | null>(searchParams.get('chat'));
  const [selectedProductId, setSelectedProductId] = useState<string | null>(searchParams.get('productId'));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get('orderId'));
  // Same query key as the dashboard's pending panel — every "pending" badge on
  // this page and inside SellerDashboard reads one shared TanStack cache entry.
  const { data: livePending = [] } = useSellerPendingOrders(user?.id);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [tab]);

  const myProducts = products.filter(p => p.seller_id === user?.id);
  const lowStock = myProducts.filter(p => typeof p.stock === 'number' && p.stock > 0 && p.stock <= 5).length;
  const pendingOrders = livePending.length;

  const switchToMessages = (buyerId: string, productId?: string | null, orderId?: string | null) => {
    setTab('messages');
    setSelectedChatUser(buyerId);
    setSelectedProductId(productId || null);
    setSelectedOrderId(orderId || null);
  };

  const activeTab = TABS.find(t => t.id === tab) || TABS[0];

  if (!user || user.role !== 'seller') return null;

  const storeName = contextVendor?.store_name || user.name;
  // Prefer a clean first name for the greeting (display_name → first word of full name → fallback to store handle)
  const displayFirstName = (user as any).display_name?.split(' ')[0]
    || user.name?.split(' ')[0]?.replace(/_/g, ' ')
    || storeName.split(' ')[0];
  const storeHref = `/store/${user.id}`;

  return (
    <div className="min-h-screen bg-background font-sans
      pb-[calc(5.5rem+env(safe-area-inset-bottom))]
      lg:pb-8 pt-[72px] lg:pt-[80px]">

      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex gap-8 pt-6">

          {/* Desktop sidebar */}
          <SideNav
            tab={tab} setTab={setTab} tabs={TABS}
            pending={pendingOrders} lowStock={lowStock}
            storeName={storeName} logoUrl={contextVendor?.logo_url}
            storeHref={storeHref} unread={0}
          />

          {/* Main content */}
          <main className="flex-1 min-w-0">

            {/* Mobile header */}
            <div className="lg:hidden">
              <PageHeader activeTab={activeTab} storeName={storeName} />
            </div>

            {/* Desktop header — store banner + active section */}
            <div className="hidden lg:flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${activeTab.color}15`, color: activeTab.color }}>
                  <activeTab.icon className="w-4 h-4" strokeWidth={2} />
                </span>
                <div>
                  <h1 className="text-xl font-black text-foreground tracking-tight leading-none">{activeTab.label}</h1>
                  <p className="text-[10px] text-foreground/35 mt-0.5 font-medium">{activeTab.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pendingOrders > 0 && (
                  <button onClick={() => setTab('orders')}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase tracking-wide hover:bg-amber-500/15 transition-colors">
                    <Clock className="w-3 h-3" /> {pendingOrders} pending
                  </button>
                )}
                {lowStock > 0 && (
                  <button onClick={() => setTab('products')}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-black uppercase tracking-wide hover:bg-rose-500/15 transition-colors">
                    <AlertCircle className="w-3 h-3" /> {lowStock} low stock
                  </button>
                )}
                <a href={storeHref} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-foreground/[0.05] text-foreground/50 text-[10px] font-black uppercase tracking-wide hover:bg-foreground/[0.09] hover:text-foreground transition-all">
                  <ExternalLink className="w-3 h-3" /> Storefront
                </a>
              </div>
            </div>

            {/* Alert pills — mobile only (desktop header shows the same chips),
                and never on the dashboard tab, which renders its own richer
                AlertBanner + pending-orders action panel. */}
            {tab !== 'dashboard' && (
              <div className="lg:hidden">
                <AlertPills
                  pending={pendingOrders} lowStock={lowStock}
                  onOrders={() => setTab('orders')} onInventory={() => setTab('products')}
                />
              </div>
            )}

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.32, 0, 0.67, 0] }}>

                {tab === 'dashboard' && (
                  <SellerDashboard
                    sellerId={user.id}
                    sellerName={displayFirstName}
                    vendorLogoUrl={contextVendor?.logo_url}
                    lowStockCount={lowStock}
                    onGoOrders={() => setTab('orders')}
                    onGoInventory={() => setTab('products')}
                    onGoReturns={() => setTab('returns')}
                    onGoMessages={() => setTab('messages')}
                    onGoPromotions={() => setTab('offers')}
                    onConfirmOrder={async (orderId) => {
                      await supabase.rpc('update_order_status_rbac', { p_order_id: orderId, p_new_status: 'processing', p_cancel_reason: null });
                    }}
                    onCancelOrder={async (orderId, reason) => {
                      await supabase.rpc('update_order_status_rbac', { p_order_id: orderId, p_new_status: 'cancelled', p_cancel_reason: reason });
                    }}
                  />
                )}

                {tab === 'products' && (
                  <SellerInventory products={myProducts} userId={user.id} refresh={refreshProducts}
                    onCreatePromo={(p) => { setPreselectedProduct(p); setTab('offers'); }} />
                )}

                {tab === 'orders' && (
                  <SellerOrders sellerId={user.id} onContactBuyer={switchToMessages} />
                )}

                {tab === 'messages' && (
                  <MessagingHub userId={user.id} selectedChatUser={selectedChatUser}
                    setSelectedChatUser={setSelectedChatUser} products={products}
                    initialProductId={selectedProductId} initialOrderId={selectedOrderId}
                    initialChatUser={selectedChatUser} />
                )}

                {tab === 'offers' && (
                  <SellerOffers sellerId={user.id} preselectedProduct={preselectedProduct} />
                )}

                {tab === 'returns' && (
                  <SellerReturns userId={user.id}
                    onContactBuyer={(buyerId, productId, orderId) => switchToMessages(buyerId, productId, orderId)} />
                )}

                {tab === 'settings' && <SellerSettingsPage onBack={() => setTab('dashboard')} />}

              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileTabBar
        tab={tab} setTab={setTab} tabs={TABS}
        pending={pendingOrders} lowStock={lowStock} unread={0}
      />
    </div>
  );
};
