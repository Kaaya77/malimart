import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { Card, Badge, Button, useToast, Input, GraphicalTag } from './UI';
import { supabase } from '../services/supabaseClient';
import { AlertCircle, CheckCircle, XCircle, Search, MessageSquare, PackageX, Clock, CheckCircle2, RefreshCcw } from 'lucide-react';
import { formatTZS } from '../constants';
import { PremiumStatCard } from './UI';
import { OrderDetailsModal } from './OrderDetailsModal';
import { Order } from '../types';

export const SellerReturns = ({ userId, onContactBuyer }: { userId: string, onContactBuyer: (buyerId: string, productId?: string, orderId?: string) => void }) => {
 const { addToast } = useToast();
 const [disputes, setDisputes] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved' | 'closed' | 'refunded'>('all');
 const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

 const stats = {
 total: disputes.length,
 pending: disputes.filter(d => d.status === 'open').length,
 refunded: disputes.filter(d => d.status === 'refunded').length
 };

 const fetchDisputes = async () => {
 setIsLoading(true);
 const { data, error } = await supabase
 .from('disputes')
 .select('*, order:orders(*), buyer:profiles!buyer_id(id, full_name, avatar_url, email, phone)')
 .eq('seller_id', userId)
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

 const handleUpdateStatus = async (disputeId: string, newStatus: string, orderId: string) => {
 const { error } = await supabase.from('disputes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', disputeId);
 if (error) {
 addToast("Failed to update status", "error");
 return;
 }
 
 if (newStatus === 'refunded') {
 await supabase.from('orders').update({ status: 'refunded' }).eq('id', orderId);
 } else if (newStatus === 'resolved') {
 await supabase.from('orders').update({ status: 'delivered' }).eq('id', orderId); // Assuming resolved means order is okay
 }
 
 addToast(`Return marked as ${newStatus}`, "success");
 fetchDisputes();
 };

 const filteredDisputes = disputes.filter(d => {
 const matchesSearch = d.order_id.includes(searchTerm) || d.buyer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
 const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
 return matchesSearch && matchesStatus;
 });

 return (
 <div className="flex flex-col h-full animate-in fade-in duration-700">
 <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-none bg-primary dark:bg-background flex items-center justify-center shadow-none relative group overflow-hidden border border-foreground/10">
 <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" />
 <RefreshCcw className="w-6 h-6 text-white relative z-10 group-hover:rotate-12 transition-transform duration-500" />
 <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 dark:bg-black/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700" />
 </div>
 <div className="space-y-1">
 <p className="text-[10px] uppercase tracking-[0.4em] font-black text-foreground/40 ">Merchant Support</p>
 <h2 className="text-4xl md:text-5xl font-serif font-light text-foreground dark:text-white tracking-tight leading-none">
 Returns & <span className="italic">Disputes</span>
 </h2>
 </div>
 </div>
 <div className="flex flex-wrap gap-3 w-full md:w-auto">
 <div className="relative flex-1 md:w-72">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[1.5]" />
 <Input 
 placeholder="Search Order ID or Customer..." 
 value={searchTerm}
 onChange={(e:any) => setSearchTerm(e.target.value)}
 className="pl-11 h-12 text-xs rounded-2xl bg-card border-foreground/5 shadow-sm focus:ring-0 focus:border-foreground dark:focus:border-white transition-all"
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
 trend={{ value: "All Time", positive: true }}
 />
 <PremiumStatCard 
 title="Pending Review" 
 value={stats.pending} 
 icon={Clock} 
 trend={{ value: "Action Required", positive: false }}
 />
 <PremiumStatCard 
 title="Refunded" 
 value={stats.refunded} 
 icon={CheckCircle2} 
 trend={{ value: "Resolved", positive: true }}
 />
 </div>

 <div className="flex gap-4 overflow-x-auto pb-4 mb-8 no-scrollbar border-b border-foreground/5 ">
 {['all', 'open', 'resolved', 'refunded', 'closed'].map(status => (
 <button 
 key={status} 
 onClick={() => setStatusFilter(status as any)}
 className={`px-2 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${statusFilter === status ? 'text-foreground dark:text-white' : 'text-foreground/30 hover:text-foreground dark:hover:text-white'}`}
 >
 {status}
 {statusFilter === status && (
 <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary dark:bg-background rounded-full" />
 )}
 </button>
 ))}
 </div>

 {isLoading ? (
 <div className="flex-1 flex items-center justify-center py-20">
 <div className="w-10 h-10 border-2 border-foreground/10 border-t-foreground dark:border-t-white rounded-full animate-spin"></div>
 </div>
 ) : filteredDisputes.length === 0 ? (
 <div className="flex-1 flex flex-col items-center justify-center text-foreground/20 py-24 text-center bg-background dark:bg-background rounded-none border border-foreground/10">
 <PackageX className="w-20 h-20 mb-6 stroke-[0.5]" />
 <p className="text-xs font-black uppercase tracking-[0.3em]">No returns found</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {filteredDisputes.map(dispute => (
 <Card key={dispute.id} className="p-10 rounded-none bg-background dark:bg-background border border-foreground/10 shadow-none group hover:border-foreground/30 dark:hover:border-background/30 transition-all duration-700 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-40 h-40 bg-foreground/[0.05] rounded-full -mr-20 -mt-20 transition-transform group-hover:scale-110 duration-1000" />
 
 <div className="relative z-10 flex justify-between items-start mb-8">
 <div className="space-y-4">
 <div className="flex flex-wrap items-center gap-4">
 <GraphicalTag 
 type="return" 
 label={dispute.status}
 id={dispute.order_id}
 onClick={() => dispute.order && setViewingOrder(dispute.order)}
 />
 <div className="px-3 py-1 border border-foreground/10 text-[9px] font-mono font-bold text-foreground/40 tracking-widest uppercase">
 REF: {dispute.order_id.slice(0,12)}
 </div>
 </div>
 <h3 className="font-serif text-2xl text-foreground dark:text-white leading-tight tracking-tight">{dispute.reason}</h3>
 </div>
 <div className="text-right shrink-0">
 <p className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">{new Date(dispute.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
 </div>
 </div>

 <div className="relative z-10 flex items-center gap-4 mb-8">
 <div className="w-12 h-12 rounded-full border border-foreground/10 overflow-hidden bg-foreground/[0.05] ">
 {dispute.buyer?.avatar_url ? (
 <img src={dispute.buyer.avatar_url} alt="" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-sm font-serif text-foreground/40 ">{dispute.buyer?.full_name?.charAt(0)}</div>
 )}
 </div>
 <div>
 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-foreground/40 ">Customer</p>
 <p className="text-sm font-bold text-foreground dark:text-white font-serif">{dispute.buyer?.full_name}</p>
 </div>
 </div>

 <div className="relative z-10 p-6 bg-background ] border border-foreground/5 text-sm text-foreground/60 leading-relaxed font-serif italic mb-10">
 <div className="absolute top-0 left-0 w-1 h-full bg-primary/10 " />
 "{dispute.description}"
 </div>

 <div className="relative z-10 flex flex-wrap gap-4">
 {dispute.status === 'open' && (
 <>
 <Button 
 onClick={() => handleUpdateStatus(dispute.id, 'resolved', dispute.order_id)}
 className="flex-1 h-14 rounded-none bg-primary dark:bg-background text-white text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform"
 >
 <CheckCircle className="w-4 h-4 mr-3 stroke-[1.5]" />
 Resolve
 </Button>
 <Button 
 onClick={() => handleUpdateStatus(dispute.id, 'refunded', dispute.order_id)}
 variant="outline"
 className="flex-1 h-14 rounded-none border-foreground/10 text-foreground dark:text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/5 hover:text-red-500 hover:border-red-500/30 transition-all"
 >
 <XCircle className="w-4 h-4 mr-3 stroke-[1.5]" />
 Refund
 </Button>
 </>
 )}
 <Button 
 onClick={() => onContactBuyer(dispute.buyer_id, dispute.order?.product_id, dispute.order_id)}
 variant="secondary"
 className="w-full h-14 rounded-none border-foreground/10 text-foreground dark:text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-background dark:hover:bg-background dark:hover:text-foreground transition-all"
 >
 <MessageSquare className="w-4 h-4 mr-3 stroke-[1.5]" />
 Contact Customer
 </Button>
 </div>
 </Card>
 ))}
 </div>
 )}
 <OrderDetailsModal isOpen={!!viewingOrder} onClose={() => setViewingOrder(null)} order={viewingOrder} />
 </div>
 );
};
