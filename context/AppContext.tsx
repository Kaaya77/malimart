
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Product, CartItem, User, Order, Notification, VendorProfile, Address, ProductVariant, ChatMessage, Offer, Category, Payment, Shipment, TrustBadge, ReturnRequest, OrderNote, ActivityLog, WalletTransaction, SocialPost, SocialInteraction, Follower, Review } from '../types';
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
    fetchMessages: () => Promise<ChatMessage[]>;
    markMessagesAsRead: (senderId: string) => Promise<void>;
    sendMessage: (to: string, text: string, productId?: string, orderId?: string, attachment?: { url: string, type: string }, replyToId?: string) => Promise<void>;
    deleteMessage: (id: string) => Promise<void>;
    softDeleteMessage: (id: string) => Promise<void>;
    reportUser: (reportedId: string, reason: string, details?: string) => Promise<void>;
    addReaction: (messageId: string, emoji: string) => Promise<void>;
    removeReaction: (messageId: string, emoji: string) => Promise<void>;
    markNotificationRead: (id: string) => Promise<void>;
    markAllNotificationsRead: () => Promise<void>;
    dismissNotification: (id: string) => Promise<void>;
    getActiveOfferForProduct: (productId: string) => Offer | null;
    logActivity: (action: string, details?: string, metadata?: any) => Promise<void>;
    notify: (title: string, message: string, type?: 'info' | 'success' | 'error', link?: string) => Promise<void>;
    requestReturn: (orderId: string, itemId: string, reason: string) => Promise<void>;
    addOrderNote: (orderId: string, note: string, visibility: 'seller' | 'admin' | 'internal') => Promise<void>;
    fetchOrderDetails: (orderId: string) => Promise<{ payments: Payment[], shipments: Shipment[], notes: OrderNote[] }>;
    interactWithPost: (postId: string, type: SocialInteraction['type'], comment?: string) => Promise<void>;
    updateVendorProfile: (data: Partial<VendorProfile>) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [wishlist, setWishlist] = useState<Product[]>([]);
    const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
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

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                let { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                
                if (error && error.code === 'PGRST116') {
                    const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
                        id: session.user.id,
                        full_name: session.user.user_metadata.full_name || 'User',
                        role: session.user.user_metadata.role || 'buyer',
                        email: session.user.email
                    }).select().single();
                    
                    if (insertError) {
                        console.error('Error creating profile:', insertError);
                    } else {
                        profile = newProfile;
                    }
                }

                if (profile) {
                    setUser({ ...profile, name: profile.full_name || 'User', email: session.user.email } as User);
                    await fetchUserData(session.user.id, profile.role);
                }
            }
            try { await fetchPublicData(); } catch(e) { console.error('fetchPublicData error:', e); }
            setIsLoading(false);
        };
        init();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                let { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
                
                if (error && error.code === 'PGRST116') {
                    const { data: newProfile, error: insertError } = await supabase.from('profiles').insert({
                        id: session.user.id,
                        full_name: session.user.user_metadata.full_name || 'User',
                        role: session.user.user_metadata.role || 'buyer',
                        email: session.user.email
                    }).select().single();
                    
                    if (insertError) {
                        console.error('Error creating profile:', insertError);
                    } else {
                        profile = newProfile;
                    }
                } else if (error) {
                    console.error('Error fetching profile:', error);
                }

                if (profile) {
                    setUser({ ...profile, name: profile.full_name || 'User', email: session.user.email } as User);
                    await fetchUserData(session.user.id, profile.role, profile.is_banned);
                } else {
                }
            } else if (event === 'SIGNED_OUT') {
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

        // Profile subscription to update user state
        const profileChannel = supabase.channel(`profiles:${user.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, async (payload) => {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (profile) {
                    setUser({ ...user, ...profile, name: profile.full_name || 'User' } as User);
                }
            })
            .subscribe();

        if (user.is_banned) {
            return () => {
                supabase.removeChannel(profileChannel);
            };
        }

        // Notifications
        const notificationsChannel = supabase.channel(`notifications:${user.id}`)
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
            .subscribe();

        // Orders
        const ordersChannel = supabase.channel(`orders:${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, 
                () => fetchAndSetOrders(user.id)
            ).subscribe();

        // Wishlist — fixed: table name was 'wishlist' (doesn't exist), correct name is 'wishlist_items'
        const wishlistChannel = supabase.channel(`wishlist:${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist_items', filter: `user_id=eq.${user.id}` }, 
                () => fetchAndSetWishlist(user.id)
            ).subscribe();
        
        // Cart — fixed: now filters by the user's own cart_id to avoid receiving all users' cart events
        const cartChannel = supabase.channel(`cart:${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'carts', filter: `user_id=eq.${user.id}` }, 
                () => fetchAndSetCart(user.id)
            ).subscribe();

        // Messages
        const messagesChannel = supabase.channel(`messages:${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, 
                () => fetchUnreadMessagesCount(user.id)
            ).subscribe();

        return () => {
            supabase.removeChannel(profileChannel);
            supabase.removeChannel(notificationsChannel);
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(wishlistChannel);
            supabase.removeChannel(cartChannel);
            supabase.removeChannel(messagesChannel);
        };
    }, [user]);

    const fetchPublicData = useCallback(async () => {
        // 1. Fetch other public data in parallel
        const otherResults = await Promise.allSettled([
            supabase.from('categories').select('*').eq('is_active', true).limit(50),
            supabase
                .from('offers')
                .select('*')
                .eq('status', 'active')
                .lte('start_date', new Date().toISOString())
                .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
                .limit(20),
            supabase.from('trust_badges').select('*').limit(50),
            supabase.from('social_posts')
                .select('*, user:profiles(full_name, avatar_url)')
                .eq('status', 'approved')
                .is('is_shadowbanned', false)
                .order('created_at', { ascending: false })
                .limit(20)
        ]);

        const [catsRes, offersRes, badgesRes, postsRes] = otherResults.map(r => 
            r.status === 'fulfilled' ? r.value : { data: null, error: r.reason }
        );

        if (catsRes.data) setCategories(catsRes.data as Category[]);
        if (offersRes.data) setOffers(offersRes.data as Offer[]);
        if (badgesRes.data) setTrustBadges(badgesRes.data);
        if (postsRes.data) setSocialPosts(postsRes.data as any);

        // 2. Fetch products separately to avoid timeout with complex joins
        try {
            const prodsRes = await supabase.from('products')
                .select(`
                    id, name, price, sale_price, images, category, subcategory, 
                    stock, rating, review_count, status, is_boosted, created_at,
                    seller_id, brand, condition, warranty_period, location,
                    latitude, longitude, description, tags
                `)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(40);

            if (prodsRes.error) {
                console.error('Error fetching products (detailed):', prodsRes.error);
                // Don't throw — let setIsLoading(false) still run
            }

            if (prodsRes.data) {
                const productIds = prodsRes.data.map(p => p.id);
                const sellerIds = [...new Set(prodsRes.data.map(p => p.seller_id))];
                
                // Fetch variants and vendor info in parallel
                const [variantsRes, vendorsRes] = await Promise.all([
                    supabase.from('product_variants')
                        .select('*')
                        .in('product_id', productIds),
                    supabase.from('vendor_profiles')
                        .select('seller_id, is_verified, store_name')
                        .in('seller_id', sellerIds)
                ]);
                
                const variantMap = new Map<string, any[]>();
                variantsRes.data?.forEach(v => {
                    if (!variantMap.has(v.product_id)) variantMap.set(v.product_id, []);
                    variantMap.get(v.product_id)?.push(v);
                });

                const vendorMap = new Map(vendorsRes.data?.map(v => [v.seller_id, v]));
                
                const productsWithVerification = prodsRes.data.map((p: any) => ({
                    ...p,
                    variants: variantMap.get(p.id) || [],
                    is_verified: vendorMap.get(p.seller_id)?.is_verified || false,
                    seller_name: vendorMap.get(p.seller_id)?.store_name || p.seller_name || 'Maison'
                }));
                setProducts(productsWithVerification as any);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    }, []);

    const fetchAndSetOrders = useCallback(async (userId: string) => {
        const { data } = await supabase.from('orders').select('*, items:order_items(*, product:products(name, images, price))').eq('user_id', userId).is('deleted_at', null).order('created_at', { ascending: false });
        if (data) setOrders(data as any);
    }, []);

    const fetchAndSetWishlist = useCallback(async (userId: string) => {
        const { data } = await supabase.from('wishlist').select('product:products(*)').eq('user_id', userId);
        if (data) setWishlist(data.map((w: any) => w.product));
    }, []);

    const fetchAndSetCart = useCallback(async (userId: string) => {
        const { data: cartData } = await supabase.from('carts').select('*, items:cart_items(*, product:products(*, variants:product_variants(*)))').eq('user_id', userId).single();
        if (cartData && cartData.items) {
            const dbCart = cartData.items.map((item: any) => ({
                ...item.products,
                quantity: item.quantity,
                selectedVariant: item.products.variants?.find((v: any) => v.id === item.variant_id),
                variant_id: item.variant_id
            }));
            setCart(dbCart);
        } else {
            setCart([]);
        }
    }, []);

    const fetchUnreadMessagesCount = useCallback(async (userId: string) => {
        const { count, error } = await supabase.from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', userId)
            .eq('read', false);
        
        if (!error && count !== null) {
            setUnreadMessages(count);
        }
    }, []);

    const fetchUserData = useCallback(async (userId: string, userRole?: string, isBanned?: boolean) => {
        const [addrsRes, notifsRes, walletRes, logsRes, paymentsRes, shipmentsRes, payMethodsRes, connAccountsRes, loginHistRes, blockedRes] = await Promise.all([
            supabase.from('addresses').select('*').eq('user_id', userId),
            isBanned ? { data: [] } : supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supabase.from('wallet_transactions').select('*').eq('profile_id', userId).order('created_at', { ascending: false }).limit(20),
            supabase.from('activity_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
            supabase.from('payments').select('*, order:orders(*)').filter('order.user_id', 'eq', userId),
            supabase.from('shipments').select('*, order:orders(*)').filter('order.user_id', 'eq', userId),
            supabase.from('payment_methods').select('*').eq('user_id', userId),
            supabase.from('connected_accounts').select('*').eq('user_id', userId),
            supabase.from('login_history').select('*').eq('user_id', userId).order('login_time', { ascending: false }).limit(10),
            supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId)
        ]);

        if (addrsRes.data) setAddresses(addrsRes.data);
        if (notifsRes.data) setNotifications(notifsRes.data);
        if (walletRes.data) setWalletTransactions(walletRes.data);
        if (logsRes.data) setActivityLogs(logsRes.data);
        if (paymentsRes.data) setPayments(paymentsRes.data as any);
        if (shipmentsRes.data) setShipments(shipmentsRes.data as any);
        if (payMethodsRes.data) setPaymentMethods(payMethodsRes.data);
        if (connAccountsRes.data) setConnectedAccounts(connAccountsRes.data);
        if (loginHistRes.data) setLoginHistory(loginHistRes.data);
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

    const logActivity = useCallback(async (action: string, details?: string, metadata: any = {}) => {
        if (!user) return;
        await supabase.from('activity_logs').insert({
            user_id: user.id,
            action_type: action,
            details,
            metadata
        });
        // Refresh logs
        const { data } = await supabase.from('activity_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
        if (data) setActivityLogs(data);
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
                // Sync to DB
                let { data: cartData } = await supabase.from('carts').select('id').eq('user_id', user.id).single();
                if (!cartData) {
                    const { data: newCart, error: cartError } = await supabase.from('carts').insert({ user_id: user.id }).select().single();
                    if (cartError) throw cartError;
                    cartData = newCart;
                }

                if (cartData) {
                    const { data: existingItem } = await supabase.from('cart_items')
                        .select('id, quantity')
                        .eq('cart_id', cartData.id)
                        .eq('product_id', product.id)
                        .eq('variant_id', variant?.id || null)
                        .maybeSingle();

                    if (existingItem) {
                        const { error } = await supabase.from('cart_items').update({ quantity: existingItem.quantity + quantity }).eq('id', existingItem.id);
                        if (error) throw error;
                    } else {
                        const { error } = await supabase.from('cart_items').insert({
                            cart_id: cartData.id,
                            product_id: product.id,
                            variant_id: variant?.id,
                            quantity: quantity,
                            price_at_add: (variant?.sale_price || variant?.base_price) || product.price
                        });
                        if (error) throw error;
                    }
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
            setCart(prev => {
                const next = prev.filter(p => !(p.id === productId && p.variant_id === variantId));
                return next;
            });
            
            if (user) {
                const { data: cartData, error: cartError } = await supabase.from('carts').select('id').eq('user_id', user.id).single();
                if (cartError) {
                    console.error('Error fetching cart:', cartError);
                    throw cartError;
                }
                if (cartData) {
                    let query = supabase.from('cart_items').delete()
                        .eq('cart_id', cartData.id)
                        .eq('product_id', productId);
                    
                    if (variantId) {
                        query = query.eq('variant_id', variantId);
                    } else {
                        query = query.is('variant_id', null);
                    }
                    
                    const { error } = await query;
                    if (error) {
                        console.error('Error deleting cart item:', error);
                        throw error;
                    }
                }
                await logActivity('remove_from_cart', `Removed item from cart`, { product_id: productId });
                await notify('Cart Updated', 'Item removed from cart', 'success');
            }
        } catch (error) {
            console.error('Error removing from cart:', error);
            await notify('Error', 'Failed to remove item from cart', 'error');
        }
    }, [user, logActivity, notify]);

    const updateQuantity = useCallback(async (productId: string, delta: number, variantId?: string) => {
        try {
            setCart(prev => prev.map(p => {
                if (p.id === productId && p.variant_id === variantId) {
                    return { ...p, quantity: Math.max(1, p.quantity + delta) };
                }
                return p;
            }));

            if (user) {
                const { data: cartData } = await supabase.from('carts').select('id').eq('user_id', user.id).single();
                if (cartData) {
                    let query = supabase.from('cart_items')
                        .select('id, quantity')
                        .eq('cart_id', cartData.id)
                        .eq('product_id', productId);
                    
                    if (variantId) {
                        query = query.eq('variant_id', variantId);
                    } else {
                        query = query.is('variant_id', null);
                    }
                    
                    const { data: item } = await query.single();
                    
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
        if (!user) return;
        const exists = wishlist.some(p => p.id === product.id);
        if (exists) {
            await supabase.from('wishlist').delete().match({ user_id: user.id, product_id: product.id });
            setWishlist(prev => prev.filter(p => p.id !== product.id));
        } else {
            await supabase.from('wishlist').insert({ user_id: user.id, product_id: product.id });
            setWishlist(prev => [...prev, product]);
        }
    }, [user, wishlist]);

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
        if (!user) throw new Error('Not authenticated');
        const itemsPayload = cart.map(item => {
            const qty = Math.max(1, Math.min(9999, Math.floor(Number(item.quantity) || 1)));
            return {
                product_id: item.id,
                variant_id: item.variant_id || null,
                quantity: qty,
                // Intentionally omitting price_at_purchase — set by RPC
            };
        });

        const { data, error } = await supabase.rpc('place_order_atomic', {
            p_user_id: user.id,
            p_shipping_address: details.address,
            p_payment_method: details.paymentMethod,
            p_payment_ref: details.paymentRef,
            p_delivery_fee: details.deliveryFee,
            p_discount_amount: details.discount,
            p_note: details.note,
            p_items: itemsPayload,
            p_is_gift: details.isGift,
            p_gift_message: details.giftMessage,
            p_preferred_delivery_date: details.preferredDeliveryDate,
            p_delivery_slot: details.deliverySlot
        });

        if (error) {
            // Map common RPC errors to user-friendly messages
            const msg = error.message || '';
            if (msg.includes('Insufficient stock')) throw new Error('One or more items are out of stock. Please update your cart.');
            if (msg.includes('Product not found')) throw new Error('A product in your cart is no longer available.');
            if (msg.includes('Unauthorized')) throw new Error('Session expired. Please log in again.');
            throw new Error(msg || 'Failed to place order. Please try again.');
        }
        
        await clearCart();
        
        // Fetch the newly created order with full details
        const orderId = data?.id;
        if (orderId) {
            const { data: newOrder, error: fetchErr } = await supabase
                .from('orders')
                .select('*, items:order_items(*, product:products(name, images, price)), buyer:profiles!user_id(*)')
                .eq('id', orderId)
                .single();
            if (!fetchErr && newOrder) {
                // Update orders state immediately without waiting for realtime
                setOrders(prev => [newOrder as any, ...prev]);
                return newOrder;
            }
        }
        
        // Fallback: refresh all user data
        await fetchUserData(user.id);
        return data;
    }, [user, cart, clearCart, fetchUserData]);

    const fetchVendorProfile = useCallback(async (sellerId: string) => {
        const { data } = await supabase.from('vendor_profiles').select('*').eq('seller_id', sellerId).single();
        return data;
    }, []);

    const addAddress = useCallback(async (address: Partial<Address>) => {
        if (!user) return;
        if (address.is_default) {
            await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
        }
        await supabase.from('addresses').insert({ ...address, user_id: user.id });
        const { data } = await supabase.from('addresses').select('*').eq('user_id', user.id);
        if (data) setAddresses(data);
    }, [user]);

    const fetchMessages = useCallback(async () => {
      if (!user) return [];
      
      // Fetch messages without reactions first to avoid join errors
      const { data: messages, error } = await supabase.from('messages')
          .select('*, sender:profiles!sender_id(full_name, avatar_url), receiver:profiles!receiver_id(full_name, avatar_url), product:products(id, name, images, price, slug), reply_to:messages!reply_to_id(*)')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      if (!messages || messages.length === 0) return [];

      // Fetch reactions separately
      const messageIds = messages.map(m => m.id);
      const { data: reactions, error: reactionsError } = await supabase.from('message_reactions')
          .select('message_id, emoji, user_id')
          .in('message_id', messageIds);

      if (reactionsError) {
          console.error('Error fetching message reactions:', reactionsError);
          // Still return messages even if reactions fail
          return (messages as any[]) || [];
      }

      // Map reactions to messages
      const messagesWithReactions = messages.map(m => ({
          ...m,
          reactions: reactions?.filter(r => r.message_id === m.id) || []
      }));
      return (messagesWithReactions as any[]) || [];
    }, [user]);

    const markMessagesAsRead = useCallback(async (senderId: string) => {
        if (!user) return;
        const { error } = await supabase.from('messages')
            .update({ read: true })
            .eq('sender_id', senderId)
            .eq('receiver_id', user.id)
            .eq('read', false);
        
        if (error) {
            console.error('Error marking messages as read:', error);
        } else {
            await fetchUnreadMessagesCount(user.id);
        }
    }, [user, fetchUnreadMessagesCount]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!user) return;
        const { error } = await supabase.from('messages').delete().eq('id', messageId);
        if (error) {
            console.error("Message delete failed:", error);
            return;
        }
    }, [user]);

    const sendMessage = useCallback(async (to: string, text: string, productId?: string, orderId?: string, attachment?: { url: string, type: string }, replyToId?: string) => {
        if (!user) return;
        
        if (blockedUsers.has(to)) {
            addToast("You cannot send messages to this user.", "error");
            return;
        }
        
        const { error } = await supabase.from('messages').insert({
            sender_id: user.id,
            receiver_id: to,
            body: text,
            product_id: productId,
            order_id: orderId,
            attachment_url: attachment?.url,
            attachment_type: attachment?.type,
            reply_to_id: replyToId,
            read: false
        });

        if (error) {
            console.error("Message send failed:", error);
            return;
        }

        const { data: receiverProfile } = await supabase.from('profiles').select('role').eq('id', to).single();
        const receiverRole = receiverProfile?.role;

        let targetLink = '/messages';
        if (receiverRole === 'buyer') {
            targetLink = `/buyer?tab=inbox&chat=${user.id}`;
        } else if (receiverRole === 'seller') {
            targetLink = `/seller?tab=messages&chat=${user.id}`;
        } else if (receiverRole === 'admin') {
            targetLink = `/admin/messages?chat=${user.id}`;
        }

        await supabase.from('notifications').insert({
            user_id: to,
            type: 'message',
            title: `New Message from ${user.name}`,
            message: text,
            read: false,
            link: targetLink,
            created_at: new Date().toISOString()
        });
    }, [user, blockedUsers, addToast]);

    const getActiveOfferForProduct = useCallback((productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product) return null;

        // 1. Find product-specific offers
        const specificOffers = offers.filter(o => 
            o.target_type === 'product' && 
            o.target_ids?.includes(productId)
        );

        if (specificOffers.length > 0) {
            // Sort by highest value (assuming same currency/type for simplicity in sorting)
            return specificOffers.sort((a, b) => b.value - a.value)[0];
        }

        // 2. Find category-specific offers
        const categoryOffers = offers.filter(o => 
            o.target_type === 'category' && 
            o.target_ids?.includes(product.category) &&
            (o.scope === 'platform' || o.seller_id === product.seller_id)
        );

        if (categoryOffers.length > 0) {
            return categoryOffers.sort((a, b) => b.value - a.value)[0];
        }

        // 3. Find store-wide offers from this seller
        const storeOffers = offers.filter(o => 
            o.target_type === 'store' && 
            o.seller_id === product.seller_id
        );

        if (storeOffers.length > 0) {
            return storeOffers.sort((a, b) => b.value - a.value)[0];
        }

        // 4. Find platform-wide offers
        const platformOffers = offers.filter(o => 
            o.scope === 'platform' && 
            (!o.target_type || o.target_type === 'store')
        );

        return platformOffers.length > 0 ? platformOffers.sort((a, b) => b.value - a.value)[0] : null;
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
        if (!item) return;

        await supabase.from('returns').insert({
            order_id: orderId,
            order_item_id: itemId,
            seller_id: item.seller_id,
            reason,
            status: 'requested'
        });
        await logActivity('request_return', `Requested return for order ${orderId}`, { order_id: orderId, item_id: itemId });
        addToast('Return request submitted', 'success');
    }, [user, logActivity, addToast]);

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
                if (type === 'like') return { ...p, likes: p.likes + 1 };
                if (type === 'share') return { ...p, shares: p.shares + 1 };
                if (type === 'comment') return { ...p, comments_count: p.comments_count + 1 };
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
        const { error } = await supabase.rpc('update_order_status_rbac', { p_order_id: id, p_new_status: status });
        if (error) {
            console.error('Status update failed', error);
            throw error;
        }
        if (reason) {
            await supabase.from('orders').update({ cancel_reason: reason }).eq('id', id);
        }
        if (user) await logActivity('update_order_status', `Order ${id} status changed to ${status}`, { order_id: id, status, reason });
        
        // Send notification to buyer
        const { data: order } = await supabase.from('orders').select('user_id').eq('id', id).single();
        if (order) {
            let message = `Your order #${id.slice(0,8)} is now ${status}`;
            if (status === 'cancelled' && reason) {
                message = `Your order #${id.slice(0,8)} was cancelled by the seller. Reason: ${reason}`;
            }
            
            await supabase.from('notifications').insert({
                user_id: order.user_id,
                type: 'order',
                title: status === 'cancelled' ? 'Order Cancelled' : 'Order Updated',
                message,
                read: false,
                created_at: new Date().toISOString()
            });
        }
    }, [user, logActivity]);

    const cancelOrder = useCallback(async (id: string, reason: string) => { 
        const { error } = await supabase.rpc('update_order_status_rbac', { p_order_id: id, p_new_status: 'cancelled' });
        if (error) {
            console.error('Cancel order failed', error);
            addToast("Failed to cancel order", "error");
            throw error;
        }
        await supabase.from('orders').update({ cancel_reason: reason }).eq('id', id); 
        if (user) await logActivity('cancel_order', `Order ${id} cancelled`, { order_id: id, reason });
        
        // Send notification to seller
        const { data: order } = await supabase.from('orders').select('seller_id').eq('id', id).single();
        if (order) {
            await supabase.from('notifications').insert({
                user_id: order.seller_id,
                type: 'order',
                title: 'Order Cancelled',
                message: `Order #${id.slice(0,8)} was cancelled by the buyer. Reason: ${reason}`,
                read: false,
                created_at: new Date().toISOString()
            });
        }

        addToast("Order cancelled successfully", "success");
        fetchUserData(user?.id!); 
    }, [user, logActivity, addToast, fetchUserData]);

    const deleteOrder = useCallback(async (id: string) => { 
        await supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', id); 
        fetchUserData(user?.id!); 
    }, [user, fetchUserData]);

    const deleteAddress = useCallback(async (id: string) => { 
        await supabase.from('addresses').delete().eq('id', id); 
        if (user) await logActivity('delete_address', `Address deleted`, { address_id: id });
        fetchUserData(user?.id!); 
    }, [user, logActivity, fetchUserData]);
    const updateAddress = useCallback(async (id: string, address: Partial<Address>) => {
        if (!user) return;
        if (address.is_default) {
            await supabase.from('addresses').update({ is_default: false }).eq('user_id', user.id);
        }
        await supabase.from('addresses').update(address).eq('id', id);
        if (user) await logActivity('update_address', `Address updated`, { address_id: id });
        fetchUserData(user?.id!);
    }, [user, logActivity, fetchUserData]);

    const updateUserProfile = useCallback(async (data: Partial<User>) => { 
        if (!user) return;
        // SECURITY: Strip fields that must NEVER be set client-side
        // Role escalation, ban bypass, and credit manipulation prevented here.
        // Supabase RLS is the authoritative gate — this is defense-in-depth.
        const {
            role, is_banned, is_admin, wallet_balance, points,
            deleted_at, id, created_at, email,
            ...safe
        } = data as any;
        
        // Additional sanitization of text fields
        if (safe.name)     safe.name     = safe.name.slice(0, 100).replace(/<[^>]*>/g, '').trim();
        if (safe.bio)      safe.bio      = safe.bio.slice(0, 500).replace(/<[^>]*>/g, '').trim();
        if (safe.phone)    safe.phone    = safe.phone.slice(0, 20).replace(/[^0-9+\s-]/g, '').trim();
        if (safe.location) safe.location = safe.location.slice(0, 100).replace(/<[^>]*>/g, '').trim();
        
        const { error } = await supabase.from('profiles').update(safe).eq('id', user.id); 
        if (error) {
            addToast(error.message, 'error');
            throw error;
        }
        await logActivity('update_profile', 'User profile updated');
        setUser({ ...user, ...safe });
        fetchUserData(user.id);
    }, [user, logActivity, fetchUserData, addToast]);

    const deleteAccount = useCallback(async () => { if(user) await supabase.rpc('delete_user'); logout(); }, [user, logout]);

    const softDeleteMessage = useCallback(async (id: string) => {
        if (!user) return;
        const { error } = await supabase.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('sender_id', user.id);
        if (error) {
            console.error("Message soft delete failed:", error);
            addToast("Failed to delete message", "error");
        }
    }, [user, addToast]);

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

    const addReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!user) return;
        const { error } = await supabase.from('message_reactions').insert({
            message_id: messageId,
            user_id: user.id,
            emoji
        });
        if (error && error.code !== '23505') { // Ignore duplicate reactions
            console.error("Add reaction failed:", error);
        }
    }, [user]);

    const removeReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!user) return;
        const { error } = await supabase.from('message_reactions').delete().match({
            message_id: messageId,
            user_id: user.id,
            emoji
        });
        if (error) {
            console.error("Remove reaction failed:", error);
        }
    }, [user]);

    const markNotificationRead = useCallback(async (id: string) => { await supabase.from('notifications').update({ read: true }).eq('id', id); fetchUserData(user?.id!); }, [user, fetchUserData]);
    const markAllNotificationsRead = useCallback(async () => { await supabase.from('notifications').update({ read: true }).eq('user_id', user?.id); fetchUserData(user?.id!); }, [user, fetchUserData]);
    const dismissNotification = useCallback(async (id: string) => { await supabase.from('notifications').delete().eq('id', id); fetchUserData(user?.id!); }, [user, fetchUserData]);

    const updateVendorProfile = useCallback(async (data: Partial<VendorProfile>) => {
        if (!user) return;
        // SECURITY: Strip server-managed fields
        const { seller_id, is_verified, trust_score, total_sales, verification_level, ...safe } = data as any;
        // Sanitize text inputs
        if (safe.store_name)  safe.store_name  = (safe.store_name  as string).slice(0, 100).replace(/<[^>]*>/g, '').trim();
        if (safe.description) safe.description = (safe.description as string).slice(0, 1000).replace(/<[^>]*>/g, '').trim();
        if (safe.address)     safe.address     = (safe.address     as string).slice(0, 200).replace(/<[^>]*>/g, '').trim();
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

    const value: AppContextType = useMemo(() => ({
        user, setUser, isLoading, products, categories, cart, wishlist, orders, notifications, unreadMessages, addresses, walletTransactions, activityLogs, offers, payments, shipments, trustBadges, socialPosts, followers, isDark, vendorProfile, paymentMethods, connectedAccounts, loginHistory, staffAccounts, shippingZones, isCartOpen, blockedUsers, recentlyViewed,
        toggleTheme,
        blockUser,
        unblockUser,
        logout,
        notify,
        addToCart, removeFromCart, updateQuantity, clearCart,
        openCart, closeCart,
        toggleWishlist, isInWishlist: (pid: string) => wishlist.some(p => p.id === pid),
        followSeller, unfollowSeller, isFollowing,
        refreshProducts: fetchPublicData, 
        refreshNotifications,
        refreshWishlist,
        refreshCart,
        placeOrder,
        updateOrderStatus,
        cancelOrder,
        deleteOrder,
        fetchVendorProfile, addAddress, 
        deleteAddress,
        updateAddress,
        updateUserProfile,
        deleteAccount,
        fetchMessages, markMessagesAsRead, sendMessage, deleteMessage,
        softDeleteMessage,
        reportUser,
        addReaction,
        removeReaction,
        markNotificationRead,
        markAllNotificationsRead,
        dismissNotification,
        getActiveOfferForProduct,
        logActivity,
        requestReturn,
        addOrderNote,
        fetchOrderDetails,
        interactWithPost,
        updateVendorProfile,
        addToRecentlyViewed,
        addReview,
        fetchReviews
    }), [
        user, isLoading, products, categories, cart, wishlist, orders, notifications, unreadMessages, addresses, walletTransactions, activityLogs, offers, payments, shipments, trustBadges, socialPosts, followers, isDark, vendorProfile, paymentMethods, connectedAccounts, loginHistory, staffAccounts, shippingZones, isCartOpen, blockedUsers, recentlyViewed,
        toggleTheme, blockUser, unblockUser, logout, notify, addToCart, removeFromCart, updateQuantity, clearCart, openCart, closeCart, toggleWishlist, followSeller, unfollowSeller, isFollowing, fetchPublicData, refreshNotifications, refreshWishlist, refreshCart, placeOrder, updateOrderStatus, cancelOrder, deleteOrder, fetchVendorProfile, addAddress, deleteAddress, updateAddress, updateUserProfile, deleteAccount, fetchMessages, markMessagesAsRead, sendMessage, deleteMessage, softDeleteMessage, reportUser, addReaction, removeReaction, markNotificationRead, markAllNotificationsRead, dismissNotification, getActiveOfferForProduct, logActivity, requestReturn, addOrderNote, fetchOrderDetails, interactWithPost, updateVendorProfile, addToRecentlyViewed, addReview, fetchReviews
    ]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppState = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppState must be used within AppStateProvider");
    return context;
};
