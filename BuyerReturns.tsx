import { validateUpload } from '../src/security';
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
 PackageX, Plus, X, Search, AlertCircle, CheckCircle2, 
 Clock, MessageSquare, ChevronRight, Upload, Image as ImageIcon,
 Loader2, RotateCcw, ShoppingBag, ArrowLeft
} from 'lucide-react';
import { Badge, Button, Input, Textarea, useToast, GraphicalTag } from './UI';
import { supabase } from '../services/supabaseClient';
import { compressImage, IMMUTABLE_CACHE } from '../services/imageCompression';
import { withCache, invalidate } from '../services/queryCache';
import { useAppState } from '../context/AppContext';
import { formatTZS } from '../constants';

// DB enum: item_not_received | item_not_as_described | wrong_item_sent | item_damaged | seller_not_responding | refund_not_processed | other
const RETURN_REASONS: { label: string; value: string }[] = [
 { label: 'Wrong item received', value: 'wrong_item_sent' },
 { label: 'Item damaged / defective', value: 'item_damaged' },
 { label: 'Not as described', value: 'item_not_as_described' },
 { label: 'Item never arrived', value: 'item_not_received' },
 { label: 'Seller not responding', value: 'seller_not_responding' },
 { label: 'Refund not processed', value: 'refund_not_processed' },
 { label: 'Other', value: 'other' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ElementType }> = {
 open: { color: 'bg-amber-500/10 text-amber-700', label: 'Under Review', icon: Clock },
 resolved: { color: 'bg-emerald-500/10 text-emerald-700', label: 'Resolved', icon: CheckCircle2 },
 refunded: { color: 'bg-blue-500/10 text-blue-700', label: 'Refunded', icon: CheckCircle2 },
 rejected: { color: 'bg-red-500/10 text-red-600', label: 'Rejected', icon: AlertCircle },
 cancelled: { color: 'bg-foreground/8 text-foreground/50', label: 'Cancelled', icon: X },
};

interface BuyerReturnsProps {
 userId: string;
 onContactSeller: (sellerId: string, context?: any) => void;
}

export const BuyerReturns: React.FC<BuyerReturnsProps> = ({ userId, onContactSeller }) => {
 const { orders } = useAppState();
 const { addToast } = useToast();
 const { buyerReturns: contextReturns, refreshBuyerReturns } = useAppState();
 const [disputes, setDisputes] = useState<any[]>(contextReturns || []);
 const [loading, setLoading] = useState(!contextReturns?.length);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<'all'|'open'|'resolved'|'refunded'>('all');
 const [selected, setSelected] = useState<any|null>(null);
 const [showCreate, setShowCreate] = useState(false);

 // New return form state
 const [form, setForm] = useState({ orderId:'', reason:'', description:'', images:[] as string[] });
 const [submitting, setSubmitting] = useState(false);
 const [uploading, setUploading] = useState(false);

 const BUYER_DISPUTES_KEY = `buyer:disputes:${userId}`;

 const fetchDisputes = async (silent = false) => {
 if (!silent) setLoading(true);
 try {
   if (silent) invalidate(BUYER_DISPUTES_KEY);
   const data = await withCache(BUYER_DISPUTES_KEY, 30_000, async () => {
     const { data: d, error } = await supabase
       .from('disputes')
       .select('*, order:orders(*), seller:profiles!seller_id(id, full_name, avatar_url)')
       .eq('buyer_id', userId)
       .order('created_at', { ascending: false });
     if (error) throw error;
     return d;
   });
   setDisputes(data || []);
 } catch (err: any) {
   console.error('[BuyerReturns]', err?.message);
 } finally {
   setLoading(false);
 }
 };

 // Seed from preloaded context instantly
 useEffect(() => {
   if (contextReturns?.length) {
     setDisputes(contextReturns);
     setLoading(false);
   }
 }, [contextReturns]);

 useEffect(() => { fetchDisputes(!!contextReturns?.length); }, [userId]);

 // Eligible orders (delivered, not already in dispute)
 const eligibleOrders = useMemo(() => {
 const disputedOrderIds = new Set(disputes.map(d => d.order_id));
 return orders.filter(o =>
 ['delivered', 'paid', 'confirmed'].includes(o.status) &&
 !disputedOrderIds.has(o.id)
 );
 }, [orders, disputes]);

 const filtered = disputes.filter(d => {
 const matchSearch = !search ||
 d.order_id?.toLowerCase().includes(search.toLowerCase()) ||
 d.reason?.toLowerCase().includes(search.toLowerCase());
 const matchStatus = statusFilter === 'all' || d.status === statusFilter;
 return matchSearch && matchStatus;
 });

 const stats = {
 open: disputes.filter(d => d.status === 'open').length,
 resolved: disputes.filter(d => ['resolved','refunded'].includes(d.status)).length,
 };

 const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = e.target.files;
 if (!files?.length) return;
 setUploading(true);
 try {
 const urls: string[] = [];
 for (const file of Array.from(files).slice(0, 3)) {
 const name = `returns/${userId}/${Date.now()}-${file.name}`;
 const { error } = await supabase.storage.from('mali-mart-uploads').upload(name, await compressImage(file), { cacheControl: IMMUTABLE_CACHE });
 if (!error) {
 const { data: pub } = supabase.storage.from('mali-mart-uploads').getPublicUrl(name);
 if (pub?.publicUrl) urls.push(pub.publicUrl);
 }
 }
 setForm(p => ({ ...p, images: [...p.images, ...urls].slice(0, 3) }));
 addToast(`${urls.length} photo${urls.length>1?'s':''} uploaded`, 'success');
 } catch { addToast('Upload failed', 'error'); }
 finally { setUploading(false); }
 };

 const handleSubmit = async () => {
 if (!form.orderId) return addToast('Please select an order', 'error');
 if (!form.reason) return addToast('Please select a reason', 'error');
 if (!form.description.trim() || form.description.length < 20)
 return addToast('Please describe the issue (at least 20 characters)', 'error');

 const order = orders.find(o => o.id === form.orderId);
 if (!order) return;

 const sellerIdForDispute = order.items?.[0]?.seller_id;
 if (!sellerIdForDispute) return addToast('Could not identify the seller for this order', 'error');

 setSubmitting(true);
 try {
 const { error } = await supabase.from('disputes').insert({
 order_id: form.orderId,
 buyer_id: userId,
 seller_id: sellerIdForDispute,
 reason: form.reason,
 description: form.description,
 evidence_urls: form.images,
 status: 'open',
 created_at: new Date().toISOString(),
 });
 if (error) throw error;

 // Notify seller
 await supabase.from('notifications').insert({
 user_id: sellerIdForDispute,
 type: 'return',
 title: 'New Return Request',
 message: `Buyer has submitted a return request for order #${form.orderId.slice(0,8)}. Reason: ${form.reason}`,
 link: `/seller?tab=returns`,
 });

 addToast('Return request submitted successfully', 'success');
 setShowCreate(false);
 setForm({ orderId:'', reason:'', description:'', images:[] });
 fetchDisputes();
 } catch { addToast('Failed to submit return request', 'error'); }
 finally { setSubmitting(false); }
 };

 if (loading) return (
 <div className="space-y-3">
 {[1,2,3].map(i=><div key={i} className="h-24 shimmer rounded-2xl"/>)}
 </div>
 );

 // Detail view
 if (selected) {
 const cfg = STATUS_CONFIG[selected.status] || STATUS_CONFIG.open;
 const StatusIcon = cfg.icon;
 return (
 <motion.div initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} className="space-y-5">
 <button onClick={()=>setSelected(null)} className="flex items-center gap-2 text-sm font-semibold text-foreground/60 hover:text-foreground transition-colors">
 <ArrowLeft className="w-4 h-4"/> Back to Returns
 </button>

 <div className="bg-card border border-foreground/8 rounded-3xl overflow-hidden">
 <div className="p-5 border-b border-foreground/8">
 <div className="flex items-start justify-between gap-4">
 <div>
 <h2 className="font-bold text-foreground">Return Request</h2>
 <p className="text-xs text-foreground/45 font-mono mt-0.5">Order #{selected.order_id?.slice(0,12)}</p>
 </div>
 <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${cfg.color}`}>
 <StatusIcon className="w-3.5 h-3.5"/>
 {cfg.label}
 </span>
 </div>
 </div>

 <div className="p-5 space-y-5">
 {/* Reason */}
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-1">Reason</p>
 <p className="text-sm font-semibold text-foreground">{selected.reason}</p>
 </div>

 {/* Description */}
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-1">Description</p>
 <p className="text-sm text-foreground/70 leading-relaxed">{selected.description}</p>
 </div>

 {/* Evidence images */}
 {selected.evidence_urls?.length > 0 && (
 <div>
 <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-2">Evidence Photos</p>
 <div className="flex gap-2">
 {selected.evidence_urls.map((img:string, i:number) => (
 <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="w-20 h-20 rounded-xl overflow-hidden bg-foreground/[0.04] shrink-0 hover:opacity-80 transition-opacity">
 <img src={img} className="w-full h-full object-cover" alt="Evidence" loading="lazy" decoding="async"/>
 </a>
 ))}
 </div>
 </div>
 )}

 {/* Resolution notes */}
 {selected.resolution_notes && (
 <div className="p-4 bg-emerald-500/8 rounded-2xl border border-emerald-500/20">
 <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Resolution Note</p>
 <p className="text-sm text-foreground/70">{selected.resolution_notes}</p>
 </div>
 )}

 {/* Dates */}
 <div className="flex gap-6 text-xs text-foreground/40">
 <span>Submitted: {new Date(selected.created_at).toLocaleDateString()}</span>
 {selected.updated_at && <span>Updated: {new Date(selected.updated_at).toLocaleDateString()}</span>}
 </div>
 </div>

 {/* Actions */}
 {selected.status === 'open' && (
 <div className="p-5 border-t border-foreground/8 flex gap-3">
 <button
 onClick={() => onContactSeller(selected.seller_id, { type:'return', id:selected.order_id, label:`Return #${selected.order_id?.slice(0,8)}` })}
 className="flex-1 h-11 rounded-2xl bg-foreground/[0.06] text-foreground text-sm font-semibold hover:bg-foreground/10 transition-colors flex items-center justify-center gap-2">
 <MessageSquare className="w-4 h-4"/> Message Seller
 </button>
 <button
 onClick={async () => {
              const { error } = await supabase.rpc('update_dispute_status', { p_dispute_id: selected.id, p_new_status: 'closed' });
              if (!error) { addToast('Return request cancelled', 'success'); setSelected(null); fetchDisputes(); }
              else addToast('Failed to cancel', 'error');
 fetchDisputes();
 }}
 className="flex-1 h-11 rounded-2xl bg-rose-500/8 text-rose-600 text-sm font-semibold hover:bg-rose-500/12 transition-colors flex items-center justify-center gap-2">
 <X className="w-4 h-4"/> Cancel Request
 </button>
 </div>
 )}
 </div>
 </motion.div>
 );
 }

 // Create new return form
 if (showCreate) {
 return (
 <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-5">
 <button onClick={()=>setShowCreate(false)} className="flex items-center gap-2 text-sm font-semibold text-foreground/60 hover:text-foreground transition-colors">
 <ArrowLeft className="w-4 h-4"/> Back
 </button>

 <div className="bg-card border border-foreground/8 rounded-3xl overflow-hidden">
 <div className="p-5 border-b border-foreground/8">
 <h2 className="font-bold text-foreground">New Return Request</h2>
 <p className="text-xs text-foreground/45 mt-0.5">Tell us what went wrong and we'll help resolve it</p>
 </div>

 <div className="p-5 space-y-5">
 {/* Select order */}
 <div>
 <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-2 block">Which order?</label>
 {eligibleOrders.length === 0 ? (
 <div className="p-4 bg-foreground/[0.03] rounded-2xl border border-dashed border-foreground/15 text-center">
 <p className="text-sm text-foreground/45">No eligible orders found</p>
 <p className="text-xs text-foreground/30 mt-1">Only delivered orders can be returned within 7 days</p>
 </div>
 ) : (
 <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
 {eligibleOrders.map(o => (
 <button key={o.id} onClick={() => setForm(p=>({...p, orderId:o.id}))}
 className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all ${form.orderId===o.id?'border-foreground bg-foreground/[0.03]':'border-foreground/10 hover:border-foreground/25'}`}>
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-xs font-bold text-foreground">#{o.id.slice(0,12).toUpperCase()}</p>
 <p className="text-[10px] text-foreground/45 mt-0.5">{o.items?.length||0} items · {formatTZS(o.total||0)}</p>
 </div>
 {form.orderId===o.id && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0"/>}
 </div>
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Reason */}
 <div>
 <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-2 block">Reason for return</label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
 {RETURN_REASONS.map(r => (
 <button key={r.value} onClick={() => setForm(p=>({...p,reason:r.value}))}
 className={`text-left p-3 rounded-xl border text-sm font-medium transition-all ${form.reason===r.value?'border-foreground bg-foreground/[0.04] text-foreground font-semibold':'border-foreground/10 text-foreground/60 hover:border-foreground/25'}`}>
 {r.label}
 </button>
 ))}
 </div>
 </div>

 {/* Description */}
 <div>
 <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-2 block">Describe the issue</label>
 <Textarea
 value={form.description}
 onChange={(e:any) => setForm(p=>({...p,description:e.target.value}))}
 placeholder="Please provide details about the problem with your order. The more specific, the faster we can help..."
 className="h-28 rounded-2xl text-sm resize-none"
 />
 <p className={`text-[10px] mt-1 ${form.description.length<20?'text-foreground/35':'text-emerald-500'}`}>
 {form.description.length}/20 minimum characters
 </p>
 </div>

 {/* Photo evidence */}
 <div>
 <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-2 block">
 Photo Evidence <span className="text-foreground/25 font-normal">(optional, max 3)</span>
 </label>
 <div className="flex gap-3 flex-wrap">
 {form.images.map((img, i) => (
 <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden">
 <img src={img} className="w-full h-full object-cover" loading="lazy" decoding="async"/>
 <button onClick={() => setForm(p=>({...p,images:p.images.filter((_,idx)=>idx!==i)}))}
 className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
 <X className="w-3 h-3 text-white stroke-[3]"/>
 </button>
 </div>
 ))}
 {form.images.length < 3 && (
 <label className={`w-20 h-20 rounded-xl border-2 border-dashed border-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:border-foreground/40 hover:bg-foreground/[0.03] transition-all ${uploading?'opacity-50 pointer-events-none':''}`}>
 {uploading ? <Loader2 className="w-5 h-5 animate-spin text-foreground/40"/> : <ImageIcon className="w-5 h-5 text-foreground/30"/>}
 <span className="text-[9px] text-foreground/30 mt-1">Add photo</span>
 <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading}/>
 </label>
 )}
 </div>
 </div>
 </div>

 <div className="p-5 border-t border-foreground/8">
 <button onClick={handleSubmit} disabled={submitting||!form.orderId||!form.reason||form.description.length<20}
 className="w-full h-13 py-3.5 rounded-2xl bg-foreground text-background font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]">
 {submitting ? <><Loader2 className="w-4 h-4 animate-spin"/> Submitting…</> : <><RotateCcw className="w-4 h-4 stroke-[2.5]"/> Submit Return Request</>}
 </button>
 </div>
 </div>
 </motion.div>
 );
 }

 // Main list view
 return (
 <div className="space-y-5">
 {/* Header */}
 <div className="flex items-center justify-between gap-4">
 <div>
 <h2 className="text-xl font-bold text-foreground">Returns & Disputes</h2>
 <p className="text-xs text-foreground/45 mt-0.5">
 {stats.open > 0 ? `${stats.open} open · ` : ''}{stats.resolved} resolved
 </p>
 </div>
 <button onClick={() => setShowCreate(true)}
 className="flex items-center gap-2 h-10 px-4 rounded-2xl bg-foreground text-background text-xs font-bold hover:bg-foreground/85 transition-colors active:scale-95 shrink-0">
 <Plus className="w-3.5 h-3.5 stroke-[2.5]"/> New Request
 </button>
 </div>

 {/* Filter bar */}
 <div className="flex gap-3 flex-col sm:flex-row">
 <div className="relative flex-1">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30 stroke-[2]"/>
 <input value={search} onChange={e=>setSearch(e.target.value)}
 placeholder="Search by order ID or reason…"
 className="w-full h-11 pl-10 pr-4 rounded-xl bg-foreground/[0.04] text-foreground text-sm placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/[0.07] transition-colors"/>
 </div>
 <div className="flex p-1 bg-foreground/[0.04] rounded-xl gap-1">
 {(['all','open','resolved'] as const).map(f=>(
 <button key={f} onClick={()=>setStatusFilter(f as any)}
 className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all capitalize ${statusFilter===f?'bg-background text-foreground shadow-sm':'text-foreground/40 hover:text-foreground/65'}`}>
 {f}
 </button>
 ))}
 </div>
 </div>

 {/* List */}
 {filtered.length === 0 ? (
 <div className="flex flex-col items-center py-20 border border-dashed border-foreground/15 rounded-3xl text-foreground/35">
 <PackageX className="w-12 h-12 mb-3 opacity-20"/>
 {disputes.length === 0 ? (
 <>
 <p className="font-semibold text-sm">No return requests yet</p>
 <p className="text-xs mt-1 mb-5">Something wrong with an order? We're here to help.</p>
 <button onClick={()=>setShowCreate(true)}
 className="flex items-center gap-2 h-10 px-5 rounded-full bg-foreground text-background text-xs font-bold">
 <Plus className="w-3.5 h-3.5"/> New Return Request
 </button>
 </>
 ) : (
 <>
 <p className="font-semibold text-sm">No results match your filter</p>
 <button onClick={()=>{setSearch('');setStatusFilter('all');}} className="mt-3 text-xs font-bold text-foreground/50 hover:text-foreground">Clear filters</button>
 </>
 )}
 </div>
 ) : (
 <div className="space-y-3">
 {filtered.map(d => {
 const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.open;
 const StatusIcon = cfg.icon;
 return (
 <motion.button key={d.id} onClick={()=>setSelected(d)}
 initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
 className="w-full text-left p-4 bg-card border border-foreground/8 rounded-2xl hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all active:scale-[0.99] flex items-center gap-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
 <StatusIcon className="w-4.5 h-4.5 stroke-[2]"/>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="text-sm font-bold text-foreground">#{d.order_id?.slice(0,12).toUpperCase()}</p>
 <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
 </div>
 <p className="text-xs text-foreground/55 mt-0.5 truncate">{d.reason}</p>
 <p className="text-[10px] text-foreground/35 mt-0.5">{new Date(d.created_at).toLocaleDateString()}</p>
 </div>
 <ChevronRight className="w-4 h-4 text-foreground/25 shrink-0"/>
 </motion.button>
 );
 })}
 </div>
 )}
 </div>
 );
};
