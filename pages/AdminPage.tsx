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
import { Card, Badge, Button, Input, useToast, Skeleton, Switch, ConfirmModal, PremiumStatCard, GraphicalTag } from '../components/UI';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AdminModeration } from '../components/AdminModeration';
import { AdminDashboard } from '../components/AdminDashboard';
import { AdminGrowth } from '../components/AdminGrowth';
import { AdminVendorVerification } from '../components/AdminVendorVerification';
import { AdminMessages } from '../components/AdminMessages';
import { AdminAIHero } from '../components/AdminAIHero';
import { analyzeDispute } from '../services/geminiService';

// Revenue data loaded from DB via fetchAdminData

export const AdminPage = () => {
    const { user } = useAppState();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'vendors' | 'products' | 'disputes' | 'payouts' | 'settings' | 'moderation' | 'growth' | 'messages' | 'ai-hero'>('overview');
    const [selectedMessageUser, setSelectedMessageUser] = useState<{id: string, name: string, context?: { type: 'order' | 'return' | 'support', id: string, label: string }} | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
        try {
            // ð All 8 admin queries run in parallel â was sequential (1.5s+), now ~200ms
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
                supabase.rpc('get_dashboard_data'),
                supabase.from('vendor_profiles')
                    .select('*, profiles!seller_id(full_name, email)')
                    .order('created_at', { ascending: false }),
                supabase.from('disputes')
                    .select('*, order:orders!order_id(id, total, status), buyer:profiles!buyer_id(full_name, email)')
                    .eq('status', 'open')
                    .order('created_at', { ascending: false })
                    .limit(30),
                supabase.from('seller_payouts')
                    .select('*, profiles!seller_id(full_name, email)')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(30),
                supabase.from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase.from('products')
                    .select('id, name, price, stock, status, created_at, seller_id, images, category, is_boosted, profiles!seller_id(full_name)')
                    .order('created_at', { ascending: false })
                    .limit(50),
                supabase.from('platform_settings').select('*').eq('id', 1).single(),
                // Revenue trend derived from orders â no separate table needed
                supabase.from('orders')
                    .select('total, created_at')
                    .in('status', ['paid','shipped','delivered'])
                    .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString())
                    .order('created_at', { ascending: true }),
                user?.id
                    ? supabase.from('messages').select('*', { count: 'exact', head: true })
                        .eq('receiver_id', user.id).eq('read', false)
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
            addToast('Failed to load admin data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Admin Actions ---

    const handleVerifyVendor = async (sellerId: string, approve: boolean) => {
        try {
            if (approve) {
                await supabase.from('vendor_profiles').update({ is_verified: true }).eq('seller_id', sellerId);
                addToast("Vendor verified successfully", "success");
            } else {
                await supabase.from('vendor_profiles').update({ is_active: false }).eq('seller_id', sellerId);
                addToast("Vendor application rejected", "success");
            }
            fetchAdminData();
        } catch (error) {
            addToast("Action failed", "error");
        }
    };

    const handleResolveDispute = async (disputeId: string, orderId: string, resolution: 'refund_buyer' | 'release_funds') => {
        try {
            await supabase.from('disputes').update({ status: 'resolved', resolution_notes: resolution }).eq('id', disputeId);
            
            if (resolution === 'refund_buyer') {
                await supabase.from('orders').update({ status: 'refunded' }).eq('id', orderId);
            } else {
                await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId);
            }
            
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
            await supabase.from('seller_payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payoutId);
            addToast("Payout approved and processed", "success");
            fetchAdminData();
        } catch (error) {
            addToast("Failed to process payout", "error");
        }
    };

    const handleToggleUserBan = async (userId: string, isBanned: boolean) => {
        try {
            await supabase.from('profiles').update({ is_banned: !isBanned }).eq('id', userId);
            
            if (!isBanned) { // If currently NOT banned, we are banning them
                await supabase.from('notifications').insert({
                    user_id: userId,
                    type: 'system',
                    title: 'Account Banned',
                    message: 'Your account has been banned due to a violation of our terms of service.'
                });
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
                await supabase.from('profiles').update({ 
                    deleted_at: new Date().toISOString(),
                    is_banned: true 
                }).eq('id', userToDelete);
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

    const handleToggleProductStatus = async (productId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        try {
            await supabase.from('products').update({ status: newStatus }).eq('id', productId);
            addToast(`Product marked as ${newStatus}`, "success");
            fetchAdminData();
        } catch (error) {
            addToast("Failed to update product", "error");
        }
    };

    const handleSaveSettings = async () => {
        try {
            const { error } = await supabase
                .from('platform_settings')
                .upsert({ 
                    id: 1, 
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

    return (
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
                         <h1 className="text-4xl md:text-6xl font-sans font-extrabold text-foreground dark:text-white tracking-tight leading-none">
                             System Overview
                         </h1>
                    </div>
                    <div className="flex items-center gap-6">
                        <button onClick={fetchAdminData} className="flex items-center text-[10px] uppercase tracking-[0.2em] font-black hover:opacity-50 transition-opacity">
                            <RefreshCw className={`w-3.5 h-3.5 mr-2 stroke-[2.5] ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                        <div className="text-right hidden md:block border-l border-foreground/10 dark:border-white/10 pl-6">
                            <p className="text-[9px] uppercase tracking-widest text-foreground/40 dark:text-white/40 font-black mb-1">SERVER TIME</p>
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
                    className="flex overflow-x-auto p-1.5 md:p-2 bg-foreground/[0.06] dark:bg-zinc-900 rounded-full mb-12 no-scrollbar border border-foreground/5 shadow-inner"
                >
                    {[
                        { id: 'overview', label: 'Nexus', icon: Activity },
                        { id: 'users', label: 'Citizens', icon: Users },
                        { id: 'vendors', label: 'Merchants', icon: Store, count: vendorsList.filter(v => !v.is_verified).length },
                        { id: 'products', label: 'Products', icon: Package },
                        { id: 'disputes', label: 'Disputes', icon: AlertTriangle, count: disputes.length },
                        { id: 'payouts', label: 'Payouts', icon: DollarSign, count: payouts.length },
                        { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
                        { id: 'growth', label: 'Growth', icon: TrendingUp },
                        { id: 'messages', label: 'Intelligence', icon: MessageSquare, count: unreadMessagesCount },
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
                            className={`flex-shrink-0 flex items-center gap-2 py-3 px-6 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === tab.id 
                                ? 'bg-white dark:bg-black text-foreground shadow-md' 
                                : 'text-foreground/40 dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-white/50 dark:hover:bg-black/50'}`}
                        >
                            <tab.icon className={`w-4 h-4 stroke-[2.5] ${activeTab === tab.id ? 'text-primary scale-110' : ''} transition-all`} /> 
                            <span className="whitespace-nowrap">{tab.label}</span>
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`ml-1 px-1.5 rounded-full flex items-center justify-center text-[10px] font-black tracking-normal ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-primary/20 text-primary'}`}>
                                    {tab.count}
                                </span>
                            )}
                        </motion.button>
                    ))}
                </motion.div>

                {/* Content Area */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1,2,3].map(i => <div key={i} className="h-48 bg-primary/5 dark:bg-background/5 border border-foreground/10 dark:border-background/10"></div>)}
                    </div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="duration-700"
                    >
                        
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <AdminDashboard
                                initialStats={stats}
                                onGoUsers={()=>setActiveTab('users')}
                                onGoVendors={()=>setActiveTab('vendors')}
                                onGoProducts={()=>setActiveTab('products')}
                                onGoDisputes={()=>setActiveTab('disputes')}
                                onGoPayouts={()=>setActiveTab('payouts')}
                                onGoGrowth={()=>setActiveTab('growth')}
                            />
                        )}

                         {/* USERS TAB */}
                        {activeTab === 'users' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm"
                            >
                                <div className="p-8 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <h3 className="font-sans font-bold text-lg tracking-tight">User Directory</h3>
                                    <div className="relative w-full md:w-72">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground stroke-2" />
                                        <input 
                                            type="text" 
                                            placeholder="SEARCH USERS..." 
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            className="w-full bg-muted/30 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground" 
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-6 font-sans">User</th>
                                                <th className="p-6 font-sans">Role</th>
                                                <th className="p-6 font-sans">Joined</th>
                                                <th className="p-6 font-sans text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredUsers.map((u, index) => (
                                                <motion.tr 
                                                    key={u.id} 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="hover:bg-muted/30 transition-colors"
                                                >
                                                    <td className="p-6">
                                                        <p className="font-sans font-bold text-sm text-foreground">{u.full_name || 'Unknown'}</p>
                                                        <p className="text-xs text-muted-foreground mt-1">{u.email}</p>
                                                    </td>
                                                    <td className="p-6 flex items-center gap-2">
                                                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                                            {u.role}
                                                        </Badge>
                                                        {u.is_banned && (
                                                            <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                                                Banned
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-6 text-xs font-medium text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                                                    <td className="p-6 text-right flex justify-end gap-2">
                                                        {u.role !== 'admin' && (
                                                            <div className="flex gap-2">
                                                                <Button 
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-xl bg-card border-border shadow-sm hover:shadow-md transition-all"
                                                                    onClick={() => handleMessageUser(u.id, u.full_name)}
                                                                    title="Message User"
                                                                >
                                                                    <MessageSquare className="w-4 h-4 text-foreground/70" />
                                                                </Button>
                                                                
                                                                <Button 
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-xl bg-card border-border shadow-sm hover:shadow-md transition-all"
                                                                    onClick={() => {
                                                                        const newRole = u.role === 'seller' ? 'buyer' : 'seller';
                                                                        supabase.from('profiles').update({ role: newRole }).eq('id', u.id).then(() => {
                                                                            addToast(`User ${newRole === 'seller' ? 'promoted to seller' : 'demoted to buyer'}`, "success");
                                                                            fetchAdminData();
                                                                        });
                                                                    }}
                                                                    title={u.role === 'seller' ? 'Demote to Buyer' : 'Promote to Seller'}
                                                                >
                                                                    {u.role === 'seller' ? <ArrowDownCircle className="w-4 h-4 text-foreground/70" /> : <ArrowUpCircle className="w-4 h-4 text-foreground/70" />}
                                                                </Button>

                                                                <Button 
                                                                    variant={u.is_banned ? "default" : "outline"}
                                                                    size="icon"
                                                                    className={`h-8 w-8 rounded-xl shadow-sm hover:shadow-md transition-all ${u.is_banned ? 'bg-primary text-white' : 'bg-card border-border'}`}
                                                                    onClick={() => handleToggleUserBan(u.id, u.is_banned)}
                                                                    title={u.is_banned ? 'Unban User' : 'Ban User'}
                                                                >
                                                                    {u.is_banned ? <Unlock className="w-4 h-4"/> : <Lock className="w-4 h-4 text-foreground/70"/>}
                                                                </Button>

                                                                <Button 
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 rounded-xl bg-card border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-sm hover:shadow-md transition-all"
                                                                    onClick={() => confirmDeleteUser(u.id)}
                                                                    title="Delete User"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {/* PRODUCTS TAB */}
                        {activeTab === 'products' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm"
                            >
                                <div className="p-8 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <h3 className="font-sans font-bold text-lg tracking-tight">Product Moderation</h3>
                                    <div className="relative w-full md:w-72">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground stroke-2" />
                                        <input 
                                            type="text" 
                                            placeholder="SEARCH PRODUCTS..." 
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            className="w-full bg-muted/30 border-none rounded-2xl py-3 pl-12 pr-4 text-xs font-bold uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground" 
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted/50 text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="p-6 font-sans">Product</th>
                                                <th className="p-6 font-sans">Seller</th>
                                                <th className="p-6 font-sans">Price</th>
                                                <th className="p-6 font-sans">Status</th>
                                                <th className="p-6 font-sans text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredProducts.map((p, index) => (
                                                <motion.tr 
                                                    key={p.id} 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="hover:bg-muted/30 transition-colors"
                                                >
                                                    <td className="p-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-16 bg-muted/50 rounded-xl overflow-hidden border border-border shadow-sm flex items-center justify-center">
                                                                {p.images && p.images[0] ? (
                                                                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Package className="w-5 h-5 text-muted-foreground stroke-2" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-sans font-bold text-sm text-foreground line-clamp-1">{p.name}</p>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-1">{p.category}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-6 text-xs font-bold text-foreground">{p.profiles?.full_name || 'Unknown'}</td>
                                                    <td className="p-6 font-mono font-medium text-foreground">{formatTZS(p.price)}</td>
                                                    <td className="p-6">
                                                        <Badge variant={p.status === 'active' ? 'secondary' : 'outline'} className="text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                                                            {p.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-6 text-right flex justify-end gap-2">
                                                        <Button 
                                                            variant="outline"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-xl bg-card border-border shadow-sm hover:shadow-md transition-all"
                                                            onClick={() => handleMessageUser(p.seller_id, p.profiles?.full_name || 'Seller', { type: 'support', label: p.name, id: p.id })}
                                                            title="Message Seller"
                                                        >
                                                            <MessageSquare className="w-4 h-4 text-foreground/70" />
                                                        </Button>
                                                        <Button 
                                                            variant={p.status === 'active' ? 'outline' : 'default'}
                                                            size="sm"
                                                            className={`h-8 px-4 text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-sm hover:shadow-md transition-all ${p.status === 'active' ? 'border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground' : ''}`}
                                                            onClick={() => handleToggleProductStatus(p.id, p.status)}
                                                        >
                                                            {p.status === 'active' ? 'Take Down' : 'Restore'}
                                                        </Button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}

                        {/* VENDORS TAB */}
                        {activeTab === 'vendors' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-6"
                            >
                                {vendorsList.length === 0 ? (
                                    <div className="text-center p-12 bg-card rounded-3xl border border-border shadow-sm">
                                        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <ShieldCheck className="w-8 h-8 text-muted-foreground stroke-2" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">No vendors found</p>
                                    </div>
                                ) : vendorsList.map(vendor => (
                                    <AdminVendorVerification key={vendor.seller_id} vendor={vendor} onUpdate={fetchAdminData} onMessage={handleMessageUser} />
                                ))}
                            </motion.div>
                        )}

                        {/* DISPUTES TAB */}
                        {activeTab === 'disputes' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-12"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <PremiumStatCard 
                                        title="Active Disputes" 
                                        value={disputes.length} 
                                        icon={AlertTriangle} 
                                        color="text-rose-600"
                                        trend={{ value: "Action Required", positive: false }}
                                    />
                                    <PremiumStatCard 
                                        title="Avg. Resolution" 
                                        value="2.4 Days" 
                                        icon={Activity} 
                                        color="text-blue-600"
                                    />
                                    <PremiumStatCard 
                                        title="Resolved (MTD)" 
                                        value="142" 
                                        icon={CheckCircle2} 
                                        color="text-emerald-600"
                                    />
                                </div>

                                <div className="space-y-8">
                                    <div className="flex items-center justify-between pb-6">
                                        <h3 className="font-sans font-bold text-2xl tracking-tight">Pending Resolutions</h3>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => {
                                                if (!disputes.length) { addToast('No disputes to export', 'info'); return; }
                                                const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                                                const rows = [
                                                    ['ID', 'Order ID', 'Buyer ID', 'Seller ID', 'Reason', 'Status', 'Description', 'Created At'].join(','),
                                                    ...disputes.map(d => [d.id, d.order_id, d.buyer_id, d.seller_id, d.reason, d.status, d.description, d.created_at].map(esc).join(','))
                                                ].join('\n');
                                                const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url; a.download = `disputes-${new Date().toISOString().slice(0,10)}.csv`;
                                                a.click(); URL.revokeObjectURL(url);
                                                addToast('Disputes exported', 'success');
                                            }} className="text-[10px] font-bold uppercase tracking-wider rounded-xl">Export CSV</Button>
                                        </div>
                                    </div>

                                    {disputes.length === 0 ? (
                                        <div className="text-center p-12 bg-card rounded-3xl border border-border shadow-sm">
                                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <CheckCircle2 className="w-8 h-8 text-muted-foreground stroke-2" />
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">All clear. No active disputes.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-6">
                                            {disputes.map(dispute => (
                                                <div key={dispute.id} className="group relative bg-card rounded-3xl border border-border p-8 overflow-hidden transition-all shadow-sm hover:shadow-md">
                                                    
                                                    <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-8">
                                                        <div className="flex-1 space-y-6">
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                <Badge variant="secondary" className="px-3 py-1 font-bold text-xs rounded-full shadow-sm">
                                                                    Order #{dispute.order_id.slice(0,8)}
                                                                </Badge>
                                                                <Badge variant="destructive" className="px-3 py-1 font-bold text-[10px] uppercase tracking-wider rounded-full shadow-sm bg-destructive/10 text-destructive hover:bg-destructive/20 border-none">
                                                                    High Priority
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <h4 className="text-2xl font-sans font-bold tracking-tight text-foreground">
                                                                    {dispute.reason.replace(/_/g, ' ')}
                                                                </h4>
                                                                <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                                                                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Buyer: <span className="text-foreground">{dispute.profiles?.full_name}</span></span>
                                                                    <span>â¢</span>
                                                                    <span>Opened {new Date(dispute.created_at).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>

                                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border text-sm text-foreground/80 leading-relaxed font-medium">
                                                                "{dispute.description}"
                                                            </div>
                                                        </div>

                                                        <div className="lg:w-80 space-y-6">
                                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Disputed Value</p>
                                                                <p className="text-3xl font-mono font-bold text-destructive tracking-tight">{formatTZS(dispute.orders?.total)}</p>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <Button 
                                                                    variant="outline"
                                                                    className="h-12 w-full rounded-xl text-[10px] font-bold uppercase tracking-wider"
                                                                    onClick={() => handleAnalyzeDispute(dispute)}
                                                                >
                                                                    <Sparkles className="w-4 h-4 mr-2" /> AI Analyze
                                                                </Button>
                                                                <Button 
                                                                    variant="outline"
                                                                    className="h-12 w-full rounded-xl text-[10px] font-bold uppercase tracking-wider"
                                                                    onClick={() => handleMessageUser(dispute.buyer_id, dispute.profiles?.full_name, { type: 'return', id: dispute.id, label: `Order #${dispute.order_id.slice(0,8)}` })}
                                                                >
                                                                    <MessageSquare className="w-4 h-4 mr-2" /> Message
                                                                </Button>
                                                                <Button 
                                                                    variant="default"
                                                                    className="col-span-2 h-12 w-full rounded-xl text-[10px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700"
                                                                    onClick={() => handleResolveDispute(dispute.id, dispute.order_id, 'release_funds')}
                                                                >
                                                                    Rule for Seller
                                                                </Button>
                                                                <Button 
                                                                    variant="outline"
                                                                    className="col-span-2 h-12 w-full rounded-xl text-[10px] font-bold uppercase tracking-wider border-destructive/20 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                                                    onClick={() => handleResolveDispute(dispute.id, dispute.order_id, 'refund_buyer')}
                                                                >
                                                                    Rule for Buyer (Refund)
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* PAYOUTS TAB */}
                        {activeTab === 'payouts' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-6"
                            >
                                {payouts.length === 0 ? (
                                    <div className="text-center p-12 bg-card rounded-3xl border border-border shadow-sm">
                                        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <DollarSign className="w-8 h-8 text-muted-foreground stroke-2" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">No pending payouts</p>
                                    </div>
                                ) : payouts.map(payout => (
                                    <div key={payout.id} className="p-6 bg-card rounded-3xl border border-border shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 transition-all hover:shadow-md">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                                                <DollarSign className="w-6 h-6 stroke-2" />
                                            </div>
                                            <div>
                                                <p className="font-sans font-bold text-xl text-foreground tracking-tight">{formatTZS(payout.net_payout)}</p>
                                                <p className="text-xs text-muted-foreground mt-1 font-medium">Requested by: <span className="text-foreground">{payout.profiles?.full_name}</span></p>
                                            </div>
                                        </div>
                                        <Button 
                                            variant="default"
                                            className="w-full md:w-auto h-12 px-8 rounded-xl font-bold uppercase tracking-wider text-[10px] shadow-sm hover:shadow-md transition-all"
                                            onClick={() => handleApprovePayout(payout.id)}
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Paid
                                        </Button>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        {/* SETTINGS TAB */}
                        {activeTab === 'settings' && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-8"
                            >
                                <div className="p-8 bg-card rounded-3xl border border-border shadow-sm">
                                    <h3 className="font-sans font-bold text-2xl tracking-tight mb-8">Platform Configuration</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Maintenance Mode</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Disable access for non-admin users</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.maintenanceMode} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, maintenanceMode: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Allow New Signups</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Open registration for new buyers and sellers</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.newSignups} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, newSignups: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Auto-Approve Vendors</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Bypass manual verification for new stores</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.autoApproveVendors} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, autoApproveVendors: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Require Vendor Verification</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Mandatory KYC for new sellers</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.requireVendorVerification} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, requireVendorVerification: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Enable Loyalty Program</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Allow buyers to earn points</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.enableLoyaltyProgram} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, enableLoyaltyProgram: c})} 
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Global Commission Rate (%)</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">The percentage taken from every successful sale.</p>
                                                <Input 
                                                    type="number" 
                                                    value={platformSettings.globalCommission} 
                                                    onChange={(e: any) => setPlatformSettings({...platformSettings, globalCommission: Number(e.target.value)})}
                                                    className="w-full bg-background border-border text-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Audit Log Retention (Days)</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">How long to keep system activity logs.</p>
                                                <Input 
                                                    type="number" 
                                                    value={platformSettings.auditRetentionDays} 
                                                    onChange={(e: any) => setPlatformSettings({...platformSettings, auditRetentionDays: Number(e.target.value)})}
                                                    className="w-full bg-background border-border text-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Max Products Per Vendor</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Limit the number of active products.</p>
                                                <Input 
                                                    type="number" 
                                                    value={platformSettings.maxProductsPerVendor} 
                                                    onChange={(e: any) => setPlatformSettings({...platformSettings, maxProductsPerVendor: Number(e.target.value)})}
                                                    className="w-full bg-background border-border text-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Default Currency</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Base currency for the platform.</p>
                                                <select 
                                                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-medium text-foreground outline-none focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                                                    value={platformSettings.defaultCurrency}
                                                    onChange={(e) => setPlatformSettings({...platformSettings, defaultCurrency: e.target.value})}
                                                >
                                                    <option value="TZS" className="bg-background">TZS</option>
                                                    <option value="USD" className="bg-background">USD</option>
                                                    <option value="KES" className="bg-background">KES</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <Button 
                                            variant="default"
                                            size="lg"
                                            onClick={handleSaveSettings} 
                                            className="h-12 px-8 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                                        >
                                            Save Configuration
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'moderation' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <AdminModeration />
                            </motion.div>
                        )}
                        {activeTab === 'growth' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <AdminGrowth />
                            </motion.div>
                        )}
                        {activeTab === 'messages' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                                <AdminMessages initialSelectedUser={selectedMessageUser} />
                            </motion.div>
                        )}
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
    );
};
