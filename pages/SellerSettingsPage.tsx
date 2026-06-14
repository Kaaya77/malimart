import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Input, Card, CardHeader, CardContent, CardTitle, CardDescription, Textarea, useToast, Badge, Switch } from '../components/UI';
import { Store, DollarSign, Truck, Loader2, Wallet, ArrowUpRight, Clock, CheckCircle2, XCircle, Briefcase, Settings, PlusCircle, Trash2, Globe, MapPin, Info, ShieldCheck, AlertTriangle, ChevronLeft } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { CURRENCY, TANZANIA_REGIONS, TANZANIA_DISTRICTS, MOBILE_MONEY_PROVIDERS, BANK_PROVIDERS, SOCIAL_PLATFORMS, isValidTIN, isValidVRN, isValidTanzanianPhone, resolveShippingFee } from '../constants';
import { SellerSettingsCtx } from './seller-settings/context';
import { StoreTab } from './seller-settings/StoreTab';
import { BusinessTab } from './seller-settings/BusinessTab';
import { DeliveryTab } from './seller-settings/DeliveryTab';
import { PreferencesTab } from './seller-settings/PreferencesTab';


export const SellerSettingsPage = ({ onBack }: { onBack?: () => void } = {}) => {
 const { user, vendorProfile, updateVendorProfile, walletTransactions } = useAppState();
 const { addToast } = useToast();
 
 const [activeTab, setActiveTab] = useState('store');

 // --- STORE PROFILE STATE ---
 const [profileData, setProfileData] = useState({
 store_name: '', description: '', contact_phone: '', contact_email: '',
 logo_url: '', banner_url: '', region: 'Dar es Salaam', district: 'Kinondoni', address: ''
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
 const [shippingZones, setShippingZones] = useState<{region: string, district: string, fee: number}[]>([]);
 const [newZone, setNewZone] = useState({ region: TANZANIA_REGIONS[0], district: 'All Districts', fee: 0 });
 const [calcRegion, setCalcRegion] = useState(TANZANIA_REGIONS[0]);
 const [calcDistrict, setCalcDistrict] = useState('All Districts');

 // --- PREFERENCES STATE ---
 const [preferences, setPreferences] = useState({
 orderNotifications: true, stockAlerts: true, vacationMode: false, lowStockThreshold: 5
 });

 const [isSaving, setIsSaving] = useState(false);

 // Load initial data
 useEffect(() => {
 if (vendorProfile) {
 setProfileData({
 store_name: vendorProfile.store_name || '',
 description: vendorProfile.description || '',
 contact_phone: vendorProfile.contact_phone || '',
 contact_email: vendorProfile.contact_email || user?.email || '',
 logo_url: vendorProfile.logo_url || '',
 banner_url: vendorProfile.banner_url || '',
 region: vendorProfile.region || 'Dar es Salaam',
 district: vendorProfile.district || 'Kinondoni',
 address: vendorProfile.address || ''
 });
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
 
 if (vendorProfile.social_links) {
 setSocialLinks(vendorProfile.social_links);
 }
 if (vendorProfile.shipping_zones) {
 setShippingZones(vendorProfile.shipping_zones);
 }
 if (vendorProfile.payment_methods) {
 setPaymentMethods(vendorProfile.payment_methods);
 } else {
 setPaymentMethods([]);
 }
 }
 }, [vendorProfile, user]);

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

 // Dynamic Lists Handlers
 const handleAddSocial = () => {
 if (!newSocial.url) return;
 if (newSocial.platform === 'WhatsApp' && !isValidTanzanianPhone(newSocial.url)) {
 return addToast("Please enter a valid Tanzanian phone number for WhatsApp", "error");
 }
 setSocialLinks([...socialLinks, newSocial]);
 setNewSocial({ platform: 'WhatsApp', url: '' });
 addToast("Social link added (Remember to save)", "success");
 };

 const handleRemoveSocial = (index: number) => {
 setSocialLinks(socialLinks.filter((_, i) => i !== index));
 };

 const handleAddPayment = () => {
 if (!newPayment.accountNumber || !newPayment.accountName) return addToast("Fill all payment details", "error");
 
 // Basic validation for Lipa Namba vs Bank Account
 if (newPayment.type === 'mobile' && newPayment.accountNumber.length < 5) {
 return addToast("Lipa Namba/Till Number seems too short", "error");
 }
 if (newPayment.type === 'bank' && newPayment.accountNumber.length < 9) {
 return addToast("Bank Account Number seems too short", "error");
 }

 setPaymentMethods([...paymentMethods, { ...newPayment, id: Date.now().toString() }]);
 setNewPayment({ type: 'mobile', provider: MOBILE_MONEY_PROVIDERS[0], accountName: '', accountNumber: '' });
 addToast("Payment method added (Remember to save)", "success");
 };

 const handleRemovePayment = (id: string) => {
 setPaymentMethods(paymentMethods.filter(p => p.id !== id));
 };

 const handleAddZone = () => {
 const zoneKey = `${newZone.region}-${newZone.district}`;
 if (shippingZones.find(z => `${z.region}-${z.district}` === zoneKey)) {
 return addToast("This specific region/district already has a fee", "error");
 }
 setShippingZones([...shippingZones, newZone]);
 setNewZone({ region: TANZANIA_REGIONS[0], district: 'All Districts', fee: 0 });
 };

 const handleRemoveZone = (region: string, district: string) => {
 setShippingZones(shippingZones.filter(z => !(z.region === region && z.district === district)));
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
 { id: 'store', label: 'Store Profile', icon: Store },
 { id: 'business', label: 'Business & Payments', icon: Briefcase },
 { id: 'delivery', label: 'Delivery & Shipping', icon: Truck },
 { id: 'preferences', label: 'Preferences', icon: Settings },
 ];
  const __ctx = { businessData, calcDistrict, calcRegion, deliveryData, handleAddPayment, handleAddSocial, handleAddZone, handleGenericSave, handleRemovePayment, handleRemoveSocial, handleRemoveZone, isSaving, newPayment, newSocial, newZone, paymentMethods, policiesData, preferences, profileData, setBusinessData, setCalcDistrict, setCalcRegion, setDeliveryData, setNewPayment, setNewSocial, setNewZone, setPoliciesData, setPreferences, setProfileData, shippingZones, socialLinks };


 return (
  <SellerSettingsCtx.Provider value={__ctx}>

 <div className="max-w-6xl mx-auto pb-12 animate-in fade-in">
 <div className="mb-5 flex items-center gap-3">
   {onBack && (
     <button
       onClick={onBack}
       className="flex items-center justify-center w-8 h-8 rounded-xl bg-foreground/[0.05] hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-all shrink-0"
       aria-label="Back to dashboard"
     >
       <ChevronLeft className="w-4 h-4" />
     </button>
   )}
   <div>
     <h1 className="text-xl font-black text-foreground tracking-tight">Store Settings</h1>
     <p className="text-xs text-foreground/40 mt-0.5">Manage your store profile, payments, and operations.</p>
   </div>
 </div>

 <div className="flex flex-col md:flex-row gap-8">
 {/* Sidebar Navigation */}
 <aside className="w-full md:w-64 shrink-0">
 <motion.nav 
 initial="hidden"
 animate="visible"
 variants={{
 hidden: { opacity: 0, y: 10 },
 visible: {
 opacity: 1,
 y: 0,
 transition: { staggerChildren: 0.05 }
 }
 }}
 className="flex flex-row md:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 md:pb-0"
 >
 {tabs.map(tab => (
 <motion.button
 key={tab.id}
 variants={{
 hidden: { opacity: 0, x: -10 },
 visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
 }}
 onClick={() => setActiveTab(tab.id)}
 className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] uppercase tracking-[0.15em] transition-colors whitespace-nowrap ${
 activeTab === tab.id 
 ? 'bg-emerald-600 text-white' 
 : 'text-foreground/60 hover:bg-foreground/[0.04]'
 }`}
 >
 <tab.icon className="w-4 h-4 stroke-[1.5]" />
 {tab.label}
 </motion.button>
 ))}
 </motion.nav>

 {/* Store Setup Progress */}
 {setupProgress < 100 && (
 <div className="mt-8 hidden md:block">
 <Card className="bg-primary/5 dark:bg-background/5 border-none shadow-none">
 <CardContent className="p-6">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-[10px] uppercase tracking-[0.2em] text-foreground">Setup Progress</h3>
 <span className="text-base font-black text-foreground">{setupProgress}%</span>
 </div>
 <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden">
 <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${setupProgress}%` }}></div>
 </div>
 </CardContent>
 </Card>
 </div>
 )}
 </aside>

 {/* Main Content Area */}
 <main className="flex-1 space-y-6">

 {/* STORE PROFILE TAB */}
 {activeTab === 'store' && <StoreTab />}

 {/* BUSINESS & PAYMENTS TAB */}
 {activeTab === 'business' && <BusinessTab />}

 {/* DELIVERY & SHIPPING TAB */}
 {activeTab === 'delivery' && <DeliveryTab />}

 {/* PREFERENCES TAB */}
 {activeTab === 'preferences' && <PreferencesTab />}

 </main>
 </div>
 </div>
  </SellerSettingsCtx.Provider>
 );
};
