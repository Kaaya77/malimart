import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Input, Card, CardHeader, CardContent, CardTitle, CardDescription, Textarea, useToast, Badge, Switch } from '../components/UI';
import { Store, DollarSign, Truck, Loader2, Wallet, ArrowUpRight, Clock, CheckCircle2, XCircle, Briefcase, Settings, PlusCircle, Trash2, Globe, MapPin, Info, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { CURRENCY, TANZANIA_REGIONS, TANZANIA_DISTRICTS, MOBILE_MONEY_PROVIDERS, BANK_PROVIDERS, SOCIAL_PLATFORMS, isValidTIN, isValidVRN, isValidTanzanianPhone, resolveShippingFee } from '../constants';

export const SellerSettingsPage = () => {
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
        } else if (paymentMethods.length === 0) {
            setPaymentMethods([
                { id: '1', type: 'mobile', provider: 'M-Pesa (Vodacom)', accountName: vendorProfile.store_name || 'My Store', accountNumber: vendorProfile.lipa_namba || '555555' }
            ]);
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

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in">
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-light text-foreground tracking-tight">Seller Settings</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mt-2">Manage your store profile, payments, and operations efficiently.</p>
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
                    ? 'bg-primary text-background dark:bg-background dark:text-foreground' 
                    : 'text-foreground/60 hover:bg-primary/5 dark:hover:bg-background/5'
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
                          <span className="text-lg font-serif text-foreground">{setupProgress}%</span>
                      </div>
                      <div className="w-full h-1 bg-primary/10 dark:bg-background/10 rounded-none overflow-hidden">
                          <div className="h-full bg-primary dark:bg-background transition-all duration-1000" style={{ width: `${setupProgress}%` }}></div>
                      </div>
                  </CardContent>
              </Card>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-6">

          {/* STORE PROFILE TAB */}
          {activeTab === 'store' && (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>Your public store details and location.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Store Name</label>
                          <Input placeholder="Store Name" value={profileData.store_name || ''} onChange={(e: any) => setProfileData({...profileData, store_name: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Contact Phone</label>
                          <Input placeholder="Contact Phone" value={profileData.contact_phone} onChange={(e: any) => setProfileData({...profileData, contact_phone: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Region</label>
                          <select 
                              className="flex h-12 w-full rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background"
                              value={profileData.region}
                              onChange={(e) => setProfileData({...profileData, region: e.target.value, district: TANZANIA_DISTRICTS[e.target.value]?.[0] || ''})}
                          >
                              {TANZANIA_REGIONS.map(region => (
                                  <option key={region} value={region}>{region}</option>
                              ))}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">District</label>
                          <select 
                              className="flex h-12 w-full rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background disabled:opacity-50"
                              value={profileData.district}
                              onChange={(e) => setProfileData({...profileData, district: e.target.value})}
                              disabled={!profileData.region || !TANZANIA_DISTRICTS[profileData.region]}
                          >
                              <option value="">Select District</option>
                              {(TANZANIA_DISTRICTS[profileData.region] || []).map(district => (
                                  <option key={district} value={district}>{district}</option>
                              ))}
                          </select>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Specific Address</label>
                          <Input placeholder="e.g., Kariakoo, Msimbazi St" value={profileData.address} onChange={(e: any) => setProfileData({...profileData, address: e.target.value})} />
                      </div>
                      <div className="md:col-span-2 space-y-1">
                          <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Store Description</label>
                          <Textarea placeholder="What do you sell?" value={profileData.description} onChange={(e: any) => setProfileData({...profileData, description: e.target.value})} />
                      </div>
                  </div>
                  <div className="flex justify-end pt-6">
                      <Button variant="primary" onClick={() => handleGenericSave({ ...profileData, social_links: socialLinks }, "Store info saved")} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Basic Info'}
                      </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Store Policies</CardTitle>
                      <CardDescription>Set expectations for your buyers.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Return Policy</label>
                              <select 
                                  className="flex h-12 w-full rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background"
                                  value={policiesData.return_policy}
                                  onChange={(e) => setPoliciesData({...policiesData, return_policy: e.target.value})}
                              >
                                  <option value="No Returns">No Returns</option>
                                  <option value="3 Days">3 Days Return</option>
                                  <option value="7 Days">7 Days Return</option>
                                  <option value="14 Days">14 Days Return</option>
                              </select>
                          </div>
                          <div className="space-y-1">
                              <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Processing Time</label>
                              <select 
                                  className="flex h-12 w-full rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background"
                                  value={policiesData.processing_time}
                                  onChange={(e) => setPoliciesData({...policiesData, processing_time: e.target.value})}
                              >
                                  <option value="Same Day">Same Day Dispatch</option>
                                  <option value="1-2 Business Days">1-2 Business Days</option>
                                  <option value="3-5 Business Days">3-5 Business Days</option>
                                  <option value="Made to Order (7+ Days)">Made to Order (7+ Days)</option>
                              </select>
                          </div>
                          <div className="md:col-span-2 space-y-1">
                              <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Warranty Information (Optional)</label>
                              <Input placeholder="e.g., 6 Months Manufacturer Warranty" value={policiesData.warranty} onChange={(e: any) => setPoliciesData({...policiesData, warranty: e.target.value})} />
                          </div>
                      </div>
                      <div className="flex justify-end pt-4">
                          <Button variant="primary" onClick={() => handleGenericSave(policiesData, "Policies saved")} disabled={isSaving}>
                              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Policies'}
                          </Button>
                      </div>
                  </CardContent>
              </Card>

              {/* Dynamic Social Links */}
              <Card>
                  <CardHeader>
                      <CardTitle>Social & Contact Links</CardTitle>
                      <CardDescription>Add the platforms where buyers can reach you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      {socialLinks.length > 0 && (
                          <div className="space-y-2 mb-4">
                              {socialLinks.map((link, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-4 border border-foreground/10 rounded-none bg-background dark:bg-background">
                                      <div className="flex items-center gap-3">
                                          <Globe className="w-4 h-4 text-foreground/40" />
                                          <span className="font-serif text-sm text-foreground">{link.platform}</span>
                                          <span className="text-[10px] uppercase tracking-[0.1em] text-foreground/60 truncate max-w-[200px]">{link.url}</span>
                                      </div>
                                      <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => handleRemoveSocial(idx)}>
                                          <Trash2 className="w-4 h-4 stroke-[1.5]" />
                                      </Button>
                                  </div>
                              ))}
                          </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-foreground/10">
                          <select 
                              className="flex h-12 w-full sm:w-auto rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background"
                              value={newSocial.platform}
                              onChange={(e) => setNewSocial({...newSocial, platform: e.target.value})}
                          >
                              {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <Input 
                              placeholder={newSocial.platform === 'WhatsApp' ? 'Phone Number (e.g., +255...)' : 'Profile URL or Username'} 
                              value={newSocial.url} 
                              onChange={(e: any) => setNewSocial({...newSocial, url: e.target.value})} 
                              className="flex-1"
                          />
                          <Button variant="secondary" onClick={handleAddSocial} disabled={!newSocial.url}>Add Link</Button>
                      </div>
                      <div className="flex justify-end pt-4">
                          <Button variant="primary" onClick={() => handleGenericSave({ social_links: socialLinks }, "Social links saved")} disabled={isSaving}>
                              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Links'}
                          </Button>
                      </div>
                  </CardContent>
              </Card>
            </div>
          )}

          {/* BUSINESS & PAYMENTS TAB */}
          {activeTab === 'business' && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Dynamic Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>How buyers can pay you (Lipa Namba or Bank).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {paymentMethods.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                          {paymentMethods.map(method => (
                              <div key={method.id} className="flex items-center justify-between p-4 border border-foreground/10 rounded-none bg-background dark:bg-background">
                                  <div className="flex items-center gap-4">
                                      <div className={`w-10 h-10 rounded-none flex items-center justify-center border border-foreground/10 ${method.type === 'mobile' ? 'bg-primary/5 dark:bg-background/5' : 'bg-primary/5 dark:bg-background/5'}`}>
                                          <DollarSign className="w-5 h-5 text-foreground stroke-[1.5]" />
                                      </div>
                                      <div>
                                          <p className="font-serif text-sm text-foreground">{method.provider}</p>
                                          <p className="text-[10px] uppercase tracking-[0.1em] text-foreground/60">{method.accountName} • {method.accountNumber}</p>
                                      </div>
                                  </div>
                                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleRemovePayment(method.id)}>
                                      <Trash2 className="w-4 h-4 stroke-[1.5]" />
                                  </Button>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">No payment methods added yet.</p>
                  )}

                  <div className="pt-6 border-t border-foreground/10 space-y-4">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-foreground mb-2">Add New Payment Method</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <select 
                              className="flex h-12 w-full rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background"
                              value={newPayment.type}
                              onChange={(e) => setNewPayment({
                                  ...newPayment, 
                                  type: e.target.value, 
                                  provider: e.target.value === 'mobile' ? MOBILE_MONEY_PROVIDERS[0] : BANK_PROVIDERS[0]
                              })}
                          >
                              <option value="mobile">Mobile Money (Lipa Namba)</option>
                              <option value="bank">Bank Account</option>
                          </select>
                          
                          <select 
                              className="flex h-12 w-full rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background"
                              value={newPayment.provider}
                              onChange={(e) => setNewPayment({...newPayment, provider: e.target.value})}
                          >
                              {(newPayment.type === 'mobile' ? MOBILE_MONEY_PROVIDERS : BANK_PROVIDERS).map(p => (
                                  <option key={p} value={p}>{p}</option>
                              ))}
                          </select>

                          <Input placeholder="Account Name (e.g., My Store Ltd)" value={newPayment.accountName} onChange={(e: any) => setNewPayment({...newPayment, accountName: e.target.value})} />
                          <Input placeholder={newPayment.type === 'mobile' ? "Lipa Namba / Till Number" : "Account Number"} value={newPayment.accountNumber} onChange={(e: any) => setNewPayment({...newPayment, accountNumber: e.target.value})} />
                      </div>
                      <Button variant="secondary" onClick={handleAddPayment} className="w-full md:w-auto"><PlusCircle className="w-4 h-4 mr-2"/> Add Method</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Registration</CardTitle>
                  <CardDescription>Official details for verification.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">TIN Number</label>
                            <Input placeholder="TIN Number" value={businessData.tin_number} onChange={(e: any) => setBusinessData({...businessData, tin_number: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Business Registration No.</label>
                            <Input placeholder="Registration No." value={businessData.business_reg_no} onChange={(e: any) => setBusinessData({...businessData, business_reg_no: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">VAT Registration Number (VRN)</label>
                            <Input placeholder="Optional VRN" value={businessData.vrn} onChange={(e: any) => setBusinessData({...businessData, vrn: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground mb-2 block">Payout Schedule</label>
                            <select 
                                className="flex h-12 w-full rounded-none border border-foreground/20 bg-transparent px-4 text-sm focus:outline-none focus:border-foreground transition-all dark:text-background dark:focus:border-background"
                                value={businessData.payout_schedule}
                                onChange={(e) => setBusinessData({...businessData, payout_schedule: e.target.value})}
                            >
                                <option value="Daily">Daily</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Bi-Weekly">Bi-Weekly</option>
                                <option value="Monthly">Monthly</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end pt-6 border-t border-foreground/8 dark:border-white/5">
                        <Button variant="primary" onClick={() => handleGenericSave({ ...businessData, payment_methods: paymentMethods }, "Business info saved")} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Business Info'}
                        </Button>
                    </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* DELIVERY & SHIPPING TAB */}
          {activeTab === 'delivery' && (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Profiles</CardTitle>
                  <CardDescription>Set delivery fees based on Tanzanian regions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-1 p-4 bg-foreground/[0.03] rounded-xl border border-foreground/10">
                      <label className="text-sm font-bold text-foreground">Base Delivery Fee (Default)</label>
                      <p className="text-xs text-foreground/55 mb-3">Applied to any region not specified below.</p>
                      <Input type="number" icon={Truck} placeholder="Amount" value={deliveryData.delivery_fee} onChange={(e: any) => setDeliveryData({...deliveryData, delivery_fee: Number(e.target.value)})} />
                  </div>
                  
                  <div className="pt-2 space-y-4">
                      <h4 className="text-sm font-semibold">Region-Specific Fees</h4>
                      
                      {shippingZones.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {shippingZones.map((zone, idx) => (
                                  <div key={idx} className="p-3 border border-foreground/10 rounded-xl flex justify-between items-center bg-background dark:bg-background">
                                      <div>
                                          <span className="font-medium text-sm block">{zone.region}</span>
                                          {zone.district !== 'All Districts' && <span className="text-xs text-foreground/55">{zone.district}</span>}
                                      </div>
                                      <div className="flex items-center gap-3">
                                          <span className="font-black font-mono text-sm">{CURRENCY} {zone.fee.toLocaleString()}</span>
                                          <Button variant="ghost" size="icon" className="text-red-500 h-6 w-6" onClick={() => handleRemoveZone(zone.region, zone.district)}>
                                              <Trash2 className="w-3 h-3" />
                                          </Button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-xs text-foreground/55">No specific regional fees added. The base fee will apply everywhere.</p>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-foreground/8 dark:border-white/5">
                          <select 
                              className="h-10 bg-background dark:bg-background border border-foreground/10 rounded-xl px-3 text-sm outline-none flex-1"
                              value={newZone.region}
                              onChange={(e) => setNewZone({...newZone, region: e.target.value, district: 'All Districts'})}
                          >
                              {TANZANIA_REGIONS.map(region => (
                                  <option key={region} value={region}>{region}</option>
                              ))}
                          </select>
                          <select 
                              className="h-10 bg-background dark:bg-background border border-foreground/10 rounded-xl px-3 text-sm outline-none flex-1 disabled:opacity-50"
                              value={newZone.district}
                              onChange={(e) => setNewZone({...newZone, district: e.target.value})}
                              disabled={!newZone.region || !TANZANIA_DISTRICTS[newZone.region]}
                          >
                              <option value="All Districts">All Districts</option>
                              {(TANZANIA_DISTRICTS[newZone.region] || []).map(district => (
                                  <option key={district} value={district}>{district}</option>
                              ))}
                          </select>
                          <Input type="number" placeholder="Fee" value={newZone.fee} onChange={(e: any) => setNewZone({...newZone, fee: Number(e.target.value)})} className="w-full sm:w-32" />
                          <Button variant="secondary" onClick={handleAddZone}>Add Zone</Button>
                      </div>
                  </div>

                  {/* SHIPPING RATE CALCULATOR (LOGIC DEMONSTRATION) */}
                  <div className="mt-8 p-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                          <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Test Your Shipping Rates</h4>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-4">
                          Select a destination to see exactly what a buyer will be charged based on your rules above.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                          <select 
                              className="h-10 bg-background dark:bg-background border border-emerald-200 dark:border-emerald-800/30 rounded-xl px-3 text-sm outline-none flex-1 w-full"
                              value={calcRegion}
                              onChange={(e) => {
                                  setCalcRegion(e.target.value);
                                  setCalcDistrict('All Districts');
                              }}
                          >
                              {TANZANIA_REGIONS.map(region => (
                                  <option key={region} value={region}>{region}</option>
                              ))}
                          </select>
                          <select 
                              className="h-10 bg-background dark:bg-background border border-emerald-200 dark:border-emerald-800/30 rounded-xl px-3 text-sm outline-none flex-1 w-full disabled:opacity-50"
                              value={calcDistrict}
                              onChange={(e) => setCalcDistrict(e.target.value)}
                              disabled={!calcRegion || !TANZANIA_DISTRICTS[calcRegion]}
                          >
                              <option value="All Districts">Any District</option>
                              {(TANZANIA_DISTRICTS[calcRegion] || []).map(district => (
                                  <option key={district} value={district}>{district}</option>
                              ))}
                          </select>
                          <div className="flex-1 w-full flex justify-end items-center">
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 mr-3 uppercase font-bold tracking-wider">Effective Fee:</span>
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-sm px-3 py-1">
                                  {CURRENCY} {resolveShippingFee(calcRegion, calcDistrict, deliveryData.delivery_fee, shippingZones).toLocaleString()}
                              </Badge>
                          </div>
                      </div>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-foreground/8 dark:border-white/5">
                      <Button variant="primary" onClick={() => handleGenericSave({ ...deliveryData, shipping_zones: shippingZones }, "Delivery settings saved")} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Delivery Settings'}
                      </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === 'preferences' && (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                  <CardHeader>
                      <CardTitle>Store Operations</CardTitle>
                      <CardDescription>Manage alerts and availability.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                      <div className="flex items-center justify-between p-4 bg-foreground/[0.03] rounded-xl">
                          <div>
                              <p className="font-bold text-sm text-foreground">Order Notifications</p>
                              <p className="text-xs text-foreground/55">Get alerts for new orders</p>
                          </div>
                          <Switch checked={preferences.orderNotifications} onChange={() => setPreferences({...preferences, orderNotifications: !preferences.orderNotifications})} />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-foreground/[0.03] rounded-xl">
                          <div>
                              <p className="font-bold text-sm text-foreground">Low Stock Alerts</p>
                              <p className="text-xs text-foreground/55">Notify when inventory is low</p>
                          </div>
                          <Switch checked={preferences.stockAlerts} onChange={() => setPreferences({...preferences, stockAlerts: !preferences.stockAlerts})} />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl mt-4">
                          <div>
                              <p className="font-bold text-sm text-amber-900 dark:text-amber-100">Vacation Mode</p>
                              <p className="text-xs text-amber-700 dark:text-amber-300">Temporarily hide your store and products</p>
                          </div>
                          <Switch checked={preferences.vacationMode} onChange={() => setPreferences({...preferences, vacationMode: !preferences.vacationMode})} />
                      </div>
                  </CardContent>
              </Card>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};
