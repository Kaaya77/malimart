import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Input, useToast } from './UI';
import { supabase } from '../services/supabaseClient';
import { ShieldAlert, Trash2, CheckCircle, AlertTriangle, EyeOff, TrendingUp, Search, Filter, User, UserMinus, UserCheck, Store, BadgeCheck, XCircle, History, Shield, FileText, Users, ShoppingBag, MessageSquare as MessageIcon } from 'lucide-react';
import { analyzeContent } from '../src/services/aiService';
import { PremiumStatCard } from './UI';

export const AdminModeration = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [appeals, setAppeals] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'content' | 'reports' | 'users' | 'vendors' | 'logs' | 'appeals' | 'products'>('content');
    const [filter, setFilter] = useState<'all' | 'pending' | 'flagged'>('all');
    const [search, setSearch] = useState('');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [moderationNote, setModerationNote] = useState('');
    const { addToast } = useToast();

    useEffect(() => {
        fetchData();
        setSelectedItems([]);
    }, [activeTab]);

    const fetchData = async () => {
        if (activeTab === 'content') {
            const { data: socialPosts } = await supabase.from('social_posts').select('*, profiles(full_name, email)');
            const { data: reviews } = await supabase.from('reviews').select('*, profiles(full_name, email)');
            const combined = [
                ...(socialPosts || []).map(p => ({ ...p, type: 'social_post', content: p.caption || 'No caption', image: p.image_url })),
                ...(reviews || []).map(r => ({ ...r, type: 'review', content: r.comment }))
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setPosts(combined);
        } else if (activeTab === 'reports') {
            const { data: userReports } = await supabase.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(full_name, email), reported:profiles!reports_reported_id_fkey(full_name, email)');
            setReports(userReports || []);
        } else if (activeTab === 'users') {
            const { data: allUsers } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            setUsers(allUsers || []);
        } else if (activeTab === 'vendors') {
            const { data: allVendors } = await supabase.from('vendor_profiles').select('*, profiles(full_name, email), documents:vendor_documents(*)').order('created_at', { ascending: false });
            setVendors(allVendors || []);
        } else if (activeTab === 'logs') {
            const { data: allLogs } = await supabase.from('moderation_logs').select('*, admin:profiles!admin_id(full_name)').order('created_at', { ascending: false });
            setLogs(allLogs || []);
        } else if (activeTab === 'appeals') {
            const { data: allAppeals } = await supabase.from('moderation_appeals').select('*, profiles(full_name, email)').order('created_at', { ascending: false });
            setAppeals(allAppeals || []);
        } else if (activeTab === 'products') {
            const { data: allProducts } = await supabase.from('products').select('*, profiles(full_name, email)').order('created_at', { ascending: false }).limit(100);
            setProducts(allProducts || []);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    };

    const handleBulkAction = async (action: string) => {
        if (selectedItems.length === 0) return;
        
        try {
            for (const id of selectedItems) {
                const item = activeTab === 'content' ? posts.find(p => p.id === id) : 
                             activeTab === 'products' ? products.find(p => p.id === id) : null;
                if (item) await handleAction(item, action);
            }
            addToast(`Bulk action ${action} completed for ${selectedItems.length} items`, "success");
            setSelectedItems([]);
        } catch (error) {
            addToast("Bulk action failed", "error");
        }
    };

    const handleAction = async (item: any, action: string) => {
        const { id } = item;
        try {
            // AI Analysis for content approval
            if (action === 'approve_content' && (item.type === 'social_post' || item.type === 'review')) {
                const analysis = await analyzeContent(item.content);
                if (analysis.is_flagged) {
                    addToast("AI flagged this content. Marking as flagged instead.", "warning");
                    action = 'flag_content';
                }
            }

            // Log action
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('moderation_logs').insert({ 
                content_id: id, 
                note: moderationNote || `Action: ${action}`, 
                action,
                admin_id: user?.id
            });

            if (action === 'resolve_report') {
                await supabase.from('reports').update({ status: 'resolved' }).eq('id', id);
                addToast("Report marked as resolved", "success");
            } else if (action === 'delete_content') {
                const table = item.type === 'social_post' ? 'social_posts' : 'reviews';
                await supabase.from(table).update({ status: 'deleted' }).eq('id', id);
                addToast("Content deleted", "success");
            } else if (action === 'approve_content') {
                const table = item.type === 'social_post' ? 'social_posts' : 'reviews';
                await supabase.from(table).update({ status: 'approved', is_shadowbanned: false }).eq('id', id);
                addToast("Content approved", "success");
            } else if (action === 'flag_content') {
                const table = item.type === 'social_post' ? 'social_posts' : 'reviews';
                await supabase.from(table).update({ status: 'flagged' }).eq('id', id);
                addToast("Content flagged", "success");
            } else if (action === 'shadowban_content') {
                const table = item.type === 'social_post' ? 'social_posts' : 'reviews';
                await supabase.from(table).update({ is_shadowbanned: true }).eq('id', id);
                addToast("Content shadowbanned", "success");
            } else if (action === 'boost_content') {
                const table = item.type === 'social_post' ? 'social_posts' : 'reviews';
                await supabase.from(table).update({ is_boosted: true }).eq('id', id);
                addToast("Content boosted", "success");
            } else if (action === 'ban_user') {
                await supabase.from('profiles').update({ is_banned: true }).eq('id', id);
                addToast("User banned", "success");
            } else if (action === 'unban_user') {
                await supabase.from('profiles').update({ is_banned: false }).eq('id', id);
                addToast("User unbanned", "success");
            } else if (action === 'verify_vendor') {
                await supabase.from('vendor_profiles').update({ is_verified: true, verification_level: 'verified' }).eq('seller_id', id);
                addToast("Vendor verified", "success");
            } else if (action === 'reject_vendor') {
                await supabase.from('vendor_profiles').update({ is_verified: false, verification_level: 'none' }).eq('seller_id', id);
                addToast("Vendor verification rejected", "success");
            } else if (action === 'resolve_appeal') {
                await supabase.from('moderation_appeals').update({ status: 'approved' }).eq('id', id);
                addToast("Appeal approved", "success");
            } else if (action === 'reject_appeal') {
                await supabase.from('moderation_appeals').update({ status: 'rejected' }).eq('id', id);
                addToast("Appeal rejected", "success");
            } else if (action === 'moderate_product') {
                await supabase.from('products').update({ status: 'flagged' }).eq('id', id);
                addToast("Product flagged for review", "success");
            }

            setModerationNote('');
            fetchData();
        } catch (error) {
            addToast(`Failed to perform action: ${action}`, "error");
        }
    };

    const filteredPosts = posts.filter(post => {
        if (filter === 'pending' && post.status === 'approved') return false;
        if (filter === 'flagged' && post.status !== 'flagged') return false;
        if (search && !post.content?.toLowerCase().includes(search.toLowerCase()) && !post.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const stats = {
        content: posts.length,
        reports: reports.filter(r => r.status === 'pending').length,
        users: users.length,
        vendors: vendors.filter(v => v.verification_status === 'pending').length
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary dark:bg-background flex items-center justify-center shadow-md">
                            <Shield className="w-5 h-5 text-white dark:text-black" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40">Security & Integrity</p>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-sans font-extrabold text-foreground dark:text-white tracking-tight leading-none">
                        Moderation Hub
                    </h2>
                </div>
                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 dark:text-white/30 stroke-[1.5] group-focus-within:text-foreground dark:group-focus-within:text-white transition-colors" />
                        <Input 
                            placeholder="Search everything..." 
                            value={search}
                            onChange={(e:any) => setSearch(e.target.value)}
                            className="pl-12 h-14 text-xs rounded-[1.5rem] bg-card border-foreground/5 dark:border-white/5 shadow-xl shadow-foreground/5 dark:shadow-black/20 focus:ring-0 focus:border-foreground dark:focus:border-white transition-all placeholder:text-foreground/20 dark:placeholder:text-white/20"
                        />
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mb-12">
                <PremiumStatCard 
                    title="Total Content" 
                    value={stats.content} 
                    icon={FileText} 
                    trend={{ value: "Social & Reviews", positive: true }}
                />
                <PremiumStatCard 
                    title="Open Reports" 
                    value={stats.reports} 
                    icon={AlertTriangle} 
                    trend={{ value: "Action Required", positive: false }}
                />
                <PremiumStatCard 
                    title="Active Users" 
                    value={stats.users} 
                    icon={Users} 
                    trend={{ value: "Community", positive: true }}
                />
                <PremiumStatCard 
                    title="Vendor Apps" 
                    value={stats.vendors} 
                    icon={Store} 
                    trend={{ value: "Pending Verification", positive: false }}
                />
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 mb-12 no-scrollbar">
                {[
                    { id: 'content', label: 'Content', icon: FileText },
                    { id: 'reports', label: 'Reports', icon: AlertTriangle },
                    { id: 'users', label: 'Users', icon: Users },
                    { id: 'vendors', label: 'Vendors', icon: Store },
                    { id: 'products', label: 'Products', icon: ShoppingBag },
                    { id: 'appeals', label: 'Appeals', icon: MessageIcon },
                    { id: 'logs', label: 'Logs', icon: History }
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-shrink-0 flex items-center gap-2 py-3 px-6 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === tab.id 
                            ? 'bg-black dark:bg-background text-white dark:text-black shadow-md' 
                            : 'bg-foreground/[0.05] dark:bg-zinc-900 border border-foreground/5 text-foreground/40 dark:text-white/40 hover:text-foreground dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800'}`}
                    >
                        <tab.icon className={`w-4 h-4 stroke-[2.5] ${activeTab === tab.id ? 'scale-110' : ''}`} />
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="space-y-12">
                {(activeTab === 'content' || activeTab === 'products') && selectedItems.length > 0 && (
                    <div className="bg-primary dark:bg-background text-white dark:text-black p-6 rounded-[2rem] flex justify-between items-center animate-in slide-in-from-bottom-4 duration-500 shadow-xl border border-white/10">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-background/20 dark:bg-black/10 flex items-center justify-center">
                                <span className="text-sm font-black">{selectedItems.length}</span>
                            </div>
                            <span className="text-xs font-black uppercase tracking-wider">Items Selected</span>
                        </div>
                        <div className="flex gap-3">
                            <Button size="sm" variant="outline" className="text-xs font-bold border-white/20 dark:border-black/20 hover:bg-background/10 dark:hover:bg-black/10 rounded-xl px-6" onClick={() => handleBulkAction('approve_content')}>Bulk Approve</Button>
                            <Button size="sm" variant="outline" className="text-xs font-bold border-red-500/50 text-red-100 dark:text-red-600 hover:bg-red-500/50 rounded-xl px-6" onClick={() => handleBulkAction('delete_content')}>Bulk Delete</Button>
                        </div>
                    </div>
                )}

                <div className="bg-foreground/[0.02] dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-foreground/5 shadow-sm">
                    <label className="text-xs font-bold text-foreground/50 mb-3 block">Moderation Note (Optional)</label>
                    <textarea 
                        value={moderationNote}
                        onChange={(e) => setModerationNote(e.target.value)}
                        placeholder="Enter reason for action..."
                        className="w-full bg-background dark:bg-black border border-foreground/10 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all h-24 resize-none shadow-sm"
                    />
                </div>

                {activeTab === 'content' && (
                    <div className="space-y-8">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 dark:text-white/30 stroke-[1.5] group-focus-within:text-foreground dark:group-focus-within:text-white transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="SEARCH CONTENT..." 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full h-12 bg-card border border-foreground/5 dark:border-white/5 rounded-2xl py-2 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] focus:outline-none focus:border-foreground/20 dark:focus:border-white/20 transition-all shadow-sm" 
                                />
                            </div>
                            <select 
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as any)}
                                className="h-12 bg-card border border-foreground/5 dark:border-white/5 rounded-2xl px-6 text-[10px] font-black uppercase tracking-[0.2em] focus:outline-none focus:border-foreground/20 dark:focus:border-white/20 transition-all shadow-sm cursor-pointer"
                            >
                                <option value="all">All Content</option>
                                <option value="pending">Pending</option>
                                <option value="flagged">Flagged</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredPosts.map(post => (
                                <Card key={post.id} className={`p-6 rounded-3xl border flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${selectedItems.includes(post.id) ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border bg-card'}`} onClick={() => toggleSelect(post.id)}>
                                    <div className="flex justify-between items-start mb-4">
                                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">{post.type}</Badge>
                                        <span className="text-xs font-medium text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex-1 space-y-4 mb-6">
                                        <p className="text-sm font-medium text-foreground leading-relaxed">"{post.content}"</p>
                                        <div className="pt-4 border-t border-border mt-auto">
                                            <p className="text-xs font-bold text-foreground">{post.profiles?.full_name}</p>
                                            <p className="text-xs text-muted-foreground">{post.profiles?.email}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button size="sm" variant="default" className="text-xs font-bold rounded-xl" onClick={(e) => { e.stopPropagation(); handleAction(post, 'approve_content'); }}>Approve</Button>
                                        <Button size="sm" variant="destructive" className="text-xs font-bold rounded-xl" onClick={(e) => { e.stopPropagation(); handleAction(post, 'delete_content'); }}>Delete</Button>
                                        <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl text-muted-foreground" onClick={(e) => { e.stopPropagation(); handleAction(post, 'shadowban_content'); }}>Shadowban</Button>
                                        <Button size="sm" variant="secondary" className="text-xs font-bold rounded-xl text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900" onClick={(e) => { e.stopPropagation(); handleAction(post, 'boost_content'); }}>Boost</Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {products.map(product => (
                            <Card key={product.id} className={`p-6 rounded-3xl border flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${selectedItems.includes(product.id) ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border bg-card'}`} onClick={() => toggleSelect(product.id)}>
                                <div className="flex justify-between items-start mb-4">
                                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">Product</Badge>
                                    <Badge variant={product.status === 'active' ? 'secondary' : 'destructive'} className="text-[10px] font-bold uppercase tracking-wider rounded-full">{product.status}</Badge>
                                </div>
                                <div className="flex-1 space-y-3 mb-6">
                                    <h4 className="font-sans font-bold text-lg text-foreground tracking-tight">{product.name}</h4>
                                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{product.description}</p>
                                    <div className="pt-4 border-t border-border mt-auto">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Seller</p>
                                        <p className="text-sm font-bold text-foreground">{product.profiles?.full_name}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl" onClick={(e) => { e.stopPropagation(); handleAction(product, 'moderate_product'); }}>Flag</Button>
                                    <Button size="sm" variant="destructive" className="text-xs font-bold rounded-xl" onClick={(e) => { e.stopPropagation(); handleAction(product, 'delete_content'); }}>Delete</Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {activeTab === 'appeals' && (
                    <div className="space-y-6">
                        {appeals.map(appeal => (
                            <Card key={appeal.id} className="p-6 rounded-3xl border border-border bg-card hover:shadow-md transition-all duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                                            <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Appeal: {appeal.content_type}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={appeal.status === 'pending' ? 'destructive' : 'secondary'} className="text-[10px] font-bold uppercase tracking-wider rounded-full">{appeal.status}</Badge>
                                                <span className="text-[10px] font-medium text-muted-foreground">{new Date(appeal.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-foreground mb-6 leading-relaxed">"{appeal.reason}"</p>
                                <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-border gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">From</p>
                                        <p className="text-sm font-bold text-foreground">{appeal.profiles?.full_name} <span className="text-muted-foreground font-medium ml-2">{appeal.profiles?.email}</span></p>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        {appeal.status === 'pending' && (
                                            <>
                                                <Button size="sm" variant="default" className="flex-1 md:flex-none text-xs font-bold rounded-xl px-8" onClick={() => handleAction(appeal, 'resolve_appeal')}>Approve</Button>
                                                <Button size="sm" variant="destructive" className="flex-1 md:flex-none text-xs font-bold rounded-xl px-8" onClick={() => handleAction(appeal, 'reject_appeal')}>Reject</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className="space-y-6">
                        {reports.map(report => (
                            <div key={report.id} className="p-6 rounded-3xl border border-border bg-card hover:shadow-md transition-all duration-300 flex flex-col md:flex-row justify-between gap-8">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                                            <AlertTriangle className="w-5 h-5 text-destructive" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Report: {report.reason}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={report.status === 'pending' ? 'destructive' : 'secondary'} className="text-[10px] font-bold uppercase tracking-wider rounded-full">{report.status}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm font-medium text-foreground leading-relaxed">"{report.details}"</p>
                                    <div className="grid grid-cols-2 gap-8 pt-4 border-t border-border">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reporter</p>
                                            <p className="text-sm font-bold text-foreground">{report.reporter?.full_name}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reported Against</p>
                                            <p className="text-sm font-bold text-foreground">{report.reported?.full_name}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-center md:justify-end">
                                    {report.status === 'pending' && (
                                        <Button size="lg" className="w-full md:w-auto text-xs font-bold rounded-2xl px-8 shadow-md" onClick={() => handleAction(report, 'resolve_report')}>Resolve Report</Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <th className="p-6 font-sans">User Identity</th>
                                        <th className="p-6 font-sans">Role</th>
                                        <th className="p-6 font-sans">Status</th>
                                        <th className="p-6 font-sans">Joined</th>
                                        <th className="p-6 text-right font-sans">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {users.map(u => (
                                        <tr key={u.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="p-6">
                                                <div className="font-sans font-bold text-sm text-foreground">{u.full_name}</div>
                                                <div className="text-xs text-muted-foreground mt-1">{u.email}</div>
                                            </td>
                                            <td className="p-6">
                                                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-full">{u.role}</Badge>
                                            </td>
                                            <td className="p-6">
                                                {u.is_banned ? (
                                                    <Badge variant="destructive" className="text-[10px] font-bold uppercase tracking-wider rounded-full">Banned</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-full">Active</Badge>
                                                )}
                                            </td>
                                            <td className="p-6 text-muted-foreground font-bold text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="p-6 text-right">
                                                {u.is_banned ? (
                                                    <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl" onClick={() => handleAction(u, 'unban_user')}>Unban</Button>
                                                ) : (
                                                    <Button size="sm" variant="destructive" className="text-xs font-bold rounded-xl" onClick={() => handleAction(u, 'ban_user')}>Ban User</Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'vendors' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {vendors.map(v => (
                            <Card key={v.seller_id} className="p-6 rounded-3xl border border-border bg-card hover:shadow-md transition-all duration-300">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1">
                                        <h4 className="font-sans font-bold text-lg text-foreground tracking-tight">{v.store_name}</h4>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{v.profiles?.full_name} <span className="font-medium ml-2">{v.profiles?.email}</span></p>
                                    </div>
                                    <Badge variant={v.is_verified ? 'secondary' : 'outline'} className="text-[10px] font-bold uppercase tracking-wider rounded-full">
                                        {v.is_verified ? 'Verified' : 'Unverified'}
                                    </Badge>
                                </div>
                                <p className="text-sm text-foreground mb-8 leading-relaxed">"{v.description || 'No description provided'}"</p>
                                
                                {v.documents && v.documents.length > 0 && (
                                    <div className="mb-8 space-y-3">
                                        <h5 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verification Documents</h5>
                                        <div className="space-y-2">
                                            {v.documents.map((doc: any) => (
                                                <div key={doc.id} className="flex justify-between items-center p-4 bg-muted/50 rounded-2xl text-xs group">
                                                    <span className="font-bold uppercase tracking-wider text-muted-foreground">{doc.document_type}</span>
                                                    <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="text-foreground font-bold uppercase tracking-wider hover:underline flex items-center gap-2">
                                                        View File <FileText className="w-3 h-3" />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    {!v.is_verified ? (
                                        <Button size="lg" className="flex-1 text-xs font-bold rounded-xl shadow-md" onClick={() => handleAction({ id: v.seller_id }, 'verify_vendor')}>Verify Store</Button>
                                    ) : (
                                        <Button size="lg" variant="destructive" className="flex-1 text-xs font-bold rounded-xl" onClick={() => handleAction({ id: v.seller_id }, 'reject_vendor')}>Revoke Verification</Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="space-y-3">
                        {logs.map(log => (
                            <div key={log.id} className="p-4 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center bg-card hover:bg-muted/30 transition-all duration-300 gap-4 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider rounded-full">{new Date(log.created_at).toLocaleString()}</Badge>
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">{log.action}</span>
                                    <span className="text-sm font-medium text-muted-foreground">"{log.note}"</span>
                                </div>
                                <div className="text-right w-full md:w-auto pt-4 md:pt-0 border-t md:border-none border-border">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">Admin:</span> 
                                    <span className="text-xs font-bold text-foreground">{log.admin?.full_name || 'System'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
