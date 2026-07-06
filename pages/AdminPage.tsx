import { SecurityMonitor } from '../components/SecurityMonitor';
import { assertRole, rateLimit } from '../src/security';
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    ShieldAlert, Users, Store, DollarSign, Activity, 
    CheckCircle2, XCircle, AlertTriangle, Search, 
    TrendingUp, ShieldCheck, Lock, Unlock, Eye, Package, Settings as SettingsIcon,
    BarChart3, RefreshCw, Trash2, MessageSquare, ArrowUpCircle, ArrowDownCircle, Sparkles, AlertCircle
} from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Card, Badge, Button, Input, useToast, Skeleton, Switch, ConfirmModal, PremiumStatCard, GraphicalTag, CountBadge } from '../components/UI';
import { formatTZS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AdminModeration } from '../components/AdminModeration';
import { AdminDashboard } from '../components/AdminDashboard';
import { AdminGrowth } from '../components/AdminGrowth';
import { AdminVendorVerification } from '../components/AdminVendorVerification';
import { AdminMessages } from '../components/AdminMessages';
import { AdminAIHero } from '../components/AdminAIHero';
import { analyzeDispute } from '../services/geminiService';
import { adminTakedownProduct } from '../services/moderationApi';
import {
    resolveDispute, getDashboardData,
    fetchAdminVendorProfiles, fetchOpenDisputes, fetchPendingPayouts,
    fetchRecentProfiles, fetchRecentProducts, fetchPlatformSettings,
    fetchRevenueOrders, countUnreadMessages,
    setVendorVerification, deactivateVendor, markPayoutPaid,
    setUserBanned, notifyUserBanned, softDeleteUser,
    restoreProduct, upsertPlatformSettings
} from '../services/adminApi';
import { AdminCtx } from './admin/context';
import { OverviewTab } from './admin/OverviewTab';
import { UsersTab } from './admin/UsersTab';
import { ProductsTab } from './admin/ProductsTab';
import { VendorsTab } from './admin/VendorsTab';
import { DisputesTab } from './admin/DisputesTab';
import { PayoutsTab } from './admin/PayoutsTab';
import { SettingsTab } from './admin/SettingsTab';
import { ModerationTab } from './admin/ModerationTab';
import { GrowthTab } from './admin/GrowthTab';
import { MessagesTab } from './admin/MessagesTab';


// Revenue data loaded from DB via fetchAdminData

export const AdminPage = () => {
    const { user } = useAppState();
    const { addToast } = useToast();
    type AdminTab = 'overview' | 'users' | 'vendors' | 'products' | 'disputes' | 'payouts' | 'settings' | 'moderation' | 'security' | 'growth' | 'messages' | 'ai-hero';
    const ADMIN_TABS: AdminTab[] = ['overview', 'users', 'vendors', 'products', 'disputes', 'payouts', 'settings', 'moderation', 'security', 'growth', 'messages', 'ai-hero'];
    // Honor ?tab= deep links (e.g. the /messages redirect sends admins to /admin?tab=messages).
    const initialTab = new URLSearchParams(window.location.search).get('tab') as AdminTab | null;
    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab && ADMIN_TABS.includes(initialTab) ? initialTab : 'overview');
    const [selectedMessageUser, setSelectedMessageUser] = useState<{id: string, name: string, context?: { type: 'order' | 'return' | 'support', id: string, label: string }} | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalUsers: 0, totalRevenue: 0, activeDisputes: 0, pendingPayouts: 0, totalProducts: 0 });
    const [usersList, setUsersList] = useState<any[]>([]);
    const [vendorsList, setVendorsList] = useState<any[]>([]);
    const [disputes, setDisputes] = useState<any[]>([]);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
    const [isConfirmDeleteUserOpen, setIsConfirmDeleteUserOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);

    // Settings State
    const [platformSettings, setPlatformSettings] = useState({
        maintenanceMode: false,
        newSignups: true,
        globalCommission: 5,
        autoApproveVendors: false,
        defaultCurrency: 'TZS',
        auditRetentionDays: 30,
        requireVendorVerification: true,
        maxProductsPerVendor: 1000,
        enableLoyaltyProgram: true
    });

    const [userSearch, setUserSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');

    useEffect(() => {
        if (user?.role !== 'admin') return;
        fetchAdminData();
    }, [user]);

    const filteredUsers = usersList.filter(u => 
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) || 
        u.email?.toLowerCase().includes(userSearch.toLowerCase())
    );

    const filteredProducts = products.filter(p => 
        p.name?.toLowerCase().includes(productSearch.toLowerCase()) || 
        p.profiles?.full_name?.toLowerCase().includes(productSearch.toLowerCase())
    );

    const fetchAdminData = async () => {
        setIsLoading(true);
        setLoadError(false);
        try {
            // Ã°ÂŸÂšÂ€ All 8 admin queries run in parallel Ã¢Â€Â” was sequential (1.5s+), now ~200ms
            const [
                statsRes,
                vendorsRes,
                disputesRes,
                payoutsRes,
                usersRes,
                productsRes,
                settingsRes,
                revenueRes,
                unreadRes
            ] = await Promise.all([
                // Admin stats: 12 counts in one RPC (already built into get_dashboard_data)
                getDashboardData(),
                fetchAdminVendorProfiles(),
                fetchOpenDisputes(),
                fetchPendingPayouts(),
                fetchRecentProfiles(),
                fetchRecentProducts(),
                fetchPlatformSettings(),
                // Revenue trend derived from orders Ã¢Â€Â” no separate table needed
                fetchRevenueOrders(),
                user?.id
                    ? countUnreadMessages(user.id)
                    : Promise.resolve({ count: 0 })
            ]);

            // Apply admin stats from RPC (one DB round-trip for all counts)
            const adminStats = statsRes.data?.admin_stats;
            setStats({
                totalUsers:     adminStats?.total_users    ?? usersRes.data?.length    ?? 0,
                totalProducts:  adminStats?.total_products ?? productsRes.data?.length ?? 0,
                totalRevenue:   adminStats?.total_revenue  ?? 0,
                activeDisputes: adminStats?.open_disputes  ?? disputesRes.data?.length ?? 0,
                pendingPayouts: payoutsRes.data?.length ?? 0,
            });

            if (vendorsRes.data)          setVendorsList(vendorsRes.data);
            if (disputesRes.data)         setDisputes(disputesRes.data);
            if (payoutsRes.data)          setPayouts(payoutsRes.data);
            if (usersRes.data)            setUsersList(usersRes.data);
            if (productsRes.data)         setProducts(productsRes.data);
            // Build monthly revenue chart data from orders
            if (revenueRes.data && revenueRes.data.length > 0) {
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const map = new Map<string, number>();
                revenueRes.data.forEach((row: any) => {
                    const d = new Date(row.created_at);
                    const key = months[d.getMonth()] + ' ' + d.getFullYear();
                    map.set(key, (map.get(key) || 0) + Number(row.total || 0));
                });
                setRevenueData(Array.from(map.entries()).map(([name, revenue]) => ({ name, revenue })));
            }
            if (typeof unreadRes.count === 'number') setUnreadMessagesCount(unreadRes.count);

            if (settingsRes.data) {
                const s = settingsRes.data;
                setPlatformSettings({
                    maintenanceMode:         s.maintenance_mode ?? false,
                    newSignups:              s.new_signups ?? true,
                    globalCommission:        s.global_commission ?? 5,
                    autoApproveVendors:      s.auto_approve_vendors ?? false,
                    defaultCurrency:         s.default_currency || 'TZS',
                    auditRetentionDays:      s.audit_retention_days ?? 30,
                    requireVendorVerification: s.require_vendor_verification ?? true,
                    maxProductsPerVendor:    s.max_products_per_vendor ?? 1000,
                    enableLoyaltyProgram:    s.enable_loyalty_program ?? true,
                });
            }
        } catch (error) {
            console.error('Admin fetch error:', error);
            setLoadError(true);
            addToast('Failed to load admin data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Admin Actions ---

    const handleVerifyVendor = async (sellerId: string, approve: boolean) => {
        try {
            if (approve) {
                await setVendorVerification(sellerId, true);
                addToast("Vendor verified successfully", "success");
            } else {
                await deactivateVendor(sellerId);
                addToast("Vendor application rejected", "success");
            }
            fetchAdminData();
        } catch (error) {
            addToast("Action failed", "error");
        }
    };

    const handleResolveDispute = async (disputeId: string, orderId: string, resolution: 'refund_buyer' | 'release_funds') => {
        try {
            // Atomic admin-only RPC: validates statuses and updates the dispute
            // and its order in one transaction.
            await resolveDispute(disputeId, resolution);
            addToast(`Dispute resolved: ${resolution.replace('_', ' ')}`, "success");
            fetchAdminData();
        } catch (error) {
            addToast("Failed to resolve dispute", "error");
        }
    };

    const handleAnalyzeDispute = async (dispute: any) => {
        addToast("Analyzing dispute with AI...", "info");
        const result = await analyzeDispute(dispute.reason, dispute.description);
        if (result) {
            addToast(`AI Suggestion: ${result.suggestion} (Risk: ${result.riskScore}/100). Recommended: ${result.recommendedAction.replace('_', ' ')}`, "success");
        } else {
            addToast("Failed to analyze dispute", "error");
        }
    };

    const handleApprovePayout = async (payoutId: string) => {
        try {
            await markPayoutPaid(payoutId);
            addToast("Payout approved and processed", "success");
            fetchAdminData();
        } catch (error) {
            addToast("Failed to process payout", "error");
        }
    };

    const handleToggleUserBan = async (userId: string, isBanned: boolean) => {
        try {
            await setUserBanned(userId, !isBanned);

            if (!isBanned) { // If currently NOT banned, we are banning them
                await notifyUserBanned(userId);
            }
            
            addToast(`User ${!isBanned ? 'banned' : 'unbanned'} successfully`, "success");
            fetchAdminData();
        } catch (error) {
            addToast("Failed to update user status", "error");
        }
    };

    const confirmDeleteUser = (userId: string) => {
        setUserToDelete(userId);
        setIsConfirmDeleteUserOpen(true);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            // Soft-delete: mark deleted_at. Hard auth.users deletion requires admin API.
                await softDeleteUser(userToDelete);
            addToast("User deleted successfully", "success");
            fetchAdminData();
        } catch (error) {
            addToast("Failed to delete user", "error");
        }
        setUserToDelete(null);
        setIsConfirmDeleteUserOpen(false);
    };

    const handleMessageUser = async (userId: string, userName: string, context?: { type: 'order' | 'return' | 'support', id: string, label: string }) => {
        setSelectedMessageUser({ id: userId, name: userName, context });
        setActiveTab('messages');
    };

    // Restore path only — takedowns now go through handleTakedownProduct
    // (reason required + seller notification). Restoring also clears any
    // recorded takedown reason.
    const handleToggleProductStatus = async (productId: string, currentStatus: string) => {
        if (currentStatus === 'active') return; // takedown handled by handleTakedownProduct
        try {
            await restoreProduct(productId);
            addToast('Product restored and live again', "success");
            fetchAdminData();
        } catch (error) {
            addToast("Failed to update product", "error");
        }
    };

    // Fair takedown: mandatory reason, RPC suspends the product AND
    // notifies the seller (no more silent takedowns).
    const handleTakedownProduct = async (productId: string, reason: string) => {
        try {
            await adminTakedownProduct(productId, reason);
            addToast('Product suspended — the seller has been notified with the reason', "success");
            fetchAdminData();
        } catch (error: any) {
            addToast(error?.message || 'Failed to take down product', "error");
            throw error;
        }
    };

    const handleSaveSettings = async () => {
        try {
            const { error } = await upsertPlatformSettings({
                    maintenance_mode: platformSettings.maintenanceMode,
                    new_signups: platformSettings.newSignups,
                    global_commission: platformSettings.globalCommission,
                    auto_approve_vendors: platformSettings.autoApproveVendors,
                    default_currency: platformSettings.defaultCurrency,
                    audit_retention_days: platformSettings.auditRetentionDays,
                    require_vendor_verification: platformSettings.requireVendorVerification,
                    max_products_per_vendor: platformSettings.maxProductsPerVendor,
                    enable_loyalty_program: platformSettings.enableLoyaltyProgram
                });
            
            if (error) throw error;
            addToast("Platform settings updated", "success");
        } catch (error) {
            console.error("Error saving settings:", error);
            addToast("Failed to update settings", "error");
        }
    };

    // --- Security Check ---
    if (!user) return null;
    if (user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }
  const __ctx = { addToast, confirmDeleteUser, disputes, fetchAdminData, filteredProducts, filteredUsers, handleAnalyzeDispute, handleApprovePayout, handleMessageUser, handleResolveDispute, handleSaveSettings, handleTakedownProduct, handleToggleProductStatus, handleToggleUserBan, payouts, platformSettings, productSearch, products, selectedMessageUser, setActiveTab, setPlatformSettings, setProductSearch, setUserSearch, stats, userSearch, vendorsList };


    return (
  <AdminCtx.Provider value={__ctx}>

        <div className="min-h-screen bg-background dark:bg-background font-sans pb-20 pt-28 px-4 md:px-8 selection:bg-primary selection:text-white dark:selection:bg-white dark:selection:text-black">
            <div className="container mx-auto max-w-7xl">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6"
                >
                    <div className="space-y-4">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary dark:bg-white flex items-center justify-center shadow-lg shadow-foreground/10 dark:shadow-white/10">
                                <ShieldAlert className="w-5 h-5 text-white dark:text-black" />
                            </div>
                            <p className="text-[10px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40">Nexus Control</p>
                         </div>
                         <h1 className="text-2xl md:text-3xl font-sans font-extrabold text-foreground dark:text-white tracking-tight leading-none">
                             System Overview
                         </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={fetchAdminData}
                            aria-label="Refresh data"
                            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 mr-2 stroke-[2.5] ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="text-[10px] uppercase tracking-widest font-black">Refresh</span>
                        </Button>
                        <div className="text-right hidden md:block border-l border-foreground/10 dark:border-white/10 pl-6">
                            <p className="text-[10px] uppercase tracking-widest text-foreground/40 dark:text-white/40 font-black mb-1">SERVER TIME</p>
                            <p className="text-xs font-sans font-bold tracking-widest text-foreground dark:text-white">{new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</p>
                        </div>
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
                    role="tablist"
                    aria-label="Admin sections"
                    className="flex overflow-x-auto gap-1.5 p-1.5 md:p-2 bg-foreground/[0.03] rounded-full mb-12 no-scrollbar border border-foreground/8 shadow-inner"
                >
                    {[
                        { id: 'overview', label: 'Nexus', icon: Activity },
                        { id: 'users', label: 'Citizens', icon: Users },
                        { id: 'vendors', label: 'Merchants', icon: Store, count: vendorsList.filter(v => !v.is_verified).length, urgent: false },
                        { id: 'products', label: 'Products', icon: Package },
                        { id: 'disputes', label: 'Disputes', icon: AlertTriangle, count: disputes.length, urgent: true },
                        { id: 'payouts', label: 'Payouts', icon: DollarSign, count: payouts.length, urgent: true },
                        { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
                        { id: 'security', label: 'Security', icon: ShieldCheck },
                        { id: 'growth', label: 'Growth', icon: TrendingUp },
                        { id: 'messages', label: 'Intelligence', icon: MessageSquare, count: unreadMessagesCount, urgent: true },
                        { id: 'ai-hero', label: 'AI Core', icon: Sparkles },
                        { id: 'settings', label: 'Protocol', icon: SettingsIcon }
                    ].map(tab => (
                        <motion.button
                            key={tab.id}
                            variants={{
                                hidden: { opacity: 0, x: -10 },
                                visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
                            }}
                            onClick={() => setActiveTab(tab.id as any)}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`flex-shrink-0 flex items-center gap-2 min-h-[44px] py-2.5 px-5 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${activeTab === tab.id
                                ? 'bg-foreground text-background shadow-md'
                                : 'bg-foreground/[0.05] text-foreground/60 hover:bg-foreground/[0.1]'}`}
                        >
                            <tab.icon className="w-4 h-4 stroke-[2.5] transition-all" />
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.count !== undefined && (
                                <CountBadge count={tab.count} urgent={tab.urgent} />
                            )}
                        </motion.button>
                    ))}
                </motion.div>

                {/* Content Area */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1,2,3].map(i => <div key={i} className="h-48 bg-primary/5 dark:bg-background/5 border border-foreground/10 dark:border-background/10"></div>)}
                    </div>
                ) : loadError ? (
                    <Card className="p-10 text-center">
                        <div className="w-14 h-14 rounded-3xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500 stroke-[1.5]" />
                        </div>
                        <p className="text-sm font-bold text-foreground">Couldn't load the admin dashboard</p>
                        <p className="text-xs font-medium text-foreground/45 mt-1 max-w-xs mx-auto leading-relaxed">Something went wrong fetching platform data. Check your connection and try again.</p>
                        <Button variant="primary" size="sm" onClick={fetchAdminData} className="mt-5">
                            <RefreshCw className="w-3.5 h-3.5 mr-2 stroke-[2.5]" /> Try again
                        </Button>
                    </Card>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="duration-700"
                    >
                        
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && <OverviewTab />}

                         {/* USERS TAB */}
                        {activeTab === 'users' && <UsersTab />}

                        {/* PRODUCTS TAB */}
                        {activeTab === 'products' && <ProductsTab />}

                        {/* VENDORS TAB */}
                        {activeTab === 'vendors' && <VendorsTab />}

                        {/* DISPUTES TAB */}
                        {activeTab === 'disputes' && <DisputesTab />}

                        {/* PAYOUTS TAB */}
                        {activeTab === 'payouts' && <PayoutsTab />}

                        {/* SETTINGS TAB */}
                        {activeTab === 'settings' && <SettingsTab />}

                        {activeTab === 'moderation' && <ModerationTab />}
                        {activeTab === 'security' && <SecurityMonitor />}
                        {activeTab === 'growth' && <GrowthTab />}
                        {activeTab === 'messages' && <MessagesTab />}
                        {activeTab === 'ai-hero' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <AdminAIHero />
                            </motion.div>
                        )}

                    </motion.div>
                )}
            </div>
            
            <ConfirmModal 
                isOpen={isConfirmDeleteUserOpen}
                onClose={() => {
                    setIsConfirmDeleteUserOpen(false);
                    setUserToDelete(null);
                }}
                onConfirm={handleDeleteUser}
                title="Delete User"
                message="Are you sure you want to permanently delete this user? This action cannot be undone."
                confirmText="Delete"
                isDestructive={true}
            />
        </div>
  </AdminCtx.Provider>
    );
};
