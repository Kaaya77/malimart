
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { withCache, invalidate, invalidatePrefix, loadPersisted, TTL } from '../services/queryCache';
import { applyTheme } from '../services/theme';
import {
    requestMyAccountDeletion, touchPresence,
    markNotificationRead as apiMarkNotificationRead,
    markAllNotificationsRead as apiMarkAllNotificationsRead,
    deleteNotifications as apiDeleteNotifications,
    deleteAllNotifications as apiDeleteAllNotifications,
} from '../services/accountApi';
import { usePresence } from '../hooks/usePresence';
import { Product, CartItem, User, Order, Notification, VendorProfile, Address, ProductVariant, Offer, Category, Payment, Shipment, TrustBadge, ReturnRequest, OrderNote, ActivityLog, WalletTransaction, SocialPost, SocialInteraction, Follower, Review } from '../types';
import { useToast } from '../components/UI';

interface AppContextType {
    user: User | null;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    isLoading: boolean;
    products: Product[];
    categories: Category[];
    cart: CartItem[];
    wishlist: Product[];
    recentlyViewed: Product[];
    orders: Order[];
    notifications: Notification[];
    unreadMessages: number;
    addresses: Address[];
    walletTransactions: WalletTransaction[];
    activityLogs: ActivityLog[];
    offers: Offer[];
    payments: Payment[];
    shipments: Shipment[];
    trustBadges: TrustBadge[];
    socialPosts: SocialPost[];
    followers: Follower[];
    paymentMethods: any[];
    connectedAccounts: any[];
    loginHistory: any[];
    staffAccounts: any[];
    shippingZones: any[];
    isDark: boolean;
    vendorProfile: VendorProfile | null;
    isCartOpen: boolean;
    blockedUsers: Set<string>;
    
    // Actions
    toggleTheme: () => void;
    blockUser: (userId: string) => void;
    unblockUser: (userId: string) => void;
    logout: () => Promise<void>;
    addToCart: (product: Product, variant?: ProductVariant, quantity?: number) => Promise<void>;
    removeFromCart: (productId: string, variantId?: string) => Promise<void>;
    updateQuantity: (productId: string, delta: number, variantId?: string) => Promise<void>;
    clearCart: () => Promise<void>;
    openCart: () => void;
    closeCart: () => void;
    toggleWishlist: (product: Product) => void;
    isInWishlist: (productId: string) => boolean;
    followSeller: (sellerId: string) => Promise<void>;
    unfollowSeller: (sellerId: string) => Promise<void>;
    isFollowing: (sellerId: string) => boolean;
    catalogError: string | null;
    refreshProducts: () => Promise<void>;
    refreshNotifications: () => Promise<void>;
    refreshWishlist: () => Promise<void>;
    refreshCart: () => Promise<void>;
    placeOrder: (details: any) => Promise<any>;
    updateOrderStatus: (orderId: string, status: string, reason?: string) => Promise<void>;
    cancelOrder: (orderId: string, reason: string) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    fetchVendorProfile: (sellerId: string) => Promise<VendorProfile | null>;
    addToRecentlyViewed: (product: Product) => void;
    addReview: (productId: string, rating: number, comment: string, images?: string[]) => Promise<void>;
    fetchReviews: (productId: string) => Promise<Review[]>;
    addAddress: (address: Partial<Address>) => Promise<void>;
    deleteAddress: (id: string) => Promise<void>;
    updateAddress: (id: string, address: Partial<Address>) => Promise<void>;
    updateUserProfile: (data: Partial<User>) => Promise<void>;
    deleteAccount: () => Promise<void>;
    /**
     * The unread badge only. Reading, sending, deleting and reacting to
     * messages now live in services/messagesService.ts + hooks/useMessaging.ts.
     * This context used to expose a fetchMessages() that pulled the user's
     * ENTIRE message history, and three inboxes called it on every event.
     */
    refreshUnreadMessages: () => Promise<void>;
    reportUser: (reportedId: string, reason: string, details?: string) => Promise<void>;
    markNotificationRead: (id: string) => Promise<void>;
    markAllNotificationsRead: () => Promise<void>;
    dismissNotification: (id: string) => Promise<void>;
    deleteAllNotifications: () => Promise<void>;
    getActiveOfferForProduct: (productId: string) => Offer | null;
    logActivity: (action: string, details?: string, metadata?: any) => Promise<void>;
    notify: (title: string, message: string, type?: 'info' | 'success' | 'error', link?: string) => Promise<void>;
    requestReturn: (orderId: string, itemId: string, reason: string) => Promise<void>;
    addOrderNote: (orderId: string, note: string, visibility: 'seller' | 'admin' | 'internal') => Promise<void>;
    fetchOrderDetails: (orderId: string) => Promise<{ payments: Payment[], shipments: Shipment[], notes: OrderNote[] }>;
    interactWithPost: (postId: string, type: SocialInteraction['type'], comment?: string) => Promise<void>;
    updateVendorProfile: (data: Partial<VendorProfile>) => Promise<void>;
    // Preloaded per-role data (loaded eagerly on login, background-refreshed)
    sellerInventory: any[];
    sellerOrders: any[];
    sellerOffers: any[];
    sellerStats: any | null;
    buyerReturns: any[];
    refreshSellerData: () => Promise<void>;
    refreshBuyerReturns: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ============================================================
// Slice types — AppContextType is the union of all four, so the
// legacy merged context stays type-identical.
// ============================================================
type AuthSlice = Pick<AppContextType,
    'user' | 'setUser' | 'isLoading' | 'isDark' | 'vendorProfile' | 'addresses' | 'walletTransactions' |
    'activityLogs' | 'paymentMethods' | 'connectedAccounts' | 'loginHistory' | 'staffAccounts' |
    'shippingZones' | 'blockedUsers' | 'toggleTheme' | 'blockUser' | 'unblockUser' | 'logout' |
    'updateUserProfile' | 'deleteAccount' | 'addAddress' | 'deleteAddress' | 'updateAddress' |
    'fetchVendorProfile' | 'updateVendorProfile' | 'logActivity'>;

type CatalogSlice = Pick<AppContextType,
    'products' | 'categories' | 'offers' | 'trustBadges' | 'socialPosts' | 'followers' |
    'recentlyViewed' | 'wishlist' | 'catalogError' | 'toggleWishlist' | 'isInWishlist' | 'followSeller' |
    'unfollowSeller' | 'isFollowing' | 'refreshProducts' | 'addToRecentlyViewed' | 'addReview' |
    'fetchReviews' | 'getActiveOfferForProduct' | 'interactWithPost' | 'refreshWishlist'>;

type CartSlice = Pick<AppContextType,
    'cart' | 'isCartOpen' | 'orders' | 'payments' | 'shipments' | 'buyerReturns' |
    'addToCart' | 'removeFromCart' | 'updateQuantity' | 'clearCart' | 'openCart' | 'closeCart' |
    'placeOrder' | 'updateOrderStatus' | 'cancelOrder' | 'deleteOrder' | 'requestReturn' |
    'addOrderNote' | 'fetchOrderDetails' | 'refreshCart' | 'refreshBuyerReturns'>;

type CommsSlice = Pick<AppContextType,
    'notifications' | 'unreadMessages' | 'sellerInventory' | 'sellerOrders' |
    'sellerOffers' | 'sellerStats' | 'notify' | 'refreshUnreadMessages' | 'reportUser' |
    'markNotificationRead' | 'markAllNotificationsRead' | 'dismissNotification' | 'deleteAllNotifications' |
    'refreshNotifications' | 'refreshSellerData'>;

const AuthContext = createContext<AuthSlice | undefined>(undefined);
const CatalogContext = createContext<CatalogSlice | undefined>(undefined);
const CartContext = createContext<CartSlice | undefined>(undefined);
const CommsContext = createContext<CommsSlice | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Seller presence beacon — while a seller's app is open, broadcast presence on
    // their store topic so buyers see a live "online" badge on the storefront.
    usePresence({
        topic: user?.role === 'seller' && user?.id ? `store:${user.id}` : null,
        key: user?.id || 'anon',
        meta: { role: 'seller' },
    });
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const stored = localStorage.getItem('mali_guest_cart');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    const [wishlist, setWishlist] = useState<Product[]>(() => {
        try {
            const stored = localStorage.getItem('mali_guest_wishlist');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });
    const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const cartIdRef = React.useRef<string | null>(null);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [offers, setOffers] = useState<Offer[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [trustBadges, setTrustBadges] = useState<TrustBadge[]>([]);
    const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
    const [followers, setFollowers] = useState<Follower[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
    const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
    const [loginHistory, setLoginHistory] = useState<any[]>([]);
    const [staffAccounts, setStaffAccounts] = useState<any[]>([]);
    const [shippingZones, setShippingZones] = useState<any[]>([]);
    // Preloaded per-role data
    const [sellerInventory, setSellerInventory] = useState<any[]>([]);
    const [sellerOrders, setSellerOrders] = useState<any[]>([]);
    const [sellerOffers, setSellerOffers] = useState<any[]>([]);
    const [sellerStats, setSellerStats] = useState<any | null>(null);
    const [buyerReturns, setBuyerReturns] = useState<any[]>([]);

    const [isDark, setIsDark] = useState(false);
    const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
    const { addToast } = useToast();

    const openCart = useCallback(() => setIsCartOpen(true), []);
    const closeCart = useCallback(() => setIsCartOpen(false), []);

    // Helper for notifications
    const notify = useCallback(async (title: string, message: string, type: 'info' | 'success' | 'error' = 'info', link?: string) => {
        addToast(message, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
        if (user) {
            await supabase.from('notifications').insert({
                user_id: user.id,
                type: type === 'error' ? 'system' : 'order',
                title,
                message,
                read: false,
                link,
                created_at: new Date().toISOString()
            });
        }
    }, [user, addToast]);

    // Handle Theme Initialization
    useEffect(() => {
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);
    // After applyTheme() runs on login, re-sync the local isDark flag to the
    // resolved mode (covers theme_mode: 'system' and cross-device changes).
    useEffect(() => {
        if (user) setIsDark(document.documentElement.classList.contains('dark'));
    }, [user]);

    const toggleTheme = useCallback(() => {
        const newMode = !isDark;
        setIsDark(newMode);
        if (newMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    // Persist guest cart to localStorage so it survives Supabase auth events and re-mounts.
    // Cleared when a user logs in (server cart takes over).
    useEffect(() => {
        if (!user) {
            try { localStorage.setItem('mali_guest_cart', JSON.stringify(cart)); } catch {}
        }
    }, [cart, user]);

    // Persist guest wishlist to localStorage — same pattern as cart.
    useEffect(() => {
        if (!user) {
            try { localStorage.setItem('mali_guest_wishlist', JSON.stringify(wishlist)); } catch {}
        }
    }, [wishlist, user]);

    useEffect(() => {
        // Fetch (or create) the profile row for a session, with one retry and a
        // session-metadata fallback. A transient network/SW hiccup on the profile
        // SELECT must never leave `user` null — RouteGuard would bounce a fully
        // authenticated session to /login the moment isLoading clears.
        const resolveProfile = async (sessionUser: any): Promise<any | null> => {
            for (let attempt = 0; attempt < 2; attempt++) {
                const { data: profile, error: pErr } = await supabase
                    .from('profiles').select('*').eq('id', sessionUser.id).single();
                if (profile) return profile;
                if (pErr && pErr.code === 'PGRST116') {
                    const { data: np } = await supabase.from('profiles').insert({
                        id: sessionUser.id,
                        full_name: sessionUser.user_metadata.full_name || 'User',
                        role: sessionUser.user_metadata.role || 'buyer',
                        email: sessionUser.email
                    }).select().single();
                    return np;
                }
                // Transient failure — brief backoff, then retry once
                if (attempt === 0) await new Promise(r => setTimeout(r, 800));
            }
            // Both attempts failed: keep the user signed in with a minimal profile
            // from session metadata. RLS remains authoritative server-side; the
            // profiles realtime subscription hydrates the full row when it recovers.
            console.warn('[auth] profile fetch failed — using session metadata fallback');
            return {
                id: sessionUser.id,
                full_name: sessionUser.user_metadata.full_name || 'User',
                role: sessionUser.user_metadata.role || 'buyer',
                email: sessionUser.email,
            };
        };

        // Shared hydration path for init() and SIGNED_IN
        const hydrateSession = async (session: any, eager: boolean) => {
            const profile = await resolveProfile(session.user);
            if (!profile) return;
            setUser({ ...profile, name: profile.full_name || 'User', email: session.user.email } as User);
            applyTheme(profile as any); // saved theme_mode/accent/motion/contrast follow the user
            void touchPresence().catch(() => {});
            // 🚀 Single RPC for ALL user data (+ public data on init) in parallel
            await Promise.all([
                applyDashboardRpc(session.user.email || '', profile),
                eager ? fetchPublicData() : Promise.resolve(),
            ]);
            // 🚀 Eager role-specific preload — data ready before user navigates
            if (profile.role === 'seller') {
                fetchSellerData(profile.id);
            } else if (profile.role === 'buyer') {
                fetchBuyerReturns(profile.id);
                if (!eager) fetchUnreadMessagesCount(session.user.id);
            }
        };

        const init = async () => {
            initRunningRef.current = true;
            setIsLoading(true);
            // Guarantee isLoading is cleared even if a Supabase call hangs forever
            const loadingTimer = setTimeout(() => { initRunningRef.current = false; setIsLoading(false); }, 12_000);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    await hydrateSession(session, true);
                } else {
                    try { await fetchPublicData(); } catch(e) { console.error('fetchPublicData:', e); }
                }
            } catch (e) {
                console.error('[init] Uncaught error:', e);
            } finally {
                clearTimeout(loadingTimer);
                initRunningRef.current = false;
                setIsLoading(false);
            }
        };
        init();

        // DEADLOCK GUARD: supabase-js dispatches onAuthStateChange while holding its
        // internal auth lock. Any awaited supabase call inside the callback needs
        // getSession() → the same lock → every request in the app hangs until the
        // lock times out. Keep the callback synchronous and defer real work to a
        // macrotask so the lock is released first.
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                setTimeout(() => { hydrateSession(session, false); }, 0);
            } else if (event === 'SIGNED_OUT') {
                // Skip SIGNED_OUT while init() is resolving — a Supabase token refresh
                // can fire SIGNED_OUT then SIGNED_IN in quick succession; acting on the
                // intermediate SIGNED_OUT would bounce an authenticated user to /login.
                if (initRunningRef.current) return;
                // Skip spurious SIGNED_OUT for guests who were never signed in —
                // Supabase fires this event on session expiry probes even with no active user,
                // which was clearing the in-memory guest cart on navigation.
                // (Read via ref: this closure runs with [] deps, `user` is frozen at null.)
                if (!userRef.current) return;
                setUser(null);
                setCart([]);
                setWishlist([]);
                setOrders([]);
                setNotifications([]);
            }
        });

        return () => { authListener.subscription.unsubscribe(); };
    }, []);

 useEffect(() => {
        if (!user) return;

        // ── ONE channel per user (was 6) ─────────────────────────────────────
        // Supabase allows many postgres_changes listeners on a single channel.
        // Collapsing 6 → 1 cuts realtime connections (and their egress/overhead)
        // by 6× per signed-in user. Every binding below is unchanged in behavior.
        let channel = supabase
            .channel(`user:${user.id}`)
            // Profile — keeps user state in sync; also how an unban propagates live
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, async () => {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profile) setUser({ ...user, ...profile, name: profile.full_name || 'User' } as User);
            });

        // Banned users only need the profile subscription (to detect an unban).
        if (!user.is_banned) {
            channel = channel
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
                    const newNotif = payload.new as Notification;
                    setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== newNotif.id)]);
                    addToast(newNotif.title || 'New Notification', 'info');
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
                    setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n));
                })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
                    setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, () => fetchAndSetOrders(user.id))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist_items', filter: `user_id=eq.${user.id}` }, () => fetchAndSetWishlist(user.id))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'carts', filter: `user_id=eq.${user.id}` }, () => fetchAndSetCart(user.id))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => fetchUnreadMessagesCount(user.id));
        }

        channel.subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user]);

    // ─── ONE-SHOT DASHBOARD HYDRATION ────────────────────────────────────────
    // Replaces 10+ sequential queries with a single SECURITY DEFINER RPC.
    // Returns all user data in one round trip: orders, cart, wishlist, addresses,
    // notifications, wallet, activity, payment methods, vendor profile (sellers),
    // admin stats (admins). Called on init and every sign-in.
    // Ref to fetchUserData — prevents TDZ when applyDashboardRpc is minified
    const fetchUserDataRef = React.useRef<any>(null);
    // Guards onAuthStateChange: while init() is in flight, ignore SIGNED_OUT
    // events so a mid-load token refresh doesn't bounce authenticated users to /login.
    const initRunningRef = React.useRef(true);
    // Live mirror of `user` for the auth listener — its effect runs with [] deps,
    // so reading `user` directly there would always see the initial null.
    const userRef = React.useRef<User | null>(null);
    useEffect(() => { userRef.current = user; }, [user]);

        const applyDashboardRpc = useCallback(async (email: string, profile: any) => {
        try {
            const { data, error } = await supabase.rpc('get_dashboard_data');
            if (error) {
                console.error('[applyDashboardRpc] RPC failed, falling back:', error.message);
                // Fallback to old fetchUserData if RPC fails
                // fetchUserData called via ref to avoid TDZ (applyDashboardRpc defined before fetchUserData)
            if (fetchUserDataRef.current) await fetchUserDataRef.current(profile.id, profile.role, profile.is_banned);
                return;
            }
            if (!data) return;

            // Hydrate all user state from single RPC response
            if (data.addresses)         setAddresses(data.addresses);
            if (data.notifications)     setNotifications(data.notifications);
            if (data.wallet_transactions) setWalletTransactions(data.wallet_transactions);
            if (data.activity_logs)     setActivityLogs(data.activity_logs);
            if (data.payment_methods)   setPaymentMethods(data.payment_methods);
            if (data.connected_accounts) setConnectedAccounts(data.connected_accounts);
            if (data.login_history)     setLoginHistory(data.login_history);
            if (data.blocked_user_ids)  setBlockedUsers(new Set(data.blocked_user_ids));
            if (data.followers)         setFollowers(data.followers);
            if (typeof data.unread_messages_count === 'number') setUnreadMessages(data.unread_messages_count);

            // Orders — RPC returns them with embedded items
            if (data.orders)            setOrders(data.orders);

            // Wishlist — RPC returns product objects directly
            if (data.wishlist)          setWishlist(data.wishlist);

            // Cart — map to CartItem shape
            if (data.cart) {
                const cartItems = data.cart.map((ci: any) => ({
                    ...ci.product,
                    quantity: ci.quantity,
                    variant_id: ci.variant_id,
                    cart_item_id: ci.cart_item_id,
                    price_at_add: ci.price_at_add,
                    selectedVariant: ci.product?.variants?.find((v: any) => v.id === ci.variant_id),
                }));
                setCart(cartItems);
            }

            // Seller-specific data
            if (profile.role === 'seller') {
                if (data.vendor_profile)   setVendorProfile(data.vendor_profile);
                if (data.staff_accounts)   setStaffAccounts(data.staff_accounts);
                if (data.shipping_zones)   setShippingZones(data.shipping_zones);
            }
        } catch (err: any) {
            console.error('[applyDashboardRpc] Unexpected error:', err.message);
            // fetchUserData called via ref to avoid TDZ (applyDashboardRpc defined before fetchUserData)
            if (fetchUserDataRef.current) await fetchUserDataRef.current(profile.id, profile.role, profile.is_banned);
        }
    }, []);  // fetchUserData accessed via ref — no TDZ

    const fetchPublicData = useCallback(async () => {
        // All public queries use stale-while-revalidate:
        // → serve cached data instantly, revalidate in background after TTL.
        // This eliminates repeated egress for data that rarely changes.

        const [cats, offers_, badges, posts, products_] = await Promise.all([
            withCache('public:categories', TTL.CATEGORIES,
                async () => {
                    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true }).limit(50);
                    return data;
                },
                (data) => setCategories(data as Category[])
            ),
            withCache('public:offers', TTL.OFFERS,
                async () => {
                    const now = new Date().toISOString();
                    const { data } = await supabase.from('offers').select('*').eq('status', 'active')
                        .lte('start_date', now).or(`end_date.is.null,end_date.gte.${now}`).limit(20);
                    return data;
                },
                (data) => setOffers(data as Offer[])
            ),
            withCache('public:trust_badges', TTL.TRUST_BADGES,
                async () => {
                    const { data } = await supabase.from('trust_badges').select('*').limit(50);
                    return data;
                },
                (data) => setTrustBadges(data)
            ),
            withCache('public:social_posts', TTL.SOCIAL_POSTS,
                async () => {
                    const { data } = await supabase.from('social_posts')
                        .select('*, user:profiles!user_id(full_name, avatar_url)')
                        .eq('status', 'approved').is('is_shadowbanned', false)
                        .order('created_at', { ascending: false }).limit(20);
                    return data;
                },
                (data) => setSocialPosts(data as any)
            ),
            withCache('public:products', TTL.PUBLIC_PRODUCTS,
                async () => {
                    const { data, error } = await supabase.rpc('get_public_products', { p_limit: 60 });
                    if (error) { console.error('Error fetching products:', error); return null; }
                    const rows = (data as any[]) ?? [];
                    // Batch-enrich seller store names so every product card
                    // shows the real store name instead of the generic "Store" fallback.
                    const sellerIds = [...new Set(rows.map((p: any) => p.seller_id).filter(Boolean))];
                    if (sellerIds.length > 0) {
                        const { data: vendors } = await supabase
                            .from('public_vendor_profiles')
                            .select('seller_id, store_name, is_verified, region')
                            .in('seller_id', sellerIds);
                        if (vendors) {
                            const vmap = Object.fromEntries((vendors as any[]).map((v: any) => [v.seller_id, v]));
                            return rows.map((p: any) => ({
                                ...p,
                                seller_name: vmap[p.seller_id]?.store_name || p.seller_name || '',
                                is_verified: vmap[p.seller_id]?.is_verified ?? p.is_verified,
                                // Seller region — Mali's store list surfaces this; without it
                                // every store showed regionless.
                                seller_region: vmap[p.seller_id]?.region || p.location || '',
                            }));
                        }
                    }
                    return rows;
                },
                (data) => { setProducts(data as any); setCatalogError(null); }
            ),
        ]);

        if (cats)     setCategories(cats as Category[]);
        if (offers_)  setOffers(offers_ as Offer[]);
        if (badges)   setTrustBadges(badges);
        if (posts)    setSocialPosts(posts as any);
        if (products_ && Array.isArray(products_)) {
            setProducts(products_ as any);
            setCatalogError(null);
        } else if (products_ === null) {
            // Backend unreachable on a cold load — fall back to the last durable
            // copy so the catalog isn't a dead screen. Only surface the hard
            // error when we have nothing at all to show.
            const persisted = loadPersisted<any[]>('public:products');
            if (Array.isArray(persisted) && persisted.length > 0) {
                setProducts(prev => (prev && prev.length > 0 ? prev : persisted));
                setCatalogError(null);
            } else {
                setCatalogError('Could not load products. Check your connection and try again.');
            }
        }
    }, []);


    const fetchAndSetOrders = useCallback(async (userId: string, limit = 50, offset = 0, bust = false) => {
        const cacheKey = `buyer:orders:${userId}:${limit}:${offset}`;
        if (bust) invalidate(cacheKey);
        const data = await withCache(cacheKey, 30_000, async () => {
            const { data: d, error } = await supabase
                .rpc('get_buyer_orders', { p_user_id: userId, p_limit: limit, p_offset: offset });
            if (error) { console.error('[Orders fetch]', error.message); return null; }
            return d;
        });
        if (data) {
            if (offset === 0) {
                setOrders((data as any[]) || []);
            } else {
                setOrders(prev => [...prev, ...((data as any[]) || [])]);
            }
        }
    }, []);

    const fetchAndSetWishlist = useCallback(async (userId: string) => {
        // MERGE, don't discard. Saving while signed out toasts "sign in to keep
        // it across devices", but this used to just delete the guest wishlist,
        // so the promise was never kept. Adopt the guest items into the account
        // first, then read the server list back.
        let guest: any[] = [];
        try { guest = JSON.parse(localStorage.getItem('mali_guest_wishlist') || '[]'); } catch {}

        if (guest.length) {
            const ids = Array.from(new Set(guest.map((p: any) => p?.id).filter(Boolean)));
            if (ids.length) {
                // Re-activate anything previously removed, then insert the rest.
                // ignoreDuplicates keeps this safe if the row already exists.
                await supabase.from('wishlist_items')
                    .update({ deleted_at: null })
                    .eq('user_id', userId)
                    .in('product_id', ids);
                await supabase.from('wishlist_items')
                    .upsert(
                        ids.map(pid => ({ user_id: userId, product_id: pid })),
                        { onConflict: 'user_id,product_id', ignoreDuplicates: true }
                    );
            }
        }
        try { localStorage.removeItem('mali_guest_wishlist'); } catch {}

        const { data } = await supabase.from('wishlist_items').select('product:products(*)').eq('user_id', userId).is('deleted_at', null);
        if (data) setWishlist(data.map((w: any) => w.product).filter(Boolean));
    }, []);

    const fetchAndSetCart = useCallback(async (userId: string) => {
        // Same problem as the wishlist, with money attached: a signed-out
        // shopper who filled a bag lost the whole thing on sign-in. Merge the
        // guest cart into the server cart before reading it back.
        let guestCart: any[] = [];
        try { guestCart = JSON.parse(localStorage.getItem('mali_guest_cart') || '[]'); } catch {}

        for (const item of guestCart) {
            if (!item?.id) continue;
            try {
                // upsert_cart_item get-or-creates the cart and merges quantities,
                // so re-adding an item the account already has is safe.
                await supabase.rpc('upsert_cart_item', {
                    p_product_id: item.id,
                    p_variant_id: item.variant_id ?? item.selectedVariant?.id ?? null,
                    p_quantity:   Math.max(1, Number(item.quantity) || 1),
                    p_price:      item.price_at_add ?? item.price ?? 0,
                });
            } catch { /* one bad line must not block sign-in */ }
        }
        try { localStorage.removeItem('mali_guest_cart'); } catch {}
        const { data: cartData } = await supabase.from('carts').select('id, items:cart_items(*, product:products(id, name, price, images, stock, seller_id, variants:product_variants(*)))').eq('user_id', userId).single();
        if (cartData) {
            cartIdRef.current = cartData.id;
            if (cartData.items) {
                const dbCart = cartData.items.map((item: any) => ({
                    ...item.product,
                    quantity: item.quantity,
                    selectedVariant: item.product?.variants?.find((v: any) => v.id === item.variant_id),
                    variant_id: item.variant_id,
                    price_at_add: item.price_at_add,
                }));
                setCart(dbCart);
            } else {
                setCart([]);
            }
        } else {
            setCart([]);
        }
    }, []);

    // Deliberately narrow: the badge is the ONLY message data this context
    // still owns. Deleted messages must not keep a badge lit forever, which
    // they did — nothing filtered deleted_at, and read receipts never
    // persisted (the UPDATE was blocked by RLS), so the count only ever grew.
    const fetchUnreadMessagesCount = useCallback(async (userId: string) => {
        const { count, error } = await supabase.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('read', false)
            .is('deleted_at', null)
            .is('receiver_deleted_at', null);
        
        if (!error && count !== null) {
            setUnreadMessages(count);
        }
    }, []);

    // ─── EAGER PRELOADERS ────────────────────────────────────────────────────────
    // Loaded immediately on login. Components read from context — no per-mount fetch.
    // Background-refreshed every 60s while the tab is open.

    const fetchSellerData = useCallback(async (userId: string, bust = false) => {
        await Promise.allSettled([
            (async () => {
                try {
                    const invKey = `seller:inventory:${userId}:0:All::false:created_at:false`;
                    if (bust) invalidate(invKey);
                    const invData = await withCache(invKey, 60_000, async () => {
                        const { data, error } = await supabase.rpc('get_seller_inventory', {
                            p_seller_id: userId, p_limit: 50, p_offset: 0,
                            p_status: null, p_search: null, p_low_stock_only: false, p_sort: 'created_desc',
                        });
                        if (error) throw error;
                        return data;
                    });
                    if (invData?.products) setSellerInventory(invData.products);
                } catch (e: any) { console.error('[fetchSellerData:inventory]', e?.message); }
            })(),
            (async () => {
                try {
                    const ordKey = `seller:orders:${userId}`;
                    if (bust) invalidate(ordKey);
                    const ordData = await withCache(ordKey, 30_000, async () => {
                        const { data, error } = await supabase.rpc('get_seller_orders', {
                            p_seller_id: userId, p_limit: 50, p_offset: 0,
                        });
                        if (error) {
                            if (error.message?.includes('timeout') || error.code === '57014') {
                                const { data: d2, error: e2 } = await supabase.rpc('get_seller_orders', {
                                    p_seller_id: userId, p_limit: 20, p_offset: 0,
                                });
                                if (!e2) return d2;
                            }
                            throw error;
                        }
                        return data;
                    });
                    if (ordData) setSellerOrders(ordData);
                } catch (e: any) { console.error('[fetchSellerData:orders]', e?.message); }
            })(),
            (async () => {
                try {
                    const offKey = `seller:offers:${userId}`;
                    if (bust) invalidate(offKey);
                    const offData = await withCache(offKey, 60_000, async () => {
                        const { data, error } = await supabase.from('offers')
                            .select('*').eq('seller_id', userId).order('created_at', { ascending: false });
                        if (error) throw error;
                        return data;
                    });
                    if (offData) setSellerOffers(offData);
                } catch (e: any) { console.error('[fetchSellerData:offers]', e?.message); }
            })(),
            (async () => {
                try {
                    const statsKey = `seller:stats:${userId}`;
                    if (bust) invalidate(statsKey);
                    const statsData = await withCache(statsKey, 3 * 60_000, async () => {
                        const { data, error } = await supabase.rpc('get_seller_dashboard_fast', { p_seller_id: userId });
                        if (error) throw error;
                        return data;
                    });
                    if (statsData) setSellerStats(statsData);
                } catch (e: any) { console.error('[fetchSellerData:stats]', e?.message); }
            })(),
        ]);
    }, []);

    const fetchBuyerReturns = useCallback(async (userId: string, bust = false) => {
        try {
            const key = `buyer:returns:${userId}`;
            if (bust) invalidate(key);
            const data = await withCache(key, 30_000, async () => {
                const { data: d, error } = await supabase.rpc('get_buyer_disputes', { p_user_id: userId });
                if (error) {
                    // Fallback: direct query
                    const { data: fallback } = await supabase.from('disputes')
                        .select('*, order:orders(*), items:dispute_items(*)')
                        .eq('buyer_id', userId)
                        .order('created_at', { ascending: false });
                    return fallback;
                }
                return d;
            });
            if (data) setBuyerReturns(data);
        } catch (err: any) {
            console.error('[fetchBuyerReturns]', err?.message);
        }
    }, []);

        const fetchUserData = useCallback(async (userId: string, userRole?: string, isBanned?: boolean) => {
        const [addrsRes, notifsRes, walletRes, paymentsRes, shipmentsRes, payMethodsRes, connAccountsRes, blockedRes] = await Promise.all([
            supabase.from('addresses').select('*').eq('user_id', userId).is('deleted_at', null),
            isBanned ? { data: [] } : supabase.from('notifications').select('*').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('wallet_transactions').select('*').eq('profile_id', userId).order('created_at', { ascending: false }).limit(20),
            supabase.from('payments').select('*, order:orders!inner(id, status, total, created_at, user_id)').eq('order.user_id', userId).limit(20),
            supabase.from('shipments').select('*, order:orders!inner(id, status, total, created_at, user_id)').eq('order.user_id', userId).limit(20),
            supabase.from('payment_methods').select('*').eq('user_id', userId),
            supabase.from('connected_accounts').select('*').eq('user_id', userId),
            supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId)
        ]);

        if (addrsRes.data) setAddresses(addrsRes.data);
        if (notifsRes.data) setNotifications(notifsRes.data);
        if (walletRes.data) setWalletTransactions(walletRes.data);
        if (paymentsRes.data) setPayments(paymentsRes.data as any);
        if (shipmentsRes.data) setShipments(shipmentsRes.data as any);
        if (payMethodsRes.data) setPaymentMethods(payMethodsRes.data);
        if (connAccountsRes.data) setConnectedAccounts(connAccountsRes.data);
        if (blockedRes.data) setBlockedUsers(new Set(blockedRes.data.map((b: any) => b.blocked_id)));

        if (userRole === 'seller') {
            const [vpRes, staffRes, zonesRes] = await Promise.all([
                supabase.from('vendor_profiles').select('*').eq('seller_id', userId).single(),
                supabase.from('staff_accounts').select('*').eq('seller_id', userId),
                supabase.from('shipping_zones').select('*').eq('seller_id', userId)
            ]);
            if (vpRes.data) setVendorProfile(vpRes.data);
            if (staffRes.data) setStaffAccounts(staffRes.data);
            if (zonesRes.data) setShippingZones(zonesRes.data);
        }

        const { data: followersData } = await supabase.from('followers').select('*').eq('user_id', userId);
        if (followersData) setFollowers(followersData);

        // Fetch data that has realtime subscriptions separately
        fetchAndSetOrders(userId);
        fetchAndSetWishlist(userId);
        fetchAndSetCart(userId);
        fetchUnreadMessagesCount(userId);
    }, [fetchAndSetOrders, fetchAndSetWishlist, fetchAndSetCart, fetchUnreadMessagesCount]);

    // Wire fetchUserData into the ref so applyDashboardRpc can call it
    React.useEffect(() => { fetchUserDataRef.current = fetchUserData; }, [fetchUserData]);

    /**
     * Re-read the unread badge. The messaging surface calls this after
     * marking a thread read, so the navbar count drops without waiting for
     * the realtime round trip.
     */
    const refreshUnreadMessages = useCallback(async () => {
        if (!user) return;
        await fetchUnreadMessagesCount(user.id);
    }, [user, fetchUnreadMessagesCount]);

    // ─── BACKGROUND REFRESH ────────────────────────────────────────────────────
    // Silently re-fetches role data every 60s so the user never sees stale data
    // when switching tabs, returning from another page, or leaving the app open.
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            if (user.role === 'seller') fetchSellerData(user.id, true);
            else if (user.role === 'buyer') {
                fetchAndSetOrders(user.id, 50, 0, true);
                fetchBuyerReturns(user.id, true);
            }
        }, 60_000);
        return () => clearInterval(interval);
    }, [user, fetchSellerData, fetchBuyerReturns, fetchAndSetOrders]);

    // ─── PRESENCE HEARTBEAT ─────────────────────────────────────────────────────
    // last_seen_at used to be written once, at login — so isOnline()'s 2-minute
    // window read a user active for hours as offline the moment that window
    // elapsed. Refresh it periodically while the tab is actually visible: a
    // background tab should go quiet like a real client would, not keep
    // reporting the user online while they are looking at something else.
    useEffect(() => {
        if (!user) return;
        let lastBeat = 0;
        const beat = () => {
            if (document.hidden) return;
            // visibilitychange can fire in quick bursts (fast tab switching);
            // the interval already covers steady presence, so this only needs
            // to catch "tab just became visible again after a while".
            if (Date.now() - lastBeat < 60_000) return;
            lastBeat = Date.now();
            void touchPresence().catch(() => {});
        };
        beat();
        const interval = setInterval(beat, 90_000);
        document.addEventListener('visibilitychange', beat);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', beat);
        };
    }, [user]);

    const logActivity = useCallback(async (action: string, details?: string, metadata: any = {}) => {
        if (!user) return;
        const { data: inserted } = await supabase.from('activity_logs').insert({
            user_id: user.id,
            action_type: action,
            details,
            metadata
        }).select().single();
        if (inserted) {
            setActivityLogs(prev => [inserted, ...prev].slice(0, 20));
        }
    }, [user]);

    const logout = useCallback(async () => {
        if (user) await logActivity('logout', 'User logged out');
        await supabase.auth.signOut();
        window.location.href = '/';
    }, [user, logActivity]);

    const addToCart = useCallback(async (product: Product, variant?: ProductVariant, quantity = 1) => {
        try {
            const newItem = { ...product, quantity, selectedVariant: variant, variant_id: variant?.id };
            
            setCart(prev => {
                const existing = prev.find(p => p.id === product.id && p.variant_id === variant?.id);
                if (existing) {
                    return prev.map(p => p === existing ? { ...p, quantity: p.quantity + quantity } : p);
                }
                return [...prev, newItem];
            });

            if (user) {
                // Single RPC: get-or-create cart + upsert item atomically (was 4 round trips)
                const { error: rpcError } = await supabase.rpc('upsert_cart_item', {
                    p_product_id: product.id,
                    p_variant_id: variant?.id ?? null,
                    p_quantity:   quantity,
                    p_price:      (variant?.sale_price || variant?.base_price) ?? product.price,
                });
                if (rpcError) throw rpcError;
                // Ensure cartIdRef is populated so removeFromCart can delete from DB
                if (!cartIdRef.current) {
                    const { data: c } = await supabase.from('carts').select('id').eq('user_id', user.id).single();
                    if (c) cartIdRef.current = c.id;
                }
                await logActivity('add_to_cart', `Added ${product.name} to cart`, { product_id: product.id });
                await notify('Cart Updated', `Added ${product.name} to your cart`, 'success', '/cart');
            }
            
        } catch (error) {
            console.error('Error adding to cart:', error);
            await notify('Error', 'Failed to add item to cart', 'error');
        }
    }, [user, logActivity, notify]);

    const removeFromCart = useCallback(async (productId: string, variantId?: string) => {
        try {
            // Match robustly: a cart line's variant may live in variant_id or
            // selectedVariant.id, and DB rows use null while callers pass
            // undefined — normalise both so removal never silently no-ops.
            const target = variantId ?? null;
            const lineVariant = (p: any) => (p.variant_id ?? p.selectedVariant?.id) ?? null;
            // Resolve the removed line's true variant from the snapshot so the DB
            // delete targets the same row the local filter drops — otherwise a
            // line whose variant lived only in selectedVariant.id would be removed
            // locally but survive in the DB and resurrect on reload.
            let dbVariant = target;
            setCart(prev => {
                const hit = prev.find(p => p.id === productId && lineVariant(p) === target);
                if (hit) dbVariant = lineVariant(hit);
                return prev.filter(p => p.id !== productId || lineVariant(p) !== target);
            });

            if (user) {
                // cartIdRef may be null if upsert_cart_item created the cart after initial fetch
                let cartId = cartIdRef.current;
                if (!cartId) {
                    const { data } = await supabase.from('carts').select('id').eq('user_id', user.id).single();
                    if (data) { cartId = data.id; cartIdRef.current = data.id; }
                }
                if (cartId) {
                    let query = supabase.from('cart_items').delete()
                        .eq('cart_id', cartId)
                        .eq('product_id', productId);
                    if (dbVariant) query = query.eq('variant_id', dbVariant);
                    else query = query.is('variant_id', null);
                    const { error } = await query;
                    if (error) throw error;
                }
                await logActivity('remove_from_cart', `Removed item from cart`, { product_id: productId });
            }
        } catch (error) {
            console.error('Error removing from cart:', error);
            await notify('Error', 'Failed to remove item from cart', 'error');
        }
    }, [user, logActivity, notify]);

    const updateQuantity = useCallback(async (productId: string, delta: number, variantId?: string) => {
        try {
            // Same normalisation as removeFromCart: a line's variant may live in
            // variant_id or selectedVariant.id, and DB rows use null while callers
            // pass undefined — match on the resolved value so +/- never no-ops, and
            // target the DB row by that same resolved variant.
            const target = variantId ?? null;
            const lineVariant = (p: any) => (p.variant_id ?? p.selectedVariant?.id) ?? null;
            let dbVariant = target;
            setCart(prev => prev.map(p => {
                if (p.id !== productId || lineVariant(p) !== target) return p;
                dbVariant = lineVariant(p);
                return { ...p, quantity: Math.max(1, p.quantity + delta) };
            }));

            if (user) {
                const cartId = cartIdRef.current;
                if (cartId) {
                    let query = supabase.from('cart_items')
                        .select('id, quantity')
                        .eq('cart_id', cartId)
                        .eq('product_id', productId);

                    if (dbVariant) {
                        query = query.eq('variant_id', dbVariant);
                    } else {
                        query = query.is('variant_id', null);
                    }

                    const { data: item } = await query.maybeSingle();

                    if (item) {
                        const { error } = await supabase.from('cart_items').update({ quantity: Math.max(1, item.quantity + delta) }).eq('id', item.id);
                        if (error) throw error;
                    }
                }
            }
        } catch (error) {
            console.error('Error updating quantity:', error);
            await notify('Error', 'Failed to update quantity', 'error');
        }
    }, [user, notify]);

    const followSeller = useCallback(async (sellerId: string) => {
        if (!user) return;
        await supabase.from('followers').insert({ user_id: user.id, seller_id: sellerId });
        setFollowers(prev => [...prev, { id: '', user_id: user.id, seller_id: sellerId, created_at: new Date().toISOString() }]);
        await notify('Followed', 'You are now following this seller', 'success');
    }, [user, notify]);

    const unfollowSeller = useCallback(async (sellerId: string) => {
        if (!user) return;
        await supabase.from('followers').delete().match({ user_id: user.id, seller_id: sellerId });
        setFollowers(prev => prev.filter(f => f.seller_id !== sellerId));
        await notify('Unfollowed', 'You have unfollowed this seller', 'info');
    }, [user, notify]);

    const isFollowing = useCallback((sellerId: string) => followers.some(f => f.seller_id === sellerId), [followers]);

    const toggleWishlist = useCallback(async (product: Product) => {
        // Guest: toggle in-memory (persisted to localStorage by the sync effect)
        if (!user) {
            setWishlist(prev =>
                prev.some(p => p.id === product.id)
                    ? prev.filter(p => p.id !== product.id)
                    : [...prev, product]
            );
            return;
        }
        // Authenticated: query DB as source of truth to avoid double-click race conditions
        const { data: existing } = await supabase
            .from('wishlist_items')
            .select('id, deleted_at')
            .eq('user_id', user.id)
            .eq('product_id', product.id)
            .single();
        const isInWishlist = existing && existing.deleted_at === null;
        if (isInWishlist) {
            await supabase.from('wishlist_items').update({ deleted_at: new Date().toISOString() }).eq('id', existing.id);
            setWishlist(prev => prev.filter(p => p.id !== product.id));
        } else {
            if (existing) {
                await supabase.from('wishlist_items').update({ deleted_at: null }).eq('id', existing.id);
            } else {
                await supabase.from('wishlist_items').insert({ user_id: user.id, product_id: product.id });
            }
            setWishlist(prev => prev.some(p => p.id === product.id) ? prev : [...prev, product]);
        }
    }, [user]);

    const addToRecentlyViewed = useCallback((product: Product) => {
        setRecentlyViewed(prev => {
            const filtered = prev.filter(p => p.id !== product.id);
            return [product, ...filtered].slice(0, 10);
        });
    }, []);

    const addReview = useCallback(async (productId: string, rating: number, comment: string, images?: string[]) => {
        if (!user) return;
        const { error } = await supabase.from('reviews').insert({
            product_id: productId,
            user_id: user.id,
            rating,
            comment,
            images,
            created_at: new Date().toISOString()
        });
        if (error) throw error;
        await notify('Review Added', 'Thank you for your feedback!', 'success');
    }, [user, notify]);

    const fetchReviews = useCallback(async (productId: string) => {
        const { data, error } = await supabase.from('reviews')
            .select('*, user:profiles(full_name, avatar_url)')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as Review[];
    }, []);

    const clearCart = useCallback(async () => {
        try {
            setCart([]);
            if (user) {
                const { data: cartData, error: cartError } = await supabase.from('carts').select('id').eq('user_id', user.id).single();
                if (cartError) {
                    console.error('Error fetching cart:', cartError);
                    throw cartError;
                }
                if (cartData) {
                    const { error } = await supabase.from('cart_items').delete().eq('cart_id', cartData.id);
                    if (error) {
                        console.error('Error clearing cart items:', error);
                        throw error;
                    }
                }
                await logActivity('clear_cart', 'Cleared shopping cart');
                await notify('Cart Cleared', 'Your cart has been cleared', 'success');
            }
        } catch (error) {
            console.error('Error clearing cart:', error);
            await notify('Error', 'Failed to clear cart', 'error');
        }
    }, [user, logActivity, notify]);

    const placeOrder = useCallback(async (details: any) => {
        if (!user) throw new Error("User not logged in");

        // SECURITY: Never trust client-side prices.
        // Only send product_id, variant_id, and quantity.
        // The place_order_atomic RPC re-fetches the current price from
        // the products/product_variants table server-side.
        const itemsPayload = cart.map(item => {
            const qty = Math.max(1, Math.min(9999, Math.floor(Number(item.quantity) || 1)));
            return {
                product_id: item.id,
                variant_id: item.variant_id || null,
                quantity: qty,
                // Intentionally omitting price_at_purchase — set by RPC
            };
        });

        // Free-shipping campaigns waive the delivery fee. Compute the waiver with
        // the SAME server function the cart preview uses, so the charged delivery
        // matches what the buyer previewed. (delivery_fee has always been
        // client-supplied to this RPC, so this introduces no new trust surface.)
        let netDeliveryFee = Math.max(0, Number(details.deliveryFee) || 0);
        try {
            const { data: waiver } = await supabase.rpc('compute_shipping_waiver', {
                p_items: itemsPayload,
                p_coupon_code: details.couponCode || null,
                p_delivery_fee: netDeliveryFee,
            });
            netDeliveryFee = Math.max(0, netDeliveryFee - (Number(waiver) || 0));
        } catch { /* on any error, fall back to the full delivery fee */ }

        const { data, error } = await supabase.rpc('place_order_atomic', {
            p_user_id: user.id,
            p_shipping_address: details.address,
            p_payment_method: details.paymentMethod,
            p_payment_ref: details.paymentRef,
            p_delivery_fee: netDeliveryFee,
            p_discount_amount: details.discount, // ignored server-side; kept for signature compat
            p_note: details.note,
            p_items: itemsPayload,
            p_is_gift: details.isGift,
            p_gift_message: details.giftMessage,
            // Checkout surfaces pass `deliveryDate`; keep the old key as a fallback
            // so neither caller shape silently drops the buyer's chosen date.
            p_preferred_delivery_date: details.preferredDeliveryDate ?? details.deliveryDate ?? null,
            p_delivery_slot: details.deliverySlot,
            // Server re-validates and computes the real discount from this code.
            p_coupon_code: details.couponCode || null,
            // Wallet spend REQUEST — the RPC clamps to the real wallet_balance
            // and the post-discount order total server-side, then debits
            // atomically with a wallet_transactions ledger row.
            p_wallet_amount: Math.max(0, Number(details.walletAmount) || 0),
        });

        if (error) {
            // Map common RPC errors to user-friendly messages
            const msg = error.message || '';
            if (msg.includes('Insufficient stock')) throw new Error('One or more items are out of stock. Please update your cart.');
            if (msg.includes('cannot purchase your own product')) throw new Error("You can't buy your own product. Remove it from your cart to continue.");
            if (msg.includes('on vacation')) throw new Error(msg.replace(/^Seller on vacation: /, ''));
            if (msg.includes('Product not found')) throw new Error('A product in your cart is no longer available.');
            if (msg.includes('Unauthorized')) throw new Error('Session expired. Please log in again.');
            throw new Error(msg || 'Failed to place order. Please try again.');
        }
        
        await clearCart();

        // If wallet balance was spent, reflect the server-computed new balance
        // immediately (the RPC returns it after the atomic debit).
        if (data && typeof data.wallet_balance === 'number') {
            setUser(u => (u ? { ...u, wallet_balance: data.wallet_balance } : u));
        }

        // Re-fetch all orders via RPC to get the full picture immediately
        await fetchAndSetOrders(user.id);
        
        // Return basic order data for confirmation page
        return data;
    }, [user, cart, clearCart, fetchUserData, fetchAndSetOrders]);

    const fetchVendorProfile = useCallback(async (sellerId: string) => {
        const { data } = await supabase.from('public_vendor_profiles').select('seller_id, store_name, description, logo_url, banner_url, region, district, is_verified, trust_score, total_sales, verification_level, rating, delivery_fee, return_policy, shipping_policy, processing_time, warranty, vacation_mode, opening_hours, instagram_url, facebook_url, website_url, social_links, tags, store_policy').eq('seller_id', sellerId).single();
        return data;
    }, []);

    const addAddress = useCallback(async (address: Partial<Address>) => {
        if (!user) return;
        if (address.is_default) {
            await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
        }
        const { error } = await supabase.from('addresses').insert({ ...address, user_id: user.id, created_at: new Date().toISOString() });
        if (error) { addToast(error.message, 'error'); throw error; }
        await logActivity('add_address', `New address added: ${address.label || address.street}`);
        const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id).is('deleted_at', null);
        if (data) setAddresses(data);
    }, [user, logActivity, addToast]);

    const getActiveOfferForProduct = useCallback((productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return null;

        // Rank a tier's candidates: a real `discount` campaign always beats a
        // shipping/BOGO one for the "best offer" (those carry the value=100
        // sentinel and only cut price/shipping elsewhere), so a genuine discount
        // is never shadowed. Within the same kind, higher value wins.
        const byBestOffer = (a: Offer, b: Offer) =>
            ((b.campaign_type === 'discount' ? 1 : 0) - (a.campaign_type === 'discount' ? 1 : 0))
            || (b.value - a.value);

        // 1. Find product-specific offers
        const specificOffers = offers.filter(o => 
            o.target_type === 'product' && 
            o.target_ids?.includes(productId)
        );

        if (specificOffers.length > 0) {
            // Sort by highest value (assuming same currency/type for simplicity in sorting)
            return specificOffers.sort(byBestOffer)[0];
        }

        // 2. Find category-specific offers
        const categoryOffers = offers.filter(o => 
            o.target_type === 'category' && 
            o.target_ids?.includes(product.category) &&
            (o.scope === 'platform' || o.seller_id === product.seller_id)
        );

        if (categoryOffers.length > 0) {
            return categoryOffers.sort(byBestOffer)[0];
        }

        // 3. Find store-wide offers from this seller
        const storeOffers = offers.filter(o => 
            o.target_type === 'store' && 
            o.seller_id === product.seller_id
        );

        if (storeOffers.length > 0) {
            return storeOffers.sort(byBestOffer)[0];
        }

        // 4. Find platform-wide offers
        const platformOffers = offers.filter(o => 
            o.scope === 'platform' && 
            (!o.target_type || o.target_type === 'store')
        );

        return platformOffers.length > 0 ? platformOffers.sort(byBestOffer)[0] : null;
    }, [products, offers]);

    const fetchOrderDetails = useCallback(async (orderId: string) => {
        const [payRes, shipRes, noteRes] = await Promise.all([
            supabase.from('payments').select('*').eq('order_id', orderId),
            supabase.from('shipments').select('*').eq('order_id', orderId),
            supabase.from('order_notes').select('*').eq('order_id', orderId).eq('visibility', 'seller')
        ]);
        return {
            payments: (payRes.data as Payment[]) || [],
            shipments: (shipRes.data as Shipment[]) || [],
            notes: (noteRes.data as OrderNote[]) || []
        };
    }, []);

    const requestReturn = useCallback(async (orderId: string, itemId: string, reason: string) => {
        if (!user) return;
        const { data: item } = await supabase.from('order_items').select('seller_id').eq('id', itemId).single();
        if (!item) { addToast('Could not find order item', 'error'); return; }

        const { error } = await supabase.from('return_requests').insert({
            order_id: orderId,
            order_item_id: itemId,
            buyer_id: user.id,
            seller_id: item.seller_id,
            reason,
            status: 'requested',
            requested_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
        });
        if (error) { addToast(error.message || 'Failed to submit return request', 'error'); throw error; }
        await logActivity('request_return', `Requested return for order ${orderId}`, { order_id: orderId, item_id: itemId });
        addToast('Return request submitted', 'success');
        await fetchBuyerReturns(user.id, true);
    }, [user, logActivity, addToast, fetchBuyerReturns]);

    const addOrderNote = useCallback(async (orderId: string, note: string, visibility: 'seller' | 'admin' | 'internal') => {
        if (!user) return;
        await supabase.from('order_notes').insert({
            order_id: orderId,
            note,
            visibility,
            created_by: user.id
        });
        await logActivity('add_order_note', `Added note to order ${orderId}`, { order_id: orderId });
    }, [user, logActivity]);

    const interactWithPost = useCallback(async (postId: string, type: SocialInteraction['type'], comment?: string) => {
        if (!user) return;
        await supabase.from('social_interactions').insert({
            post_id: postId,
            user_id: user.id,
            type,
            comment_text: comment
        });

        // Update local count optimistically
        setSocialPosts(prev => prev.map(p => {
            if (p.id === postId) {
                if (type === 'like') return { ...p, likes: (p.likes ?? 0) + 1 };
                if (type === 'share') return { ...p, shares: (p.shares ?? 0) + 1 };
                if (type === 'comment') return { ...p, comments_count: (p.comments_count ?? 0) + 1 };
            }
            return p;
        }));

        await logActivity('social_interaction', `Interacted with post ${postId}`, { post_id: postId, type });
    }, [user, logActivity]);

    const blockUser = useCallback(async (userId: string) => {
        if (!user) return;
        await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: userId });
        setBlockedUsers(prev => new Set(prev).add(userId));
    }, [user]);

    const unblockUser = useCallback(async (userId: string) => {
        if (!user) return;
        await supabase.from('blocked_users').delete().match({ blocker_id: user.id, blocked_id: userId });
        setBlockedUsers(prev => { const next = new Set(prev); next.delete(userId); return next; });
    }, [user]);

    const updateOrderStatus = useCallback(async (id: string, status: string, reason?: string) => {
        // Optimistic update — reflect change immediately before server confirms
        const previous = orders.map(o => ({ ...o }));
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as import('../types').OrderStatus } : o));

        const { error } = await supabase.rpc('update_order_status_rbac', { p_order_id: id, p_new_status: status, p_cancel_reason: reason || null });
        if (error) {
            setOrders(previous); // rollback
            console.error('Status update failed', error);
            throw error;
        }
        if (user) await logActivity('update_order_status', `Order ${id} status changed to ${status}`, { order_id: id, status, reason });
        // update_order_status_rbac() already inserts the buyer-facing notification
        // server-side (cancellations and processing/in_transit/delivered transitions).
    }, [user, orders, logActivity]);

    const cancelOrder = useCallback(async (id: string, reason: string) => {
        // Optimistic update
        const previous = orders;
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' as import('../types').OrderStatus } : o));

        // Buyer cancellations go through cancel_my_order (pending orders only).
        // The guarded RPC restores stock, flips payment_status to 'refund_due' when
        // money is in play, and notifies every seller itself — no client inserts needed.
        const { data: result, error } = await supabase.rpc('cancel_my_order', { p_order: id, p_reason: reason });
        if (error) {
            setOrders(previous); // rollback
            console.error('Cancel order failed', error);
            // The RPC raises human-readable messages (e.g. "The seller is already
            // preparing this order...") — surface them instead of a generic failure.
            addToast(error.message || "Failed to cancel order", "error");
            throw error;
        }
        // cancel_reason now set by RPC — no separate PATCH needed
        if (user) await logActivity('cancel_order', `Order ${id} cancelled`, { order_id: id, reason });

        addToast(
            (result as any)?.refund_due
                ? "Order cancelled — your payment will be refunded"
                : "Order cancelled successfully",
            "success"
        );
        fetchUserData(user?.id!);
    }, [user, orders, logActivity, addToast, fetchUserData]);

    const deleteOrder = useCallback(async (id: string) => {
        // Direct UPDATE on orders is RLS-blocked for buyers (orders_update_own only
        // permits status→cancelled), so the old .update({deleted_at}) silently no-oped.
        // hide_my_order soft-deletes the order server-side (terminal statuses only).
        // Remove it from view immediately — waiting on a full fetchUserData()
        // round-trip made "Remove from history" feel like it was doing nothing.
        const previous = orders;
        setOrders(prev => prev.filter(o => o.id !== id));
        const { error } = await supabase.rpc('hide_my_order', { p_order: id });
        if (error) {
            setOrders(previous); // rollback
            console.error('Hide order failed', error);
            addToast(error.message || 'Could not remove order from history', 'error');
            throw error;
        }
    }, [orders, addToast]);

    const deleteAddress = useCallback(async (id: string) => { 
        const { error } = await supabase.from('addresses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        if (error) { addToast(error.message, 'error'); return; }
        if (user) await logActivity('delete_address', `Address deleted`, { address_id: id });
        setAddresses(prev => prev.filter(a => a.id !== id));
    }, [user, logActivity, addToast]);
    const updateAddress = useCallback(async (id: string, address: Partial<Address>) => {
        if (!user) return;
        if (address.is_default) {
            await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
        }
        const { error } = await supabase.from('addresses').update({ ...address, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) { addToast(error.message, 'error'); throw error; }
        if (user) await logActivity('update_address', `Address updated`, { address_id: id });
        const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id).is('deleted_at', null);
        if (data) setAddresses(data);
    }, [user, logActivity, addToast, fetchUserData]);

    const updateUserProfile = useCallback(async (data: Partial<User>) => { 
        if (!user) return;
        // SECURITY: Strip fields that must NEVER be set client-side
        // Role escalation, ban bypass, and credit manipulation prevented here.
        // Supabase RLS is the authoritative gate — this is defense-in-depth.
        const {
            role, is_banned, is_admin, wallet_balance, points,
            deleted_at, id, created_at, email, last_seen_at,
            name, // NOT a real column — the app derives user.name from full_name
            ...safe
        } = data as any;

        // Additional sanitization of text fields
        if (safe.full_name)    safe.full_name     = safe.full_name.slice(0, 100).replace(/<[^>]*>/g, '').trim();
        if (safe.display_name) safe.display_name  = safe.display_name.slice(0, 60).replace(/<[^>]*>/g, '').trim();
        if (safe.bio)          safe.bio           = safe.bio.slice(0, 500).replace(/<[^>]*>/g, '').trim();
        if (safe.phone)        safe.phone         = safe.phone.slice(0, 20).replace(/[^0-9+\s-]/g, '').trim();
        if (safe.location)     safe.location      = safe.location.slice(0, 100).replace(/<[^>]*>/g, '').trim();
        if (safe.pronouns)     safe.pronouns      = safe.pronouns.slice(0, 30).replace(/<[^>]*>/g, '').trim();
        if (safe.signature_emoji) safe.signature_emoji = safe.signature_emoji.slice(0, 10).trim();
        if (safe.cover_image_url) safe.cover_image_url = safe.cover_image_url.slice(0, 500).trim();
        // Only allow safe enum values for DB-constrained fields
        const validAccents = ['emerald', 'ocean', 'violet', 'rose', 'amber', 'teal', 'indigo', 'slate'];
        const validModes = ['light', 'dark', 'system'];
        const validLayouts = ['compact', 'comfortable', 'spacious'];
        const validGreetings = ['karibu', 'habari', 'hello', 'mambo'];
        if (safe.theme_accent && !validAccents.includes(safe.theme_accent)) delete safe.theme_accent;
        if (safe.theme_mode && !validModes.includes(safe.theme_mode)) delete safe.theme_mode;
        if (safe.dashboard_layout && !validLayouts.includes(safe.dashboard_layout)) delete safe.dashboard_layout;
        if (safe.greeting_style && !validGreetings.includes(safe.greeting_style)) delete safe.greeting_style;
        
        const { error } = await supabase.from('profiles').update(safe).eq('id', user.id); 
        if (error) {
            addToast(error.message, 'error');
            throw error;
        }
        await logActivity('update_profile', 'User profile updated');
        // user.name is derived from full_name — keep the in-memory display name in
        // sync so a name change shows immediately (navbar, avatars) without reload.
        setUser({ ...user, ...safe, ...(safe.full_name ? { name: safe.full_name } : {}) });
        fetchUserData(user.id);
    }, [user, logActivity, fetchUserData, addToast]);

    const deleteAccount = useCallback(async () => {
        if (!user) return;
        await requestMyAccountDeletion(user.id);
        logout();
    }, [user, logout]);

    const reportUser = useCallback(async (reportedId: string, reason: string, details?: string) => {
        if (!user) return;
        const { error } = await supabase.from('reports').insert({
            reporter_id: user.id,
            reported_id: reportedId,
            reason,
            details
        });
        if (error) {
            console.error("Report failed:", error);
            addToast("Failed to submit report", "error");
        } else {
            addToast("Report submitted successfully", "success");
        }
    }, [user, addToast]);

    // These read through RPCs, not supabase.from() directly — a legacy
    // violation this file used to carry (CLAUDE.md's contained AppContext/
    // useHomePageData exception), migrated while touching this code. The
    // optimistic setNotifications is what actually matters here: the
    // Navbar unread badge and NotificationsPanel both read this SAME
    // shared array now, so a read/delete anywhere updates the badge
    // everywhere instead of only inside whichever component made the call.
    const markNotificationRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        await apiMarkNotificationRead(id);
    }, []);
    const markAllNotificationsRead = useCallback(async () => {
        if (!user) return;
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        await apiMarkAllNotificationsRead();
    }, [user]);
    const dismissNotification = useCallback(async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        await apiDeleteNotifications([id]);
    }, []);
    const deleteAllNotifications = useCallback(async () => {
        if (!user) return;
        setNotifications([]); // optimistic
        await apiDeleteAllNotifications();
    }, [user]);

    const updateVendorProfile = useCallback(async (data: Partial<VendorProfile>) => {
        if (!user) return;
        // SECURITY: Strip server-managed fields
        const { seller_id, is_verified, trust_score, total_sales, verification_level, ...safe } = data as any;
        // Sanitize text inputs
        if (safe.store_name)  safe.store_name  = (safe.store_name  as string).slice(0, 100).replace(/<[^>]*>/g, '').trim();
        if (safe.description) safe.description = (safe.description as string).slice(0, 1000).replace(/<[^>]*>/g, '').trim();
        if (safe.address)     safe.address     = (safe.address     as string).slice(0, 200).replace(/<[^>]*>/g, '').trim();
        // Hex-color / URL CHECK constraints reject '' — coerce blank to NULL.
        if ('accent_color' in safe && !safe.accent_color) safe.accent_color = null;
        if ('banner_cta_url' in safe && !safe.banner_cta_url) safe.banner_cta_url = null;
        let result;
        if (vendorProfile) {
            result = await supabase.from('vendor_profiles').update(safe).eq('seller_id', user.id).select().single();
        } else {
            const payload = { seller_id: user.id, store_name: `${user.name || 'My'}'s Store`, ...safe };
            result = await supabase.from('vendor_profiles').insert(payload).select().single();
        }
        
        if (result.error) {
            addToast(result.error.message, 'error');
            throw result.error;
        }
        if (result.data) setVendorProfile(result.data);
        await logActivity('update_vendor_profile', 'Seller profile updated');
    }, [user, vendorProfile, logActivity, addToast]);
    const refreshNotifications = useCallback(async () => { if (user) await fetchUserData(user.id, user.role); }, [user, fetchUserData]);
    const refreshWishlist = useCallback(async () => { if (user) await fetchAndSetWishlist(user.id); }, [user, fetchAndSetWishlist]);
    const refreshCart = useCallback(async () => { if (user) await fetchAndSetCart(user.id); }, [user, fetchAndSetCart]);

    // Fast dashboard refresh — replaces fetchUserData calls post-action
    const refreshDashboard = useCallback(async () => {
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('role, is_banned').eq('id', user.id).single();
        if (profile) await applyDashboardRpc(user.email, { ...user, ...profile });
    }, [user, applyDashboardRpc]);

    // Stable wrappers for previously-inline functions
    const isInWishlist = useCallback((pid: string) => wishlist.some(p => p.id === pid), [wishlist]);
    const refreshProducts = useCallback(async () => { invalidatePrefix('public:'); await fetchPublicData(); }, [fetchPublicData]);
    const refreshSellerData = useCallback(async () => { if (user) await fetchSellerData(user.id, true); }, [user, fetchSellerData]);
    const refreshBuyerReturns = useCallback(async () => { if (user) await fetchBuyerReturns(user.id, true); }, [user, fetchBuyerReturns]);

    // ============================================================
    // SLICED CONTEXTS — each memoized independently so consumers
    // only re-render when their slice changes. useAppState() still
    // works (merges all slices) for backward compatibility.
    // ============================================================

    const authValue: AuthSlice = useMemo(() => ({
        user, setUser, isLoading, isDark, vendorProfile, addresses, walletTransactions, activityLogs,
        paymentMethods, connectedAccounts, loginHistory, staffAccounts, shippingZones, blockedUsers,
        toggleTheme, blockUser, unblockUser, logout, updateUserProfile, deleteAccount,
        addAddress, deleteAddress, updateAddress, fetchVendorProfile, updateVendorProfile, logActivity,
    }), [user, isLoading, isDark, vendorProfile, addresses, walletTransactions, activityLogs,
        paymentMethods, connectedAccounts, loginHistory, staffAccounts, shippingZones, blockedUsers,
        toggleTheme, blockUser, unblockUser, logout, updateUserProfile, deleteAccount,
        addAddress, deleteAddress, updateAddress, fetchVendorProfile, updateVendorProfile, logActivity]);

    const catalogValue: CatalogSlice = useMemo(() => ({
        products, categories, offers, trustBadges, socialPosts, followers, recentlyViewed, wishlist,
        catalogError,
        toggleWishlist, isInWishlist, followSeller, unfollowSeller, isFollowing, refreshProducts,
        addToRecentlyViewed, addReview, fetchReviews, getActiveOfferForProduct, interactWithPost, refreshWishlist,
    }), [products, categories, offers, trustBadges, socialPosts, followers, recentlyViewed, wishlist,
        catalogError,
        toggleWishlist, isInWishlist, followSeller, unfollowSeller, isFollowing, refreshProducts,
        addToRecentlyViewed, addReview, fetchReviews, getActiveOfferForProduct, interactWithPost, refreshWishlist]);

    const cartValue: CartSlice = useMemo(() => ({
        cart, isCartOpen, orders, payments, shipments, buyerReturns,
        addToCart, removeFromCart, updateQuantity, clearCart, openCart, closeCart,
        placeOrder, updateOrderStatus, cancelOrder, deleteOrder,
        requestReturn, addOrderNote, fetchOrderDetails, refreshCart, refreshBuyerReturns,
    }), [cart, isCartOpen, orders, payments, shipments, buyerReturns,
        addToCart, removeFromCart, updateQuantity, clearCart, openCart, closeCart,
        placeOrder, updateOrderStatus, cancelOrder, deleteOrder,
        requestReturn, addOrderNote, fetchOrderDetails, refreshCart, refreshBuyerReturns]);

    const commsValue: CommsSlice = useMemo(() => ({
        notifications, unreadMessages,
        sellerInventory, sellerOrders, sellerOffers, sellerStats,
        notify, refreshUnreadMessages, reportUser,
        markNotificationRead, markAllNotificationsRead, dismissNotification, deleteAllNotifications,
        refreshNotifications, refreshSellerData,
    }), [notifications, unreadMessages,
        sellerInventory, sellerOrders, sellerOffers, sellerStats,
        notify, refreshUnreadMessages, reportUser,
        markNotificationRead, markAllNotificationsRead, dismissNotification, deleteAllNotifications,
        refreshNotifications, refreshSellerData]);

    // Legacy merged value — changes when any slice changes (same behavior
    // as before the split). Existing useAppState() consumers keep working;
    // migrate hot components to the slice hooks for re-render wins.
    const value: AppContextType = useMemo(() => ({
        ...authValue, ...catalogValue, ...cartValue, ...commsValue,
    }), [authValue, catalogValue, cartValue, commsValue]);

    return (
        <AuthContext.Provider value={authValue}>
            <CatalogContext.Provider value={catalogValue}>
                <CartContext.Provider value={cartValue}>
                    <CommsContext.Provider value={commsValue}>
                        <AppContext.Provider value={value}>{children}</AppContext.Provider>
                    </CommsContext.Provider>
                </CartContext.Provider>
            </CatalogContext.Provider>
        </AuthContext.Provider>
    );
};

export const useAppState = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppState must be used within AppStateProvider");
    return context;
};

// ============================================================
// Focused hooks — subscribe only to one slice. Prefer these in
// components: they avoid re-renders from unrelated state.
// ============================================================
export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AppStateProvider");
    return ctx;
};
export const useCatalog = () => {
    const ctx = useContext(CatalogContext);
    if (!ctx) throw new Error("useCatalog must be used within AppStateProvider");
    return ctx;
};
export const useCart = () => {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used within AppStateProvider");
    return ctx;
};
export const useComms = () => {
    const ctx = useContext(CommsContext);
    if (!ctx) throw new Error("useComms must be used within AppStateProvider");
    return ctx;
};
