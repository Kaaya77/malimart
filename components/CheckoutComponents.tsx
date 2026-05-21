import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
 Check, MapPin, Truck, ShieldCheck, X, 
 Plus, Smartphone, Banknote, Home, Receipt, 
 ShoppingBag, Store, Info, ChevronLeft, ChevronDown, ChevronUp,
 Package, ArrowRight, CheckCircle2, Clock, Wallet,
 Zap, Hash, Ban, Loader2, Copy, Calendar, Gift, MessageSquare, AlertCircle,
 CreditCard, Landmark, PenLine, Locate, Navigation, ShoppingCart, HelpCircle,
 Phone, Star
} from 'lucide-react';
import { Button, Input, Label, Card, useToast, Badge, Switch, Textarea } from './UI';
import { formatTZS, CURRENCY } from '../constants';
import { useAppState } from '../context/AppContext';
import { Order, OrderStatus, Address, VendorProfile, CartItem } from '../types';
import { supabase } from '../services/supabaseClient';

const getEffectiveUnitPrice = (item: CartItem): number => {
 if (typeof item.price_at_add === 'number' && item.price_at_add > 0) return item.price_at_add;
 if (item.selectedVariant) return item.selectedVariant.sale_price ?? item.selectedVariant.base_price ?? 0;
 return item.price ?? 0;
};

// ─── AddressForm ─────────────────────────────────────────────────────────────
const REGIONS = ['Dar es Salaam','Arusha','Zanzibar','Mwanza','Dodoma','Kilimanjaro','Tanga','Mbeya','Morogoro','Mara','Lindi','Ruvuma','Songwe','Katavi'];

const AddressForm = ({ initialData, onSave, onCancel }: {
 initialData?: Partial<Address>;
 onSave: (data: Omit<Address,'id'|'user_id'|'created_at'>) => Promise<void>;
 onCancel: () => void;
}) => {
 const [form, setForm] = useState({
 label: initialData?.label || 'Home', street: initialData?.street || '',
 city: initialData?.city || '', phone: initialData?.phone || '',
 postal_code: initialData?.postal_code || '', landmark: initialData?.landmark || '',
 is_default: initialData?.is_default || false,
 latitude: initialData?.latitude || 0, longitude: initialData?.longitude || 0,
 });
 const { addToast } = useToast();
 const [saving, setSaving] = useState(false);
 const [locating, setLocating] = useState(false);

 const handleLocate = () => {
 if (!navigator.geolocation) return addToast('Geolocation not supported','error');
 setLocating(true);
 navigator.geolocation.getCurrentPosition(
 pos => { setForm(p => ({...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude})); setLocating(false); addToast('Location pinned ✓','success'); },
 () => { setLocating(false); addToast('Could not get location','error'); }
 );
 };

 const handleSave = async () => {
 if (!form.label.trim()) return addToast('Label required','error');
 if (!form.street.trim()) return addToast('Street required','error');
 if (!form.city) return addToast('Region required','error');
 if (!form.phone.trim() || !/^(\+255|0)[67]\d{8}$/.test(form.phone.replace(/\s/g,'')))
 return addToast('Valid TZ phone required (07XXXXXXXX)','error');
 try {
 setSaving(true);
 await onSave({ ...form, geo: { lat: form.latitude, lng: form.longitude } });
 } catch (e:any) { addToast(e.message || 'Failed to save','error'); }
 finally { setSaving(false); }
 };

 const field = (label: string, icon: React.ReactNode, input: React.ReactNode) => (
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 pl-1">{label}</label>
 <div className="relative">
 <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/25 pointer-events-none">{icon}</div>
 {input}
 </div>
 </div>
 );

 return (
 <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="bg-background border border-foreground/10 rounded-3xl overflow-hidden shadow-2xl">
 {/* Header */}
 <div className="flex items-center justify-between p-5 border-b border-foreground/8">
 <div>
 <h3 className="font-bold text-foreground">New Delivery Address</h3>
 <p className="text-xs text-foreground/45 mt-0.5">Where should we send your order?</p>
 </div>
 <button onClick={onCancel} className="w-9 h-9 rounded-full bg-foreground/[0.06] flex items-center justify-center hover:bg-foreground/[0.10] transition-colors">
 <X className="w-4 h-4 stroke-[2]"/>
 </button>
 </div>

 <div className="p-5 space-y-4">
 {/* Label pills */}
 <div className="flex gap-2">
 {['Home','Office','Other'].map(l => (
 <button key={l} onClick={() => setForm(p=>({...p,label:l}))}
 className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${form.label===l ? 'bg-foreground text-background' : 'bg-foreground/[0.06] text-foreground/60 hover:bg-foreground/10'}`}>
 {l}
 </button>
 ))}
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {field('Phone', <Phone className="w-4 h-4"/>,
 <Input value={form.phone} onChange={(e:any)=>setForm(p=>({...p,phone:e.target.value}))}
 placeholder="07XXXXXXXX" className="pl-11 h-12 rounded-2xl bg-foreground/[0.04] border-foreground/10 font-mono"/>)}
 <div className="space-y-2">
 <label className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 pl-1">Region</label>
 <select value={form.city} onChange={e=>setForm(p=>({...p,city:e.target.value}))}
 className="w-full h-12 bg-foreground/[0.04] border border-foreground/10 rounded-2xl px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 appearance-none transition-colors">
 <option value="" disabled>Select region…</option>
 {REGIONS.map(r=><option key={r} value={r}>{r}</option>)}
 </select>
 </div>
 </div>

 {field('Street / Building', <Home className="w-4 h-4"/>,
 <Input value={form.street} onChange={(e:any)=>setForm(p=>({...p,street:e.target.value}))}
 placeholder="e.g. 14 Barack Obama Dr, Twiga Towers" className="pl-11 h-12 rounded-2xl bg-foreground/[0.04] border-foreground/10"/>)}

 {field('Landmark (optional)', <Navigation className="w-4 h-4"/>,
 <Input value={form.landmark} onChange={(e:any)=>setForm(p=>({...p,landmark:e.target.value}))}
 placeholder="e.g. Near Total Gas Station" className="pl-11 h-12 rounded-2xl bg-foreground/[0.04] border-foreground/10"/>)}

 {/* GPS capture */}
 <div className="flex items-center justify-between p-4 rounded-2xl bg-foreground/[0.03] border border-foreground/8">
 <div className="flex items-center gap-3">
 <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.latitude!==0?'bg-emerald-500 text-white':'bg-foreground/[0.08] text-foreground/40'}`}>
 <Locate className="w-4 h-4 stroke-[2]"/>
 </div>
 <div>
 <p className="text-xs font-semibold text-foreground">{form.latitude!==0?'GPS pinned ✓':'GPS Location'}</p>
 <p className="text-[10px] text-foreground/40">{form.latitude!==0?`${form.latitude.toFixed(4)}, ${form.longitude.toFixed(4)}`:'Tap to pin your exact location'}</p>
 </div>
 </div>
 <button onClick={handleLocate} disabled={locating}
 className="h-9 px-4 rounded-xl bg-foreground/[0.08] text-foreground text-xs font-semibold hover:bg-foreground/15 transition-colors disabled:opacity-50 flex items-center gap-1.5">
 {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Locate className="w-3.5 h-3.5"/>}
 {locating?'Locating…':'Pin'}
 </button>
 </div>

 <div className="flex items-center gap-3 p-4 rounded-2xl bg-foreground/[0.03]">
 <Switch checked={form.is_default} onCheckedChange={(v:boolean)=>setForm(p=>({...p,is_default:v}))}/>
 <div>
 <p className="text-xs font-semibold text-foreground">Set as default address</p>
 <p className="text-[10px] text-foreground/40">Pre-selected for future orders</p>
 </div>
 </div>
 </div>

 <div className="p-5 border-t border-foreground/8 flex gap-3">
 <button onClick={onCancel} className="flex-1 h-12 rounded-2xl bg-foreground/[0.05] text-foreground/60 text-sm font-semibold hover:bg-foreground/[0.08] transition-colors">Cancel</button>
 <button onClick={handleSave} disabled={saving}
 className="flex-[2] h-12 rounded-2xl bg-foreground text-background text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-[0.98]">
 {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4 stroke-[2.5]"/>}
 {saving?'Saving…':'Save Address'}
 </button>
 </div>
 </motion.div>
 );
};

// ─── Order Tracking ───────────────────────────────────────────────────────────
const TRACK_STEPS = [
 { key:'placed', icon:ShoppingBag, label:'Placed', color:'bg-blue-500' },
 { key:'confirmed', icon:CheckCircle2,label:'Confirmed', color:'bg-indigo-500' },
 { key:'processing',icon:Package, label:'Processing', color:'bg-amber-500' },
 { key:'shipped', icon:Truck, label:'En Route', color:'bg-purple-500' },
 { key:'delivered', icon:Home, label:'Delivered', color:'bg-emerald-500' },
];
const STATUS_IDX: Record<string,number> = {
 pending:0,placed:0,confirmed:1,paid:1,processing:2,
 shipped:3,in_transit:3,ready_for_pickup:3,delivered:4
};

export const OrderTracking = ({ order }: { order: Order }) => {
 const [events, setEvents] = useState<any[]>([]);
 const [tracking, setTracking] = useState<{number:string|null,carrier:string|null}>({number:null,carrier:null});

 useEffect(() => {
 supabase.from('shipments').select('*').eq('order_id',order.id).single().then(({data:s})=>{
 if (!s) return;
 setTracking({number:s.tracking_number,carrier:s.carrier});
 supabase.from('shipment_events').select('*').eq('shipment_id',s.id).order('occurred_at',{ascending:false})
 .then(({data:ev})=>{ if(ev) setEvents(ev); });
 });
 },[order.id]);

 const isCancelled = ['cancelled','refunded','failed'].includes(order.status);
 if (isCancelled) return (
 <div className="flex items-center gap-4 p-5 rounded-3xl bg-red-500/8 border border-red-500/20">
 <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center"><Ban className="w-5 h-5 text-red-500"/></div>
 <div>
 <p className="font-bold text-red-600 text-sm">Order {order.status}</p>
 <p className="text-xs text-red-500/70 mt-0.5">{order.cancel_reason || order.reject_reason || 'This transaction has been terminated.'}</p>
 </div>
 </div>
 );

 const idx = STATUS_IDX[order.status] ?? 0;

 return (
 <div className="space-y-6">
 {/* Progress steps */}
 <div className="relative flex justify-between items-center px-2 pt-2 pb-14">
 <div className="absolute top-[22px] left-6 right-6 h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
 <motion.div initial={{width:0}} animate={{width:`${(idx/(TRACK_STEPS.length-1))*100}%`}}
 transition={{duration:1.2,ease:'easeOut'}}
 className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 rounded-full"/>
 </div>
 {TRACK_STEPS.map((step,i)=>{
 const done=i<idx, cur=i===idx, Icon=step.icon;
 return (
 <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
 <motion.div animate={{scale:cur?1.15:1}} transition={{type:'spring',stiffness:400}}
 className={`w-11 h-11 rounded-2xl flex items-center justify-center border-[3px] border-background shadow-md transition-colors duration-500 ${done||cur?step.color+' text-white':'bg-foreground/[0.06] text-foreground/30'}`}>
 <Icon className="w-4 h-4"/>
 {cur && <motion.div animate={{opacity:[0.3,0.7,0.3]}} transition={{repeat:Infinity,duration:2}}
 className={`absolute inset-0 rounded-2xl blur-xl -z-10 ${step.color}`}/>}
 </motion.div>
 <span className={`absolute top-14 text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${cur?'text-foreground':'text-foreground/30'}`}>
 {step.label}
 </span>
 </div>
 );
 })}
 </div>

 {/* Events */}
 {events.length>0 && (
 <div className="bg-foreground/[0.03] rounded-2xl p-5 border border-foreground/8 space-y-3">
 <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35 mb-1">Live Updates</p>
 {events.map((ev,i)=>(
 <div key={ev.id} className="flex gap-3">
 <div className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 ${i===0?'bg-blue-500 animate-pulse':'bg-foreground/20'}`}/>
 <div>
 <p className="text-xs font-bold text-foreground">{ev.status.replace(/_/g,' ').toUpperCase()}</p>
 {ev.notes && <p className="text-[10px] text-foreground/50">{ev.notes}</p>}
 <p className="text-[9px] font-mono text-foreground/30 mt-0.5">{new Date(ev.occurred_at).toLocaleString()}</p>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Carrier */}
 {(tracking.number||tracking.carrier) && (
 <div className="flex items-center justify-between p-5 bg-foreground rounded-2xl text-background">
 <div>
 <p className="text-[9px] font-bold uppercase tracking-widest text-background/40 mb-0.5">Carrier</p>
 <p className="font-bold text-sm">{tracking.carrier||'Standard Delivery'}</p>
 </div>
 {tracking.number && <div className="text-right">
 <p className="text-[9px] font-bold uppercase tracking-widest text-background/40 mb-0.5">Tracking ID</p>
 <p className="font-mono font-bold tracking-widest">{tracking.number}</p>
 </div>}
 </div>
 )}
 </div>
 );
};

// ─── Checkout Modal ──────────────────────────────────────────────────────────
interface CheckoutModalProps {
 total: number; subtotal: number; vat: number; discount: number;
 onClose: () => void;
 onComplete: (d: { address:Address; paymentMethod:string; deliveryFee:number; note:string; paymentRef?:string; isGift?:boolean; giftMessage?:string; deliveryDate?:string; deliverySlot?:string }) => Promise<void>;
}

const PAYMENT_METHODS = [
 { id:'lipa_namba', label:'Mobile Money', icon:Smartphone, desc:'M-Pesa · Tigo · Airtel' },
 { id:'mobile_transfer',label:'Bank Transfer', icon:Landmark, desc:'Direct bank deposit' },
 { id:'cash', label:'Cash on Delivery', icon:Banknote, desc:'Pay the driver on arrival' },
];

const DELIVERY_SLOTS = ['Morning (8–12)','Afternoon (12–4)','Evening (4–8)','Anytime'];

export const CheckoutModal = ({ total, subtotal, vat, discount, onClose, onComplete }: CheckoutModalProps) => {
 const { addresses, addAddress, cart } = useAppState();
 const { addToast } = useToast();

 const [step, setStep] = useState<1|2>(1);
 const [selectedAddr, setSelectedAddr] = useState<Address|null>(null);
 const [isAddingAddr, setIsAddingAddr] = useState(false);
 const [note, setNote] = useState('');
 const [deliveryDate, setDeliveryDate] = useState('');
 const [slot, setSlot] = useState('Anytime');
 const [isGift, setIsGift] = useState(false);
 const [giftMsg, setGiftMsg] = useState('');
 const [method, setMethod] = useState<'lipa_namba'|'mobile_transfer'|'cash'>('lipa_namba');
 const [payRef, setPayRef] = useState('');
 const [senderPhone, setSenderPhone] = useState('');
 const [sellers, setSellers] = useState<VendorProfile[]>([]);
 const [sellersLoaded, setSellersLoaded] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [showSummary, setShowSummary] = useState(false);

 // Auto-select default or first address when addresses load
 useEffect(()=>{
 if (addresses.length===0) return;
 if (!selectedAddr) {
 setSelectedAddr(addresses.find(a=>a.is_default)||addresses[0]);
 } else {
 // When a new address is added, it'll be the last one — auto-select it
 // (it won't have an id yet matching anything in previous selectedAddr)
 const found = addresses.find(a=>a.id===selectedAddr.id);
 if (!found) {
 // Newly added - select the latest
 setSelectedAddr(addresses[addresses.length-1]);
 }
 }
 },[addresses]);

 useEffect(()=>{
 const ids = [...new Set(cart.map(i=>i.seller_id))];
 if (!ids.length) { setSellersLoaded(true); return; }
 supabase.from('vendor_profiles').select('*').in('seller_id',ids)
 .then(({data})=>{ if(data) setSellers(data as VendorProfile[]); setSellersLoaded(true); });
 },[cart]);

 const deliveryFee = useMemo(()=>
 [...new Set(cart.map(i=>i.seller_id))].reduce((acc,sid)=>
 acc+(Number(sellers.find(s=>s.seller_id===sid)?.delivery_fee||0)),0)
 ,[cart,sellers]);

 const finalTotal = subtotal + vat + deliveryFee - discount;

 const groupedItems = useMemo(()=>{
 const g: Record<string,CartItem[]> = {};
 cart.forEach(item=>{ if(!g[item.seller_id]) g[item.seller_id]=[]; g[item.seller_id].push(item); });
 return g;
 },[cart]);

 const nextDays = useMemo(()=>{
 const days=[]; const today=new Date();
 for(let i=1;i<=6;i++){ const d=new Date(today); d.setDate(today.getDate()+i); days.push(d); }
 return days;
 },[]);

 const canSubmit = selectedAddr && (
 method==='cash' ||
 (method==='lipa_namba' && payRef.trim().length>=4 && senderPhone.trim().length>=9) ||
 (method==='mobile_transfer' && payRef.trim().length>=4)
 );

 const handleComplete = async () => {
 if (!selectedAddr) return addToast('Select a delivery address','error');
 setSubmitting(true);
 try {
 const methodLabel = method==='cash'?'Cash on Delivery':method==='lipa_namba'?'Mobile Money':'Bank Transfer';
 await onComplete({
 address: selectedAddr, paymentMethod: methodLabel, deliveryFee,
 note, paymentRef: senderPhone?`${payRef} (from: ${senderPhone})`:payRef,
 isGift, giftMessage: giftMsg,
 deliveryDate: deliveryDate?new Date(deliveryDate).toISOString():undefined, deliverySlot: slot
 });
 } catch { addToast('Order failed, please try again','error'); }
 finally { setSubmitting(false); }
 };

 return (
 <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm">
 <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} transition={{duration:0.3,ease:[0.22,1,0.36,1]}}
 className="relative w-full max-w-6xl bg-background md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-foreground/8"
 style={{height:'92dvh',maxHeight:'92dvh'}}>

 {/* ── LEFT / MAIN ─────────────────────────────────────── */}
 <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

 {/* Mobile collapsed summary */}
 <div className="md:hidden border-b border-foreground/8">
 <button onClick={()=>setShowSummary(v=>!v)} className="w-full p-4 flex justify-between items-center gap-4 active:bg-foreground/[0.03]">
 <div className="flex items-center gap-2 text-xs font-bold text-foreground/50 uppercase tracking-widest">
 <Receipt className="w-4 h-4"/>
 <span>{showSummary?'Hide':'See'} order</span>
 {showSummary?<ChevronUp className="w-3.5 h-3.5"/>:<ChevronDown className="w-3.5 h-3.5"/>}
 </div>
 <span className="font-black text-lg text-foreground">{formatTZS(Math.round(finalTotal))}</span>
 </button>
 <AnimatePresence>
 {showSummary && (
 <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
 className="overflow-hidden">
 <div className="px-4 pb-4 space-y-3 max-h-[28vh] overflow-y-auto no-scrollbar border-t border-foreground/8 pt-3">
 {cart.map((item,i)=>{
 const price=getEffectiveUnitPrice(item);
 return (
 <div key={i} className="flex items-center gap-3 text-xs">
 <div className="relative w-10 h-10 rounded-xl bg-foreground/[0.06] overflow-hidden shrink-0">
 <img src={item.selectedVariant?.image_url||item.images?.[0]} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
 <span className="absolute -top-1 -right-1 bg-foreground text-background text-[8px] px-1 rounded-full font-bold">{item.quantity}</span>
 </div>
 <span className="flex-1 text-foreground/70 truncate">{item.name}</span>
 <span className="font-bold shrink-0">{formatTZS(price*item.quantity)}</span>
 </div>
 );
 })}
 <div className="pt-2 border-t border-foreground/8 space-y-1">
 <div className="flex justify-between text-[10px] text-foreground/50"><span>Subtotal</span><span>{formatTZS(subtotal)}</span></div>
 <div className="flex justify-between text-[10px] text-foreground/50"><span>VAT (18%)</span><span>{formatTZS(Math.round(vat))}</span></div>
 <div className="flex justify-between text-[10px] text-foreground/50"><span>Delivery</span><span>{formatTZS(deliveryFee)}</span></div>
 {discount>0 && <div className="flex justify-between text-[10px] text-emerald-500 font-bold"><span>Discount</span><span>-{formatTZS(discount)}</span></div>}
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* Header */}
 <div className="px-5 py-4 flex items-center justify-between border-b border-foreground/8 shrink-0">
 <div className="flex items-center gap-3">
 {step===2 && (
 <button onClick={()=>setStep(1)} className="w-9 h-9 rounded-full bg-foreground/[0.06] flex items-center justify-center hover:bg-foreground/10 transition-colors mr-1">
 <ChevronLeft className="w-4 h-4 stroke-[2.5]"/>
 </button>
 )}
 <div>
 <div className="flex items-center gap-2">
 <ShieldCheck className="w-5 h-5 text-emerald-500 stroke-[2]"/>
 <h2 className="font-bold text-base text-foreground">{step===1?'Delivery Details':'Payment'}</h2>
 </div>
 <div className="flex items-center gap-1.5 mt-1">
 <div className={`h-1 rounded-full transition-all duration-300 ${step>=1?'w-8 bg-emerald-500':'w-4 bg-foreground/15'}`}/>
 <div className={`h-1 rounded-full transition-all duration-300 ${step>=2?'w-8 bg-emerald-500':'w-4 bg-foreground/15'}`}/>
 <span className="text-[9px] text-foreground/35 font-bold uppercase tracking-widest ml-1">Step {step}/2</span>
 </div>
 </div>
 </div>
 <button onClick={onClose} className="w-9 h-9 rounded-full bg-foreground/[0.06] flex items-center justify-center hover:bg-foreground/10 transition-colors">
 <X className="w-4 h-4 stroke-[2]"/>
 </button>
 </div>

 {/* Scrollable form */}
 <div className="flex-1 overflow-y-auto no-scrollbar">
 <AnimatePresence mode="wait">
 {step===1 ? (
 <motion.div key="step1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}
 transition={{duration:0.25}} className="p-5 space-y-6 pb-4">

 {/* Delivery address */}
 <section>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <MapPin className="w-4 h-4 text-foreground/50 stroke-[2]"/>
 <h3 className="text-sm font-bold text-foreground">Delivery Address</h3>
 </div>
 {!isAddingAddr && (
 <button onClick={()=>setIsAddingAddr(true)}
 className="h-8 px-3 rounded-xl bg-foreground/[0.06] text-foreground/70 text-xs font-semibold flex items-center gap-1.5 hover:bg-foreground/10 transition-colors">
 <Plus className="w-3.5 h-3.5 stroke-[2.5]"/> Add new
 </button>
 )}
 </div>
 {isAddingAddr ? (
 <AddressForm
 onSave={async d=>{
 await addAddress(d);
 setIsAddingAddr(false);
 // The new address will appear in `addresses` after state update.
 // We'll auto-select it via the useEffect below.
 }}
 onCancel={()=>setIsAddingAddr(false)}
 />
 ) : (
 <div className="space-y-2.5">
 {addresses.length===0 && (
 <button onClick={()=>setIsAddingAddr(true)}
 className="w-full py-10 border-2 border-dashed border-foreground/15 rounded-2xl text-foreground/40 text-sm text-center hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all">
 <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30"/>
 Tap to add your first address
 </button>
 )}
 {addresses.map(addr=>(
 <button key={addr.id} onClick={()=>setSelectedAddr(addr)}
 className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${selectedAddr?.id===addr.id?'border-foreground bg-foreground/[0.03] shadow-sm':'border-foreground/10 hover:border-foreground/25'}`}>
 <div className="flex items-start gap-3">
 <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedAddr?.id===addr.id?'bg-foreground text-background':'bg-foreground/[0.08] text-foreground/50'}`}>
 {addr.label.toLowerCase().includes('home')?<Home className="w-4 h-4 stroke-[2]"/>:<MapPin className="w-4 h-4 stroke-[2]"/>}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-foreground uppercase tracking-wide">{addr.label}</span>
 {addr.is_default && <span className="text-[9px] bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Default</span>}
 </div>
 <p className="text-sm text-foreground/70 mt-0.5 truncate">{addr.street}</p>
 <p className="text-xs text-foreground/45 mt-0.5">{addr.city}{addr.landmark?` · Near ${addr.landmark}`:''}</p>
 </div>
 {selectedAddr?.id===addr.id && (
 <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
 <Check className="w-3 h-3 text-white stroke-[3]"/>
 </div>
 )}
 </div>
 </button>
 ))}
 </div>
 )}
 </section>

 {/* Delivery date */}
 <section>
 <div className="flex items-center gap-2 mb-4">
 <Calendar className="w-4 h-4 text-foreground/50 stroke-[2]"/>
 <h3 className="text-sm font-bold text-foreground">Preferred Delivery</h3>
 </div>
 <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
 <button onClick={()=>setDeliveryDate('')}
 className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-18 rounded-2xl border-2 transition-all py-3 ${deliveryDate===''?'border-foreground bg-foreground/[0.04]':'border-foreground/10 text-foreground/40 hover:border-foreground/25'}`}>
 <span className="text-[9px] font-bold uppercase">ASAP</span>
 <Zap className="w-4 h-4 mt-1"/>
 </button>
 {nextDays.map((d,i)=>{
 const val=d.toISOString().split('T')[0];
 const sel=deliveryDate===val;
 return (
 <button key={i} onClick={()=>setDeliveryDate(val)}
 className={`flex-shrink-0 flex flex-col items-center justify-center w-16 rounded-2xl border-2 transition-all py-3 ${sel?'border-foreground bg-foreground/[0.04] text-foreground':'border-foreground/10 text-foreground/40 hover:border-foreground/25'}`}>
 <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString('en',{weekday:'short'})}</span>
 <span className="text-xl font-black mt-0.5">{d.getDate()}</span>
 <span className="text-[8px] opacity-60">{d.toLocaleDateString('en',{month:'short'})}</span>
 </button>
 );
 })}
 </div>
 {deliveryDate && (
 <div className="flex gap-2 mt-3 flex-wrap">
 {DELIVERY_SLOTS.map(s=>(
 <button key={s} onClick={()=>setSlot(s)}
 className={`px-3 h-9 rounded-xl text-[11px] font-semibold transition-all ${slot===s?'bg-foreground text-background':'bg-foreground/[0.05] text-foreground/60 hover:bg-foreground/10'}`}>
 {s}
 </button>
 ))}
 </div>
 )}
 </section>

 {/* Gift toggle */}
 <section>
 <button onClick={()=>setIsGift(v=>!v)} className="flex items-center gap-3 w-full">
 <div className={`w-12 h-7 rounded-full transition-colors duration-200 relative ${isGift?'bg-indigo-500':'bg-foreground/15'}`}>
 <div className={`absolute top-1 w-5 h-5 rounded-full bg-background shadow transition-transform duration-200 ${isGift?'translate-x-6':'translate-x-1'}`}/>
 </div>
 <div className="flex items-center gap-2">
 <Gift className="w-4 h-4 text-indigo-400 stroke-[2]"/>
 <span className="text-sm font-semibold text-foreground">Send as a Gift</span>
 </div>
 </button>
 <AnimatePresence>
 {isGift && (
 <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden mt-3">
 <Textarea value={giftMsg} onChange={(e:any)=>setGiftMsg(e.target.value)}
 placeholder="Write a heartfelt gift message…"
 className="h-24 rounded-2xl bg-indigo-500/5 border-indigo-200/30 text-sm resize-none"/>
 </motion.div>
 )}
 </AnimatePresence>
 </section>

 {/* Note */}
 <section>
 <div className="flex items-center gap-2 mb-3">
 <MessageSquare className="w-4 h-4 text-foreground/50 stroke-[2]"/>
 <h3 className="text-sm font-bold text-foreground">Driver Instructions</h3>
 <span className="text-[10px] text-foreground/35 font-semibold">(optional)</span>
 </div>
 <Textarea value={note} onChange={(e:any)=>setNote(e.target.value)}
 placeholder="Gate code, special directions, call before arrival…"
 className="h-20 rounded-2xl bg-foreground/[0.04] border-foreground/10 text-sm resize-none"/>
 </section>
 </motion.div>
 ) : (
 <motion.div key="step2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}
 transition={{duration:0.25}} className="p-5 space-y-6 pb-4">

 {/* Payment method selection */}
 <section>
 <div className="flex items-center gap-2 mb-4">
 <Wallet className="w-4 h-4 text-foreground/50 stroke-[2]"/>
 <h3 className="text-sm font-bold text-foreground">Payment Method</h3>
 </div>
 <div className="grid grid-cols-3 gap-2.5">
 {PAYMENT_METHODS.map(m=>{
 const Icon=m.icon;
 const sel=method===m.id;
 return (
 <button key={m.id} onClick={()=>setMethod(m.id as any)}
 className={`relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all duration-200 ${sel?'border-foreground bg-foreground/[0.04] shadow-sm':'border-foreground/10 hover:border-foreground/25'}`}>
 {sel && <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white stroke-[3]"/></div>}
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${sel?'bg-foreground text-background':'bg-foreground/[0.08] text-foreground/50'}`}>
 <Icon className="w-5 h-5"/>
 </div>
 <p className="text-[11px] font-bold text-foreground leading-tight">{m.label}</p>
 <p className="text-[9px] text-foreground/40 mt-0.5">{m.desc}</p>
 </button>
 );
 })}
 </div>
 </section>

 {/* Mobile money / bank transfer details */}
 {method!=='cash' && (
 <section className="space-y-4">
 {/* Per-seller payment channels */}
 <div className="space-y-2.5">
 <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35">Pay to</p>
 {(Object.entries(groupedItems) as [string,CartItem[]][]).map(([sid,items])=>{
 const seller=sellers.find(s=>s.seller_id===sid);
 const sum=items.reduce((a,i)=>a+(getEffectiveUnitPrice(i)*i.quantity),0)+(Number(seller?.delivery_fee||0));
 let name=seller?.store_name||'Merchant';
 let num='Contact support'; let lbl='Account';
 if (method==='mobile_transfer') {
 name=seller?.bank_account_name||name;
 num=seller?.account_number||'Not listed';
 lbl=seller?.bank_name||'Bank';
 } else {
 if (seller?.lipa_namba) { num=seller.lipa_namba; lbl='Lipa Namba'; }
 else if (seller?.mobile_number) { num=seller.mobile_number; lbl=seller.mobile_operator||'Mobile'; name=seller.mobile_name||name; }
 }
 return (
 <div key={sid} className="flex items-center justify-between p-4 bg-foreground rounded-2xl text-background gap-3">
 <div className="min-w-0">
 <p className="text-[9px] font-bold uppercase tracking-widest text-background/45 mb-0.5">{name} · {formatTZS(Math.round(sum))}</p>
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-[10px] bg-background/15 px-2 py-0.5 rounded-lg font-bold uppercase">{lbl}</span>
 <span className="font-mono font-bold text-sm tracking-wider">{num}</span>
 </div>
 </div>
 <button onClick={()=>{navigator.clipboard.writeText(String(num));addToast('Copied!','success');}}
 className="w-9 h-9 rounded-xl bg-background/15 hover:bg-background/25 flex items-center justify-center shrink-0 transition-colors">
 <Copy className="w-4 h-4"/>
 </button>
 </div>
 );
 })}
 </div>

 {/* Transaction reference */}
 <div className="p-4 bg-foreground/[0.03] rounded-2xl border border-foreground/8 space-y-3">
 <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/35">Verify your payment</p>
 <div className="relative">
 <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"/>
 <Input value={senderPhone} onChange={(e:any)=>setSenderPhone(e.target.value)}
 placeholder="Your phone number (optional)" className="pl-10 h-11 rounded-xl bg-background border-foreground/10 font-mono text-sm"/>
 </div>
 <div className="relative">
 <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30"/>
 <Input value={payRef} onChange={(e:any)=>setPayRef(e.target.value.toUpperCase())}
 placeholder="TRANSACTION ID / REF CODE"
 className="pl-10 h-12 rounded-xl bg-background border-foreground/10 font-mono font-bold tracking-widest text-center uppercase text-sm"/>
 </div>
 <p className="text-[10px] text-foreground/40 text-center">Enter the M-Pesa / bank reference from your payment confirmation SMS</p>
 </div>
 </section>
 )}

 {method==='cash' && (
 <div className="flex items-start gap-4 p-4 bg-amber-500/8 rounded-2xl border border-amber-500/20">
 <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
 <Banknote className="w-5 h-5 text-amber-600"/>
 </div>
 <div>
 <p className="text-sm font-bold text-foreground">Cash on Delivery selected</p>
 <p className="text-xs text-foreground/55 mt-0.5">Please have the exact amount ready: <strong className="text-foreground">{formatTZS(Math.round(finalTotal))}</strong>. Payment is collected at your door.</p>
 </div>
 </div>
 )}
 </motion.div>
 )}
 </AnimatePresence>
 </div>

 {/* Action bar */}
 <div className="p-4 border-t border-foreground/8 shrink-0" style={{paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
 <button
 onClick={()=>step===1?setStep(2):handleComplete()}
 disabled={step===1?!selectedAddr:(submitting||!canSubmit)}
 className={`w-full h-14 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] disabled:opacity-40
 ${step===2&&canSubmit?'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25':'bg-foreground text-background shadow-lg shadow-foreground/15'}`}>
 {submitting ? (
 <><Loader2 className="w-4 h-4 animate-spin"/> Processing…</>
 ) : step===1 ? (
 <>Continue to Payment <ArrowRight className="w-4 h-4 stroke-[2.5]"/></>
 ) : (
 <><CheckCircle2 className="w-5 h-5 stroke-[2]"/> Place Order · {formatTZS(Math.round(finalTotal))}</>
 )}
 </button>
 </div>
 </div>

 {/* ── RIGHT / DESKTOP SUMMARY ──────────────────────────── */}
 <div className="hidden md:flex w-[360px] bg-foreground/[0.02] border-l border-foreground/8 flex-col shrink-0">
 <div className="p-6 border-b border-foreground/8">
 <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/35">
 <Receipt className="w-4 h-4"/> Order Summary
 </div>
 </div>
 <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
 {cart.map((item,i)=>{
 const price=getEffectiveUnitPrice(item);
 return (
 <div key={i} className="flex gap-3 items-start">
 <div className="relative w-14 h-14 rounded-2xl bg-background border border-foreground/8 overflow-hidden shrink-0">
 <img src={item.selectedVariant?.image_url||item.images?.[0]} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async"/>
 <span className="absolute bottom-0 right-0 bg-foreground text-background text-[8px] px-1.5 py-0.5 rounded-tl-lg font-bold">{item.quantity}</span>
 </div>
 <div className="flex-1 min-w-0 pt-0.5">
 <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
 {item.selectedVariant && <p className="text-[10px] text-foreground/40 mt-0.5 truncate">{Object.values(item.selectedVariant.attributes||{}).join(' · ')}</p>}
 <p className="text-xs text-foreground/55 mt-1">{formatTZS(price*item.quantity)}</p>
 </div>
 </div>
 );
 })}
 </div>
 <div className="p-6 border-t border-foreground/8 space-y-3">
 <div className="flex justify-between text-xs text-foreground/50"><span>Subtotal</span><span>{formatTZS(subtotal)}</span></div>
 <div className="flex justify-between text-xs text-foreground/50"><span>VAT (18%)</span><span>{formatTZS(Math.round(vat))}</span></div>
 <div className="flex justify-between text-xs text-foreground/50 items-center">
 <span>Delivery</span>
 <span>{sellersLoaded?formatTZS(deliveryFee):<Loader2 className="w-3.5 h-3.5 animate-spin"/>}</span>
 </div>
 {discount>0 && <div className="flex justify-between text-xs font-bold text-emerald-500"><span>Discount</span><span>-{formatTZS(discount)}</span></div>}
 <div className="pt-4 border-t border-foreground/8 flex justify-between items-end">
 <span className="text-xs font-bold uppercase tracking-widest text-foreground">Total Due</span>
 <span className="text-2xl font-black text-foreground leading-none">{formatTZS(Math.round(finalTotal))}</span>
 </div>
 {/* Security badges */}
 <div className="flex items-center justify-center gap-4 pt-2">
 {[{icon:ShieldCheck,label:'Secure'},{icon:Truck,label:'Tracked'},{icon:RotateCcw,label:'7-day returns'}].map(({icon:Icon,label})=>(
 <div key={label} className="flex flex-col items-center gap-1">
 <Icon className="w-4 h-4 text-foreground/30 stroke-[1.8]"/>
 <span className="text-[9px] text-foreground/30 font-semibold uppercase tracking-wider">{label}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </motion.div>
 </div>
 );
};

// ─── Aliases re-exported for import consistency ───────────────────────────────
const RotateCcw = ({ className }: {className?:string}) => (
 <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
 </svg>
);
