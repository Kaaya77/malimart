import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { Card, Badge, Button, useToast, Input, GraphicalTag } from './UI';
import { supabase } from '../services/supabaseClient';
import { PackageX, Search, MessageSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { PremiumStatCard } from './UI';
import { OrderDetailsModal } from './OrderDetailsModal';
import { Order } from '../types';

export const BuyerReturns = ({ userId, onContactSeller }: { userId: string, onContactSeller: (sellerId: string, context?: { type: 'order' | 'return' | 'support', id: string, label: string }) => void }) => {
    const { addToast } = useToast();
    const [disputes, setDisputes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'closed' | 'refunded'>('all');
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

    const stats = {
        total: disputes.length,
        open: disputes.filter(d => d.status === 'open').length,
        resolved: disputes.filter(d => d.status === 'resolved' || d.status === 'refunded').length
    };

    const fetchDisputes = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('disputes')
            .select('*, order:orders(*), seller:profiles!seller_id(id, full_name, avatar_url, email, phone)')
            .eq('buyer_id', userId)
            .order('created_at', { ascending: false });
        
        if (error) {
            addToast("Failed to load returns", "error");
        } else {
            setDisputes(data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchDisputes();
    }, [userId]);

    const filteredDisputes = disputes.filter(d => {
        const matchesSearch = d.order_id.includes(searchTerm) || d.seller?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[1.25rem] bg-primary dark:bg-white flex items-center justify-center shadow-2xl shadow-foreground/20 dark:shadow-white/20 relative group overflow-hidden">
                            <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" />
                            <PackageX className="w-6 h-6 text-white dark:text-black relative z-10 group-hover:rotate-12 transition-transform duration-500" />
                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 dark:bg-black/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-[0.4em] font-black text-foreground/40 dark:text-white/40">Resolution Center</p>
                            <h2 className="text-4xl md:text-5xl font-serif font-light text-foreground dark:text-white tracking-tight leading-none">
                                Returns & <span className="italic">Claims</span>
                            </h2>
                        </div>
                    </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 dark:text-white/30 stroke-[1.5]" />
                        <Input 
                            placeholder="Search Order ID or Seller..." 
                            value={searchTerm}
                            onChange={(e:any) => setSearchTerm(e.target.value)}
                            className="pl-11 h-12 text-xs rounded-2xl bg-white dark:bg-primary border-foreground/5 dark:border-white/5 shadow-sm focus:ring-0 focus:border-foreground dark:focus:border-white transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <PremiumStatCard 
                    title="Total Claims" 
                    value={stats.total} 
                    icon={PackageX} 
                    trend={{ value: "Lifetime", positive: true }}
                />
                <PremiumStatCard 
                    title="Active Returns" 
                    value={stats.open} 
                    icon={Clock} 
                    trend={{ value: "Pending", positive: false }}
                />
                <PremiumStatCard 
                    title="Resolved" 
                    value={stats.resolved} 
                    icon={CheckCircle2} 
                    trend={{ value: "Success", positive: true }}
                />
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 mb-8 no-scrollbar border-b border-foreground/5 dark:border-white/5">
                {['all', 'open', 'resolved', 'refunded', 'closed'].map(status => (
                    <button 
                        key={status} 
                        onClick={() => setStatusFilter(status as any)}
                        className={`px-2 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${statusFilter === status ? 'text-foreground dark:text-white' : 'text-foreground/30 dark:text-white/30 hover:text-foreground dark:hover:text-white'}`}
                    >
                        {status}
                        {statusFilter === status && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary dark:bg-white rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex-1 flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-2 border-foreground/10 dark:border-white/10 border-t-foreground dark:border-t-white rounded-full animate-spin"></div>
                </div>
            ) : filteredDisputes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-foreground/20 dark:text-white/20 py-24 text-center bg-white/50 dark:bg-white/[0.02] rounded-[2.5rem] border border-foreground/5 dark:border-white/5 backdrop-blur-sm">
                    <PackageX className="w-20 h-20 mb-6 stroke-[0.5]" />
                    <p className="text-xs font-black uppercase tracking-[0.3em]">No returns found</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {filteredDisputes.map(dispute => (
                        <Card key={dispute.id} className="p-10 rounded-[2.5rem] bg-white dark:bg-primary border-foreground/5 dark:border-white/5 shadow-2xl shadow-foreground/5 dark:shadow-black/20 group hover:border-foreground/20 dark:hover:border-white/20 transition-all duration-700 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 dark:bg-white/5 rounded-full -mr-20 -mt-20 transition-transform group-hover:scale-110 duration-1000" />
                            
                            <div className="relative z-10 flex justify-between items-start mb-8">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <GraphicalTag 
                                            type="return" 
                                            label={dispute.status}
                                            id={dispute.order_id}
                                            onClick={() => dispute.order && setViewingOrder(dispute.order)}
                                        />
                                        <div className="px-3 py-1 border border-foreground/10 dark:border-white/10 text-[9px] font-mono font-bold text-foreground/40 dark:text-white/40 tracking-widest uppercase">
                                            REF: {dispute.order_id.slice(0,12)}
                                        </div>
                                    </div>
                                    <h3 className="font-serif text-2xl text-foreground dark:text-white leading-tight tracking-tight">{dispute.reason}</h3>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] font-black text-foreground/30 dark:text-white/30 uppercase tracking-[0.2em]">{new Date(dispute.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                </div>
                            </div>

                            <div className="relative z-10 p-6 bg-background dark:bg-white/[0.03] border border-foreground/5 dark:border-white/5 text-sm text-foreground/60 dark:text-white/60 leading-relaxed font-serif italic mb-8">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/10 dark:bg-white/10" />
                                "{dispute.description}"
                            </div>

                            <div className="relative z-10 flex items-center justify-between mt-auto pt-6 border-t border-foreground/5 dark:border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full border border-foreground/10 dark:border-white/10 overflow-hidden bg-primary/5 dark:bg-white/5">
                                        <img src={dispute.seller?.avatar_url || `https://ui-avatars.com/api/?name=${dispute.seller?.full_name}`} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-serif text-sm text-foreground dark:text-white">{dispute.seller?.full_name}</p>
                                        <p className="text-[9px] text-foreground/40 dark:text-white/40 font-mono tracking-widest uppercase">{dispute.seller?.phone}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button size="sm" variant="secondary" className="h-10 px-5 text-[9px] tracking-[0.2em]" onClick={() => onContactSeller(dispute.seller_id, { type: 'return', id: dispute.order_id, label: `Return #${dispute.order_id.slice(0,8)}` })}>
                                        <MessageSquare className="w-3.5 h-3.5 mr-2 stroke-[1.5]" /> Contact Seller
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />
        </div>
    );
};
