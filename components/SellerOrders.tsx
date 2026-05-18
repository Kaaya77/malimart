
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Printer, ChevronLeft, Receipt, User, Truck, ShoppingBag, AlertCircle, Download, Calendar, ArrowUpDown, CheckSquare, Clock } from 'lucide-react';
import { useAppState } from '../context/AppContext';
import { Button, Input, Card, Badge, useToast, ReceiptModal, SatisfyingOrderGraphic } from './UI';
import { supabase } from '../services/supabaseClient';
import { formatTZS } from '../constants';
import { OrderTracking } from './CheckoutComponents';
import { VendorProfile } from '../types';
import { CancelOrderModal } from './CancelOrderModal';

export const SellerOrders = ({ sellerId, onContactBuyer }: { sellerId: string, onContactBuyer: (buyerId: string, productId?: string, orderId?: string) => void }) => {
    const { addToast } = useToast();
    const { user, updateOrderStatus, fetchVendorProfile } = useAppState();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [disputeDetails, setDisputeDetails] = useState<any | null>(null);
    const [trackingData, setTrackingData] = useState({ carrier: '', tracking_number: '' });
    const [receiptOrder, setReceiptOrder] = useState<{ order: any, seller: VendorProfile } | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    // New Feature States
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
    const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);

    useEffect(() => {
        if (selectedOrder?.status === 'disputed') {
            const fetchDispute = async () => {
                const { data } = await supabase.from('disputes').select('*').eq('order_id', selectedOrder.id).single();
                setDisputeDetails(data);
            };
            fetchDispute();
        } else {
            setDisputeDetails(null);
        }

        // Fetch existing shipment if any
        if (selectedOrder) {
            const fetchShipment = async () => {
                const { data } = await supabase.from('shipments').select('*').eq('order_id', selectedOrder.id).single();
                if (data) {
                    setTrackingData({ carrier: data.carrier || '', tracking_number: data.tracking_number || '' });
                } else {
                    setTrackingData({ carrier: '', tracking_number: '' });
                }
            };
            fetchShipment();
        }
    }, [selectedOrder]);

    const handleUpdateTracking = async () => {
        if (!selectedOrder) return;
        try {
            // Check if shipment exists
            const { data: existing } = await supabase.from('shipments').select('id').eq('order_id', selectedOrder.id).single();
            
            if (existing) {
                await supabase.from('shipments').update({
                    carrier: trackingData.carrier,
                    tracking_number: trackingData.tracking_number,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id);
                
                // Add event
                await supabase.from('shipment_events').insert({
                    shipment_id: existing.id,
                    status: 'in_transit',
                    notes: `Tracking updated: ${trackingData.carrier} - ${trackingData.tracking_number}`
                });
            } else {
                const { data: newShipment, error } = await supabase.from('shipments').insert({
                    order_id: selectedOrder.id,
                    seller_id: user?.id,
                    carrier: trackingData.carrier,
                    tracking_number: trackingData.tracking_number,
                    status: 'in_transit'
                }).select().single();

                if (!error && newShipment) {
                    await supabase.from('shipment_events').insert({
                        shipment_id: newShipment.id,
                        status: 'created',
                        notes: `Shipment created via ${trackingData.carrier}`
                    });
                }
            }
            addToast("Tracking info updated", "success");
        } catch (error) {
            addToast("Failed to update tracking", "error");
        }
    };

    const handleIssueRefund = async () => {
        if (!selectedOrder || !disputeDetails) return;
        try {
            // Update dispute status
            await supabase.from('disputes').update({ status: 'resolved', resolution_notes: 'Refund issued by seller', resolved_at: new Date().toISOString() }).eq('id', disputeDetails.id);
            // Update order status
            await updateOrderStatus(selectedOrder.id, 'refunded');
            addToast("Refund initiated and dispute resolved", "success");
            setSelectedOrder({ ...selectedOrder, status: 'refunded' });
        } catch (error) {
            addToast("Failed to issue refund", "error");
        }
    };

    const fetchOrders = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('order_items')
            .select(`
                *,
                order:orders (
                    *,
                    buyer:profiles (*)
                ),
                product:products (name, images)
            `)
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            addToast("Failed to load orders", "error");
        } else {
            console.log('Fetched order items:', data);
            const grouped = data.reduce((acc: any, item: any) => {
                let orderData = item.order;
                if (Array.isArray(orderData)) orderData = orderData[0];
                if (!orderData || orderData.deleted_at) return acc; // Skip soft-deleted orders
                
                if (!acc[item.order_id]) {
                    let buyerData = orderData.buyer || orderData.profiles;
                    if (Array.isArray(buyerData)) buyerData = buyerData[0];
                    acc[item.order_id] = {
                        ...orderData,
                        buyer: buyerData,
                        items: [],
                        seller_total: 0 
                    };
                }
                acc[item.order_id].items.push(item);
                console.log('Item:', item, 'Price:', item.price_at_purchase, 'Qty:', item.quantity);
                acc[item.order_id].seller_total += (item.price_at_purchase || 0) * (item.quantity || 0);
                return acc;
            }, {});
            setOrders(Object.values(grouped));
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchOrders();
        
        const channel = supabase.channel(`seller_orders_${sellerId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items', filter: `seller_id=eq.${sellerId}` }, () => fetchOrders())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchOrders())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [sellerId]);

    const handleUpdateStatus = async (orderId: string, newStatus: string) => {
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        if (selectedOrder?.id === orderId) setSelectedOrder((prev: any) => ({ ...prev, status: newStatus }));

        try {
            await updateOrderStatus(orderId, newStatus);
            addToast(`Order marked as ${newStatus}`, "success");
            fetchOrders();
        } catch (error) {
            addToast("Update failed", "error");
            fetchOrders(); // Rollback on error
        }
    };

    const handleBulkUpdateStatus = async (newStatus: string) => {
        if (selectedOrderIds.size === 0) return;
        setIsBulkUpdating(true);
        try {
            for (const id of Array.from(selectedOrderIds)) {
                await updateOrderStatus(id, newStatus);
            }
            addToast(`Updated ${selectedOrderIds.size} orders to ${newStatus}`, "success");
            setSelectedOrderIds(new Set());
            fetchOrders();
        } catch (error) {
            addToast("Bulk update failed", "error");
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleExportCSV = () => {
        console.log("Exporting CSV...");
        if (filteredOrders.length === 0) return addToast("No orders to export", "info");
        
        const headers = ['Order ID', 'Date', 'Customer Name', 'Customer Email', 'Status', 'Total Amount', 'Items'];
        const csvContent = [
            headers.join(','),
            ...filteredOrders.map(o => [
                o.id,
                new Date(o.created_at).toLocaleDateString(),
                `"${o.buyer?.full_name || o.buyer?.email || 'Guest'}"`,
                `"${o.buyer?.email || ''}"`,
                o.status,
                o.seller_total,
                `"${o.items.map((i:any) => `${i.quantity}x ${i.product?.name}`).join('; ')}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        addToast("Exported successfully", "success");
    };

    const filteredOrders = useMemo(() => {
        let result = orders.filter(o => {
            const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
            const matchesSearch = (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  o.buyer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesDate = true;
            const orderDate = new Date(o.created_at);
            const now = new Date();
            if (dateFilter === 'today') {
                matchesDate = orderDate.toDateString() === now.toDateString();
            } else if (dateFilter === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                matchesDate = orderDate >= weekAgo;
            } else if (dateFilter === 'month') {
                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                matchesDate = orderDate >= monthAgo;
            }

            return matchesStatus && matchesSearch && matchesDate;
        });

        result.sort((a, b) => {
            if (sortBy === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sortBy === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            if (sortBy === 'amount_desc') return b.seller_total - a.seller_total;
            if (sortBy === 'amount_asc') return a.seller_total - b.seller_total;
            return 0;
        });

        return result;
    }, [orders, statusFilter, searchTerm, dateFilter, sortBy]);

    const stats = useMemo(() => ({
        pending: orders.filter(o => o.status === 'pending').length,
        revenue: orders.reduce((acc, o) => acc + o.seller_total, 0),
        completed: orders.filter(o => o.status === 'delivered').length
    }), [orders]);

    const toggleOrderSelection = (id: string) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedOrderIds(newSet);
    };

    const toggleAllSelection = () => {
        if (selectedOrderIds.size === filteredOrders.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
        }
    };

    return (
        <div className="flex flex-col min-h-[600px] h-full animate-in fade-in">
            <div className="flex flex-col xl:flex-row gap-6 mb-6 shrink-0">
                <div className="flex gap-4 overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
                    <div className="p-6 rounded-none bg-background dark:bg-background border border-foreground/10 dark:border-background/10 min-w-[160px]">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 mb-2">Pending</p>
                        <p className="text-2xl font-serif text-foreground dark:text-background">{stats.pending}</p>
                    </div>
                    <div className="p-6 rounded-none bg-background dark:bg-background border border-foreground/10 dark:border-background/10 min-w-[160px]">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 mb-2">Est. Revenue</p>
                        <p className="text-2xl font-serif text-foreground dark:text-background truncate">{formatTZS(stats.revenue)}</p>
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 dark:text-background/40" />
                            <Input 
                                placeholder="Search Order ID or Customer..." 
                                value={searchTerm}
                                onChange={(e: any) => setSearchTerm(e.target.value)}
                                className="h-14 pl-12 rounded-none bg-transparent border-foreground/20 dark:border-background/20 focus:border-foreground dark:focus:border-background text-foreground dark:text-background placeholder:text-foreground/40 dark:placeholder:text-background/40"
                            />
                        </div>
                        <Button variant="outline" className="h-14 rounded-none px-6 border-foreground/20 dark:border-background/20 text-foreground dark:text-background hover:bg-primary/5 dark:hover:bg-background/5 uppercase tracking-[0.1em] text-[10px]" onClick={handleExportCSV} title="Export to CSV">
                            <Download className="w-4 h-4 mr-2" /> Export
                        </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center bg-primary/5 dark:bg-background/5 p-2 rounded-none border border-foreground/10 dark:border-background/10">
                        <div className="flex bg-white dark:bg-primary rounded-none p-1 border border-foreground/10 dark:border-background/10">
                            {['all', 'pending', 'shipped', 'delivered'].map(s => (
                                <button 
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-6 py-2 rounded-none text-[9px] uppercase tracking-[0.2em] transition-all ${statusFilter === s ? 'bg-primary text-background dark:bg-background dark:text-foreground' : 'text-foreground/60 dark:text-background/60 hover:text-foreground dark:hover:text-background'}`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        
                        <div className="flex items-center gap-3 px-4 border-l border-foreground/10 dark:border-background/10">
                            <Calendar className="w-4 h-4 text-foreground/40 dark:text-background/40" />
                            <select value={dateFilter} onChange={(e:any) => setDateFilter(e.target.value)} className="bg-transparent text-[9px] uppercase tracking-[0.2em] text-foreground dark:text-background outline-none cursor-pointer">
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-3 px-4 border-l border-foreground/10 dark:border-background/10">
                            <ArrowUpDown className="w-4 h-4 text-foreground/40 dark:text-background/40" />
                            <select value={sortBy} onChange={(e:any) => setSortBy(e.target.value)} className="bg-transparent text-[9px] uppercase tracking-[0.2em] text-foreground dark:text-background outline-none cursor-pointer">
                                <option value="date_desc">Newest First</option>
                                <option value="date_asc">Oldest First</option>
                                <option value="amount_desc">Highest Amount</option>
                                <option value="amount_asc">Lowest Amount</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden rounded-none border border-foreground/10 dark:border-background/10 bg-background dark:bg-background shadow-sm relative">
                <div className={`${selectedOrder ? 'hidden lg:flex w-1/3 border-r' : 'w-full flex'} border-foreground/10 dark:border-background/10 flex-col`}>
                    <div className="p-6 border-b border-foreground/10 dark:border-background/10 bg-primary/5 dark:bg-background/5 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={toggleAllSelection} className="p-1 hover:bg-primary/10 dark:hover:bg-background/10 rounded-none transition-colors">
                                <CheckSquare className={`w-4 h-4 ${selectedOrderIds.size > 0 ? 'text-foreground dark:text-background' : 'text-foreground/40 dark:text-background/40'}`} />
                            </button>
                            <h3 className="font-serif text-[11px] uppercase tracking-[0.2em] text-foreground/60 dark:text-background/60">{filteredOrders.length} Orders Found</h3>
                        </div>
                        {selectedOrderIds.size > 0 && (
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="h-8 text-[9px] rounded-none border-foreground/20 dark:border-background/20 text-foreground dark:text-background uppercase tracking-[0.1em]" onClick={() => handleBulkUpdateStatus('processing')} isLoading={isBulkUpdating}>Accept</Button>
                                <Button size="sm" className="h-8 text-[9px] rounded-none bg-primary text-background dark:bg-background dark:text-foreground uppercase tracking-[0.1em]" onClick={() => handleBulkUpdateStatus('shipped')} isLoading={isBulkUpdating}>Ship</Button>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
                        {isLoading ? (
                            <div className="space-y-2">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="p-4 border border-foreground/10 dark:border-background/10 flex items-center gap-4 animate-pulse">
                                        <div className="w-4 h-4 bg-primary/10 dark:bg-background/10"></div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-primary/10 dark:bg-background/10 w-1/4"></div>
                                            <div className="h-4 bg-primary/10 dark:bg-background/10 w-1/2"></div>
                                            <div className="h-2 bg-primary/10 dark:bg-background/10 w-1/3"></div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="w-16 h-4 bg-primary/10 dark:bg-background/10"></div>
                                            <div className="w-20 h-4 bg-primary/10 dark:bg-background/10"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : 
                         filteredOrders.length === 0 ? <div className="p-10 text-center text-foreground/40 dark:text-background/40 text-[9px] uppercase tracking-[0.2em]">No orders found</div> :
                         filteredOrders.map((order, index) => (
                            <div 
                                key={order.id || `order-${index}`} 
                                className={`p-4 rounded-none border transition-all cursor-pointer hover:bg-primary/5 dark:hover:bg-background/5 flex items-center gap-4 ${selectedOrder?.id === order.id ? 'border-foreground bg-primary/5 dark:border-background dark:bg-background/5' : 'border-foreground/10 dark:border-background/10'}`}
                            >
                                <div className="shrink-0" onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order.id); }}>
                                    <div className={`w-4 h-4 rounded-none border ${selectedOrderIds.has(order.id) ? 'bg-primary border-foreground dark:bg-background dark:border-background' : 'border-foreground/20 dark:border-background/20'} flex items-center justify-center`}>
                                        {selectedOrderIds.has(order.id) && <CheckSquare className="w-3 h-3 text-background dark:text-foreground" />}
                                    </div>
                                </div>
                                <div className="flex-1 grid grid-cols-[1fr_auto] gap-2" onClick={() => {
                                    console.log('Order:', order);
                                    setSelectedOrder(order);
                                }}>
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="font-mono text-[10px] text-foreground/60 dark:text-background/60">#{(order.id || '').slice(0,8)}</span>
                                        <p className="font-serif text-[13px] text-foreground dark:text-background truncate">{order.buyer?.full_name || order.buyer?.email || 'Guest User'}</p>
                                        <p className="text-[9px] text-foreground/40 dark:text-background/40 uppercase tracking-[0.1em]">
                                            {order.created_at && !isNaN(new Date(order.created_at).getTime()) 
                                                ? new Date(order.created_at).toLocaleDateString() 
                                                : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <Badge variant={['delivered'].includes(order.status) ? 'success' : ['cancelled'].includes(order.status) ? 'danger' : 'secondary'} className="text-[8px] rounded-none uppercase tracking-[0.1em]">
                                            {order.status}
                                        </Badge>
                                        <span className="font-mono text-sm text-foreground dark:text-background mt-1">{formatTZS(order.seller_total)}</span>
                                        <span className="text-[9px] uppercase tracking-[0.2em] text-foreground/60 dark:text-background/60 mt-1">{order.items.length} Items</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedOrder ? (
                    <div className="flex-1 flex flex-col h-full bg-background dark:bg-background">
                        <div className="p-8 border-b border-foreground/10 dark:border-background/10 flex justify-between items-center bg-background dark:bg-background">
                            <div className="flex items-center gap-6">
                                <button onClick={() => setSelectedOrder(null)} className="lg:hidden p-2 bg-primary/5 dark:bg-background/5 rounded-none hover:bg-primary/10 dark:hover:bg-background/10 transition-colors"><ChevronLeft className="w-4 h-4 text-foreground dark:text-background"/></button>
                                <div>
                                    <h2 className="font-serif text-2xl text-foreground dark:text-background">Order Details</h2>
                                    <p className="text-[10px] font-mono text-foreground/60 dark:text-background/60 mt-1">ID: {selectedOrder.id}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button className="p-3 rounded-none bg-primary/5 dark:bg-background/5 hover:bg-primary/10 dark:hover:bg-background/10 text-foreground dark:text-background transition-colors border border-foreground/10 dark:border-background/10" title="Print Invoice">
                                    <Printer className="w-4 h-4" />
                                </button>
                                <Button size="sm" variant="outline" className="rounded-none border-foreground/20 dark:border-background/20 text-foreground dark:text-background uppercase tracking-[0.1em] text-[9px]" onClick={() => onContactBuyer(selectedOrder.buyer.id, selectedOrder.items[0]?.product_id, selectedOrder.id)}>Contact Buyer</Button>
                                {selectedOrder.status === 'pending' && (
                                    <>
                                        <Button size="sm" variant="danger" className="rounded-none uppercase tracking-[0.1em] text-[9px]" onClick={() => setIsCancelModalOpen(true)}>Cancel</Button>
                                        <Button size="sm" className="rounded-none bg-primary text-background dark:bg-background dark:text-foreground uppercase tracking-[0.1em] text-[9px]" onClick={() => handleUpdateStatus(selectedOrder.id, 'processing')}>
                                            {selectedOrder.payment_method !== 'Cash on Delivery' ? 'Verify Payment & Accept' : 'Accept Order'}
                                        </Button>
                                    </>
                                )}
                                {selectedOrder.status === 'processing' && (
                                    <Button size="sm" className="rounded-none bg-primary text-background dark:bg-background dark:text-foreground uppercase tracking-[0.1em] text-[9px]" onClick={() => handleUpdateStatus(selectedOrder.id, 'in_transit')}>Mark Shipped</Button>
                                )}
                                {selectedOrder.status === 'in_transit' && (
                                    <Button size="sm" className="rounded-none bg-primary text-background dark:bg-background dark:text-foreground uppercase tracking-[0.1em] text-[9px]" onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>Mark Delivered</Button>
                                )}
                                {selectedOrder.status === 'delivered' && (
                                    <>
                                        <Button size="sm" variant="secondary" className="rounded-none uppercase tracking-[0.1em] text-[9px]" onClick={async () => {
                                            const seller = await fetchVendorProfile(sellerId);
                                            setReceiptOrder({ order: selectedOrder, seller: seller || {} as VendorProfile });
                                        }}>Print Receipt</Button>
                                        <Button size="sm" variant="danger" className="rounded-none uppercase tracking-[0.1em] text-[9px]" onClick={async () => {
                                            console.log("Clearing order:", selectedOrder.id);
                                            await supabase.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', selectedOrder.id);
                                            addToast("Order cleared", "success");
                                            setSelectedOrder(null);
                                            fetchOrders();
                                        }}>Clear Order</Button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                            {/* NEW: Satisfying Order Graphic */}
                            <div className="mb-8">
                                <SatisfyingOrderGraphic status={selectedOrder.status as any} />
                            </div>

                            {selectedOrder.status === 'cancelled' && selectedOrder.cancel_reason && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 mb-1">Cancellation Reason</p>
                                        <p className="text-sm font-medium text-red-900 dark:text-red-200">{selectedOrder.cancel_reason}</p>
                                    </div>
                                </div>
                            )}

                            {selectedOrder.status === 'disputed' && (
                                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-8 rounded-none flex items-start gap-6">
                                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-none flex items-center justify-center text-red-600 shrink-0">
                                        <AlertCircle className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-serif text-red-800 dark:text-red-400 uppercase tracking-[0.2em] text-sm mb-2">Active Dispute</h4>
                                        <p className="text-red-700 dark:text-red-300 text-xs mb-4 leading-relaxed font-serif">The buyer has raised an issue with this order. Please review the details and respond to resolve the dispute.</p>
                                        {disputeDetails && (
                                            <div className="mb-6 p-4 bg-white dark:bg-black/20 rounded-none border border-red-100 dark:border-red-900/20">
                                                <p className="text-xs font-serif text-foreground dark:text-background mb-2"><span className="uppercase tracking-[0.1em] text-[9px] opacity-60 mr-2">Reason:</span> {disputeDetails.reason}</p>
                                                <p className="text-xs font-serif text-foreground dark:text-background"><span className="uppercase tracking-[0.1em] text-[9px] opacity-60 mr-2">Description:</span> {disputeDetails.description}</p>
                                            </div>
                                        )}
                                        <div className="flex gap-4">
                                            <Button size="sm" variant="danger" className="rounded-none uppercase tracking-[0.1em] text-[9px]" onClick={handleIssueRefund}>Issue Refund</Button>
                                            <Button size="sm" variant="outline" className="rounded-none border-red-200 text-red-700 hover:bg-red-100 uppercase tracking-[0.1em] text-[9px]" onClick={() => onContactBuyer(selectedOrder.buyer.id, selectedOrder.items[0]?.product_id, selectedOrder.id)}>Contact Buyer</Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6">
                                <Card className="p-8 rounded-none border-foreground/10 dark:border-background/10 bg-transparent">
                                    <h4 className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 mb-6 flex items-center gap-3"><User className="w-4 h-4"/> Customer</h4>
                                    <div className="flex items-center gap-6 mb-6">
                                        <div className="w-16 h-16 rounded-none bg-primary/10 dark:bg-background/10 overflow-hidden">
                                            <img src={selectedOrder.buyer?.avatar_url || `https://ui-avatars.com/api/?name=${selectedOrder.buyer?.full_name}`} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <p className="font-serif text-lg text-foreground dark:text-background">{selectedOrder.buyer?.full_name || selectedOrder.buyer?.email || 'Guest User'}</p>
                                            <p className="text-xs text-foreground/60 dark:text-background/60 font-mono mt-1">{selectedOrder.buyer?.email}</p>
                                            <p className="text-xs text-foreground/60 dark:text-background/60 font-mono mt-1">{selectedOrder.buyer?.phone}</p>
                                        </div>
                                    </div>
                                    {selectedOrder.note && (
                                        <div className="bg-primary/5 dark:bg-background/5 p-4 rounded-none border border-foreground/10 dark:border-background/10 text-xs text-foreground dark:text-background font-serif">
                                            <span className="uppercase tracking-[0.1em] text-[9px] opacity-60 mr-2">Note:</span> {selectedOrder.note}
                                        </div>
                                    )}
                                </Card>
                                <Card className="p-8 rounded-none border-foreground/10 dark:border-background/10 bg-transparent">
                                    <h4 className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 mb-6 flex items-center gap-3"><Truck className="w-4 h-4"/> Logistics & Tracking</h4>
                                    <div className="space-y-2 mb-6">
                                        <p className="font-serif text-sm text-foreground dark:text-background">{selectedOrder.shipping_address?.label}</p>
                                        <p className="text-xs text-foreground/60 dark:text-background/60">{selectedOrder.shipping_address?.street}</p>
                                        <p className="text-xs text-foreground/60 dark:text-background/60">{selectedOrder.shipping_address?.city} {selectedOrder.shipping_address?.postal_code}</p>
                                        <p className="text-xs font-mono mt-3 text-foreground/60 dark:text-background/60">{selectedOrder.shipping_address?.phone}</p>
                                    </div>
                                    
                                    {selectedOrder.status === 'processing' || selectedOrder.status === 'shipped' || selectedOrder.status === 'in_transit' ? (
                                        <div className="pt-6 border-t border-foreground/10 dark:border-background/10 space-y-4">
                                            <Input placeholder="Carrier (e.g., DHL, Local Courier)" className="h-12 text-xs rounded-none bg-transparent border-foreground/20 dark:border-background/20" value={trackingData.carrier} onChange={(e: any) => setTrackingData({...trackingData, carrier: e.target.value})} />
                                            <Input placeholder="Tracking Number" className="h-12 text-xs font-mono rounded-none bg-transparent border-foreground/20 dark:border-background/20" value={trackingData.tracking_number} onChange={(e: any) => setTrackingData({...trackingData, tracking_number: e.target.value})} />
                                            <Button size="sm" variant="secondary" className="w-full text-[9px] uppercase tracking-[0.2em] rounded-none h-12" onClick={handleUpdateTracking}>Update Tracking</Button>
                                        </div>
                                    ) : trackingData.tracking_number ? (
                                        <div className="mt-6 pt-6 border-t border-foreground/10 dark:border-background/10">
                                            <p className="text-xs font-serif text-foreground dark:text-background">{trackingData.carrier}</p>
                                            <p className="text-[10px] font-mono text-foreground/60 dark:text-background/60 mt-1">{trackingData.tracking_number}</p>
                                        </div>
                                    ) : (
                                        <div className="mt-6 pt-6 border-t border-foreground/10 dark:border-background/10 flex justify-between items-center">
                                            <Badge variant="outline" className="rounded-none uppercase tracking-[0.1em] text-[8px]">{selectedOrder.delivery_slot || 'Standard'}</Badge>
                                            <span className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40">{new Date(selectedOrder.created_at).toLocaleString()}</span>
                                        </div>
                                    )}
                                </Card>
                            </div>

                            <Card className="p-8 rounded-none border-foreground/10 dark:border-background/10 bg-transparent">
                                <h4 className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 mb-6 flex items-center gap-3"><Clock className="w-4 h-4"/> Order Timeline</h4>
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-primary/10 dark:before:bg-background/10">
                                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        <div className="flex items-center justify-center w-3 h-3 rounded-none border border-foreground dark:border-background bg-primary dark:bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-none bg-primary/5 dark:bg-background/5 border border-foreground/10 dark:border-background/10">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="font-serif text-sm text-foreground dark:text-background">Order Placed</div>
                                                <div className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40">{new Date(selectedOrder.created_at).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                    {['processing', 'in_transit', 'shipped', 'delivered'].includes(selectedOrder.status) && (
                                        <div className="relative flex items-center justify-between md:justify-normal md:even:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-3 h-3 rounded-none border border-foreground dark:border-background bg-primary dark:bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                                            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-none bg-primary/5 dark:bg-background/5 border border-foreground/10 dark:border-background/10">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="font-serif text-sm text-foreground dark:text-background">Processing</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {['in_transit', 'shipped', 'delivered'].includes(selectedOrder.status) && (
                                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-3 h-3 rounded-none border border-foreground dark:border-background bg-primary dark:bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                                            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-none bg-primary/5 dark:bg-background/5 border border-foreground/10 dark:border-background/10">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="font-serif text-sm text-foreground dark:text-background">Shipped</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {['delivered'].includes(selectedOrder.status) && (
                                        <div className="relative flex items-center justify-between md:justify-normal md:even:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-3 h-3 rounded-none border border-foreground dark:border-background bg-primary dark:bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2"></div>
                                            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-none bg-primary/5 dark:bg-background/5 border border-foreground/10 dark:border-background/10">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="font-serif text-sm text-foreground dark:text-background">Delivered</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <div>
                                <h4 className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 mb-6 flex items-center gap-3"><ShoppingBag className="w-4 h-4"/> Items ({selectedOrder.items.length})</h4>
                                <div className="space-y-4">
                                    {selectedOrder.items.map((item: any, index: number) => (
                                        <div key={item.id || `item-${index}`} className="flex gap-6 p-6 bg-transparent rounded-none border border-foreground/10 dark:border-background/10 items-center">
                                            <div className="w-16 h-16 bg-primary/5 dark:bg-background/5 rounded-none overflow-hidden shrink-0">
                                                <img src={item.product?.images?.[0]} className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-serif text-lg truncate text-foreground dark:text-background">{item.product?.name}</p>
                                                <p className="text-[10px] text-foreground/60 dark:text-background/60 font-mono mt-1">SKU: {item.sku || 'N/A'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-serif text-sm text-foreground dark:text-background mb-1">x{item.quantity}</p>
                                                <p className="text-[11px] font-mono text-foreground/60 dark:text-background/60 mb-2">{formatTZS(item.price_at_purchase * item.quantity)}</p>
                                                <Button size="sm" variant="ghost" className="h-8 text-[9px] uppercase tracking-[0.1em] rounded-none hover:bg-primary/5 dark:hover:bg-background/5" onClick={() => onContactBuyer(selectedOrder.buyer.id, item.product_id, selectedOrder.id)}>Contact</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end mt-8 pt-8 border-t border-foreground/10 dark:border-background/10">
                                    <div className="text-right">
                                        <p className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 mb-2">Total Payout</p>
                                        <p className="text-3xl font-serif text-foreground dark:text-background">{formatTZS(selectedOrder.seller_total)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {receiptOrder && <ReceiptModal isOpen={!!receiptOrder} order={receiptOrder.order} seller={receiptOrder.seller} onClose={() => setReceiptOrder(null)} />}
                    </div>
                ) : (
                    <div className="hidden lg:flex flex-1 flex-col items-center justify-center text-foreground/20 dark:text-background/20">
                        <Receipt className="w-16 h-16 mb-6 stroke-[1]"/>
                        <p className="uppercase tracking-[0.2em] text-[10px]">Select an order to view details</p>
                    </div>
                )}
            </div>
            <CancelOrderModal 
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={async (reason) => {
                    if (selectedOrder) {
                        try {
                            await updateOrderStatus(selectedOrder.id, 'cancelled', reason);
                            setIsCancelModalOpen(false);
                            addToast("Order cancelled successfully", "success");
                            fetchOrders();
                        } catch (e: any) {
                            console.error("Failed to cancel order", e);
                            addToast(e.message || "Failed to cancel order", "error");
                        }
                    }
                }}
                role="seller"
            />
        </div>
    );
};
