
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    Store, MapPin, Star, BadgeCheck, MessageSquare, 
    LayoutGrid, Package, Undo2, Wallet, 
    History as HistoryIcon, RefreshCw, ShoppingBag, Copy, 
    CreditCard, ArrowDownLeft, ArrowUpRight, 
    Phone, Mail, Save, Bell, Edit3, Trash2, Shield, 
    Lock as LockIcon, LogOut, X, Tag, Send, Check, ChevronLeft, User, Smartphone, Plus, Sparkles, DollarSign,
    Repeat, Percent, Ticket, Clock, Search, Settings, AlertCircle, Printer, RotateCcw, Heart, TrendingUp
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Card, Badge, Input, useToast, ConfirmDialog, Label, Textarea, Switch, Skeleton, ReceiptModal, PremiumStatCard, ModernFollowCard, GraphicalTag } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { OrderTracking } from '../components/CheckoutComponents';
import { formatTZS, CURRENCY } from '../constants';
import { ChatMessage, VendorProfile, Address, ReturnRequest, Order, Offer, Product } from '../types';
import * as aiService from '../services/geminiService';
import { BuyerOrders } from '../components/BuyerOrders';
import { BuyerMessages } from '../components/BuyerMessages';
import { ProductCard } from '../components/ProductCard';
import { BuyerSettingsPage } from './BuyerSettingsPage';
import { BuyerReturns } from '../components/BuyerReturns';
import { useBuyerStats } from '../src/hooks/useBuyerStats';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

// --- Sub-Components ---

const BuyerOffers = () => {
    const { addToast } = useToast();
    const [offers, setOffers] = useState<(Offer & { vendor: VendorProfile })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'expiring' | 'high_value'>('all');

    useEffect(() => {
        const fetchOffers = async () => {
            setIsLoading(true);
            const now = new Date().toISOString();
            const { data: offersData, error: offersError } = await supabase
                .from('offers')
                .select('*')
                .eq('status', 'active')
                .or(`end_date.is.null,end_date.gte.${now}`)
                .order('created_at', { ascending: false });

            if (offersError) {
                console.error("Error fetching offers", offersError);
                setIsLoading(false);
                return;
            }

            const sellerIds = [...new Set(offersData?.map(o => o.seller_id))];
            const { data: vendorsData } = await supabase
                .from('vendor_profiles')
                .select('seller_id, store_name, logo_url, is_verified')
                .in('seller_id', sellerIds);

            const vendorsMap = new Map(vendorsData?.map(v => [v.seller_id, v]));
            const offersWithVendors = offersData?.map(o => ({
                ...o,
                vendor: vendorsMap.get(o.seller_id)
            }));

            setOffers(offersWithVendors as any);
            setIsLoading(false);
        };
        fetchOffers();
    }, []);

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        addToast("Coupon code copied to clipboard", "success");
    };

    const filteredOffers = useMemo(() => {
        return offers.filter(o => {
            if (filter === 'all') return true;
            if (filter === 'high_value') return o.type === 'percentage' ? o.value >= 20 : o.value >= 10000;
            if (filter === 'expiring') {
                if (!o.end_date) return false;
                const daysLeft = (new Date(o.end_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
                return daysLeft <= 3;
            }
            return true;
        });
    }, [offers, filter]);

    const getGradient = (offer: Offer) => {
        if (offer.type === 'percentage' && offer.value >= 25) return 'from-rose-500 to-pink-600';
        if (offer.type === 'fixed') return 'from-emerald-500 to-teal-600';
        return 'from-blue-600 to-indigo-700';
    };

    if (isLoading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1,2,3].map(i => <div key={i} className="h-48 rounded-none bg-foreground/[0.04]"></div>)}
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                    <h2 className="text-2xl font-serif font-light text-foreground">Wallet & Rewards</h2>
                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mt-1">Exclusive vouchers curated for you</p>
                </div>
                <div className="flex bg-foreground/[0.04] p-1 rounded-none">
                    {['all', 'high_value', 'expiring'].map(f => (
                        <button key={f} onClick={() => setFilter(f as any)} className={`px-4 py-2.5 rounded-none text-[10px] uppercase tracking-[0.2em] transition-all ${filter === f ? 'bg-foreground text-background shadow-sm' : 'text-foreground/60 hover:text-foreground'}`}>
                            {f.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            {filteredOffers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-foreground/20 rounded-none text-foreground/40">
                    <Ticket className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-[10px] uppercase tracking-[0.2em]">No active offers found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {(filteredOffers as any[]).map(offer => (
                        <div key={offer.id} className="group relative bg-background rounded-none overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-foreground/10 flex flex-col h-full">
                            <div className={`h-24 bg-gradient-to-r ${getGradient(offer)} p-6 relative overflow-hidden`}>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-background/10 rounded-full blur-[40px] pointer-events-none translate-x-10 -translate-y-10"></div>
                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-none bg-background p-0.5 shadow-lg overflow-hidden">
                                            <img src={offer.vendor?.logo_url || `https://ui-avatars.com/api/?name=${offer.vendor?.store_name}`} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white/80 uppercase tracking-[0.2em]">{offer.vendor?.store_name}</p>
                                            {offer.vendor?.is_verified && <div className="flex items-center gap-1 text-[8px] text-white bg-background/20 px-2 py-0.5 rounded-none w-fit mt-1"><BadgeCheck className="w-2.5 h-2.5"/> Verified</div>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-3xl font-serif text-white tracking-tight leading-none">{offer.type === 'percentage' ? `${offer.value}%` : formatTZS(offer.value)}</span>
                                        <span className="block text-[9px] text-white/80 uppercase tracking-[0.2em] mt-1">{offer.type === 'percentage' ? 'Off' : 'Save'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 flex-1 flex flex-col relative">
                                <div className="mb-6">
                                    <h3 className="font-serif text-foreground text-lg leading-snug mb-2">{offer.title}</h3>
                                    <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground leading-relaxed">{offer.min_order_value > 0 ? `Valid on orders above ${formatTZS(offer.min_order_value)}.` : 'No minimum spend required.'}</p>
                                </div>
                                <div className="mt-auto space-y-4">
                                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {offer.end_date ? new Date(offer.end_date).toLocaleDateString() : 'No Expiry'}</span>
                                        <span className="flex items-center gap-1"><Tag className="w-3 h-3"/> Storewide</span>
                                    </div>
                                    <button onClick={() => handleCopy(offer.code)} className="group/btn w-full h-12 relative flex items-center justify-between px-1 bg-foreground/[0.04] rounded-none border border-dashed border-foreground/20 hover:border-foreground/40 transition-all cursor-copy">
                                        <div className="flex items-center gap-3 pl-3">
                                            <div className="w-8 h-8 rounded-none bg-background flex items-center justify-center shadow-sm border border-foreground/10">
                                                <Ticket className="w-4 h-4 text-foreground/60 group-hover/btn:text-foreground" />
                                            </div>
                                            <span className="font-mono text-sm tracking-[0.1em] text-foreground">{offer.code}</span>
                                        </div>
                                        <div className="pr-4 text-[9px] uppercase tracking-[0.2em] text-foreground opacity-0 group-hover/btn:opacity-100 transition-opacity flex items-center gap-1">Copy <Copy className="w-3 h-3"/></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const ProductOrderTag = ({ product, order }: { product?: Product, order?: Order }) => {
    if (!product && !order) return null;
    return (
        <div className="mb-4">
            <GraphicalTag 
                type={order ? 'order' : 'support'} 
                label={order ? `Order #${order.id.slice(0,8)}` : product?.name || 'Product'}
                id={order?.id || product?.id}
            />
            {product && (
                <div className="mt-2 p-3 bg-foreground/[0.05] rounded-xl flex items-center gap-3 border border-foreground/10">
                    {product.images?.[0] && (
                        <img src={product.images[0]} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold truncate">{product.name}</p>
                    </div>
                </div>
            )}
        </div>
    );
};


const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background p-4 border border-foreground/10 rounded-none shadow-2xl">
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground mb-1">{label || payload[0].name}</p>
                <p className="font-serif text-lg text-foreground">
                    {formatTZS(payload[0].value)}
                </p>
            </div>
        );
    }
    return null;
};

export const BuyerPage = () => {
    const { user, orders, cancelOrder, deleteOrder, addToCart, fetchVendorProfile, wishlist, followers, unfollowSeller } = useAppState();
    const buyerStats = useBuyerStats();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inbox' | 'offers' | 'returns' | 'settings' | 'wishlist' | 'follows'>(
        (searchParams.get('tab') as any) || 'dashboard'
    );
    const [receiptOrder, setReceiptOrder] = useState<{ order: Order, seller: VendorProfile } | null>(null);
    const [followedVendors, setFollowedVendors] = useState<VendorProfile[]>([]);
    const [isFollowsLoading, setIsFollowsLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'follows' && followers.length > 0) {
            const fetchFollowedVendors = async () => {
                setIsFollowsLoading(true);
                const sellerIds = followers.map(f => f.seller_id);
                const { data, error } = await supabase
                    .from('vendor_profiles')
                    .select('*')
                    .in('seller_id', sellerIds);
                
                if (data) setFollowedVendors(data);
                setIsFollowsLoading(false);
            };
            fetchFollowedVendors();
        } else if (activeTab === 'follows' && followers.length === 0) {
            setFollowedVendors([]);
        }
    }, [activeTab, followers]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) setActiveTab(tab as any);
    }, [searchParams]);

    if (!user) return null;

    const handleReorder = (order: Order) => {
        order.items?.forEach(item => {
            if (item.products) addToCart(item.products, undefined, item.quantity);
        });
        navigate('/cart');
    };

    const handleContactSeller = (sellerId: string, context?: { type: 'order' | 'return' | 'support', id: string, label: string }) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', 'inbox');
        params.set('sellerId', sellerId);
        if (context) {
            params.set('contextType', context.type);
            params.set('contextId', context.id);
            params.set('contextLabel', context.label);
        }
        setSearchParams(params);
        setActiveTab('inbox');
    };

    // Fixed: Explicitly typed stats array to resolve spread assignment issues with 'any' value types
    const stats: { title: string, value: string | number, icon: any, color: string }[] = [
        { title: 'Total Orders', value: buyerStats.orderCount, icon: Package, color: 'text-brand-600' },
        { title: 'Total Spent', value: formatTZS(buyerStats.totalSpent), icon: DollarSign, color: 'text-indigo-600' },
        { title: 'Points', value: user.points || 0, icon: Star, color: 'text-amber-500' },
        { title: 'Wallet', value: formatTZS(user.wallet_balance || 0), icon: Wallet, color: 'text-emerald-500' }
    ];

    const changeTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', tab);
        setSearchParams(params);
        setActiveTab(tab as any);
    };

    return (
        <div className="min-h-screen bg-background font-sans pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:pt-28 px-4 md:px-8 selection:bg-foreground selection:text-background">
            <div className="container mx-auto max-w-7xl">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col md:flex-row justify-between items-end mb-6 md:mb-10 gap-4"
                >
                    <div className="space-y-4">
                         <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-foreground flex items-center justify-center rounded-2xl shadow-xl shadow-foreground/10">
                                <User className="w-6 h-6 text-background" />
                            </div>
                            <h1 className="text-3xl md:text-6xl font-serif font-light tracking-tight text-foreground">
                                Hello, {user.name?.split(' ')[0] || 'User'}
                            </h1>
                         </div>
                         <p className="text-sm text-foreground/60 font-medium tracking-tight max-w-md">
                            Welcome to your premium buyer dashboard. Manage your orders and account with ease.
                         </p>
                    </div>
                </motion.div>

                <motion.div 
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0, y: 20 },
                        visible: {
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1], staggerChildren: 0.05 }
                        }
                    }}
                    className="flex overflow-x-auto p-1.5 bg-foreground/[0.04] backdrop-blur-md rounded-2xl mb-8 no-scrollbar border border-foreground/8 sticky top-[64px] z-20"
                >
                    {[
                        { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
                        { id: 'orders', label: 'My Orders', icon: ShoppingBag },
                        { id: 'wishlist', label: 'Wishlist', icon: Heart },
                        { id: 'follows', label: 'Follows', icon: Store },
                        { id: 'inbox', label: 'Messages', icon: MessageSquare },
                        { id: 'offers', label: 'Rewards', icon: Ticket },
                        { id: 'returns', label: 'Returns', icon: RotateCcw },
                        { id: 'settings', label: 'Account', icon: Settings }
                    ].map(tab => (
                        <motion.button 
                            key={tab.id} 
                            variants={{
                                hidden: { opacity: 0, x: -10 },
                                visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
                            }}
                            onClick={() => changeTab(tab.id)} 
                            className={`flex-shrink-0 flex items-center justify-center gap-2 py-3 px-4 md:px-6 rounded-xl text-[10px] uppercase tracking-[0.15em] transition-all duration-200 ${
                                activeTab === tab.id 
                                ? 'bg-background text-foreground shadow-sm font-bold' 
                                : 'text-foreground/45 hover:text-foreground/70 font-semibold'
                            }`}
                        >
                            <tab.icon className={`w-4 h-4 stroke-[1.5] ${activeTab === tab.id ? 'scale-110' : ''}`} /> 
                            <span className="whitespace-nowrap">{tab.label}</span>
                        </motion.button>
                    ))}
                </motion.div>

                {activeTab === 'dashboard' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-10"
                    >
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {stats.map((s, i) => (
                                <PremiumStatCard 
                                    key={i} 
                                    title={s.title} 
                                    value={s.value} 
                                    icon={s.icon} 
                                    trend={i === 1 ? { value: "+12.5%", positive: true } : undefined}
                                />
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="group lg:col-span-2 p-8 rounded-none shadow-none border border-foreground/10 bg-transparent hover:border-foreground/30 transition-all duration-500">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground">Spending History (Last 6 Months)</h3>
                                </div>
                                <div className="h-64 min-w-0 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={buyerStats.spendingHistory}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                            <XAxis 
                                                dataKey="month" 
                                                hide
                                            />
                                            <YAxis 
                                                hide
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar 
                                                dataKey="amount" 
                                                fill="currentColor" 
                                                className="text-foreground"
                                                radius={[2, 2, 0, 0]} 
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="group p-8 rounded-none shadow-none border border-foreground/10 bg-transparent hover:border-foreground/30 transition-all duration-500">
                                <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-8">Category Split</h3>
                                <div className="h-64 min-w-0 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={buyerStats.categoryDistribution}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                                nameKey="name"
                                                fill="currentColor"
                                                className="text-foreground"
                                            >
                                                {buyerStats.categoryDistribution.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.15)} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <Card className="group p-8 rounded-none shadow-none border border-foreground/10 bg-transparent hover:border-foreground/30 transition-all duration-500">
                                <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-8">Recent Orders</h3>
                                <div className="space-y-4">
                                    {orders.slice(0,3).map(o => (
                                        <div key={o.id} className="flex justify-between items-center p-4 border-b border-foreground/10 last:border-0 hover:bg-foreground/[0.04] transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-none bg-foreground/[0.04] flex items-center justify-center"><Package className="w-5 h-5 text-foreground"/></div>
                                                <div>
                                                    <p className="font-serif text-lg text-foreground">Order #{o.id.slice(0,8)}</p>
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">{o.status}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => changeTab('orders')} className="p-2 hover:bg-foreground/10 transition-colors"><ChevronLeft className="w-4 h-4 rotate-180 text-foreground"/></button>
                                        </div>
                                    ))}
                                    {orders.length === 0 && (
                                        <div className="flex items-center justify-center h-48 text-[10px] uppercase tracking-[0.2em] opacity-40 text-foreground">No orders yet</div>
                                    )}
                                </div>
                            </Card>
                            <Card className="group p-8 rounded-none shadow-none border border-foreground/10 bg-primary hover:opacity-90 transition-all duration-500 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-background/5 rounded-full blur-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
                                <div className="relative z-10">
                                    <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-background mb-8">Estimated Savings</h3>
                                    <p className="text-background/80 text-sm font-medium mb-8">You've saved approximately {formatTZS(buyerStats.savings)} this month using platform vouchers and offers.</p>
                                    <Button variant="outline" onClick={() => changeTab('offers')} className="bg-transparent border-background/20 text-background hover:bg-background/10 h-12 rounded-none text-[10px] font-black uppercase tracking-widest">Explore More Deals</Button>
                                </div>
                            </Card>
                        </div>
                    </motion.div>
                )}

                {activeTab === 'orders' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <BuyerOrders 
                            orders={orders} 
                            onCancel={cancelOrder} 
                            onDelete={deleteOrder}
                            onReorder={handleReorder} 
                            onContactSeller={handleContactSeller} 
                            onPrintReceipt={(order, seller) => setReceiptOrder({ order, seller: seller || {} as VendorProfile })} 
                            fetchVendorProfile={fetchVendorProfile} 
                        />
                    </motion.div>
                )}

                {activeTab === 'wishlist' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-foreground">Wishlist <span className="text-foreground/40 font-normal">({wishlist.length})</span></h2>
                        </div>
                        {wishlist.length === 0 ? (
                            <div className="py-20 text-center border border-dashed border-foreground/15 rounded-2xl">
                                <p className="text-4xl mb-4">🤍</p>
                                <p className="font-semibold text-foreground/70 mb-1">Your wishlist is empty</p>
                                <p className="text-sm text-foreground/40">Tap the heart on any product to save it</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-8 md:gap-x-5 md:gap-y-10">
                                {wishlist.map((p, i) => <ProductCard key={p.id} product={p} index={i} onClick={() => navigate(`/product/${p.id}`)} />)}
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === 'follows' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        <div className="flex justify-between items-end">
                            <div>
                                <h2 className="text-2xl font-black font-display uppercase tracking-tight text-foreground">Followed Brands</h2>
                                <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mt-1">Stores you're keeping an eye on</p>
                            </div>
                        </div>
                        {isFollowsLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                                {[1,2,3].map(i => <div key={i} className="h-64 bg-foreground/[0.04] rounded-none"></div>)}
                            </div>
                        ) : followedVendors.length === 0 ? (
                            <div className="text-center py-20 text-foreground/40 font-black uppercase text-[10px] tracking-[0.2em] border border-dashed border-foreground/20 rounded-none">No brands followed yet</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {followedVendors.map(v => (
                                    <ModernFollowCard 
                                        key={v.seller_id} 
                                        vendor={v} 
                                        onUnfollow={() => unfollowSeller(v.seller_id)}
                                        onViewStore={() => navigate(`/store/${v.seller_id}`)}
                                    />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {activeTab === 'inbox' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <BuyerMessages 
                            userId={user.id} 
                            initialSellerId={searchParams.get('sellerId')} 
                        />
                    </motion.div>
                )}

                {activeTab === 'returns' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <BuyerReturns 
                            userId={user.id} 
                            onContactSeller={handleContactSeller}
                        />
                    </motion.div>
                )}

                {activeTab === 'offers' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <BuyerOffers />
                    </motion.div>
                )}
                {activeTab === 'settings' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <BuyerSettingsPage />
                    </motion.div>
                )}
            </div>
            {receiptOrder && <ReceiptModal isOpen={!!receiptOrder} order={receiptOrder.order} seller={receiptOrder.seller} onClose={() => setReceiptOrder(null)} />}
        </div>
    );
};