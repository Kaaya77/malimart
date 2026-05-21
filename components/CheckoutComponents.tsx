import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, MapPin, Truck, ShieldCheck, X,
  Plus, Smartphone, Banknote, Home, Receipt,
  ShoppingBag, Store, Info, ChevronLeft, ChevronDown, ChevronUp,
  Package, ArrowRight, CheckCircle2, Clock, Wallet,
  Zap, Hash, Ban, Loader2, Copy, Calendar, Gift, MessageSquare,
  CreditCard, Landmark, PenLine, Locate, Navigation, ShoppingCart,
  HelpCircle, Phone, Lock, Sparkles, AlertCircle
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

// ─────────────────────────────────────────────
// AddressForm
// ─────────────────────────────────────────────
const AddressForm = ({ initialData, onSave, onCancel }: {
  initialData?: Partial<Address>;
  onSave: (data: Omit<Address, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  onCancel: () => void;
}) => {
  const [formData, setFormData] = useState({
    label: initialData?.label || 'Home',
    street: initialData?.street || '',
    city: initialData?.city || '',
    phone: initialData?.phone || '',
    postal_code: initialData?.postal_code || '',
    landmark: initialData?.landmark || '',
    is_default: initialData?.is_default || false,
    latitude: initialData?.latitude || 0,
    longitude: initialData?.longitude || 0,
  });
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const validatePhone = (phone: string) => /^(\+255|0)[67]\d{8}$/.test(phone.replace(/\s/g, ''));

  const handleLocate = () => {
    if (!navigator.geolocation) return addToast("Geolocation not supported", "error");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setFormData(p => ({ ...p, latitude: pos.coords.latitude, longitude: pos.coords.longitude })); setIsLocating(false); addToast("Location pinned!", "success"); },
      () => { setIsLocating(false); addToast("Could not get location", "error"); }
    );
  };

  const handleSave = async () => {
    if (!formData.label.trim()) return addToast('Label required', 'error');
    if (!formData.street.trim()) return addToast('Street required', 'error');
    if (!validatePhone(formData.phone)) return addToast('Valid TZ phone required (07XXXXXXXX)', 'error');
    if (!formData.city) return addToast('Region required', 'error');
    try {
      setIsSaving(true);
      await onSave({ ...formData, geo: { lat: formData.latitude, lng: formData.longitude } });
      addToast('Address saved!', 'success');
    } catch (err: any) { addToast(err.message || 'Failed to save.', 'error'); }
    finally { setIsSaving(false); }
  };

  const fieldCls = "w-full h-12 bg-foreground/[0.04] border border-foreground/10 rounded-xl px-4 text-sm font-medium outline-none focus:border-foreground/30 transition-all text-foreground placeholder:text-foreground/30";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-background border border-foreground/10 rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">New Address</h3>
          <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-wider mt-0.5">Where should we deliver?</p>
        </div>
        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors">
          <X className="w-3.5 h-3.5 text-foreground/50" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/40 pl-1">Label</label>
            <div className="relative">
              <input placeholder="e.g. Home, Office" value={formData.label} onChange={e => setFormData(p => ({ ...p, label: e.target.value }))} className={fieldCls + " pl-10"} />
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/40 pl-1">Phone</label>
            <div className="relative">
              <input placeholder="07XXXXXXXX" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className={fieldCls + " pl-10 font-mono"} />
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/40 pl-1">Street / Building</label>
          <div className="relative">
            <input placeholder="e.g. 14 Barack Obama Drive, Twiga Towers" value={formData.street} onChange={e => setFormData(p => ({ ...p, street: e.target.value }))} className={fieldCls + " pl-10"} />
            <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/40 pl-1">Region</label>
            <select
              value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
              className={fieldCls + " appearance-none cursor-pointer"}
            >
              <option value="" disabled>Select region</option>
              {['Dar es Salaam', 'Arusha', 'Zanzibar', 'Mwanza', 'Dodoma', 'Kilimanjaro', 'Tanga', 'Mbeya', 'Morogoro'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/40 pl-1">Postal Code (optional)</label>
            <input placeholder="e.g. 11101" value={formData.postal_code} onChange={e => setFormData(p => ({ ...p, postal_code: e.target.value }))} className={fieldCls} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/40 pl-1">Landmark</label>
          <div className="relative">
            <input placeholder="e.g. Next to Total Gas Station" value={formData.landmark} onChange={e => setFormData(p => ({ ...p, landmark: e.target.value }))} className={fieldCls + " pl-10"} />
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/25" />
          </div>
        </div>

        {/* GPS + Default row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleLocate} disabled={isLocating} type="button"
            className={`h-11 flex items-center justify-center gap-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.15em] transition-all ${formData.latitude !== 0 ? 'border-emerald-500 text-emerald-500 bg-emerald-50 dark:bg-emerald-900/15' : 'border-foreground/15 text-foreground/50 hover:border-foreground/30 hover:text-foreground'}`}
          >
            <Locate className="w-4 h-4" />
            {isLocating ? 'Locating...' : formData.latitude !== 0 ? 'GPS Pinned ✓' : 'Pin My GPS'}
          </button>
          <button
            onClick={() => setFormData(p => ({ ...p, is_default: !p.is_default }))} type="button"
            className={`h-11 flex items-center justify-center gap-2 rounded-xl border text-[9px] font-black uppercase tracking-[0.15em] transition-all ${formData.is_default ? 'border-foreground text-foreground bg-foreground/[0.05]' : 'border-foreground/15 text-foreground/50 hover:border-foreground/30'}`}
          >
            <Check className="w-4 h-4" />
            {formData.is_default ? 'Default ✓' : 'Set as Default'}
          </button>
        </div>
      </div>

      <div className="px-5 pb-5 flex gap-3">
        <button onClick={onCancel} className="flex-1 h-11 rounded-xl border border-foreground/12 text-[9px] font-black uppercase tracking-[0.15em] text-foreground/50 hover:text-foreground transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave} disabled={isSaving}
          className="flex-[2] h-11 rounded-xl bg-foreground text-background text-[9px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Save Address</>}
        </button>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────
// Order Progress Visual
// ─────────────────────────────────────────────
const OrderProgressVisual = ({ status }: { status: string }) => {
  const steps = [
    { id: 'placed', icon: ShoppingBag, label: 'Placed', color: '#3b82f6' },
    { id: 'confirmed', icon: CheckCircle2, label: 'Confirmed', color: '#6366f1' },
    { id: 'processing', icon: Package, label: 'Processing', color: '#f59e0b' },
    { id: 'shipped', icon: Truck, label: 'On the Way', color: '#8b5cf6' },
    { id: 'delivered', icon: Home, label: 'Delivered', color: '#10b981' },
  ];

  const statusMap: Record<string, number> = { pending: 0, placed: 0, confirmed: 1, paid: 1, processing: 2, shipped: 3, in_transit: 3, ready_for_pickup: 3, delivered: 4 };
  const currentIdx = statusMap[status] ?? 0;

  return (
    <div className="py-8 px-4">
      <div className="relative flex justify-between items-center">
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-foreground/8">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="h-full bg-foreground"
          />
        </div>
        {steps.map((step, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 + 0.2, duration: 0.4, type: 'spring' }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted || isCurrent ? 'bg-foreground border-foreground' : 'bg-background border-foreground/15'}`}
              >
                <Icon className={`w-4 h-4 ${isCompleted || isCurrent ? 'text-background' : 'text-foreground/25'}`} />
                {isCurrent && <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute inset-0 rounded-full bg-foreground" />}
              </motion.div>
              <p className={`text-[8px] font-black uppercase tracking-wider text-center whitespace-nowrap ${isCurrent ? 'text-foreground' : 'text-foreground/30'}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const OrderTracking = ({ order }: { order: Order }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [carrier, setCarrier] = useState<string | null>(null);

  useEffect(() => {
    const fetchTracking = async () => {
      const { data: shipment } = await supabase.from('shipments').select('*').eq('order_id', order.id).single();
      if (shipment) {
        setTrackingNumber(shipment.tracking_number);
        setCarrier(shipment.carrier);
        const { data: evts } = await supabase.from('shipment_events').select('*').eq('shipment_id', shipment.id).order('occurred_at', { ascending: false });
        if (evts) setEvents(evts);
      }
    };
    fetchTracking();
  }, [order.id]);

  const isCancelled = ['cancelled', 'refunded', 'failed'].includes(order.status);
  if (isCancelled) return (
    <div className="p-5 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-center gap-4">
      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center"><Ban className="w-5 h-5 text-red-500" /></div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-red-500">Order {order.status}</p>
        <p className="text-[9px] text-red-400 font-bold mt-0.5">{order.cancel_reason || order.reject_reason || "Transaction terminated."}</p>
      </div>
    </div>
  );

  return (
    <div>
      <OrderProgressVisual status={order.status} />
      {events.length > 0 && (
        <div className="mt-6 bg-foreground/[0.03] rounded-2xl p-5 border border-foreground/8">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-4">Live Updates</p>
          <div className="space-y-4">
            {events.map((ev, idx) => (
              <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.08 }} className="flex gap-3 relative">
                {idx !== events.length - 1 && <div className="absolute left-1.5 top-4 bottom-0 w-px bg-foreground/10" />}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 z-10 ${idx === 0 ? 'bg-foreground animate-pulse' : 'bg-foreground/20'}`} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-foreground">{ev.status.replace(/_/g, ' ')}</p>
                  {ev.notes && <p className="text-[9px] text-foreground/50 font-bold mt-0.5">{ev.notes}</p>}
                  <p className="text-[8px] font-mono text-foreground/30 mt-1">{new Date(ev.occurred_at).toLocaleString()}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      {(trackingNumber || carrier) && (
        <div className="mt-4 bg-foreground rounded-2xl p-5 flex justify-between items-center text-background">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-background/40 mb-1">Carrier</p>
            <p className="font-black text-sm">{carrier || 'Standard Delivery'}</p>
          </div>
          {trackingNumber && (
            <div className="text-right">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-background/40 mb-1">Tracking</p>
              <p className="font-mono font-black text-sm tracking-widest">{trackingNumber}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// PaymentInstructions
// ─────────────────────────────────────────────
const PaymentInstructions = ({ method, seller }: { method: string; seller: VendorProfile }) => {
  if (method === 'cash') return (
    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/15 rounded-xl border border-blue-100 dark:border-blue-900/30 text-[11px] text-blue-700 dark:text-blue-300 font-medium">
      Have exact cash ready for the delivery driver.
    </div>
  );
  const getLipaNumber = () => {
    if (seller.lipa_namba) return { num: seller.lipa_namba, type: 'Lipa Namba' };
    if (seller.mobile_number) return { num: seller.mobile_number, type: seller.mobile_operator || 'Mobile' };
    return null;
  };
  const lipa = getLipaNumber();
  return (
    <div className="mt-4 text-[11px] text-foreground/60 space-y-2">
      <p className="font-black uppercase tracking-wider text-foreground/50 text-[9px]">How to Pay</p>
      {method === 'lipa_namba' && lipa && (
        <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium bg-foreground/[0.04] p-4 rounded-xl">
          <li>Open mobile money (M-Pesa / Tigo / Airtel)</li>
          <li>Select "Pay Bills" or "Pay Merchant"</li>
          <li>Enter: <strong className="text-foreground font-mono">{lipa.num}</strong></li>
          <li>Enter the amount shown above</li>
          <li>Paste the Transaction ID below</li>
        </ol>
      )}
      {method === 'mobile_transfer' && seller.account_number && (
        <ol className="list-decimal list-inside space-y-1.5 pl-1 font-medium bg-foreground/[0.04] p-4 rounded-xl">
          <li>Open bank app or USSD</li>
          <li>Select "Bank Transfer"</li>
          <li>Bank: <strong className="text-foreground">{seller.bank_name}</strong></li>
          <li>Account: <strong className="text-foreground font-mono">{seller.account_number}</strong></li>
          <li>Name: <strong className="text-foreground">{seller.bank_account_name}</strong></li>
          <li>Paste Transaction ID below</li>
        </ol>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// CheckoutModal
// ─────────────────────────────────────────────
interface CheckoutModalProps {
  total: number; subtotal: number; vat: number; discount: number;
  onClose: () => void;
  onComplete: (details: { address: Address; paymentMethod: string; deliveryFee: number; note: string; paymentRef?: string; isGift?: boolean; giftMessage?: string; deliveryDate?: string; deliverySlot?: string }) => Promise<void>;
}

export const CheckoutModal = ({ total: initialTotal, subtotal, vat, discount, onClose, onComplete }: CheckoutModalProps) => {
  const { addresses, addAddress, cart } = useAppState();
  const { addToast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isAddingAddr, setIsAddingAddr] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliverySlot, setDeliverySlot] = useState('Standard');
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'lipa_namba' | 'mobile_transfer' | 'cash'>('lipa_namba');
  const [paymentRef, setPaymentRef] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [sellerDetails, setSellerDetails] = useState<VendorProfile[]>([]);
  const [areVendorsLoaded, setAreVendorsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddress) {
      setSelectedAddress(addresses.find(a => a.is_default) || addresses[0]);
    }
  }, [addresses]);

  useEffect(() => {
    const fetchSellers = async () => {
      const ids = Array.from(new Set(cart.map(i => i.seller_id)));
      if (!ids.length) { setAreVendorsLoaded(true); return; }
      try {
        const { data } = await supabase.from('vendor_profiles').select('*').in('seller_id', ids);
        if (data) setSellerDetails(data as VendorProfile[]);
      } catch (e) { console.error(e); }
      finally { setAreVendorsLoaded(true); }
    };
    fetchSellers();
  }, [cart]);

  const deliveryFeeTotal = useMemo(() => {
    const uids = Array.from(new Set(cart.map(i => i.seller_id)));
    return uids.reduce<number>((acc, sid) => acc + Number(sellerDetails.find(s => s.seller_id === sid)?.delivery_fee || 0), 0);
  }, [cart, sellerDetails]);

  const finalTotal = subtotal + vat + deliveryFeeTotal - discount;

  const groupedItems = useMemo(() => {
    const g: Record<string, CartItem[]> = {};
    cart.forEach(item => { if (!g[item.seller_id]) g[item.seller_id] = []; g[item.seller_id].push(item); });
    return g;
  }, [cart]);

  const nextDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; }), []);

  const handleComplete = async () => {
    if (!selectedAddress) return addToast("Select a delivery address", "error");
    if (paymentMethod === 'lipa_namba') {
      if (!senderPhone?.trim() || senderPhone.trim().length < 9) return addToast("Enter sender phone number", "error");
      if (!paymentRef?.trim() || paymentRef.trim().length < 4) return addToast("Enter transaction reference", "error");
    } else if (paymentMethod === 'mobile_transfer' && (!paymentRef?.trim() || paymentRef.trim().length < 4)) {
      return addToast("Enter bank transfer reference", "error");
    }
    setIsSubmitting(true);
    try {
      const methodLabel = paymentMethod === 'cash' ? 'Cash on Delivery' : paymentMethod === 'lipa_namba' ? 'Mobile Money' : 'Bank Transfer';
      const finalRef = senderPhone ? `${paymentRef} (from: ${senderPhone})` : paymentRef;
      await onComplete({ address: selectedAddress, paymentMethod: methodLabel, deliveryFee: deliveryFeeTotal, note: orderNote, paymentRef: finalRef, isGift, giftMessage, deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined, deliverySlot });
    } catch { addToast("Failed to process order", "error"); }
    finally { setIsSubmitting(false); }
  };

  const canProceed = selectedAddress && (
    step === 1 ||
    paymentMethod === 'cash' ||
    (paymentMethod === 'lipa_namba' && paymentRef.trim().length >= 4 && senderPhone.trim().length >= 9) ||
    (paymentMethod === 'mobile_transfer' && paymentRef.trim().length >= 4)
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-end md:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-5xl bg-background overflow-hidden flex flex-col md:flex-row border border-foreground/10"
          style={{
            height: '95dvh',
            borderRadius: 'clamp(16px, 3vw, 28px) clamp(16px, 3vw, 28px) 0 0',
          }}
        >
          {/* ── MOBILE: Collapsible summary strip ── */}
          <div className="md:hidden border-b border-foreground/8 bg-background z-30 flex-shrink-0">
            <button
              onClick={() => setShowMobileSummary(s => !s)}
              className="w-full px-5 py-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-foreground/40" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/50">{cart.length} items</span>
                {showMobileSummary ? <ChevronUp className="w-3 h-3 text-foreground/30" /> : <ChevronDown className="w-3 h-3 text-foreground/30" />}
              </div>
              <span className="text-base font-black text-foreground tracking-tight">{formatTZS(Math.round(finalTotal))}</span>
            </button>

            <AnimatePresence>
              {showMobileSummary && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 border-t border-foreground/8">
                    <div className="py-3 space-y-3 max-h-[28vh] overflow-y-auto">
                      {cart.map((item, i) => {
                        const price = getEffectiveUnitPrice(item);
                        return (
                          <div key={i} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-foreground/[0.05] flex-shrink-0">
                                <img src={item.selectedVariant?.image_url || item.images?.[0]} className="w-full h-full object-cover" alt="" />
                                <span className="absolute -top-0.5 -right-0.5 bg-foreground text-background text-[7px] font-black w-4 h-4 flex items-center justify-center rounded-full">{item.quantity}</span>
                              </div>
                              <span className="text-[10px] font-bold text-foreground/70 truncate">{item.name}</span>
                            </div>
                            <span className="text-[10px] font-black text-foreground flex-shrink-0">{formatTZS(price * item.quantity)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-3 border-t border-foreground/8 space-y-1.5">
                      <div className="flex justify-between text-[9px] font-bold text-foreground/40 uppercase tracking-wider"><span>Subtotal</span><span>{formatTZS(subtotal)}</span></div>
                      <div className="flex justify-between text-[9px] font-bold text-foreground/40 uppercase tracking-wider"><span>Delivery</span><span>{formatTZS(deliveryFeeTotal)}</span></div>
                      {discount > 0 && <div className="flex justify-between text-[9px] font-black text-emerald-500 uppercase tracking-wider"><span>Discount</span><span>-{formatTZS(discount)}</span></div>}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── MAIN AREA ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-5 md:px-8 py-4 md:py-5 border-b border-foreground/8 flex items-center justify-between bg-background">
              <div>
                <div className="flex items-center gap-2">
                  {step === 2 && (
                    <button onClick={() => setStep(1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors mr-1">
                      <ChevronLeft className="w-4 h-4 text-foreground" />
                    </button>
                  )}
                  <h2 className="text-[13px] font-black uppercase tracking-[0.18em] text-foreground">
                    {step === 1 ? 'Delivery' : 'Payment'}
                  </h2>
                </div>
                {/* Progress dots */}
                <div className="flex items-center gap-1.5 mt-2 ml-0.5">
                  <div className="h-[3px] w-12 rounded-full bg-foreground" />
                  <div className={`h-[3px] w-12 rounded-full transition-all duration-300 ${step === 2 ? 'bg-foreground' : 'bg-foreground/15'}`} />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-foreground/30 ml-1">Step {step}/2</span>
                </div>
              </div>
              <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full bg-foreground/[0.05] hover:bg-foreground/10 transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-foreground/50" />
              </button>
            </div>

            {/* Scrollable form */}
            <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="p-5 md:p-8 space-y-8">

                {/* ── STEP 1: Delivery ── */}
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">

                      {/* Address */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5" /> Delivery Address
                          </h3>
                          {!isAddingAddr && (
                            <button onClick={() => setIsAddingAddr(true)} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-foreground/40 hover:text-foreground transition-colors border border-foreground/12 rounded-lg px-3 py-1.5">
                              <Plus className="w-3 h-3" /> Add New
                            </button>
                          )}
                        </div>

                        {isAddingAddr ? (
                          <AddressForm onSave={async d => { await addAddress(d); setIsAddingAddr(false); }} onCancel={() => setIsAddingAddr(false)} />
                        ) : (
                          <div className="space-y-3">
                            {addresses.length === 0 && (
                              <div className="text-center py-10 border-2 border-dashed border-foreground/10 rounded-2xl">
                                <MapPin className="w-8 h-8 mx-auto mb-3 text-foreground/20" />
                                <p className="text-[10px] font-black uppercase tracking-wider text-foreground/30">No saved addresses</p>
                                <button onClick={() => setIsAddingAddr(true)} className="mt-3 text-[9px] font-black uppercase tracking-wider text-foreground border-b border-foreground/30 pb-px">Add one now</button>
                              </div>
                            )}
                            {addresses.map(addr => (
                              <motion.div
                                key={addr.id} onClick={() => setSelectedAddress(addr)}
                                whileTap={{ scale: 0.99 }}
                                className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedAddress?.id === addr.id ? 'border-foreground bg-background shadow-lg' : 'border-foreground/8 bg-foreground/[0.02] hover:border-foreground/20'}`}
                              >
                                {selectedAddress?.id === addr.id && (
                                  <div className="absolute top-0 right-0 w-8 h-8 bg-foreground flex items-center justify-center rounded-bl-xl rounded-tr-2xl">
                                    <Check className="w-3.5 h-3.5 text-background" />
                                  </div>
                                )}
                                <div className="flex items-center gap-3 mb-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${addr.label.toLowerCase().includes('home') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' : 'bg-foreground/[0.06] text-foreground/40'}`}>
                                    {addr.label.toLowerCase().includes('home') ? <Home className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-foreground">{addr.label}</span>
                                  {addr.is_default && <span className="text-[8px] font-black uppercase tracking-wider bg-foreground/8 text-foreground/40 px-2 py-0.5 rounded-full">Default</span>}
                                </div>
                                <p className="text-[12px] font-bold text-foreground ml-11 leading-tight">{addr.street}</p>
                                <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider ml-11 mt-0.5">{addr.city}{addr.postal_code ? ` • ${addr.postal_code}` : ''}</p>
                                {addr.phone && <p className="text-[10px] text-foreground/40 font-bold ml-11 mt-0.5 font-mono">{addr.phone}</p>}
                                {addr.landmark && <p className="text-[9px] text-foreground/30 ml-11 mt-1 flex items-center gap-1"><Navigation className="w-2.5 h-2.5" />{addr.landmark}</p>}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </section>

                      {/* Delivery Schedule */}
                      <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground mb-4 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" /> Delivery Schedule
                        </h3>
                        <div className="bg-foreground/[0.03] border border-foreground/8 rounded-2xl p-4 space-y-4">
                          {/* Date picker */}
                          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
                            {nextDays.map((d, i) => {
                              const iso = d.toISOString().split('T')[0];
                              const isSelected = deliveryDate === iso;
                              return (
                                <motion.button key={i} whileTap={{ scale: 0.95 }} onClick={() => setDeliveryDate(iso)}
                                  className={`flex flex-col items-center min-w-[64px] h-[68px] rounded-xl border-2 transition-all flex-shrink-0 ${isSelected ? 'border-foreground bg-foreground text-background' : 'border-foreground/10 text-foreground/50 hover:border-foreground/25'}`}
                                >
                                  <span className="text-[8px] font-black uppercase tracking-wider mt-2">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                  <span className="text-xl font-black leading-tight">{d.getDate()}</span>
                                  <span className="text-[7px] font-bold opacity-60">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                                </motion.button>
                              );
                            })}
                          </div>
                          {/* Slot picker */}
                          <div className="grid grid-cols-2 gap-2">
                            {['Morning (8-12)', 'Afternoon (12-4)', 'Evening (4-8)', 'Standard'].map(slot => (
                              <button key={slot} onClick={() => setDeliverySlot(slot)}
                                className={`h-10 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${deliverySlot === slot ? 'bg-foreground text-background' : 'bg-foreground/[0.04] text-foreground/40 hover:bg-foreground/[0.08]'}`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      </section>

                      {/* Gift toggle */}
                      <section>
                        <button onClick={() => setIsGift(g => !g)} className="flex items-center gap-3 w-full">
                          <div className={`w-10 h-6 rounded-full relative transition-colors ${isGift ? 'bg-foreground' : 'bg-foreground/15'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow-sm transform transition-transform ${isGift ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                            <Gift className="w-3.5 h-3.5 text-indigo-400" /> Send as Gift
                          </span>
                        </button>
                        <AnimatePresence>
                          {isGift && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-4">
                              <textarea
                                placeholder="Write a gift message..."
                                value={giftMessage}
                                onChange={e => setGiftMessage(e.target.value)}
                                className="w-full h-24 bg-foreground/[0.03] border border-foreground/10 rounded-xl p-4 text-sm font-medium text-foreground placeholder:text-foreground/30 outline-none focus:border-foreground/25 transition-all resize-none"
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </section>
                    </motion.div>
                  )}

                  {/* ── STEP 2: Payment ── */}
                  {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">

                      {/* Payment method selector */}
                      <section>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground mb-4 flex items-center gap-2">
                          <Wallet className="w-3.5 h-3.5" /> Payment Method
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: 'lipa_namba', label: 'Mobile Money', icon: Smartphone, desc: 'M-Pesa · Tigo · Airtel' },
                            { id: 'mobile_transfer', label: 'Bank Transfer', icon: Landmark, desc: 'Direct Bank' },
                            { id: 'cash', label: 'Cash on Delivery', icon: Banknote, desc: 'Pay at Door' },
                          ].map(m => (
                            <motion.button key={m.id} whileTap={{ scale: 0.97 }} onClick={() => setPaymentMethod(m.id as any)}
                              className={`relative flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${paymentMethod === m.id ? 'border-foreground bg-foreground/[0.04]' : 'border-foreground/8 hover:border-foreground/20'}`}
                            >
                              {paymentMethod === m.id && <div className="absolute top-2 right-2 w-4 h-4 bg-foreground rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-background" /></div>}
                              <m.icon className={`w-5 h-5 mb-2 ${paymentMethod === m.id ? 'text-foreground' : 'text-foreground/30'}`} />
                              <p className={`text-[8px] font-black uppercase tracking-wider leading-tight ${paymentMethod === m.id ? 'text-foreground' : 'text-foreground/40'}`}>{m.label}</p>
                            </motion.button>
                          ))}
                        </div>
                      </section>

                      {/* Payment details panel */}
                      {paymentMethod !== 'cash' && (
                        <section className="bg-foreground rounded-2xl overflow-hidden">
                          <div className="p-5 md:p-6">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-background/40 mb-4">Payment Channels</p>
                            <div className="space-y-3 mb-6">
                              {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([sid, items]) => {
                                const seller = sellerDetails.find(s => s.seller_id === sid);
                                const itemSum = items.reduce((acc, i) => acc + getEffectiveUnitPrice(i) * i.quantity, 0);
                                const sellerTotal = itemSum + (seller?.delivery_fee || 0);
                                let payName = seller?.store_name || 'Merchant';
                                let payNumber = 'Contact Support';
                                let payLabel = 'Account';
                                if (paymentMethod === 'mobile_transfer') {
                                  payName = seller?.bank_account_name || seller?.store_name || 'Merchant';
                                  payNumber = seller?.account_number || 'Not Listed';
                                  payLabel = seller?.bank_name || 'Bank';
                                } else {
                                  if (seller?.lipa_namba) { payNumber = seller.lipa_namba; payLabel = 'Lipa Namba'; }
                                  else if (seller?.mobile_number) { payNumber = seller.mobile_number; payLabel = seller.mobile_operator || 'Mobile'; payName = seller.mobile_name || payName; }
                                }
                                return (
                                  <div key={sid} className="bg-white/8 rounded-xl p-4 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[8px] font-black uppercase tracking-wider text-background/40 mb-1">{payName} • {formatTZS(Math.round(sellerTotal))}</p>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9px] font-bold bg-white/15 text-background px-2 py-0.5 rounded-md uppercase">{payLabel}</span>
                                        <span className="font-mono font-black text-background text-sm tracking-wider">{payNumber}</span>
                                      </div>
                                    </div>
                                    <button onClick={() => { navigator.clipboard.writeText(String(payNumber)); addToast("Copied!", "success"); }}
                                      className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                                    >
                                      <Copy className="w-4 h-4 text-background/70" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Transaction entry */}
                            <div className="space-y-3">
                              <div className="relative">
                                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-background/30" />
                                <input
                                  placeholder="Sender Phone (optional)"
                                  value={senderPhone}
                                  onChange={e => setSenderPhone(e.target.value)}
                                  className="w-full h-11 bg-black/25 border border-white/10 rounded-xl pl-11 text-[11px] font-mono font-bold text-white placeholder:text-white/25 outline-none focus:border-white/30 transition-all"
                                />
                              </div>
                              <div className="relative">
                                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-background/30" />
                                <input
                                  placeholder="TRANSACTION ID"
                                  value={paymentRef}
                                  onChange={e => setPaymentRef(e.target.value.toUpperCase())}
                                  className="w-full h-13 bg-black/25 border border-white/15 rounded-xl pl-11 text-[12px] font-mono font-black tracking-[0.18em] text-white placeholder:text-white/20 uppercase outline-none focus:border-white/40 transition-all"
                                  style={{ height: '52px' }}
                                />
                              </div>
                            </div>
                            {sellerDetails.length === 1 && <PaymentInstructions method={paymentMethod} seller={sellerDetails[0]} />}
                          </div>
                        </section>
                      )}

                      {/* Note */}
                      <section>
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-2 block flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3" /> Driver Note
                        </label>
                        <textarea
                          placeholder="Gate code, specific directions, call before delivery..."
                          value={orderNote}
                          onChange={e => setOrderNote(e.target.value)}
                          className="w-full h-20 bg-foreground/[0.04] border border-foreground/10 rounded-xl p-4 text-sm font-medium text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/25 transition-all resize-none"
                        />
                      </section>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom spacer for action bar */}
              <div className="h-24" />
            </div>

            {/* ── Action bar ── */}
            <div
              className="flex-shrink-0 bg-background border-t border-foreground/8 px-5 md:px-8 flex gap-3"
              style={{ paddingTop: '12px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => step === 1 ? setStep(2) : handleComplete()}
                disabled={!canProceed || isSubmitting}
                className="flex-1 h-13 rounded-xl bg-foreground text-background text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 group disabled:opacity-50 transition-opacity"
                style={{ height: '52px' }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : step === 1 ? (
                  <>Continue to Payment <ArrowRight className="w-4 h-4 stroke-[2] group-hover:translate-x-0.5 transition-transform" /></>
                ) : (
                  <><Lock className="w-4 h-4 stroke-[2]" />Confirm Order • {formatTZS(Math.round(finalTotal))}</>
                )}
              </motion.button>
            </div>
          </div>

          {/* ── DESKTOP: Receipt sidebar ── */}
          <div className="hidden md:flex w-[340px] lg:w-[380px] bg-foreground/[0.025] border-l border-foreground/8 flex-col flex-shrink-0">
            <div className="p-8 flex-1 overflow-y-auto">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-foreground/40 mb-6 flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5" /> Receipt Preview
              </p>
              <div className="space-y-4 mb-6">
                {cart.map((item, i) => {
                  const price = getEffectiveUnitPrice(item);
                  return (
                    <div key={i} className="flex gap-3 items-center group">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-foreground/[0.05] border border-foreground/8 flex-shrink-0 relative">
                        <img src={item.selectedVariant?.image_url || item.images?.[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                        <span className="absolute bottom-0 right-0 bg-foreground text-background text-[7px] px-1 py-0.5 font-black rounded-tl-md">{item.quantity}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-tight truncate text-foreground">{item.name}</p>
                        <p className="text-[9px] text-foreground/40 font-bold mt-0.5">{formatTZS(price * item.quantity)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-foreground/8 p-8 space-y-3">
              {[
                { label: 'Subtotal', value: formatTZS(subtotal) },
                { label: 'VAT (18%)', value: formatTZS(Math.round(vat)) },
                { label: 'Delivery', value: areVendorsLoaded ? formatTZS(deliveryFeeTotal) : '...' },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-[10px] font-bold text-foreground/40 uppercase tracking-wider">
                  <span>{row.label}</span><span className="text-foreground/60">{row.value}</span>
                </div>
              ))}
              {discount > 0 && (
                <div className="flex justify-between text-[10px] font-black text-emerald-500 uppercase tracking-wider">
                  <span>Discount</span><span>-{formatTZS(discount)}</span>
                </div>
              )}
              <div className="pt-4 border-t border-foreground/8 flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60">Total Due</span>
                <span className="text-2xl font-black tracking-tight text-foreground leading-none">{formatTZS(Math.round(finalTotal))}</span>
              </div>
              <div className="flex items-center gap-2 text-[8px] font-bold text-foreground/25 uppercase tracking-wider pt-2">
                <Lock className="w-3 h-3" /> Encrypted & Secure
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
