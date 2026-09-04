import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SettingsShell } from '../components/settings/SettingsShell';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Input, Card, CardHeader, CardContent, CardTitle, CardDescription, Textarea, useToast, Badge, Switch, VerifiedBadge } from '../components/UI';
import { Store, DollarSign, Truck, Loader2, Wallet, ArrowUpRight, Clock, CheckCircle2, XCircle, Briefcase, Settings, PlusCircle, Trash2, Globe, MapPin, Info, ShieldCheck, AlertTriangle, ChevronLeft, Shield } from 'lucide-react';
import { listMyPayoutMethods, addMyPayoutMethod, deleteMyPayoutMethod, listMyShippingZones, addMyShippingZone, deleteMyShippingZone } from '../services/sellerApi';
import { CURRENCY, TANZANIA_REGIONS, TANZANIA_DISTRICTS, MOBILE_MONEY_PROVIDERS, BANK_PROVIDERS, SOCIAL_PLATFORMS, isValidTIN, isValidVRN, isValidTanzanianPhone, resolveShippingFee } from '../constants';
import { SellerSettingsCtx } from './seller-settings/context';
import { StoreTab } from './seller-settings/StoreTab';
import { BusinessTab } from './seller-settings/BusinessTab';
import { DeliveryTab } from './seller-settings/DeliveryTab';
import { PreferencesTab } from './seller-settings/PreferencesTab';
import { SecurityTab } from './seller-settings/SecurityTab';


export const SellerSettingsPage = ({ onBack }: { onBack?: () => void } = {}) => {
 const { user, vendorProfile, updateVendorProfile, walletTransactions } = useAppState();
 const { addToast } = useToast();

 // Deep-linkable / refresh-safe tab selection, matching Buyer Settings.
 const [searchParams, setSearchParams] = useSearchParams();
 const validTabs = ['store', 'business', 'delivery', 'preferences', 'security'];
 const initialTab = searchParams.get('tab');
 const [activeTab, setActiveTabState] = useState(initialTab && validTabs.includes(initialTab) ? initialTab : 'store');
 const setActiveTab = (id: string) => {
   setActiveTabState(id);
   setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('tab', id); return next; }, { replace: true });
 };

 // --- STORE PROFILE STATE ---
 const [profileData, setProfileData] = useState({
 store_name: '', description: '', contact_phone: '', contact_email: '',
 logo_url: '', banner_url: '', region: 'Dar es Salaam', district: 'Kinondoni', address: '',
 accent_color: '', banner_headline: '', banner_subtext: '', banner_cta_text: '', banner_cta_url: ''
 });
 
 // Dynamic Social Links
 const [socialLinks, setSocialLinks] = useState<{platform: string, url: string}[]>([]);
 const [newSocial, setNewSocial] = useState({ platform: 'WhatsApp', url: '' });

 // --- POLICIES STATE ---
 const [policiesData, setPoliciesData] = useState({
 return_policy: 'No Returns', processing_time: '1-2 Business Days', warranty: ''
 });

 // --- BUSINESS & PAYMENTS STATE ---
 const [businessData, setBusinessData] = useState({ tin_number: '', business_reg_no: '', vrn: '', payout_schedule: 'Weekly' });
 
 // Dynamic Payment Methods
 const [paymentMethods, setPaymentMethods] = useState<{id: string, type: string, provider: string, accountName: string, accountNumber: string}[]>([]);
 const [newPayment, setNewPayment] = useState({ type: 'mobile', provider: MOBILE_MONEY_PROVIDERS[0], accountName: '', accountNumber: '' });

 // --- DELIVERY STATE ---
 const [deliveryData, setDeliveryData] = useState({ delivery_fee: 0 });
 const [shippingZones, setShippingZones] = useState<{id?: string, region: string, district: string, fee: number}[]>([]);
 const [newZone, setNewZone] = useState({ region: TANZANIA_REGIONS[0], district: 'All Districts', fee: 0 });
 const [calcRegion, setCalcRegion] = useState(TANZANIA_REGIONS[0]);
 const [calcDistrict, setCalcDistrict] = useState('All Districts');

 // --- PREFERENCES STATE ---
 const [preferences, setPreferences] = useState({
 orderNotifications: true, stockAlerts: true, vacationMode: false, lowStockThreshold: 5
 });

 const [isSaving, setIsSaving] = useState(false);

 // Snapshot of the last-loaded/saved Basic Info form, so the Store tab can
 // warn before an in-progress edit is lost to a tab switch or closed tab.
 const profileSnapshotRef = React.useRef<string>('');

 // Load initial data
 useEffect(() => {
 if (vendorProfile) {
 const loadedProfile = {
 store_name: vendorProfile.store_name || '',
 description: vendorProfile.description || '',
 contact_phone: vendorProfile.contact_phone || '',
 contact_email: vendorProfile.contact_email || user?.email || '',
 logo_url: vendorProfile.logo_url || '',
 banner_url: vendorProfile.banner_url || '',
 region: vendorProfile.region || 'Dar es Salaam',
 district: vendorProfile.district || 'Kinondoni',
 address: vendorProfile.address || '',
 accent_color: vendorProfile.accent_color || '',
 banner_headline: vendorProfile.banner_headline || '',
 banner_subtext: vendorProfile.banner_subtext || '',
 banner_cta_text: vendorProfile.banner_cta_text || '',
 banner_cta_url: vendorProfile.banner_cta_url || ''
 };
 setProfileData(loadedProfile);
 profileSnapshotRef.current = JSON.stringify(loadedProfile);
 setBusinessData({
 tin_number: vendorProfile.tin_number || '',
 business_reg_no: vendorProfile.business_reg_no || '',
 vrn: vendorProfile.vrn || '',
 payout_schedule: vendorProfile.payout_schedule || 'Weekly'
 });
 setPoliciesData({
 return_policy: vendorProfile.return_policy || 'No Returns',
 processing_time: vendorProfile.processing_time || '1-2 Business Days',
 warranty: vendorProfile.warranty || ''
 });
 setDeliveryData({ delivery_fee: vendorProfile.delivery_fee || 0 });
 // Preferences must hydrate too — otherwise the toggles show hardcoded
 // defaults, misrepresent the saved state, and a later Save writes those
 // defaults back (e.g. Vacation Mode silently flips off).
 setPreferences({
 orderNotifications: (vendorProfile as any).order_notifications ?? true,
 stockAlerts: (vendorProfile as any).stock_alerts ?? true,
 vacationMode: (vendorProfile as any).vacation_mode ?? false,
 lowStockThreshold: (vendorProfile as any).low_stock_threshold ?? 5,
 });

 if (vendorProfile.social_links) {
 setSocialLinks(vendorProfile.social_links);
 }
 }
 }, [vendorProfile, user]);

 // Payout methods + shipping zones live in their own tables (not vendor_profiles).
 // Load them directly so the lists reflect what's actually persisted.
 useEffect(() => {
 if (!user) return;
 let cancelled = false;
 (async () => {
 const [{ data: payouts }, { data: zones }] = await Promise.all([
 listMyPayoutMethods(user.id),
 listMyShippingZones(user.id),
 ]);
 if (cancelled) return;
 if (payouts) {
 setPaymentMethods(payouts.map((p: any) => ({
 id: p.id,
 type: p.method_type,
 provider: p.details?.provider || '',
 accountName: p.details?.accountName || '',
 accountNumber: p.details?.accountNumber || '',
 })));
 }
 if (zones) {
 setShippingZones(zones.map((z: any) => ({
 id: z.id,
 region: z.name,
 district: z.description || 'All Districts',
 fee: Number(z.fee) || 0,
 })));
 }
 })();
 return () => { cancelled = true; };
 }, [user]);

 // --- HANDLERS ---
 
 const handleGenericSave = async (data: any, successMessage: string) => {
 // Validation Logic
 if (data.tin_number && !isValidTIN(data.tin_number)) {
 addToast("TIN must be exactly 9 digits", "error");
 return;
 }
 if (data.vrn && !isValidVRN(data.vrn)) {
 addToast("VRN must have at least 9 digits", "error");
 return;
 }
 if (data.contact_phone && !isValidTanzanianPhone(data.contact_phone)) {
 addToast("Please enter a valid Tanzanian phone number", "error");
 return;
 }
 if (data.accent_color && !/^#[0-9A-Fa-f]{6}$/.test(data.accent_color)) {
 addToast("Accent color must be a hex code like #10b981", "error");
 return;
 }
 if (data.banner_cta_url && !/^https?:\/\//.test(data.banner_cta_url)) {
 addToast("Banner button link must start with http:// or https://", "error");
 return;
 }

 setIsSaving(true);
 try {
 await updateVendorProfile(data);
 addToast(successMessage, "success");
 } catch (error) {
 addToast("Failed to save changes", "error");
 } finally {
 setIsSaving(false);
 }
 };

 // Dynamic Lists Handlers — add/remove persist immediately so links actually
 // save (users expected "Add Link" to save; the old flow needed a separate
 // Save button and silently lost links if they navigated away).
 const handleAddSocial = async () => {
 if (!newSocial.url) return;
 if (newSocial.platform === 'WhatsApp' && !isValidTanzanianPhone(newSocial.url)) {
 return addToast("Please enter a valid Tanzanian phone number for WhatsApp", "error");
 }
 const next = [...socialLinks, newSocial];
 setSocialLinks(next);
 setNewSocial({ platform: 'WhatsApp', url: '' });
 await handleGenericSave({ social_links: next }, "Social link saved");
 };

 const handleRemoveSocial = async (index: number) => {
 const next = socialLinks.filter((_, i) => i !== index);
 setSocialLinks(next);
 await handleGenericSave({ social_links: next }, "Social link removed");
 };

 const handleAddPayment = async () => {
 if (!user) return;
 if (!newPayment.accountNumber || !newPayment.accountName) return addToast("Fill all payment details", "error");

 // Basic validation for Lipa Namba vs Bank Account
 if (newPayment.type === 'mobile' && newPayment.accountNumber.length < 5) {
 return addToast("Lipa Namba/Till Number seems too short", "error");
 }
 if (newPayment.type === 'bank' && newPayment.accountNumber.length < 9) {
 return addToast("Bank Account Number seems too short", "error");
 }

 const { data, error } = await addMyPayoutMethod(user.id, {
 methodType: newPayment.type,
 details: { provider: newPayment.provider, accountName: newPayment.accountName, accountNumber: newPayment.accountNumber },
 isPrimary: paymentMethods.length === 0,
 });

 if (error) return addToast(error.message || "Could not save payment method", "error");

 setPaymentMethods([...paymentMethods, {
 id: data.id,
 type: data.method_type,
 provider: data.details?.provider || '',
 accountName: data.details?.accountName || '',
 accountNumber: data.details?.accountNumber || '',
 }]);
 setNewPayment({ type: 'mobile', provider: MOBILE_MONEY_PROVIDERS[0], accountName: '', accountNumber: '' });
 addToast("Payment method saved", "success");
 };

 const handleRemovePayment = async (id: string) => {
 const prev = paymentMethods;
 setPaymentMethods(paymentMethods.filter(p => p.id !== id));
 const { error } = await deleteMyPayoutMethod(id);
 if (error) { setPaymentMethods(prev); addToast("Could not remove payment method", "error"); }
 };

 const handleAddZone = async () => {
 if (!user) return;
 const zoneKey = `${newZone.region}-${newZone.district}`;
 if (shippingZones.find(z => `${z.region}-${z.district}` === zoneKey)) {
 return addToast("This specific region/district already has a fee", "error");
 }
 const { data, error } = await addMyShippingZone(user.id, {
 name: newZone.region,
 description: newZone.district,
 fee: newZone.fee,
 });

 if (error) return addToast(error.message || "Could not save zone", "error");

 setShippingZones([...shippingZones, { id: data.id, region: data.name, district: data.description || 'All Districts', fee: Number(data.fee) || 0 }]);
 setNewZone({ region: TANZANIA_REGIONS[0], district: 'All Districts', fee: 0 });
 addToast("Shipping zone saved", "success");
 };

 const handleRemoveZone = async (id?: string) => {
 if (!id) return;
 const prev = shippingZones;
 setShippingZones(shippingZones.filter(z => z.id !== id));
 const { error } = await deleteMyShippingZone(id);
 if (error) { setShippingZones(prev); addToast("Could not remove zone", "error"); }
 };

 const setupProgress = useMemo(() => {
 if (!vendorProfile) return 0;
 let points = 0; let total = 5;
 if (vendorProfile.store_name) points++;
 if (vendorProfile.description) points++;
 if (vendorProfile.logo_url) points++;
 if (vendorProfile.contact_phone) points++;
 if (paymentMethods.length > 0) points++;
 return Math.round((points / total) * 100);
 }, [vendorProfile, paymentMethods]);

 const tabs = [
 { id: 'store', label: 'Store Profile', desc: 'Logo, info & policies', icon: Store },
 { id: 'business', label: 'Business & Payments', desc: 'Tax, payouts & methods', icon: Briefcase },
 { id: 'delivery', label: 'Delivery & Shipping', desc: 'Zones & fees', icon: Truck },
 { id: 'preferences', label: 'Preferences', desc: 'Alerts & vacation mode', icon: Settings },
 { id: 'security', label: 'Security', desc: 'Password & account', icon: Shield },
 ];
  const __ctx = { addToast, businessData, calcDistrict, calcRegion, deliveryData, handleAddPayment, handleAddSocial, handleAddZone, handleGenericSave, handleRemovePayment, handleRemoveSocial, handleRemoveZone, isSaving, newPayment, newSocial, newZone, paymentMethods, policiesData, preferences, profileData, setBusinessData, setCalcDistrict, setCalcRegion, setDeliveryData, setNewPayment, setNewSocial, setNewZone, setPoliciesData, setPreferences, setProfileData, shippingZones, socialLinks, user };

 const activeMeta = tabs.find(t => t.id === activeTab)!;
 const storeName = profileData.store_name || vendorProfile?.store_name || 'Your store';
 // circumference for the progress ring (r=18)
 const RING = 2 * Math.PI * 18;
 const isProfileDirty = activeTab === 'store' && JSON.stringify(profileData) !== profileSnapshotRef.current;

 return (
  <SellerSettingsCtx.Provider value={__ctx}>

 <SettingsShell
      title="Store Settings"
      subtitle="Manage your storefront, business details and operations."
      isDirty={isProfileDirty}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      header={<>
 {/* ── Hero header ── */}
 <div className="glass-surface rounded-3xl p-5 sm:p-6 mb-5 mt-1 relative overflow-hidden">
   {/* subtle accent wash */}
   <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
   <div className="relative flex items-center gap-4">
     {onBack && (
       <button
         onClick={onBack}
         className="flex items-center justify-center w-9 h-9 rounded-xl bg-foreground/[0.05] hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-all shrink-0"
         aria-label="Back to dashboard"
       >
         <ChevronLeft className="w-4 h-4" />
       </button>
     )}

     {/* Store logo */}
     <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-foreground/[0.05] border border-foreground/10 overflow-hidden flex items-center justify-center shrink-0">
       {profileData.logo_url
         ? <img src={profileData.logo_url} alt={storeName} className="w-full h-full object-cover" />
         : <Store className="w-6 h-6 text-foreground/30" />}
     </div>

     {/* Identity */}
     <div className="min-w-0 flex-1">
       <div className="flex items-center gap-2">
         <h1 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight truncate">{storeName}</h1>
         {vendorProfile?.is_verified && (
           <VerifiedBadge iconOnly size="w-4 h-4 sm:w-5 sm:h-5" />
         )}
       </div>
       <p className="text-xs sm:text-sm text-foreground/45 mt-0.5">Store settings & operations</p>
     </div>

     {/* Setup progress ring */}
     {setupProgress < 100 && (
       <div className="relative w-14 h-14 shrink-0" title={`${setupProgress}% complete`}>
         <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
           <circle cx="22" cy="22" r="18" fill="none" strokeWidth="4" className="stroke-foreground/10" />
           <circle
             cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round"
             className="stroke-emerald-500 transition-all duration-1000"
             strokeDasharray={RING}
             strokeDashoffset={RING - (RING * setupProgress) / 100}
           />
         </svg>
         <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground tabular-nums">
           {setupProgress}%
         </span>
       </div>
     )}
   </div>

   {/* Setup hint */}
   {setupProgress < 100 && (
     <p className="relative text-[11px] text-foreground/45 mt-3 sm:ml-20">
       Complete your store setup to start attracting more buyers.
     </p>
   )}
 </div>
      </>}
    >
      <main className="space-y-6">
 <AnimatePresence mode="wait">
 <motion.div
 key={activeTab}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -8 }}
 transition={{ duration: 0.25 }}
 >
 {/* Section heading */}
 <div className="flex items-center gap-3 mb-5">
 <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
 <activeMeta.icon className="w-5 h-5 stroke-[2]" />
 </div>
 <div>
 <h2 className="text-lg font-bold text-foreground tracking-tight leading-tight">{activeMeta.label}</h2>
 <p className="text-xs text-foreground/45">{activeMeta.desc}</p>
 </div>
 </div>

 {activeTab === 'store' && <StoreTab />}
 {activeTab === 'business' && <BusinessTab />}
 {activeTab === 'delivery' && <DeliveryTab />}
 {activeTab === 'preferences' && <PreferencesTab />}
 {activeTab === 'security' && <SecurityTab />}
 </motion.div>
 </AnimatePresence>
</main>
    </SettingsShell>
  </SellerSettingsCtx.Provider>
 );
};
