import { rateLimit, isValidPrice } from '../src/security';
import React, { useState, useEffect, useMemo } from 'react';
import { 
 Zap, Truck, Repeat, Percent, Tag, Copy, 
 CheckCircle2, Trash2, Edit, Power, PowerOff, Ticket, Plus, X, ChevronDown
} from 'lucide-react';
import { useAppState } from '../context/AppContext'; // already imported
import { Button, Input, Card, Badge, useToast, Label, Switch, ConfirmModal } from './UI';
import { supabase } from '../services/supabaseClient';
import { Offer } from '../types';
import { formatTZS, CURRENCY } from '../constants';

// --- Sub-Component: Campaign Preview Card ---
const CampaignPreview = ({ formData, getPreviewGradient }: any) => (
 <div className="w-full max-w-[280px] bg-background dark:bg-background rounded-2xl overflow-hidden shadow-2xl relative mb-6 z-10 border border-foreground/10">
 <div className={`h-32 bg-gradient-to-r ${getPreviewGradient()} p-6 relative overflow-hidden transition-colors duration-500`}>
 <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-[40px] pointer-events-none translate-x-10 -translate-y-10"></div>
 <div className="relative z-10 flex justify-between items-start">
 <div className="flex items-center gap-2">
 <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md p-0.5 shadow-lg flex items-center justify-center text-white">
 {formData.campaign_mode === 'flash' ? <Zap className="w-5 h-5"/> : formData.campaign_type === 'shipping' ? <Truck className="w-5 h-5"/> : formData.campaign_type === 'bogo' ? <Repeat className="w-5 h-5"/> : <Percent className="w-5 h-5"/>}
 </div>
 </div>
 <div className="text-right">
 {formData.campaign_type === 'bogo' ? (
 <>
 <span className="text-[10px] uppercase tracking-[0.2em] text-white/80 mb-0.5 block">Bundle Deal</span>
 <span className="text-xl font-serif text-white tracking-tight leading-none">BUY {formData.buy_quantity}</span>
 <span className="text-[10px] uppercase tracking-[0.2em] text-white/90 block">GET {formData.get_quantity} FREE</span>
 </>
 ) : formData.campaign_type === 'shipping' ? (
 <span className="text-xl font-serif text-white tracking-tight leading-none mt-2 block">FREE SHIP</span>
 ) : (
 <>
 <span className="text-[10px] uppercase tracking-[0.2em] text-white/80 mb-0.5 block">Save</span>
 <span className="text-3xl font-serif text-white tracking-tight leading-none">
 {formData.type === 'percentage' ? `${formData.value || 0}%` : formatTZS(formData.value || 0)}
 </span>
 </>
 )}
 </div>
 </div>
 </div>

 <div className="p-6 relative">
 <h3 className="font-serif text-foreground text-lg leading-snug mb-2 line-clamp-2">
 {formData.title || 'Special Campaign'}
 </h3>
 <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/60 leading-relaxed mb-6">
 {formData.target_type === 'store' ? 'Valid across all store items.' : `Valid on ${formData.target_ids.length} selected items.`}
 {formData.min_order_value > 0 ? ` Orders above ${formatTZS(formData.min_order_value)}.` : ''}
 {formData.campaign_mode === 'flash' ? ' ⚡ Ends in 24h!' : ''}
 </p>

 {formData.campaign_mode === 'coupon' ? (
 <div className="flex items-center justify-between px-3 py-3 bg-foreground/[0.05] dark:bg-background/5 rounded-2xl border border-dashed border-foreground/20">
 <div className="flex items-center gap-2">
 <Ticket className="w-4 h-4 text-foreground" />
 <span className="font-mono text-xs tracking-widest text-foreground">
 {formData.code || 'CODE'}
 </span>
 </div>
 <span className="text-[9px] uppercase tracking-[0.2em] text-foreground/40">Copy</span>
 </div>
 ) : (
 <div className="flex items-center justify-center gap-2 px-3 py-3 bg-foreground/[0.05] dark:bg-background/5 rounded-2xl border border-foreground/10">
 <CheckCircle2 className="w-4 h-4 text-foreground" />
 <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Auto-Applied</span>
 </div>
 )}
 </div>
 </div>
);

export const SellerOffers = ({ sellerId, preselectedProduct }: { sellerId: string, preselectedProduct?: any }) => {
 const { products } = useAppState();
 const { addToast } = useToast();
 const [offers, setOffers] = useState<Offer[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
 const [itemToDelete, setItemToDelete] = useState<string | null>(null);

 const myProducts = useMemo(() => products.filter(p => p.seller_id === sellerId), [products, sellerId]);

 // Form State
 const [formData, setFormData] = useState({
 title: '',
 code: '',
 campaign_mode: 'coupon' as 'coupon' | 'sale' | 'flash',
 campaign_type: 'discount' as 'discount' | 'bogo' | 'shipping',
 type: 'percentage' as 'percentage' | 'fixed',
 value: 0,
 min_order_value: 0,
 buy_quantity: 2,
 get_quantity: 1,
 max_usage: 0,
 start_date: new Date().toISOString().split('T')[0],
 end_date: '',
 target_type: 'store' as 'store' | 'product',
 target_ids: [] as string[]
 });

 useEffect(() => {
 if (preselectedProduct) {
 setFormData(prev => ({
 ...prev,
 target_type: 'product',
 target_ids: [preselectedProduct.id]
 }));
 setIsCreateModalOpen(true);
 }
 }, [preselectedProduct]);

 const fetchOffers = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const { data, error } = await supabase.from('offers').select('*')
        .eq('seller_id', sellerId).order('created_at', { ascending: false });
      if (error) throw error;
      setOffers(data as Offer[]);
    } catch (err: any) {
      if (!silent) addToast('Failed to load offers', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
    // Realtime: refresh when offers change for this seller
    const ch = supabase.channel(`offers-${sellerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: `seller_id=eq.${sellerId}` },
        () => fetchOffers(true))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sellerId]);

 const handleCreate = async () => {
 const isAuto = formData.campaign_mode !== 'coupon';
 if (!isAuto && !formData.code) return addToast("Code required for coupons", "error");
 if (formData.campaign_type !== 'shipping' && formData.campaign_type !== 'bogo' && !formData.value) return addToast("Discount Value required", "error");
 if (formData.target_type === 'product' && formData.target_ids.length === 0) return addToast("Select at least one product", "error");
 if (formData.campaign_mode === 'flash' && !formData.end_date) return addToast("End date required for Flash Sales", "error");

 setIsSubmitting(true);
 try {
 const finalCode = isAuto ? (formData.code || `AUTO-${Date.now().toString().slice(-6)}`) : formData.code.toUpperCase();
 
 const payload = {
 seller_id: sellerId,
 title: formData.title || (formData.campaign_type === 'bogo' ? `Buy ${formData.buy_quantity} Get ${formData.get_quantity}` : `${formData.value}${formData.type === 'percentage' ? '%' : ''} Off`),
 code: finalCode,
 campaign_type: formData.campaign_type,
 type: formData.type,
 value: formData.campaign_type === 'shipping' ? 100 : formData.campaign_type === 'bogo' ? 100 : formData.value,
 min_order_value: formData.min_order_value,
 buy_quantity: formData.campaign_type === 'bogo' ? formData.buy_quantity : 0,
 get_quantity: formData.campaign_type === 'bogo' ? formData.get_quantity : 0,
 max_usage: formData.max_usage > 0 ? formData.max_usage : null,
 start_date: formData.start_date,
 end_date: formData.end_date || null,
 status: 'active',
 scope: 'seller',
 target_type: formData.target_type,
 target_ids: formData.target_ids,
 is_auto_apply: isAuto,
 is_flash_sale: formData.campaign_mode === 'flash'
 };

 let error;
 if (editingId) {
 const { error: e } = await supabase.from('offers').update(payload).eq('id', editingId);
 error = e;
 } else {
 const { error: e } = await supabase.from('offers').insert(payload);
 error = e;
 }

 if (error) throw error;
 addToast(editingId ? "Campaign updated successfully" : "Campaign created successfully", "success");
 setIsCreateModalOpen(false);
 resetForm();
 fetchOffers();
 } catch (e: any) {
 addToast(e.message || "Failed to create offer", "error");
 } finally {
 setIsSubmitting(false);
 }
 };

 const resetForm = () => {
 setFormData({
 title: '',
 code: '',
 campaign_mode: 'coupon',
 campaign_type: 'discount',
 type: 'percentage',
 value: 0,
 min_order_value: 0,
 buy_quantity: 2,
 get_quantity: 1,
 max_usage: 0,
 start_date: new Date().toISOString().split('T')[0],
 end_date: '',
 target_type: 'store',
 target_ids: []
 });
 setEditingId(null);
 };

 const handleEdit = (offer: Offer) => {
 setFormData({
 title: offer.title || '',
 code: offer.code || '',
 campaign_mode: offer.is_flash_sale ? 'flash' : (offer.is_auto_apply ? 'sale' : 'coupon'),
 campaign_type: offer.campaign_type || 'discount',
 type: offer.type,
 value: offer.value,
 min_order_value: offer.min_order_value || 0,
 buy_quantity: offer.buy_quantity || 0,
 get_quantity: offer.get_quantity || 0,
 max_usage: offer.max_usage || 0,
 start_date: offer.start_date ? new Date(offer.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
 end_date: offer.end_date ? new Date(offer.end_date).toISOString().split('T')[0] : '',
 target_type: (offer.target_type as 'store' | 'product') || 'store',
 target_ids: offer.target_ids || []
 });
 setEditingId(offer.id);
 setIsCreateModalOpen(true);
 };

 const confirmDelete = (id: string) => {
 setItemToDelete(id);
 setIsConfirmDeleteOpen(true);
 };

 const handleDelete = async () => {
 if (!itemToDelete) return;
 const { error } = await supabase.from('offers').delete().eq('id', itemToDelete);
 if (error) addToast("Deletion failed", "error");
 else {
 addToast("Campaign deleted", "info");
 setOffers(prev => prev.filter(o => o.id !== itemToDelete));
 }
 setItemToDelete(null);
 setIsConfirmDeleteOpen(false);
 };

 const toggleStatus = async (offer: Offer) => {
 const newStatus = offer.status === 'active' ? 'inactive' : 'active';
 const { error } = await supabase.from('offers').update({ status: newStatus }).eq('id', offer.id);
 if (!error) {
 addToast(`Campaign ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'info');
 setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, status: newStatus as any } : o));
 }
 };

 const generateCode = () => {
 const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
 let code = '';
 for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
 setFormData(prev => ({ ...prev, code }));
 };

 const setFlashDuration = (hours: number) => {
 const end = new Date();
 end.setHours(end.getHours() + hours);
 setFormData(prev => ({ ...prev, end_date: end.toISOString().split('T')[0] }));
 };

 const getPreviewGradient = () => {
 if (formData.campaign_mode === 'flash') return 'from-amber-500 to-red-600';
 if (formData.campaign_type === 'shipping') return 'from-emerald-500 to-teal-500';
 if (formData.campaign_type === 'bogo') return 'from-indigo-500 to-purple-600';
 if (formData.type === 'percentage' && formData.value >= 25) return 'from-rose-500 to-pink-600';
 return 'from-blue-600 to-indigo-700';
 };

 const selectedProductsDisplay = useMemo(() => {
 return myProducts.filter(p => formData.target_ids.includes(p.id));
 }, [myProducts, formData.target_ids]);

 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-2xl font-serif text-foreground uppercase tracking-tight">Active Campaigns</h2>
 <p className="text-[10px] text-foreground/60 uppercase tracking-[0.2em] mt-1">Manage coupons, sales & flash deals</p>
 </div>
 <Button variant="brand" onClick={() => { resetForm(); setIsCreateModalOpen(true); }} className="rounded-2xl h-12 shadow-none text-[10px] uppercase tracking-[0.2em]">
 <Plus className="w-4 h-4 mr-2" /> Create Campaign
 </Button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {isLoading ? (
 [1,2,3].map(i => <div key={i} className="h-48 rounded-2xl bg-foreground/[0.05] dark:bg-background/5 animate-pulse"></div>)
 ) : offers.length === 0 ? (
 <div className="col-span-full py-20 text-center border border-dashed border-foreground/20 rounded-2xl text-foreground/40">
 <Tag className="w-12 h-12 mx-auto mb-4 opacity-20" />
 <p className="uppercase tracking-[0.2em] text-[10px]">No active campaigns</p>
 </div>
 ) : (
 offers.map(offer => (
 <div key={offer.id} className={`relative group p-6 rounded-2xl border shadow-none transition-all ${offer.status === 'active' ? 'bg-background dark:bg-background border-foreground/10 hover:border-foreground/30 dark:hover:border-background/30' : 'bg-foreground/[0.04] border-transparent opacity-75'}`}>
 <div className="flex justify-between items-start mb-4">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${offer.status === 'inactive' ? 'bg-primary/10 dark:bg-background/10 text-foreground/40' : offer.is_flash_sale ? 'bg-amber-100/50 text-amber-600' : offer.campaign_type === 'shipping' ? 'bg-emerald-100/50 text-emerald-600' : offer.campaign_type === 'bogo' ? 'bg-indigo-100/50 text-indigo-600' : 'bg-blue-100/50 text-blue-600'}`}>
 {offer.is_flash_sale ? <Zap className="w-6 h-6 fill-current"/> : offer.campaign_type === 'shipping' ? <Truck className="w-6 h-6"/> : offer.campaign_type === 'bogo' ? <Repeat className="w-6 h-6"/> : <Percent className="w-6 h-6"/>}
 </div>
 <div className="flex flex-col items-end gap-1">
 {offer.status === 'inactive' && <Badge className="bg-primary/10 dark:bg-background/10 text-foreground/60 border-none rounded-2xl">Inactive</Badge>}
 {offer.is_flash_sale && offer.status === 'active' && <Badge variant="danger" className="text-[7px] uppercase tracking-[0.2em] animate-pulse rounded-2xl">Flash Sale</Badge>}
 {offer.is_auto_apply && !offer.is_flash_sale && <Badge variant="success" className="text-[7px] uppercase tracking-[0.2em] rounded-2xl">Auto-Apply</Badge>}
 <Badge variant="outline" className="text-[7px] uppercase tracking-[0.2em] rounded-2xl">{offer.target_type === 'product' ? 'Items' : 'Store'}</Badge>
 </div>
 </div>
 
 <h3 className="text-3xl font-serif text-foreground tracking-tight mb-1 leading-none">
 {offer.campaign_type === 'bogo' ? (
 <>BUY {offer.buy_quantity} <span className="text-lg text-foreground/40 font-sans">GET {offer.get_quantity}</span></>
 ) : offer.campaign_type === 'shipping' ? (
 'FREE SHIPPING'
 ) : (
 <>
 {offer.type === 'percentage' ? `${offer.value}%` : formatTZS(offer.value)}
 <span className="text-lg text-foreground/40 font-sans ml-1">OFF</span>
 </>
 )}
 </h3>
 <p className="text-[10px] text-foreground/60 uppercase tracking-[0.2em] mb-6 truncate">{offer.title}</p>
 
 {!offer.is_auto_apply ? (
 <div className="bg-primary/5 dark:bg-background/5 rounded-2xl p-3 flex items-center justify-between border border-dashed border-foreground/20">
 <code className="font-mono text-foreground tracking-widest">{offer.code}</code>
 <div className="flex gap-2">
 <button onClick={() => { navigator.clipboard.writeText(offer.code); addToast("Code copied", "success"); }} className="p-1.5 hover:bg-primary/10 dark:hover:bg-background/10 rounded-2xl text-foreground/40 hover:text-foreground transition-colors">
 <Copy className="w-4 h-4" />
 </button>
 </div>
 </div>
 ) : (
 <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/20 text-center">
 <span className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
 <CheckCircle2 className="w-3 h-3"/> Applied at Checkout
 </span>
 </div>
 )}

 <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background dark:bg-background p-1 rounded-2xl shadow-sm border border-foreground/10">
 <button onClick={() => toggleStatus(offer)} className={`p-2 rounded-2xl transition-colors ${offer.status === 'active' ? 'text-emerald-500 hover:bg-emerald-50/50' : 'text-foreground/40 hover:bg-foreground/[0.04]'}`} title={offer.status === 'active' ? 'Deactivate' : 'Activate'}>
 {offer.status === 'active' ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
 </button>
 <button onClick={() => handleEdit(offer)} className="p-2 text-blue-500 hover:bg-blue-50/50 rounded-2xl transition-colors" title="Edit">
 <Edit className="w-4 h-4" />
 </button>
 <button onClick={() => confirmDelete(offer.id)} className="p-2 text-red-500 hover:bg-red-50/50 rounded-2xl transition-colors" title="Delete">
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 ))
 )}
 </div>

 {/* Create Modal */}
 {isCreateModalOpen && (
 <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-primary/80 dark:bg-background/80 backdrop-blur-md animate-in fade-in">
 <Card className="w-full max-w-6xl h-[95vh] md:h-[90vh] p-0 rounded-2xl bg-background dark:bg-background overflow-hidden flex flex-col md:flex-row border border-foreground/10">
 <div className="flex flex-col md:flex-row h-full">
 {/* LEFT: Live Preview */}
 <div className="w-full md:w-4/12 bg-foreground/[0.05] dark:bg-background/5 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-foreground/10 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-[80px] pointer-events-none"></div>
 <h3 className="text-[10px] uppercase tracking-[0.2em] text-foreground/40 mb-8 relative z-10">Live Preview</h3>
 <CampaignPreview formData={formData} getPreviewGradient={getPreviewGradient} />
 </div>

 {/* RIGHT: Form */}
 <div className="flex-1 p-8 md:p-10 overflow-y-auto no-scrollbar pb-24">
 <div className="flex justify-between items-center mb-8">
 <div>
 <h3 className="font-serif text-2xl uppercase tracking-tight text-foreground">Campaign Studio</h3>
 <p className="text-foreground/60 text-[10px] uppercase tracking-[0.2em] mt-1">Craft your offer strategy</p>
 </div>
 <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-foreground/[0.04] rounded-2xl text-foreground"><X className="w-6 h-6"/></button>
 </div>
 
 <div className="space-y-8">
 {/* 1. Campaign Mode Selection */}
 <div>
 <Label>Select Strategy</Label>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {[
 { id: 'discount', label: 'Discount', icon: Percent, desc: '% or Fixed Off' },
 { id: 'bogo', label: 'BOGO', icon: Repeat, desc: 'Buy X Get Y' },
 { id: 'flash', label: 'Flash Sale', icon: Zap, desc: 'Urgent Deals' },
 { id: 'shipping', label: 'Free Ship', icon: Truck, desc: 'Zero Delivery' },
 ].map(opt => (
 <button 
 key={opt.id}
 onClick={() => {
 const newCampaignType = opt.id === 'flash' ? 'discount' : opt.id as any;
 const isShipping = newCampaignType === 'shipping';
 
 setFormData(prev => ({
 ...prev, 
 campaign_type: newCampaignType, 
 campaign_mode: opt.id === 'flash' ? 'flash' : 'sale',
 target_type: isShipping ? 'store' : prev.target_type,
 target_ids: isShipping ? [] : prev.target_ids
 }));
 }}
 className={`flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all group ${
 (formData.campaign_mode === 'flash' && opt.id === 'flash') || (formData.campaign_mode !== 'flash' && formData.campaign_type === opt.id)
 ? 'border-foreground bg-primary text-background dark:border-background dark:bg-background dark:text-foreground shadow-none' 
 : 'border-foreground/10 bg-transparent text-foreground/40 hover:border-foreground/30 dark:hover:border-background/30'
 }`}
 >
 <opt.icon className="w-6 h-6" />
 <div className="text-center">
 <span className="block text-[10px] uppercase tracking-[0.2em]">{opt.label}</span>
 <span className="text-[9px] opacity-70">{opt.desc}</span>
 </div>
 </button>
 ))}
 </div>
 </div>

 {/* 2. Configuration Logic */}
 <div className="p-6 bg-foreground/[0.05] dark:bg-background/5 rounded-2xl border border-foreground/10 space-y-6">
 {formData.campaign_type === 'bogo' && (
 <div className="grid grid-cols-2 gap-6 animate-in fade-in">
 <div><Label>Customer Buys</Label><div className="flex items-center gap-2"><Input type="number" value={Number.isNaN(formData.buy_quantity) ? '' : (formData.buy_quantity ?? '')} onChange={(e:any) => setFormData({...formData, buy_quantity: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 text-center font-serif text-lg rounded-2xl" /><span className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">Items</span></div></div>
 <div><Label>Customer Gets</Label><div className="flex items-center gap-2"><Input type="number" value={Number.isNaN(formData.get_quantity) ? '' : (formData.get_quantity ?? '')} onChange={(e:any) => setFormData({...formData, get_quantity: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 text-center font-serif text-lg rounded-2xl" /><span className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">Free</span></div></div>
 </div>
 )}

 {formData.campaign_type === 'discount' && (
 <div className="grid grid-cols-2 gap-6 animate-in fade-in">
 <div>
 <Label>Discount Unit</Label>
 <div className="flex bg-background dark:bg-background p-1 rounded-2xl border border-foreground/10">
 <button onClick={() => setFormData({...formData, type: 'percentage'})} className={`flex-1 py-3 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all ${formData.type === 'percentage' ? 'bg-primary text-background dark:bg-background dark:text-foreground shadow-none' : 'text-foreground/40'}`}>Percent %</button>
 <button onClick={() => setFormData({...formData, type: 'fixed'})} className={`flex-1 py-3 rounded-2xl text-[10px] uppercase tracking-[0.2em] transition-all ${formData.type === 'fixed' ? 'bg-primary text-background dark:bg-background dark:text-foreground shadow-none' : 'text-foreground/40'}`}>Fixed {CURRENCY}</button>
 </div>
 </div>
 <div>
 <Label>Value</Label>
 <Input type="number" placeholder="0" value={Number.isNaN(formData.value) ? '' : (formData.value ?? '')} onChange={(e:any) => setFormData({...formData, value: e.target.value === '' ? null : Number(e.target.value)})} className="h-14 font-serif text-lg rounded-2xl" />
 </div>
 </div>
 )}

 {formData.campaign_mode === 'flash' && (
 <div className="animate-in fade-in">
 <Label>Duration</Label>
 <div className="grid grid-cols-3 gap-3 mb-4">
 {[12, 24, 48].map(h => (
 <button key={h} onClick={() => setFlashDuration(h)} className="py-3 rounded-2xl border border-foreground/10 bg-background dark:bg-background text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/[0.04] transition-colors">{h} Hours</button>
 ))}
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div><Label>Start</Label><Input type="date" value={formData.start_date || ''} onChange={(e:any) => setFormData({...formData, start_date: e.target.value})} className="h-12 rounded-2xl" /></div>
 <div><Label>End</Label><Input type="date" value={formData.end_date || ''} onChange={(e:any) => setFormData({...formData, end_date: e.target.value})} className="h-12 rounded-2xl" /></div>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-6">
 <div><Label>Min Spend</Label><Input type="number" placeholder="0" value={Number.isNaN(formData.min_order_value) ? '' : (formData.min_order_value ?? '')} onChange={(e:any) => setFormData({...formData, min_order_value: e.target.value === '' ? null : Number(e.target.value)})} className="h-12 rounded-2xl" /></div>
 <div><Label>Usage Limit</Label><Input type="number" placeholder="Unlimited" value={Number.isNaN(formData.max_usage) ? '' : (formData.max_usage ?? '')} onChange={(e:any) => setFormData({...formData, max_usage: e.target.value === '' ? null : Number(e.target.value)})} className="h-12 rounded-2xl" /></div>
 </div>
 </div>

 {/* 3. Targeting */}
 <div>
 <Label>Applied To</Label>
 <div className="flex gap-4 mb-4">
 <button 
 onClick={() => setFormData({...formData, target_type: 'store', target_ids: []})} 
 className={`flex-1 py-4 rounded-2xl border text-[10px] uppercase tracking-[0.2em] transition-all ${formData.target_type === 'store' || formData.campaign_type === 'shipping' ? 'border-foreground bg-primary text-background dark:border-background dark:bg-background dark:text-foreground' : 'border-foreground/10 text-foreground/40'}`}>
 Entire Store
 </button>
 <button 
 onClick={() => setFormData({...formData, target_type: 'product'})} 
 disabled={formData.campaign_type === 'shipping'}
 className={`flex-1 py-4 rounded-2xl border text-[10px] uppercase tracking-[0.2em] transition-all ${formData.target_type === 'product' && formData.campaign_type !== 'shipping' ? 'border-foreground bg-primary text-background dark:border-background dark:bg-background dark:text-foreground' : 'border-foreground/10 text-foreground/40'} disabled:opacity-50 disabled:cursor-not-allowed`}>
 Specific Items
 </button>
 </div>
 {formData.campaign_type === 'shipping' && (
 <p className="text-center text-[10px] uppercase tracking-[0.2em] text-foreground/40 -mt-2 mb-4">Free shipping must apply to the entire store.</p>
 )}
 {formData.target_type === 'product' && (
 <div className="animate-in slide-in-from-top-2">
 <div className="relative group">
 <select 
 className="w-full h-12 bg-foreground/[0.05] dark:bg-background/5 border border-foreground/10 rounded-2xl px-4 text-[10px] uppercase tracking-[0.2em] outline-none cursor-pointer pr-10 appearance-none"
 onChange={(e) => {
 const id = e.target.value;
 if (id && !formData.target_ids.includes(id)) {
 setFormData({...formData, target_ids: [...formData.target_ids, id]});
 }
 }}
 value=""
 >
 <option value="">Select Products...</option>
 {myProducts.map(p => (
 <option key={p.id} value={p.id} disabled={formData.target_ids.includes(p.id)}>{p.name} ({formatTZS(p.price)})</option>
 ))}
 </select>
 <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
 </div>
 <div className="flex flex-wrap gap-2 mt-4">
 {selectedProductsDisplay.map(p => (
 <div key={p.id} className="flex items-center gap-2 pl-3 pr-1 py-1.5 bg-background dark:bg-background text-foreground rounded-2xl border border-foreground/10 text-[10px] uppercase tracking-[0.2em] shadow-none">
 <span className="truncate max-w-[120px]">{p.name}</span>
 <button onClick={() => setFormData({...formData, target_ids: formData.target_ids.filter(tid => tid !== p.id)})} className="p-1 hover:bg-primary/10 dark:hover:bg-background/10 rounded-2xl"><X className="w-3 h-3"/></button>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* 4. Activation */}
 <div className="pt-4 border-t border-foreground/10">
 <div className="flex items-center justify-between mb-6">
 <Label className="mb-0">Manual Code Entry</Label>
 <Switch checked={formData.campaign_mode === 'coupon'} onCheckedChange={(c: boolean) => setFormData({...formData, campaign_mode: c ? 'coupon' : 'sale'})} />
 </div>
 {formData.campaign_mode === 'coupon' && (
 <div className="relative group mb-6 animate-in fade-in">
 <Input placeholder="SAVE2024" value={formData.code} onChange={(e:any) => setFormData({...formData, code: e.target.value.toUpperCase()})} className="h-14 pl-12 font-mono uppercase tracking-widest font-bold text-lg rounded-2xl group-focus-within:border-foreground dark:group-focus-within:border-background" />
 <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/40 group-focus-within:text-foreground dark:group-focus-within:text-background" />
 <button onClick={generateCode} className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-[0.2em] text-foreground hover:bg-foreground/[0.04] px-3 py-1.5 rounded-2xl transition-colors">Auto-Gen</button>
 </div>
 )}
 
 <div className="flex gap-4">
 <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)} className="flex-1 h-16 rounded-2xl text-sm font-bold uppercase tracking-[0.2em]">
 Cancel
 </Button>
 <Button variant="brand" onClick={handleCreate} isLoading={isSubmitting} className="flex-[2] h-16 rounded-2xl text-sm font-bold uppercase tracking-[0.2em] bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
 {editingId ? 'Update Campaign' : 'Launch Campaign'}
 </Button>
 </div>
 </div>
 </div>
 </div>
 </div>
 </Card>
 </div>
 )}

 <ConfirmModal 
 isOpen={isConfirmDeleteOpen}
 onClose={() => {
 setIsConfirmDeleteOpen(false);
 setItemToDelete(null);
 }}
 onConfirm={handleDelete}
 title="Delete Campaign"
 message="Are you sure you want to delete this campaign? This action cannot be undone."
 confirmText="Delete"
 isDestructive={true}
 />
 </div>
 );
};