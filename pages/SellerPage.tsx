
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    LayoutGrid, Package, MessageSquare, Settings, 
    Wallet, Eye, Clock, Percent, ShoppingBag, RotateCcw, ExternalLink, Store
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { useSellerStats } from '../src/hooks/useSellerStats';
import { Card, Badge, Skeleton, PremiumStatCard } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { VendorProfile } from '../types';
import { formatTZS } from '../constants';
import { SellerAnalytics } from '../components/SellerAnalytics';
import { AdvancedAnalytics } from '../components/AdvancedAnalytics';
import { SellerInventory } from '../components/SellerInventory';
import { SellerOffers } from '../components/SellerOffers';
import { SellerOrders } from '../components/SellerOrders';
import { SellerMessages } from '../components/SellerMessages';
import { SellerSettingsPage } from './SellerSettingsPage';
import { SellerReturns } from '../components/SellerReturns';

export const SellerPage = () => {
    const { user, products, refreshProducts } = useAppState();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'orders' | 'messages' | 'offers' | 'returns' | 'settings'>((searchParams.get('tab') as any) || 'dashboard');
    const [preselectedProduct, setPreselectedProduct] = useState<any>(null);
    const [selectedChatUser, setSelectedChatUser] = useState<string | null>(searchParams.get('chat'));
    const [selectedProductId, setSelectedProductId] = useState<string | null>(searchParams.get('productId'));
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get('orderId'));
    const { stats, loading: loadingStats } = useSellerStats(user?.id);
    const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);

    const myProducts = products.filter(p => p.seller_id === user?.id);

    useEffect(() => {
        if (!user) return;
        
        const loadVendorProfile = async () => {
            const { data: profile } = await supabase.from('vendor_profiles').select('*').eq('seller_id', user.id).single();
            if (profile) setVendorProfile(profile);
        };
        
        loadVendorProfile();
    }, [user]);

    if (!user || user.role !== 'seller') return null;

    return (
        <div className="min-h-screen bg-[#f5f2ed] dark:bg-[#121212] font-sans pb-20 pt-28 px-4 md:px-8 selection:bg-[#1a1a1a] selection:text-white dark:selection:bg-white dark:selection:text-black">
            <div className="container mx-auto max-w-7xl">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6"
                >
                    <div className="space-y-4">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#1a1a1a] dark:bg-white flex items-center justify-center shadow-lg shadow-[#1a1a1a]/10 dark:shadow-white/10">
                                <Store className="w-5 h-5 text-white dark:text-black" />
                            </div>
                            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-[#1a1a1a]/40 dark:text-white/40">Merchant Console</p>
                         </div>
                         <h1 className="text-5xl md:text-7xl font-serif font-light text-[#1a1a1a] dark:text-white tracking-tight leading-[0.9]">
                             {vendorProfile?.store_name || user.name}'s <span className="italic font-light">Store</span>
                         </h1>
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
                    className="flex overflow-x-auto p-2 bg-[#1a1a1a]/5 dark:bg-[#f5f2ed]/5 backdrop-blur-xl rounded-none mb-12 no-scrollbar border border-[#1a1a1a]/10 dark:border-[#f5f2ed]/10 shadow-xl shadow-[#1a1a1a]/5 dark:shadow-black/20"
                >
                    {[
                        { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
                        { id: 'products', label: 'Inventory', icon: Package },
                        { id: 'orders', label: 'Orders', icon: ShoppingBag },
                        { id: 'messages', label: 'Messages', icon: MessageSquare },
                        { id: 'offers', label: 'Campaigns', icon: Percent },
                        { id: 'returns', label: 'Returns', icon: RotateCcw },
                        { id: 'settings', label: 'Settings', icon: Settings }
                    ].map(tab => (
                        <motion.button 
                            key={tab.id} 
                            variants={{
                                hidden: { opacity: 0, x: -10 },
                                visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
                            }}
                            onClick={() => setActiveTab(tab.id as any)} 
                            className={`flex-1 flex items-center justify-center gap-3 py-4 px-8 rounded-none text-[10px] uppercase tracking-[0.2em] transition-all duration-500 ${activeTab === tab.id 
                                ? 'bg-[#1a1a1a] dark:bg-[#f5f2ed] text-[#f5f2ed] dark:text-[#1a1a1a] shadow-2xl shadow-[#1a1a1a]/20 dark:shadow-black/40 scale-[1.02]' 
                                : 'text-[#1a1a1a]/40 dark:text-[#f5f2ed]/40 hover:text-[#1a1a1a] dark:hover:text-[#f5f2ed]'}`}
                        >
                            <tab.icon className={`w-4 h-4 stroke-[1.5] ${activeTab === tab.id ? 'scale-110' : ''} transition-transform`} /> 
                            <span className="whitespace-nowrap">{tab.label}</span>
                        </motion.button>
                    ))}
                </motion.div>

                {activeTab === 'dashboard' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-8"
                    >
                        {/* KPI Summary Bar */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <PremiumStatCard 
                                title="Total Revenue" 
                                value={formatTZS(stats.revenue)} 
                                icon={Wallet} 
                                trend={{ value: "+8.2%", positive: true }}
                            />
                            <PremiumStatCard 
                                title="Active Listings" 
                                value={stats.listings} 
                                icon={Package} 
                            />
                            <PremiumStatCard 
                                title="Avg Order Value" 
                                value={formatTZS(stats.aov)} 
                                icon={ShoppingBag} 
                            />
                            <PremiumStatCard 
                                title="Pending Orders" 
                                value={stats.pending} 
                                icon={Clock} 
                                trend={stats.pending > 5 ? { value: "Action Required", positive: false } : undefined}
                            />
                        </div>

                        <SellerAnalytics stats={stats} />
                        <AdvancedAnalytics stats={stats} />
                    </motion.div>
                )}

                {activeTab === 'orders' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <SellerOrders sellerId={user.id} onContactBuyer={(buyerId, productId, orderId) => {
                            setActiveTab('messages');
                            setSelectedChatUser(buyerId);
                            setSelectedProductId(productId);
                            setSelectedOrderId(orderId);
                        }} />
                    </motion.div>
                )}

                {activeTab === 'offers' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <SellerOffers sellerId={user.id} preselectedProduct={preselectedProduct} />
                    </motion.div>
                )}

                {activeTab === 'messages' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <SellerMessages userId={user.id} selectedChatUser={selectedChatUser} setSelectedChatUser={setSelectedChatUser} products={products} initialProductId={selectedProductId} initialOrderId={selectedOrderId} initialChatUser={selectedChatUser} />
                    </motion.div>
                )}

                {activeTab === 'products' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <SellerInventory products={myProducts} userId={user.id} refresh={refreshProducts} onCreatePromo={(product) => {
                            setPreselectedProduct(product);
                            setActiveTab('offers');
                        }} />
                    </motion.div>
                )}

                {activeTab === 'returns' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <SellerReturns userId={user.id} onContactBuyer={(buyerId, productId, orderId) => {
                            setActiveTab('messages');
                            setSelectedChatUser(buyerId);
                            setSelectedProductId(productId);
                            setSelectedOrderId(orderId);
                        }} />
                    </motion.div>
                )}

                {activeTab === 'settings' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <SellerSettingsPage />
                    </motion.div>
                )}
            </div>
        </div>
    );
};
