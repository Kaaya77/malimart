import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, MapPin, Truck, ShieldCheck, X, 
  Plus, Smartphone, Banknote, Home, Receipt, 
  ShoppingBag, Store, Info, ChevronLeft, ChevronDown, ChevronUp,
  Package, ArrowRight, CheckCircle2, Clock, Wallet,
  Zap, Hash, Ban, Loader2, Copy, Calendar, Gift, MessageSquare, AlertCircle,
  CreditCard, Landmark, PenLine, Locate, Navigation, ShoppingCart, HelpCircle,
  Phone
} from 'lucide-react';
import { Button, Input, Label, Card, useToast, Badge, Switch, Textarea } from './UI';
import { formatTZS, CURRENCY } from '../constants';
import { useAppState } from '../context/AppContext';
import { Order, OrderStatus, Address, VendorProfile, CartItem } from '../types';
import { supabase } from '../services/supabaseClient';

// ───────────────────────────────────────────────
// Shared price helper — must match CartPage & CartDrawer
// ───────────────────────────────────────────────
const getEffectiveUnitPrice = (item: CartItem): number => {
  if (typeof item.price_at_add === 'number' && item.price_at_add > 0) {
    return item.price_at_add;
  }
  if (item.selectedVariant) {
    return item.selectedVariant.sale_price ?? item.selectedVariant.base_price ?? 0;
  }
  return item.price ?? 0;
};

// ───────────────────────────────────────────────
// Address Form (your original — unchanged)
// ───────────────────────────────────────────────
const AddressForm = ({ initialData, onSave, onCancel }: { initialData?: Partial<Address>, onSave: (data: Omit<Address, 'id' | 'user_id' | 'created_at'>) => Promise<void>, onCancel: () => void }) => {
  const [formData, setFormData] = useState({
    label: initialData?.label || 'Home',
    street: initialData?.street || '',
    city: initialData?.city || '',
    phone: initialData?.phone || '',
    postal_code: initialData?.postal_code || '',
    landmark: initialData?.landmark || '',
    is_default: initialData?.is_default || false,
    latitude: initialData?.latitude || 0,
    longitude: initialData?.longitude || 0
  });
  const { addToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const validatePhone = (phone: string) => /^(\+255|0)[67]\d{8}$/.test(phone.replace(/\s/g, ''));

  const handleLocate = () => {
    if (!navigator.geolocation) return addToast("Geolocation not supported", "error");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }));
        setIsLocating(false);
        addToast("Location pinned successfully", "success");
      },
      (err) => {
        console.error(err);
        setIsLocating(false);
        addToast("Could not fetch location", "error");
      }
    );
  };

  const handleSave = async () => {
    if (!formData.label.trim()) return addToast('Label is required (e.g. Home)', 'error');
    if (!formData.street.trim()) return addToast('Street/Building is required', 'error');
    if (!formData.phone.trim() || !validatePhone(formData.phone)) return addToast('Valid TZ phone required (e.g. 07XXXXXXXX)', 'error');
    if (!formData.city) return addToast('Region is required', 'error');
    
    try {
      setIsSaving(true);
      await onSave({
        label: formData.label,
        street: formData.street,
        city: formData.city,
        phone: formData.phone,
        postal_code: formData.postal_code,
        landmark: formData.landmark,
        is_default: formData.is_default,
        latitude: formData.latitude,
        longitude: formData.longitude,
        geo: { lat: formData.latitude, lng: formData.longitude }
      });
      addToast('Address saved successfully!', 'success');
    } catch (err: any) { 
      addToast(err.message || 'Failed to save address.', 'error'); 
    } finally { 
      setIsSaving(false); 
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-10 rounded-[2rem] bg-background border border-foreground/8 shadow-xl shadow-foreground/5 animate-in zoom-in-95 duration-500">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h3 className="text-xl font-serif font-light tracking-tight text-foreground">Delivery Point</h3>
          <p className="text-xs text-foreground/40 uppercase tracking-[0.2em] font-bold">Where should we send your items?</p>
        </div>
        <button type="button" onClick={onCancel} className="p-2 hover:bg-foreground/[0.06] rounded-full transition-colors">
          <X className="w-5 h-5 stroke-[1] text-foreground" />
        </button>
      </div>
      
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-5 md:gap-8">
          <div className="space-y-3">
            <Label className="text-[10px] uppercase tracking-widest font-black text-foreground/40 pl-1">Address Label</Label>
            <div className="relative">
              <Input 
                placeholder="e.g. Home, Office" 
                value={formData.label || ''} 
                onChange={(e:any) => setFormData({...formData, label: e.target.value})} 
                className="h-14 rounded-2xl bg-foreground/[0.04] border-none focus:ring-2 focus:ring-foreground/30 transition-all pl-12" 
              />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20" />
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-[10px] uppercase tracking-widest font-black text-foreground/40 pl-1">Contact Phone</Label>
            <div className="relative">
              <Input 
                placeholder="07XXXXXXXX" 
                value={formData.phone || ''} 
                onChange={(e:any) => setFormData({...formData, phone: e.target.value})} 
                className="h-14 rounded-2xl bg-foreground/[0.04] border-none focus:ring-2 focus:ring-foreground/30 transition-all pl-12 font-mono" 
              />
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:gap-8">
          <div className="space-y-3">
            <Label className="text-[10px] uppercase tracking-widest font-black text-foreground/40 pl-1">Region</Label>
            <select 
              className="w-full h-14 bg-foreground/[0.04] border-none rounded-2xl px-6 text-xs font-bold outline-none focus:ring-2 focus:ring-foreground transition-all appearance-none" 
              value={formData.city || ''} 
              onChange={e => setFormData({...formData, city: e.target.value})}
            >
              <option value="" disabled>Select a Region</option>
              {['Dar es Salaam', 'Arusha', 'Zanzibar', 'Mwanza', 'Dodoma', 'Kilimanjaro', 'Tanga', 'Mbeya', 'Morogoro'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            <Label className="text-[10px] uppercase tracking-widest font-black text-foreground/40 pl-1">Postal Code (Optional)</Label>
            <Input 
              value={formData.postal_code || ''} 
              onChange={(e:any) => setFormData({...formData, postal_code: e.target.value})} 
              placeholder="e.g. 11101" 
              className="h-14 rounded-2xl bg-foreground/[0.04] border-none focus:ring-2 focus:ring-foreground/30 transition-all" 
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] uppercase tracking-widest font-black text-foreground/40 pl-1">Street / Building / House No.</Label>
          <div className="relative">
            <Input 
              value={formData.street || ''} 
              onChange={(e:any) => setFormData({...formData, street: e.target.value})} 
              placeholder="e.g. 14 Barack Obama Dr, Twiga Towers" 
              className="h-14 rounded-2xl bg-foreground/[0.04] border-none focus:ring-2 focus:ring-foreground/30 transition-all pl-12" 
            />
            <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20" />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-[10px] uppercase tracking-widest font-black text-foreground/40 pl-1">Nearby Landmark</Label>
          <div className="relative">
            <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/20" />
            <Input 
              value={formData.landmark || ''} 
              onChange={(e:any) => setFormData({...formData, landmark: e.target.value})} 
              placeholder="e.g. Next to Total Gas Station" 
              className="h-14 rounded-2xl bg-foreground/[0.04] border-none focus:ring-2 focus:ring-foreground/30 transition-all pl-12" 
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-foreground/[0.03] border border-foreground/8">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${formData.latitude !== 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-foreground/[0.04] text-foreground/40'}`}>
              <Locate className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Precise Location</p>
              <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-black">
                {formData.latitude !== 0 ? 'GPS Coordinates Pinned' : 'Not yet captured'}
              </p>
            </div>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleLocate} 
            isLoading={isLocating} 
            className="h-12 px-6 rounded-full border-foreground/10 hover:bg-foreground hover:text-background transition-all text-[10px] font-black uppercase tracking-widest"
          >
            Capture GPS
          </Button>
        </div>

        <div className="flex items-center gap-4 p-6 rounded-3xl bg-foreground/[0.03] border border-foreground/8">
          <Switch checked={formData.is_default} onCheckedChange={(v: boolean) => setFormData({...formData, is_default: v})} />
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground">Default Address</p>
            <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-black">Use this for future orders</p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button 
          variant="ghost" 
          onClick={onCancel} 
          className="flex-1 h-16 rounded-3xl text-foreground/40 hover:text-rose-500 hover:bg-rose-500/5 transition-all font-bold"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          className="flex-[2] h-16 rounded-3xl bg-foreground text-background shadow-2xl shadow-foreground/20 hover:scale-[1.02] active:scale-95 transition-all text-xs font-black uppercase tracking-[0.2em]" 
          isLoading={isSaving}
        >
          Save & Use Address
        </Button>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────
// OrderTracking (your original — unchanged)
// ───────────────────────────────────────────────
const OrderProgressVisual = ({ status }: { status: string }) => {
  const steps = [
    { id: 'placed', icon: ShoppingBag, label: 'Order Placed', color: 'bg-blue-500' },
    { id: 'confirmed', icon: CheckCircle2, label: 'Confirmed', color: 'bg-indigo-500' },
    { id: 'processing', icon: Package, label: 'Processing', color: 'bg-amber-500' },
    { id: 'shipped', icon: Truck, label: 'On the Way', color: 'bg-purple-500' },
    { id: 'delivered', icon: Home, label: 'Delivered', color: 'bg-emerald-500' }
  ];

  const getStatusIndex = (s: string) => {
    const statusMap: Record<string, number> = {
      'pending': 0, 'placed': 0,
      'confirmed': 1, 'paid': 1,
      'processing': 2,
      'shipped': 3, 'in_transit': 3, 'ready_for_pickup': 3,
      'delivered': 4
    };
    return statusMap[s] ?? 0;
  };

  const currentIdx = getStatusIndex(status);

  return (
    <div className="py-12 px-4">
      <div className="relative flex justify-between items-center max-w-2xl mx-auto">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-foreground/[0.06] -translate-y-1/2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(currentIdx / (steps.length - 1)) * 100}%` }}
            transition={{ duration: 1.5, ease: "circOut" }}
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"
          />
        </div>

        {steps.map((step, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.2 : 1,
                  backgroundColor: isCompleted || isCurrent ? 'var(--tw-bg-opacity)' : 'rgba(241, 245, 249, 1)',
                }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-4 border-background transition-colors duration-500 ${isCompleted || isCurrent ? step.color : 'bg-foreground/[0.06] text-foreground/30'}`}
              >
                <Icon className={`w-5 h-5 ${isCompleted || isCurrent ? 'text-white' : 'text-foreground/30'}`} />
                
                {isCurrent && (
                  <motion.div 
                    layoutId="active-glow"
                    className={`absolute inset-0 rounded-2xl blur-xl opacity-50 -z-10 ${step.color}`}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
              </motion.div>
              
              <div className="absolute top-14 whitespace-nowrap text-center">
                <p className={`text-[10px] font-black uppercase tracking-widest ${isCurrent ? 'text-foreground' : 'text-foreground/30'}`}>
                  {step.label}
                </p>
                {isCurrent && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center mt-1"
                  >
                    <div className="flex gap-1">
                      {[1, 2, 3].map(dot => (
                        <motion.div 
                          key={dot}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ repeat: Infinity, duration: 1, delay: dot * 0.2 }}
                          className={`w-1 h-1 rounded-full ${step.color}`}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
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
        const { data: shipmentEvents } = await supabase.from('shipment_events').select('*').eq('shipment_id', shipment.id).order('occurred_at', { ascending: false });
        if (shipmentEvents) {
          setEvents(shipmentEvents);
        }
      }
    };
    fetchTracking();
  }, [order.id]);

  const getStepIndex = (status: OrderStatus) => {
    if (status === 'pending' || status === 'placed') return 0;
    if (status === 'processing' || status === 'confirmed' || status === 'paid') return 1;
    if (status === 'ready_for_pickup' || status === 'shipped' || status === 'in_transit') return 2;
    if (status === 'delivered') return 3;
    return 0;
  };

  const currentIdx = getStepIndex(order.status as OrderStatus);
  const isCancelled = ['cancelled', 'refunded', 'failed'].includes(order.status);
  
  if (isCancelled) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-[2rem] border border-red-100 dark:border-red-900/30 flex items-center gap-4">
        <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600"><Ban className="w-6 h-6"/></div>
        <div>
          <h4 className="font-black text-sm text-red-600 uppercase tracking-widest">Order {order.status}</h4>
          <p className="text-[10px] font-bold text-red-400 uppercase mt-1">
            {order.cancel_reason || order.reject_reason || "This transaction has been terminated."}
          </p>
        </div>
      </div>
    );
  }

  const stepIcons = [
    { id: 'pending', icon: Clock, label: 'Placed' },
    { id: 'processing', icon: Package, label: 'Processing' },
    { id: 'shipped', icon: Truck, label: 'En Route' },
    { id: 'delivered', icon: Home, label: 'Delivered' }
  ];

  return (
    <div className="relative pt-2">
      <OrderProgressVisual status={order.status} />
      
      <div className="mt-12 space-y-4">
        {events.length > 0 && (
          <div className="bg-foreground/[0.03] rounded-3xl p-6 border border-foreground/8">
            <h5 className="text-[10px] font-black uppercase tracking-widest text-foreground/40 mb-4">Live Updates</h5>
            <div className="space-y-4">
              {events.map((ev, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  key={ev.id} 
                  className="flex gap-4 relative"
                >
                  {idx !== events.length - 1 && <div className="absolute left-2 top-5 bottom-0 w-px bg-foreground/10" />}
                  <div className={`w-4 h-4 rounded-full border-2 border-background shrink-0 z-10 ${idx === 0 ? 'bg-blue-500 animate-pulse' : 'bg-foreground/20'}`} />
                  <div>
                    <p className="text-xs font-bold text-foreground">{ev.status.replace(/_/g, ' ').toUpperCase()}</p>
                    <p className="text-[10px] text-foreground/50 mt-0.5">{ev.notes}</p>
                    <p className="text-[8px] font-mono opacity-40 mt-1">{new Date(ev.occurred_at).toLocaleString()}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {(trackingNumber || carrier) && (
          <div className="bg-foreground rounded-3xl p-6 text-background flex justify-between items-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-background/40 mb-1">Carrier Details</p>
              <p className="font-bold text-sm">{carrier || 'Standard Delivery'}</p>
            </div>
            {trackingNumber && (
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-background/40 mb-1">Tracking ID</p>
                <p className="font-mono font-bold text-sm tracking-widest">{trackingNumber}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────
// PaymentInstructions (your original — unchanged)
// ───────────────────────────────────────────────
const PaymentInstructions = ({ method, seller }: { method: string, seller: VendorProfile }) => {
  if (method === 'cash') {
    return (
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-xs text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20">
        <p className="font-bold">You've selected Cash on Delivery. Please have the exact amount ready for the driver.</p>
      </div>
    );
  }

  const getLipaNumber = () => {
    if (seller.lipa_namba) return { num: seller.lipa_namba, type: 'Lipa Namba' };
    if (seller.mobile_number) return { num: seller.mobile_number, type: seller.mobile_operator || 'Mobile' };
    return null;
  };

  const lipa = getLipaNumber();

  return (
    <div className="mt-6 space-y-4 text-xs text-foreground/60">
      <div className="flex items-center gap-2 font-bold text-foreground">
        <HelpCircle className="w-4 h-4 text-foreground" />
        <span>How to Pay</span>
      </div>
      {method === 'lipa_namba' && lipa && (
        <ol className="list-decimal list-inside space-y-2 pl-2 font-medium bg-foreground/[0.05] p-4 rounded-2xl">
          <li>Go to your mobile money menu (M-Pesa, Tigo Pesa, etc.).</li>
          <li>Select "Pay Bills" or "Pay Merchant".</li>
          <li>Enter Business/Till Number: <strong className="text-foreground font-mono">{lipa.num}</strong></li>
          <li>Enter the amount for this seller.</li>
          <li>Enter the Transaction ID you receive into the field above.</li>
        </ol>
      )}
      {method === 'mobile_transfer' && seller.account_number && (
        <ol className="list-decimal list-inside space-y-2 pl-2 font-medium bg-foreground/[0.05] p-4 rounded-2xl">
          <li>Open your bank app or USSD menu.</li>
          <li>Select "Bank Transfer".</li>
          <li>Bank: <strong className="text-foreground">{seller.bank_name}</strong></li>
          <li>Account Number: <strong className="text-foreground font-mono">{seller.account_number}</strong></li>
          <li>Account Name: <strong className="text-foreground">{seller.bank_account_name}</strong></li>
          <li>Enter the Transaction ID you receive into the field above.</li>
        </ol>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────
// Checkout Modal — full replaceable version
// ───────────────────────────────────────────────
interface CheckoutModalProps {
  total: number;
  subtotal: number;
  vat: number;
  discount: number;
  onClose: () => void;
  onComplete: (details: { 
    address: Address; 
    paymentMethod: string; 
    deliveryFee: number; 
    note: string; 
    paymentRef?: string;
    isGift?: boolean;
    giftMessage?: string;
    deliveryDate?: string;
    deliverySlot?: string;
  }) => Promise<void>;
}

export const CheckoutModal = ({ total: initialTotal, subtotal, vat, discount, onClose, onComplete }: CheckoutModalProps) => {
  const { addresses, addAddress, cart } = useAppState();
  const { addToast } = useToast();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [isAddingAddr, setIsAddingAddr] = useState(false);
  
  const [orderNote, setOrderNote] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliverySlot, setDeliverySlot] = useState<string>('Standard');
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'lipa_namba'|'mobile_transfer'|'cash'>('lipa_namba');
  const [paymentRef, setPaymentRef] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [sellerDetails, setSellerDetails] = useState<VendorProfile[]>([]);
  const [areVendorsLoaded, setAreVendorsLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  useEffect(() => { 
    if (addresses.length > 0 && !selectedAddress) { 
      const def = addresses.find(a => a.is_default); 
      setSelectedAddress(def || addresses[0]); 
    } 
  }, [addresses]);

  useEffect(() => {
    const fetchSellerData = async () => {
      const sellerIds = Array.from(new Set(cart.map(i => i.seller_id)));
      if (sellerIds.length === 0) { setAreVendorsLoaded(true); return; }
      
      try {
        const { data } = await supabase.from('vendor_profiles').select('*').in('seller_id', sellerIds);
        if (data) setSellerDetails(data as VendorProfile[]);
      } catch (err) { console.error(err); } 
      finally { setAreVendorsLoaded(true); }
    };
    fetchSellerData();
  }, [cart]);

  const deliveryFeeTotal = useMemo((): number => {
    const uniqueSellers = Array.from(new Set(cart.map(i => i.seller_id)));
    return uniqueSellers.reduce<number>((acc, sid) => {
      const seller = sellerDetails.find(s => s.seller_id === sid);
      return acc + (Number(seller?.delivery_fee || 0));
    }, 0);
  }, [cart, sellerDetails]);

  const finalTotal = subtotal + vat + deliveryFeeTotal - discount;

  const groupedItems = useMemo(() => {
    const groups: Record<string, CartItem[]> = {};
    cart.forEach(item => {
      if (!groups[item.seller_id]) groups[item.seller_id] = [];
      groups[item.seller_id].push(item);
    });
    return groups;
  }, [cart]);

  const nextDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for(let i=1; i<=7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const handleComplete = async () => {
    if (!selectedAddress) return addToast("Please select a delivery address", "error");
    
    if (paymentMethod === 'lipa_namba') {
      if (!senderPhone || senderPhone.trim().length < 9) {
        return addToast("Please enter a valid sender phone number", "error");
      }
      if (!paymentRef || paymentRef.trim().length < 4) {
        return addToast("Please enter the transaction reference code", "error");
      }
    } else if (paymentMethod === 'mobile_transfer') {
      if (!paymentRef || paymentRef.trim().length < 4) {
        return addToast("Please enter the bank transfer reference", "error");
      }
    }
    
    setIsSubmitting(true);
    try {
      const methodLabel = paymentMethod === 'cash' ? 'Cash on Delivery' : paymentMethod === 'lipa_namba' ? 'Mobile Money' : 'Bank Transfer';
      
      const finalRef = senderPhone ? `${paymentRef} (from: ${senderPhone})` : paymentRef;

      await onComplete({ 
        address: selectedAddress, 
        paymentMethod: methodLabel, 
        deliveryFee: deliveryFeeTotal, 
        note: orderNote, 
        paymentRef: finalRef,
        isGift,
        giftMessage,
        deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : undefined,
        deliverySlot
      });
    } catch (err) { 
      console.error(err);
      addToast("Failed to process order", "error"); 
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/75 backdrop-blur-xl animate-in fade-in">
      <div className="relative w-full max-w-7xl h-[95dvh] md:h-[90vh] bg-background md:rounded-[2.5rem] rounded-t-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-foreground/8">
        
        {/* Mobile: Collapsible Order Summary */}
        <div className="md:hidden border-b border-foreground/8 bg-background/90 backdrop-blur-md z-30">
          <button 
            onClick={() => setShowMobileSummary(!showMobileSummary)}
            className="w-full p-4 flex justify-between items-center"
          >
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground/50">
              <ShoppingCart className="w-4 h-4" /> 
              <span>{showMobileSummary ? 'Hide' : 'Show'} Order Summary</span>
              {showMobileSummary ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
            </div>
            <span className="font-black text-lg font-display tracking-tight text-foreground">{formatTZS(Math.round(finalTotal))}</span>
          </button>
          {showMobileSummary && (
            <div className="px-4 pb-4 animate-in slide-in-from-top-2 border-t border-foreground/8">
              <div className="py-3 space-y-3 max-h-[25vh] overflow-y-auto no-scrollbar">
                {cart.map((item, i) => {
                  const price = getEffectiveUnitPrice(item);
                  return (
                    <div key={i} className="flex justify-between items-start text-xs">
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 bg-foreground/[0.06] rounded-lg overflow-hidden shrink-0">
                          <img src={item.selectedVariant?.image_url || item.images?.[0]} className="w-full h-full object-cover" />
                          <span className="absolute -top-1 -right-1 bg-foreground text-background text-[8px] px-1 rounded-bl-md font-bold">{item.quantity}</span>
                        </div>
                        <span className="font-bold text-foreground/70 w-32 truncate">{item.name}</span>
                      </div>
                      <span className="font-bold">{formatTZS(price * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="pt-3 border-t border-foreground/8 space-y-2">
                <div className="flex justify-between text-[10px] text-foreground/50 uppercase font-bold"><span>Subtotal</span><span>{formatTZS(subtotal)}</span></div>
                <div className="flex justify-between text-[10px] text-foreground/50 uppercase font-bold"><span>Delivery</span><span>{formatTZS(deliveryFeeTotal)}</span></div>
                {discount > 0 && <div className="flex justify-between text-[10px] text-emerald-500 uppercase font-bold"><span>Discount</span><span>-{formatTZS(discount)}</span></div>}
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Header */}
          <div className="px-5 md:px-8 py-5 bg-background border-b border-foreground/8 flex justify-between items-center shrink-0">
            <div>
              <h2 className="text-lg md:text-2xl font-black uppercase font-display flex items-center gap-3 text-foreground tracking-tight">
                <ShieldCheck className="w-6 h-6 md:w-7 md:h-7 text-foreground" /> 
                {step === 1 ? 'Logistics' : 'Payment'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className={`h-1 w-8 rounded-full ${step >= 1 ? 'bg-foreground' : 'bg-foreground/15'}`}></div>
                <div className={`h-1 w-8 rounded-full ${step >= 2 ? 'bg-foreground' : 'bg-foreground/15'}`}></div>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40 ml-2">Step {step}/2</span>
              </div>
            </div>
            <button onClick={onClose} className="p-3 bg-foreground/[0.04] rounded-full hover:bg-foreground/[0.08] transition-colors"><X className="w-5 h-5 text-foreground/50" /></button>
          </div>

          {/* Scrollable Form */}
          <div className="flex-1 overflow-y-auto p-5 md:p-10 space-y-8 md:space-y-12 no-scrollbar pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {step === 1 ? (
              <div className="space-y-12 animate-in slide-in-from-right duration-300">
                {/* Address Selection */}
                <section>
                  <div className="flex justify-between items-end mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2"><MapPin className="w-4 h-4 text-foreground" /> Delivery Location</h3>
                    {!isAddingAddr && <Button size="sm" variant="ghost" onClick={() => setIsAddingAddr(true)} className="h-9 px-4 text-[10px] font-black rounded-xl uppercase bg-background border border-foreground/10 hover:bg-foreground/[0.06] hover:text-foreground"><Plus className="w-3 h-3 mr-2"/> Add New</Button>}
                  </div>
                  {isAddingAddr ? <AddressForm onSave={async (d) => { await addAddress(d); setIsAddingAddr(false); }} onCancel={() => setIsAddingAddr(false)} /> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {addresses.length === 0 && <div className="col-span-2 text-center py-10 text-foreground/40 text-xs font-bold uppercase border-2 border-dashed border-foreground/10 rounded-[2rem] bg-foreground/[0.02]">No saved locations found</div>}
                      {addresses.map(addr => (
                        <div key={addr.id} onClick={() => setSelectedAddress(addr)} className={`relative p-6 rounded-[2rem] border-2 cursor-pointer transition-all group overflow-hidden ${selectedAddress?.id === addr.id ? 'border-foreground bg-background shadow-xl' : 'border-transparent bg-foreground/[0.03] hover:border-foreground/20'}`}>
                          {selectedAddress?.id === addr.id && <div className="absolute top-0 right-0 p-3 bg-foreground text-background rounded-bl-2xl shadow-lg"><Check className="w-4 h-4" /></div>}
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-xl ${addr.label.toLowerCase().includes('home') ? 'bg-blue-100 text-blue-600' : 'bg-foreground/[0.08] text-foreground'}`}>
                              {addr.label.toLowerCase().includes('home') ? <Home className="w-4 h-4"/> : <MapPin className="w-4 h-4"/>}
                            </div>
                            <span className="font-black uppercase text-xs tracking-wider">{addr.label}</span>
                          </div>
                          <p className="font-bold text-sm text-foreground mb-1 line-clamp-1">{addr.street}</p>
                          <p className="text-[10px] text-foreground/50 uppercase font-bold tracking-wide">{addr.city} {addr.postal_code ? `• ${addr.postal_code}` : ''}</p>
                          {addr.landmark && <p className="text-[10px] text-foreground/40 mt-2 flex items-center gap-1"><Navigation className="w-3 h-3"/> Near: {addr.landmark}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Delivery Schedule */}
                <section>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-6 flex items-center gap-2"><Calendar className="w-4 h-4 text-foreground" /> Scheduling</h3>
                  <div className="bg-foreground/[0.03] p-5 md:p-6 rounded-[2.5rem] border border-foreground/8">
                    <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                      {nextDays.map((d, i) => {
                        const isSelected = deliveryDate === d.toISOString().split('T')[0];
                        return (
                          <button key={i} onClick={() => setDeliveryDate(d.toISOString().split('T')[0])} className={`flex flex-col items-center justify-center min-w-[80px] h-20 rounded-2xl border-2 transition-all ${isSelected ? 'border-foreground bg-foreground/[0.05] text-foreground' : 'border-foreground/10 text-foreground/40 hover:border-foreground/30'}`}>
                            <span className="text-[10px] font-black uppercase tracking-widest">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                            <span className="text-xl font-bold">{d.getDate()}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="h-px bg-foreground/8 my-4"></div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['Morning (8-12)', 'Afternoon (12-4)', 'Evening (4-8)', 'Standard'].map(slot => (
                        <button key={slot} onClick={() => setDeliverySlot(slot)} className={`h-12 rounded-xl text-[10px] font-black uppercase transition-all ${deliverySlot === slot ? 'bg-foreground text-background shadow-lg' : 'bg-foreground/[0.04] text-foreground/50 hover:bg-foreground/[0.08]'}`}>{slot}</button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Gifting */}
                <section>
                  <div className="flex items-center gap-4 mb-4 cursor-pointer" onClick={() => setIsGift(!isGift)}>
                    <div className={`w-12 h-8 rounded-full p-1 transition-colors ${isGift ? 'bg-indigo-500' : 'bg-foreground/20'}`}>
                      <div className={`w-6 h-6 bg-background rounded-full shadow-md transform transition-transform ${isGift ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2"><Gift className="w-4 h-4 text-indigo-500" /> Send as a Gift</h3>
                  </div>
                  {isGift && (
                    <div className="animate-in slide-in-from-top-2 fade-in">
                      <div className="relative">
                        <PenLine className="absolute left-4 top-4 w-4 h-4 text-foreground/30" />
                        <Textarea placeholder="Write a heartfelt message to accompany your package..." value={giftMessage || ''} onChange={(e: any) => setGiftMessage(e.target.value)} className="h-32 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-500/20 pl-12 pt-4 text-sm font-medium" />
                      </div>
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="space-y-10 animate-in slide-in-from-right duration-300">
                <section>
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-6 flex items-center gap-2"><Wallet className="w-4 h-4 text-foreground" /> Select Payment Method</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'lipa_namba', label: 'Mobile Money', icon: Smartphone, desc: 'M-Pesa, Tigo, Airtel' },
                      { id: 'mobile_transfer', label: 'Bank Transfer', icon: Landmark, desc: 'Direct Deposit' },
                      { id: 'cash', label: 'Cash on Delivery', icon: Banknote, desc: 'Pay at Doorstep' }
                    ].map(m => (
                      <button key={m.id} onClick={() => setPaymentMethod(m.id as any)} className={`relative flex flex-col items-start p-6 rounded-[2.5rem] border-2 transition-all overflow-hidden group ${paymentMethod === m.id ? 'border-foreground bg-background shadow-xl' : 'border-transparent bg-foreground/[0.03] hover:border-foreground/20'}`}>
                        {paymentMethod === m.id && <div className="absolute top-0 right-0 p-4 bg-foreground rounded-bl-[2rem] text-background"><Check className="w-4 h-4"/></div>}
                        <div className={`p-4 rounded-2xl mb-4 transition-colors ${paymentMethod === m.id ? 'bg-foreground/[0.05] text-foreground' : 'bg-foreground/[0.06] text-foreground/40'}`}><m.icon className="w-6 h-6" /></div>
                        <p className="font-black text-sm uppercase tracking-tight text-foreground">{m.label}</p>
                        <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-wider mt-1">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                </section>

                {paymentMethod !== 'cash' && (
                  <div className="bg-foreground rounded-[3rem] p-8 text-background relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-background/5 blur-[100px] pointer-events-none rounded-full"></div>
                    
                    <div className="relative z-10 grid md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2"><Info className="w-4 h-4 text-background/60" /><p className="text-[10px] font-black uppercase tracking-widest text-background/40">Merchant Payment Channels</p></div>
                        {(Object.entries(groupedItems) as [string, CartItem[]][]).map(([sid, items]) => {
                          const seller = sellerDetails.find(s => s.seller_id === sid);
                          const itemSum = items.reduce((acc, i) => acc + (getEffectiveUnitPrice(i) * i.quantity), 0);
                          const sellerTotal = itemSum + (seller?.delivery_fee || 0);
                          
                          let payName = seller?.store_name || 'Merchant';
                          let payNumber = 'Contact Support';
                          let payLabel = 'Account';

                          if (paymentMethod === 'mobile_transfer') {
                            payName = seller?.bank_account_name || seller?.store_name || 'Merchant';
                            payNumber = seller?.account_number || 'Not Listed';
                            payLabel = seller?.bank_name || 'Bank';
                          } else {
                            if (seller?.lipa_namba) {
                              payNumber = seller.lipa_namba;
                              payLabel = "Lipa Namba";
                            } else if (seller?.mobile_number) {
                              payNumber = seller.mobile_number;
                              payLabel = seller.mobile_operator || 'Mobile';
                              payName = seller.mobile_name || payName;
                            }
                          }

                          return (
                            <div key={sid} className="bg-white/5 rounded-3xl p-5 border border-white/10 flex justify-between items-center group hover:bg-white/10 transition-colors">
                              <div>
                                <p className="text-[8px] font-black uppercase tracking-widest text-background/50 mb-1">{payName} • {formatTZS(Math.round(sellerTotal))}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-md uppercase">{payLabel}</span>
                                  <span className="font-mono font-bold text-lg tracking-widest">{payNumber}</span>
                                </div>
                              </div>
                              <button onClick={() => { navigator.clipboard.writeText(String(payNumber)); addToast("Number Copied", "success"); }} className="p-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"><Copy className="w-4 h-4" /></button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-white/5 rounded-[2.5rem] p-6 border border-white/10 flex flex-col">
                        <div>
                          <Label className="text-foreground/40 mb-4 block">Transaction Verification</Label>
                          <div className="space-y-4">
                            <div className="relative">
                              <Input placeholder="Your Phone Number (Optional)" value={senderPhone || ''} onChange={(e:any) => setSenderPhone(e.target.value)} className="h-12 bg-black/20 border-white/10 text-white placeholder:text-background/30 rounded-xl font-mono text-xs pl-12" />
                              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                            </div>
                            <div className="relative">
                              <Input placeholder="ENTER TRANSACTION ID" value={paymentRef || ''} onChange={(e:any) => setPaymentRef(e.target.value.toUpperCase())} className="h-14 bg-black/20 border-white/20 text-white placeholder:text-background/30 rounded-xl font-mono font-black tracking-[0.2em] text-center uppercase text-lg focus:border-white" />
                              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
                            </div>
                          </div>
                        </div>
                        {sellerDetails.length === 1 && <PaymentInstructions method={paymentMethod} seller={sellerDetails[0]} />}
                      </div>
                    </div>
                  </div>
                )}

                <section>
                  <Label className="text-xs font-black uppercase text-foreground/40 mb-3 block flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5"/> Driver Instructions</Label>
                  <Textarea placeholder="Gate code, specific directions, call upon arrival..." value={orderNote || ''} onChange={(e: any) => setOrderNote(e.target.value)} className="h-24 rounded-[2rem] p-6 bg-foreground/[0.04] border-none shadow-inner resize-none text-sm font-medium" />
                </section>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="p-5 md:p-8 bg-background border-t border-foreground/8 flex gap-4 shrink-0">
            {step === 2 && <Button variant="ghost" onClick={() => setStep(1)} className="h-16 w-16 p-0 rounded-[1.5rem] bg-foreground/[0.05] hover:bg-foreground/[0.09]"><ChevronLeft className="w-6 h-6" /></Button>}
            <Button 
              variant="primary" 
              className="flex-1 h-16 rounded-[1.5rem] shadow-2xl text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 group"
              onClick={() => step === 1 ? setStep(2) : handleComplete()}
              isLoading={isSubmitting}
              disabled={
                !selectedAddress || 
                (step === 2 && paymentMethod === 'lipa_namba' && (!paymentRef.trim() || !senderPhone.trim())) ||
                (step === 2 && paymentMethod === 'mobile_transfer' && !paymentRef.trim())
              }
            >
              {step === 1 ? (
                <>Continue to Payment <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
              ) : (
                <>Confirm Order • {formatTZS(Math.round(finalTotal))} <CheckCircle2 className="w-5 h-5" /></>
              )}
            </Button>
          </div>
        </div>

        {/* Right Panel: Sticky Summary (Desktop) */}
        <div className="hidden md:flex w-[400px] bg-foreground/[0.03] border-l border-foreground/8 flex-col p-10 shrink-0">
          <h3 className="font-black text-xs uppercase tracking-widest text-foreground/40 mb-8 flex items-center gap-2"><Receipt className="w-4 h-4" /> Receipt Preview</h3>
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 mb-8 pr-2">
            {cart.map((item, i) => {
              const price = getEffectiveUnitPrice(item);
              return (
                <div key={i} className="flex gap-4 items-center group">
                  <div className="w-14 h-14 bg-background rounded-2xl overflow-hidden border border-foreground/8 shrink-0 shadow-sm relative">
                    <img src={item.selectedVariant?.image_url || item.images?.[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
                    <span className="absolute bottom-0 right-0 bg-foreground text-background text-[8px] px-1.5 py-0.5 rounded-tl-lg font-bold">{item.quantity}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase truncate leading-tight text-foreground">{item.name}</p>
                    <p className="text-[9px] text-foreground/40 font-bold mt-1 uppercase">{formatTZS(price * item.quantity)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-4 pt-8 border-t border-foreground/8">
            <div className="flex justify-between text-[11px] font-bold text-foreground/50 uppercase"><span>Subtotal</span><span>{formatTZS(subtotal)}</span></div>
            <div className="flex justify-between text-[11px] font-bold text-foreground/50 uppercase"><span>VAT (18%)</span><span>{formatTZS(Math.round(vat))}</span></div>
            <div className="flex justify-between text-[11px] font-bold text-foreground/50 uppercase"><span>Delivery</span><span>{areVendorsLoaded ? formatTZS(deliveryFeeTotal) : <Loader2 className="w-3 h-3 animate-spin"/>}</span></div>
            {discount > 0 && <div className="flex justify-between text-[11px] font-black text-emerald-500 uppercase"><span>Discount</span><span>-{formatTZS(discount)}</span></div>}
            <div className="pt-6 border-t border-foreground/10 flex justify-between items-end">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Total Due</span>
              <span className="text-3xl font-black font-display tracking-tighter text-foreground leading-none">{formatTZS(Math.round(finalTotal))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};