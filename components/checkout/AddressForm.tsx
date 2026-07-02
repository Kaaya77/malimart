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
import { Button, Input, Label, Card, useToast, Badge, Switch, Textarea } from '../UI';
import { formatTZS, CURRENCY } from '../../constants';
import { useAppState } from '../../context/AppContext';
import { Order, OrderStatus, Address, VendorProfile, CartItem } from '../../types';

export const AddressForm = ({ initialData, onSave, onCancel }: {
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