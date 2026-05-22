import { OrderTracking } from './CheckoutComponents';

import React, { useState, useMemo } from 'react';
import { Search, Package, Clock, ChevronLeft, Receipt, RotateCcw, AlertCircle, ShoppingBag, CheckSquare } from 'lucide-react';
import { Button, Card, Badge, Input, SatisfyingOrderGraphic } from './UI';
import { ReceiptModal } from './ReceiptModal';
import { formatTZS } from '../constants';
import { Order, VendorProfile } from '../types';
import { CancelOrderModal } from './CancelOrderModal';

export const BuyerOrders = ({ 
 orders, 
 onCancel, 
 onDelete,
 onReorder, 
 onContactSeller, 
 onPrintReceipt, 
 fetchVendorProfile 
}: { 
 orders: Order[], 
 onCancel: (id: string, reason: string) => void, 
 onDelete: (id: string) => void,
 onReorder: (order: Order) => void, 
 onContactSeller: (sellerId: string, context?: { type: 'order' | 'return' | 'support', id: string, label: string }) => void, 
 onPrintReceipt: (order: Order, seller?: VendorProfile) => void, 
 fetchVendorProfile: (id: string) => Promise<VendorProfile | null> 
}) => {
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState('all');
 const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
 const [receiptOrder, setReceiptOrder] = useState<{ order: Order, seller: VendorProfile } | null>(null);
 const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

 const filteredOrders = useMemo(() => {
 return orders.filter(o => {
 if (o.deleted_at) return false; // Filter out soft-deleted orders
 const matchesStatus = statusFilter === 'all'
        || o.status === statusFilter
        || (statusFilter === 'in_transit' && o.status === 'shipped');
 const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
 o.items?.some(i => i.products?.name.toLowerCase().includes(searchTerm.toLowerCase()));
 return matchesStatus && matchesSearch;
 }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
 }, [orders, statusFilter, searchTerm]);

 return (
 <div className="flex flex-col h-[700px] animate-in fade-in">
 <div className="flex gap-4 mb-6 shrink-0">
 <div className="relative flex-1">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
 <Input 
 placeholder="Search Order ID or Product..." 
 value={searchTerm}
 onChange={(e: any) => setSearchTerm(e.target.value)}
 className="h-14 pl-12 rounded-2xl bg-background dark:bg-background/5 border-foreground/10"
 />
 </div>
 <div className="flex bg-foreground/[0.05] dark:bg-background/5 p-1.5 rounded-2xl">
 {['all', 'pending', 'processing', 'in_transit', 'delivered', 'cancelled', 'disputed'].map(s => (
 <button 
 key={s === 'in_transit' ? 'Shipped' : s === 'processing' ? 'Confirmed' : s.charAt(0).toUpperCase() + s.slice(1)}
 onClick={() => setStatusFilter(s)}
 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === s ? 'bg-card text-foreground shadow-sm' : 'text-foreground/40 hover:text-foreground/70'}`}
 >
 {s}
 </button>
 ))}
 </div>
 </div>

 <div className="flex-1 flex gap-6 overflow-hidden rounded-3xl border border-foreground/8 bg-card shadow-sm relative">
 <div className={`${selectedOrder ? 'hidden lg:flex w-1/3 border-r' : 'w-full flex'} border-foreground/8 flex-col`}>
 <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
 {filteredOrders.length === 0 ? <div className="p-10 text-center text-foreground/40 text-xs font-bold uppercase">No orders found</div> :
 filteredOrders.map(order => (
 <div 
 key={order.id} 
 onClick={() => setSelectedOrder(order)}
 className={`p-4 rounded-2xl border-2 transition-all cursor-pointer hover:bg-foreground/[0.03] dark:hover:bg-background/5 flex gap-3 ${selectedOrder?.id === order.id ? 'border-brand-500 bg-brand-50/10' : 'border-transparent'}`}
 >
 <div className="flex-1">
 <div className="flex justify-between items-start mb-2">
 <span className="font-mono text-[10px] font-bold text-foreground/40">#{order.id.slice(0,8)}</span>
 <Badge variant={['delivered'].includes(order.status) ? 'success' : ['cancelled'].includes(order.status) ? 'danger' : 'secondary'} className="text-[8px]">
 {order.status}
 </Badge>
 </div>
 <p className="font-black text-xs text-foreground mb-1">{order.items?.[0]?.product?.name || order.items?.[0]?.products?.name || 'Multiple Items'}</p>
 <div className="flex justify-between items-center pt-2 border-t border-foreground/8">
 <span className="text-[10px] font-bold text-foreground/40 uppercase">{new Date(order.created_at).toLocaleDateString()}</span>
 <span className="font-black text-sm">{formatTZS(order.total)}</span>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {selectedOrder ? (
 <div className="flex-1 flex flex-col h-full bg-foreground/[0.02]">
 <div className="p-6 border-b border-foreground/8 flex justify-between items-center bg-card">
 <div className="flex items-center gap-4">
 <button onClick={() => setSelectedOrder(null)} className="lg:hidden p-2 bg-foreground/[0.06] rounded-full hover:bg-foreground/10 transition-colors active:scale-90"><ChevronLeft className="w-4 h-4"/></button>
 <div>
 <h2 className="font-black text-xl font-display uppercase tracking-tight">Order Details</h2>
 <p className="text-[10px] font-bold text-foreground/40 font-mono">ID: {selectedOrder.id}</p>
 </div>
 </div>
 <div className="flex gap-1.5 flex-wrap">
 <button onClick={() => onReorder(selectedOrder)}
 className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-foreground/[0.06] text-foreground text-xs font-semibold hover:bg-foreground/10 transition-colors active:scale-95">
 Reorder
 </button>
 <button onClick={() => onContactSeller(selectedOrder.items?.[0]?.products?.seller_id || selectedOrder.items?.[0]?.seller_id, { type: 'order', id: selectedOrder.id, label: `Order #${selectedOrder.id.slice(0,8)}` })}
 className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-foreground/[0.06] text-foreground text-xs font-semibold hover:bg-foreground/10 transition-colors active:scale-95">
 Message Seller
 </button>
 <button onClick={async () => {
 const sellerId = selectedOrder.items?.[0]?.products?.seller_id || selectedOrder.items?.[0]?.seller_id;
 const seller = sellerId ? await fetchVendorProfile(sellerId) : undefined;
 setReceiptOrder({ order: selectedOrder, seller: seller || {} as VendorProfile });
 if (onPrintReceipt) onPrintReceipt(selectedOrder, seller as any);
 }} className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-foreground/[0.06] text-foreground text-xs font-semibold hover:bg-foreground/10 transition-colors active:scale-95">
 Receipt
 </button>
 {selectedOrder.status === 'pending' && (
 <button onClick={() => setIsCancelModalOpen(true)}
 className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-rose-500/10 text-rose-600 text-xs font-semibold hover:bg-rose-500/15 transition-colors active:scale-95">
 Cancel Order
 </button>
 )}
 </div>
 </div>

 <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
 {/* Order Progress */}
 <div className="mb-6">
 <SatisfyingOrderGraphic status={selectedOrder.status as any} />
 </div>

 {/* Live Order Tracking */}
 {!['cancelled','refunded','failed'].includes(selectedOrder.status) && (
 <div className="bg-foreground/[0.02] border border-foreground/8 rounded-3xl p-5">
 <h4 className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-4 flex items-center gap-2">
 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
 Live Tracking
 </h4>
 <OrderTracking order={selectedOrder as any} />
 </div>
 )}

 {selectedOrder.status === 'cancelled' && selectedOrder.cancel_reason && (
 <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
 <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
 <div>
 <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 mb-1">Cancellation Reason</p>
 <p className="text-sm font-medium text-red-900 dark:text-red-200">{selectedOrder.cancel_reason}</p>
 </div>
 </div>
 )}

 <div className="space-y-3">
 <h4 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-4 flex items-center gap-2"><ShoppingBag className="w-3 h-3"/> Items ({selectedOrder.items?.length || 0})</h4>
 {selectedOrder.items?.map((item: any) => (
 <div key={item.id} className="flex gap-4 p-4 bg-card rounded-2xl border border-foreground/8 items-center">
 <div className="w-12 h-12 bg-foreground/[0.05] rounded-xl overflow-hidden shrink-0">
 <img src={item.product?.images?.[0] || item.products?.images?.[0]} className="w-full h-full object-cover" loading="lazy" decoding="async" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-sm truncate">{item.product?.name || item.products?.name}</p>
 <p className="text-[10px] text-foreground/55 font-mono">Qty: {item.quantity}</p>
 </div>
 <div className="text-right">
 <p className="font-black text-sm">{formatTZS(item.price_at_purchase * item.quantity)}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 {receiptOrder && <ReceiptModal isOpen={!!receiptOrder} order={receiptOrder.order} seller={receiptOrder.seller} onClose={() => setReceiptOrder(null)} />}
 </div>
 ) : (
 <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-foreground/20">
 <Receipt className="w-16 h-16 mb-4 opacity-20"/>
 <p className="font-black uppercase tracking-widest text-xs">Select an order to view details</p>
 </div>
 )}
 </div>
 <CancelOrderModal 
 isOpen={isCancelModalOpen}
 onClose={() => setIsCancelModalOpen(false)}
 onConfirm={async (reason) => {
 if (selectedOrder) {
 try {
 await onCancel(selectedOrder.id, reason);
 setIsCancelModalOpen(false);
 } catch (e) {
 }
 }
 }}
 role="buyer"
 />
 </div>
 );
};
