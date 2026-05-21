import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Input, Card, CardHeader, CardContent, CardTitle, CardDescription, ConfirmDialog, useToast, Switch, ConfirmModal, Badge } from '../components/UI';
import { User as UserIcon, Mail, Phone, Home, PlusCircle, Trash2, Edit, Loader2, Wallet, Gift, Copy, ArrowUpRight, ArrowDownLeft, Bell, Shield, Globe, CreditCard, Download, LogOut, CheckCircle2, MapPin, Settings, Lock, Activity } from 'lucide-react';
import { CURRENCY, TANZANIA_REGIONS, TANZANIA_DISTRICTS, MOBILE_MONEY_PROVIDERS, BANK_PROVIDERS, isValidTanzanianPhone } from '../constants';
import { supabase } from '../services/supabaseClient';

export const BuyerSettingsPage = () => {
  const { user, addresses, addAddress, updateAddress, deleteAddress, updateUserProfile, walletTransactions, paymentMethods, connectedAccounts, loginHistory } = useAppState();
  const { addToast } = useToast();
  
  const [activeTab, setActiveTab] = useState('profile');

  const [profileData, setProfileData] = useState({ 
    full_name: user?.full_name || user?.name || '', 
    phone: user?.phone || '',
    avatar_url: user?.avatar_url || '',
    region: user?.region || 'Dar es Salaam'
  });
  const [addressData, setAddressData] = useState({ label: '', street: '', city: 'Dar es Salaam', district: 'Kinondoni', phone: '' });
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<string | null>(null);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isUpdatingAddress, setIsUpdatingAddress] = useState(false);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({ type: 'visa', provider: 'visa', last4: '', phone_number: '' });
  const [isConfirmDeletePaymentOpen, setIsConfirmDeletePaymentOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);

  // New Feature States (Mocked for UI demonstration where DB columns don't exist)
  const [preferences, setPreferences] = useState({
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      newsletter: true,
      profileVisibility: false,
      twoFactorAuth: false,
      language: 'en',
      defaultCurrency: 'TZS',
      highContrastMode: false,
      exportFormat: 'csv',
      optOutAnalytics: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isConfirmAccountDeleteOpen, setIsConfirmAccountDeleteOpen] = useState(false);

  useEffect(() => {
    if (user) {
        setProfileData({ 
            full_name: user.full_name || user.name || '', 
            phone: user.phone || '',
            avatar_url: user.avatar_url || '',
            region: user.region || 'Dar es Salaam'
        });
        setPreferences({
            emailNotifications: user.email_notifications ?? true,
            smsNotifications: user.sms_notifications ?? false,
            pushNotifications: user.push_notifications ?? true,
            newsletter: user.newsletter ?? true,
            profileVisibility: user.profile_visibility ?? false,
            twoFactorAuth: user.two_factor_auth ?? false,
            language: user.language || 'en',
            defaultCurrency: user.default_currency || 'TZS',
            highContrastMode: user.high_contrast_mode ?? false,
            exportFormat: user.export_format || 'csv',
            optOutAnalytics: user.opt_out_analytics ?? false
        });
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileData.phone && !isValidTanzanianPhone(profileData.phone)) {
        addToast('Please enter a valid Tanzanian phone number (e.g., 0712345678)', 'error');
        return;
    }
    setIsSavingProfile(true);
    try {
        await updateUserProfile(profileData);
        addToast('Profile updated successfully', 'success');
    } catch (error) {
        addToast('Failed to update profile', 'error');
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addressData.phone && !isValidTanzanianPhone(addressData.phone)) {
        addToast('Please enter a valid Tanzanian phone number for this address', 'error');
        return;
    }
    setIsAddingAddress(true);
    try {
        await addAddress(addressData);
        addToast('Address added successfully', 'success');
        setAddressData({ label: '', street: '', city: 'Dar es Salaam', district: 'Kinondoni', phone: '' });
    } catch (error) {
        addToast('Failed to add address', 'error');
    } finally {
        setIsAddingAddress(false);
    }
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAddress) return;
    if (editingAddress.phone && !isValidTanzanianPhone(editingAddress.phone)) {
        addToast('Please enter a valid Tanzanian phone number', 'error');
        return;
    }
    setIsUpdatingAddress(true);
    try {
        await updateAddress(editingAddress.id, editingAddress);
        addToast('Address updated successfully', 'success');
        setEditingAddress(null);
    } catch (error) {
        addToast('Failed to update address', 'error');
    } finally {
        setIsUpdatingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (id: string) => {
      try {
          await updateAddress(id, { is_default: true });
          addToast('Default address updated', 'success');
      } catch (error) {
          addToast('Failed to set default address', 'error');
      }
  };

  const confirmDeleteAddress = (id: string) => {
    setAddressToDelete(id);
    setIsConfirmOpen(true);
  };

  const handleDeleteAddress = async () => {
    if (addressToDelete) {
        setIsDeletingAddress(true);
        try {
            await deleteAddress(addressToDelete);
            addToast('Address deleted successfully', 'success');
            setAddressToDelete(null);
        } catch (error) {
            addToast('Failed to delete address', 'error');
        } finally {
            setIsDeletingAddress(false);
        }
    }
    setIsConfirmOpen(false);
  };

  const copyReferralCode = () => {
      if (user?.referral_code) {
          navigator.clipboard.writeText(user.referral_code);
          addToast('Referral code copied to clipboard!', 'success');
      }
  };

  const togglePreference = async (key: keyof typeof preferences) => {
      const newValue = !preferences[key];
      setPreferences(prev => ({ ...prev, [key]: newValue }));
      
      const dbKey = (key as string).replace(/([A-Z])/g, "_$1").toLowerCase();
      try {
          await updateUserProfile({ [dbKey]: newValue });
          addToast('Preference updated', 'success');
      } catch (error) {
          addToast('Failed to update preference', 'error');
          setPreferences(prev => ({ ...prev, [key]: !newValue }));
      }
  };

  const handleLanguageChange = async (e: any) => {
      const lang = e.target.value;
      setPreferences({...preferences, language: lang});
      try {
          await updateUserProfile({ language: lang });
          addToast('Language updated', 'success');
      } catch (error) {
          addToast('Failed to update language', 'error');
      }
  };

  const handleExportData = async () => {
      if (!user) return;
      setIsExporting(true);
      try {
          const { data: orders } = await supabase
              .from('orders')
              .select('id, created_at, status, total, subtotal, delivery_fee, payment_method, items:order_items(price_at_purchase, quantity, product:products(name, category))')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
          if (!orders || orders.length === 0) {
              addToast('No orders to export', 'info');
              setIsExporting(false);
              return;
          }
          const headers = ['Order ID','Date','Status','Product','Category','Qty','Unit Price','Subtotal','Delivery','Total','Payment'];
          const rows: string[] = [headers.join(',')];
          (orders as any[]).forEach((order: any) => {
              const items: any[] = order.items || [];
              if (!items.length) {
                  rows.push([order.id.slice(0,8), new Date(order.created_at).toLocaleDateString(), order.status, '-','-','-','-', order.subtotal, order.delivery_fee, order.total, order.payment_method || 'N/A'].join(','));
              } else {
                  items.forEach((item: any, idx: number) => {
                      rows.push([
                          idx===0 ? order.id.slice(0,8) : '-',
                          idx===0 ? new Date(order.created_at).toLocaleDateString() : '-',
                          idx===0 ? order.status : '-',
                          '"'+(item.product?.name || 'Unknown')+'"',
                          item.product?.category || '-',
                          item.quantity,
                          item.price_at_purchase,
                          idx===0 ? order.subtotal : '-',
                          idx===0 ? order.delivery_fee : '-',
                          idx===0 ? order.total : '-',
                          idx===0 ? (order.payment_method || 'N/A') : '-'
                      ].join(','));
                  });
              }
          });
          const csv = rows.join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'malimart-orders-'+new Date().toISOString().split('T')[0]+'.csv';
          document.body.appendChild(a); a.click();
          document.body.removeChild(a); URL.revokeObjectURL(url);
          addToast('Exported '+orders.length+' orders as CSV', 'success');
      } catch (e) {
          addToast('Export failed. Please try again.', 'error');
      } finally { setIsExporting(false); }
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setIsAddingPayment(true);
      try {
          await supabase.from('payment_methods').insert({
              user_id: user.id,
              ...paymentData
          });
          addToast('Payment method added', 'success');
          setPaymentData({ type: 'visa', provider: 'visa', last4: '', phone_number: '' });
          // Force refresh data
          window.location.reload();
      } catch (error) {
          addToast('Failed to add payment method', 'error');
      } finally {
          setIsAddingPayment(false);
      }
  };

  const confirmDeletePayment = (id: string) => {
      setPaymentToDelete(id);
      setIsConfirmDeletePaymentOpen(true);
  };

  const handleDeletePayment = async () => {
      if (paymentToDelete) {
          setIsDeletingPayment(true);
          try {
              await supabase.from('payment_methods').delete().eq('id', paymentToDelete);
              addToast('Payment method removed', 'success');
              setPaymentToDelete(null);
              window.location.reload();
          } catch (error) {
              addToast('Failed to remove payment method', 'error');
          } finally {
              setIsDeletingPayment(false);
          }
      }
      setIsConfirmDeletePaymentOpen(false);
  };

  const handleConnectAccount = async (provider: string) => {
      if (!user) return;
      // OAuth flow: in production redirect to Supabase OAuth provider
      // For now, record the intent and show instructions
      const existing = connectedAccounts.find(a => a.provider === provider);
      if (existing) {
          addToast(provider + ' is already connected', 'info');
          return;
      }
      addToast('Redirecting to ' + provider + ' authorization...', 'info');
      // Supabase OAuth integration point
      // await supabase.auth.signInWithOAuth({ provider: provider.toLowerCase() as any, options: { redirectTo: window.location.href } });
  };

  const handleDisconnectAccount = async (provider: string) => {
      if (!user) return;
      try {
          await supabase.from('connected_accounts').delete().eq('user_id', user.id).eq('provider', provider);
          addToast(provider + ' disconnected', 'success');
          window.location.reload();
      } catch (error) {
          addToast('Failed to disconnect ' + provider, 'error');
      }
  };

  const confirmRequestAccountDeletion = () => {
      setIsConfirmAccountDeleteOpen(true);
  };

  const handleRequestAccountDeletion = async () => {
      try {
          // In a real app, this would flag the account or send an email
          await supabase.from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', user?.id);
          addToast('Account deletion requested', 'success');
      } catch (error) {
          addToast('Failed to request deletion', 'error');
      }
      setIsConfirmAccountDeleteOpen(false);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'billing', label: 'Billing & Shipping', icon: MapPin },
    { id: 'wallet', label: 'Wallet & Rewards', icon: Wallet },
    { id: 'security', label: 'Security & Privacy', icon: Shield },
  ];

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account preferences and settings.</p>
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
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </motion.button>
            ))}
          </motion.nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-6">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details and public profile.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="space-y-6">
                    <div className="flex items-center gap-6 mb-6">
                      <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                        {profileData.avatar_url ? (
                          <img src={profileData.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <UserIcon className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Input placeholder="Avatar URL (Optional)" value={profileData.avatar_url || ''} onChange={(e: any) => setProfileData({ ...profileData, avatar_url: e.target.value })} />
                        <p className="text-xs text-slate-500 mt-2">Provide a valid image URL for your profile picture.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</label>
                          <Input icon={UserIcon} placeholder="Full Name" value={profileData.full_name || ''} onChange={(e: any) => setProfileData({ ...profileData, full_name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
                          <Input icon={Mail} placeholder="Email Address" value={user?.email || ''} disabled className="bg-slate-50 dark:bg-slate-900/50 opacity-70" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone Number</label>
                          <Input icon={Phone} placeholder="Phone Number" value={profileData.phone || ''} onChange={(e: any) => setProfileData({ ...profileData, phone: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Region</label>
                          <div className="relative">
                              <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <select 
                                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 text-sm outline-none text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                  value={profileData.region || ''}
                                  onChange={(e: any) => setProfileData({ ...profileData, region: e.target.value })}
                              >
                                  {TANZANIA_REGIONS.map(region => (
                                      <option key={region} value={region}>{region}</option>
                                  ))}
                              </select>
                          </div>
                        </div>
                    </div>
                    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-white/5">
                      <Button type="submit" variant="primary" disabled={isSavingProfile}>
                        {isSavingProfile ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preferences</CardTitle>
                  <CardDescription>Customize your regional and display settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Language</label>
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select 
                                className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 text-sm outline-none text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                value={preferences.language}
                                onChange={handleLanguageChange}
                            >
                                <option value="en">English (US)</option>
                                <option value="sw">Swahili</option>
                                <option value="fr">French</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Default Currency</label>
                        <div className="relative">
                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <select 
                                className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 text-sm outline-none text-slate-900 dark:text-white appearance-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                value={preferences.defaultCurrency}
                                onChange={(e) => {
                                    setPreferences({...preferences, defaultCurrency: e.target.value});
                                    updateUserProfile({ default_currency: e.target.value });
                                }}
                            >
                                <option value="TZS">TZS - Tanzanian Shilling</option>
                                <option value="USD">USD - US Dollar</option>
                                <option value="KES">KES - Kenyan Shilling</option>
                            </select>
                        </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm text-slate-900 dark:text-white">High Contrast Mode</p>
                            <p className="text-xs text-slate-500">Improve visibility for accessibility</p>
                        </div>
                        <Switch checked={preferences.highContrastMode} onChange={() => togglePreference('highContrastMode')} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* BILLING & SHIPPING TAB */}
          {activeTab === 'billing' && (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Addresses</CardTitle>
                  <CardDescription>Manage where your orders are delivered.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {addresses.length === 0 ? (
                      <div className="text-center py-10 text-slate-500 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                          <MapPin className="w-8 h-8 mx-auto mb-3 text-slate-400 opacity-50" />
                          <p className="text-sm font-medium">No addresses found. Add one below.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[...addresses].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)).map((addr, idx) => (
                          <div key={addr.id} className={`p-5 border rounded-2xl flex flex-col justify-between transition-all ${addr.is_default ? 'border-slate-900 dark:border-white bg-slate-50/50 dark:bg-white/5 shadow-sm' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <div className="flex items-center gap-2 mb-2">
                                          <p className="font-semibold text-slate-900 dark:text-white">{addr.label}</p>
                                          {addr.is_default && <Badge variant="secondary" className="text-[10px] py-0 h-5 bg-slate-900 text-white dark:bg-white dark:text-slate-900">Default</Badge>}
                                      </div>
                                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{addr.street}<br/>{addr.district ? `${addr.district}, ` : ''}{addr.city}</p>
                                      <p className="text-sm text-slate-500 dark:text-slate-500 mt-2 flex items-center gap-1"><Phone className="w-3 h-3"/> {addr.phone}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2 justify-end mt-auto pt-4 border-t border-slate-100 dark:border-white/5">
                                  {!addr.is_default && <Button size="sm" variant="outline" onClick={() => handleSetDefaultAddress(addr.id)} className="text-xs">Set Default</Button>}
                                  <Button size="icon" variant="ghost" onClick={() => setEditingAddress(addr)}><Edit className="w-4 h-4" /></Button>
                                  <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => confirmDeleteAddress(addr.id)} disabled={isDeletingAddress && addressToDelete === addr.id}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                          </div>
                          ))}
                      </div>
                  )}
                  
                  <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                    <h3 className="font-semibold text-sm mb-4">Add New Address</h3>
                    <form onSubmit={handleAddAddress} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input placeholder="Label (e.g., Home, Office)" value={addressData.label} onChange={(e: any) => setAddressData({...addressData, label: e.target.value})} required />
                          <Input placeholder="Phone Number" value={addressData.phone} onChange={(e: any) => setAddressData({...addressData, phone: e.target.value})} required />
                          <div className="md:col-span-2">
                              <Input placeholder="Street Address" value={addressData.street} onChange={(e: any) => setAddressData({...addressData, street: e.target.value})} required />
                          </div>
                          <div className="md:col-span-1">
                              <select 
                                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                  value={addressData.city}
                                  onChange={(e: any) => setAddressData({...addressData, city: e.target.value, district: TANZANIA_DISTRICTS[e.target.value]?.[0] || ''})}
                                  required
                              >
                                  <option value="" disabled>Select Region/City</option>
                                  {TANZANIA_REGIONS.map(region => (
                                      <option key={region} value={region}>{region}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="md:col-span-1">
                              <select 
                                  className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all disabled:opacity-50"
                                  value={addressData.district}
                                  onChange={(e: any) => setAddressData({...addressData, district: e.target.value})}
                                  disabled={!addressData.city || !TANZANIA_DISTRICTS[addressData.city]}
                              >
                                  <option value="">Select District (Optional)</option>
                                  {(TANZANIA_DISTRICTS[addressData.city] || []).map(district => (
                                      <option key={district} value={district}>{district}</option>
                                  ))}
                              </select>
                          </div>
                      </div>
                      <Button type="submit" variant="secondary" disabled={isAddingAddress}>
                        {isAddingAddress ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...</> : <><PlusCircle className="w-4 h-4 mr-2" /> Add Address</>}
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Payment Methods</CardTitle>
                      <CardDescription>Manage your saved cards and mobile money.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      {paymentMethods.length === 0 ? (
                          <p className="text-sm text-slate-500">No payment methods added.</p>
                      ) : (
                          <div className="space-y-3">
                            {paymentMethods.map(pm => (
                                <div key={pm.id} className="p-4 border border-slate-200 dark:border-white/10 rounded-xl flex justify-between items-center bg-white dark:bg-slate-900">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-8 rounded flex items-center justify-center text-white font-bold text-[10px] ${pm.type === 'visa' ? 'bg-slate-900 dark:bg-slate-700' : 'bg-emerald-600'}`}>
                                          {pm.provider.toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-slate-900 dark:text-white">{pm.type === 'visa' ? `•••• •••• •••• ${pm.last4}` : pm.phone_number}</p>
                                            <p className="text-xs text-slate-500 capitalize">{pm.provider}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => confirmDeletePayment(pm.id)}>Remove</Button>
                                </div>
                            ))}
                          </div>
                      )}
                      
                      <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                        <h4 className="font-semibold text-sm mb-4">Add Payment Method</h4>
                        <form onSubmit={handleAddPaymentMethod} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select className="h-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white" value={paymentData.type} onChange={(e) => setPaymentData({...paymentData, type: e.target.value, provider: e.target.value === 'visa' ? 'visa' : (e.target.value === 'mobile' ? MOBILE_MONEY_PROVIDERS[0] : BANK_PROVIDERS[0])})}>
                                    <option value="visa">Card (Visa/Mastercard)</option>
                                    <option value="mobile">Mobile Money</option>
                                    <option value="bank">Bank Account</option>
                                </select>
                                {paymentData.type === 'mobile' && (
                                    <select className="h-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white" value={paymentData.provider} onChange={(e) => setPaymentData({...paymentData, provider: e.target.value})}>
                                        {MOBILE_MONEY_PROVIDERS.map(provider => (
                                            <option key={provider} value={provider}>{provider}</option>
                                        ))}
                                    </select>
                                )}
                                {paymentData.type === 'bank' && (
                                    <select className="h-10 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white" value={paymentData.provider} onChange={(e) => setPaymentData({...paymentData, provider: e.target.value})}>
                                        {BANK_PROVIDERS.map(provider => (
                                            <option key={provider} value={provider}>{provider}</option>
                                        ))}
                                    </select>
                                )}
                                {paymentData.type === 'visa' ? (
                                    <Input placeholder="Last 4 Digits" value={paymentData.last4} onChange={(e: any) => setPaymentData({...paymentData, last4: e.target.value})} maxLength={4} required />
                                ) : (
                                    <Input placeholder={paymentData.type === 'bank' ? "Account Number" : "Phone Number"} value={paymentData.phone_number} onChange={(e: any) => setPaymentData({...paymentData, phone_number: e.target.value})} required />
                                )}
                            </div>
                            <Button type="submit" variant="secondary" disabled={isAddingPayment}>
                                {isAddingPayment ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlusCircle className="w-4 h-4 mr-2" />} Add Method
                            </Button>
                        </form>
                      </div>
                  </CardContent>
              </Card>
            </div>
          )}

          {/* WALLET & REWARDS TAB */}
          {activeTab === 'wallet' && (
            <div className="space-y-6 animate-in fade-in">
              <Card className="overflow-hidden border-none bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <CardContent className="p-8 md:p-10 relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-black/5 blur-[80px] rounded-full pointer-events-none"></div>
                    <div className="relative z-10">
                      <p className="text-sm font-medium opacity-80 mb-2 flex items-center gap-2"><Wallet className="w-4 h-4" /> Available Balance</p>
                      <h2 className="text-5xl md:text-6xl font-display font-bold tracking-tight">{CURRENCY} {(user?.wallet_balance || 0).toLocaleString()}</h2>
                      <div className="mt-8 flex gap-3">
                        <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 dark:bg-black/5 dark:border-black/10 dark:text-slate-900 dark:hover:bg-black/10">Top Up</Button>
                        <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 dark:bg-black/5 dark:border-black/10 dark:text-slate-900 dark:hover:bg-black/10">Withdraw</Button>
                      </div>
                    </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {walletTransactions.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <p className="text-sm">No recent transactions.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {walletTransactions.slice(0, 5).map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                {tx.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900 dark:text-white capitalize">{tx.description || tx.type}</p>
                                                <p className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`font-semibold ${tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                            {tx.type === 'credit' ? '+' : '-'}{CURRENCY} {(tx.amount || 0).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/20">
                    <CardHeader>
                      <CardTitle className="text-emerald-900 dark:text-emerald-100 flex items-center gap-2"><Gift className="w-5 h-5" /> Invite & Earn</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-emerald-800 dark:text-emerald-200">Share your code. When a friend makes their first purchase, they get 10% off and you get {CURRENCY} 5,000.</p>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                            <code className="px-3 py-1 font-mono font-bold text-slate-900 dark:text-white text-sm flex-1 text-center">{user?.referral_code || 'MALI-XXXX'}</code>
                            <Button variant="secondary" size="icon" onClick={copyReferralCode} className="shrink-0 h-8 w-8">
                                <Copy className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY & PRIVACY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                  <CardHeader>
                      <CardTitle>Notifications</CardTitle>
                      <CardDescription>Control how we contact you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">Email Notifications</p>
                              <p className="text-xs text-slate-500">Order updates and promotions</p>
                          </div>
                          <Switch checked={preferences.emailNotifications} onChange={() => togglePreference('emailNotifications')} />
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">SMS Updates</p>
                              <p className="text-xs text-slate-500">Delivery tracking and alerts</p>
                          </div>
                          <Switch checked={preferences.smsNotifications} onChange={() => togglePreference('smsNotifications')} />
                      </div>
                      <div className="flex items-center justify-between py-3">
                          <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">Newsletter</p>
                              <p className="text-xs text-slate-500">Weekly deals and platform news</p>
                          </div>
                          <Switch checked={preferences.newsletter} onChange={() => togglePreference('newsletter')} />
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Security</CardTitle>
                      <CardDescription>Protect your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">Two-Factor Authentication (2FA)</p>
                              <p className="text-xs text-slate-500">Add an extra layer of security</p>
                          </div>
                          <Switch checked={preferences.twoFactorAuth} onChange={() => togglePreference('twoFactorAuth')} />
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">Public Profile</p>
                              <p className="text-xs text-slate-500">Allow others to see your reviews</p>
                          </div>
                          <Switch checked={preferences.profileVisibility} onChange={() => togglePreference('profileVisibility')} />
                      </div>
                      <div className="flex items-center justify-between py-3">
                          <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">Opt-out of Analytics</p>
                              <p className="text-xs text-slate-500">Do not track my usage data</p>
                          </div>
                          <Switch checked={preferences.optOutAnalytics} onChange={() => togglePreference('optOutAnalytics')} />
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Connected Accounts</CardTitle>
                      <CardDescription>Link social accounts for quicker login.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {['google', 'facebook'].map(provider => {
                              const account = connectedAccounts.find(a => a.provider === provider);
                              return (
                                  <div key={provider} className="flex items-center justify-between p-4 border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-white/5">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${provider === 'google' ? 'bg-white' : 'bg-[#1877F2]'}`}>
                                              {provider === 'google' ? (
                                                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                              ) : (
                                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                              )}
                                          </div>
                                          <span className="font-medium text-sm text-slate-900 dark:text-white capitalize">{provider}</span>
                                      </div>
                                      {account ? (
                                          <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Connected</span>
                                      ) : (
                                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleConnectAccount(provider)}>Connect</Button>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Data & Account Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl">
                          <div>
                              <p className="font-medium text-sm text-slate-900 dark:text-white">Export Format</p>
                              <p className="text-xs text-slate-500">Preferred format for data exports</p>
                          </div>
                          <select 
                              className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-3 text-sm outline-none"
                              value={preferences.exportFormat}
                              onChange={(e) => {
                                  setPreferences({...preferences, exportFormat: e.target.value});
                                  updateUserProfile({ export_format: e.target.value as any });
                              }}
                          >
                              <option value="csv">CSV</option>
                              <option value="pdf">PDF</option>
                              <option value="json">JSON</option>
                          </select>
                      </div>

                      <div className="flex flex-col md:flex-row gap-4">
                          <Button variant="secondary" className="flex-1" onClick={handleExportData} disabled={isExporting}>
                              {isExporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting...</> : <><Download className="w-4 h-4 mr-2" /> Export Data</>}
                          </Button>
                          <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:border-red-900/50" onClick={confirmRequestAccountDeletion}>
                              <LogOut className="w-4 h-4 mr-2" /> Delete Account
                          </Button>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Recent Logins</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-2">
                          {loginHistory.length === 0 ? (
                              <p className="text-sm text-slate-500">No recent logins found.</p>
                          ) : (
                              loginHistory.map((login, idx) => (
                                  <div key={idx} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                                      <div>
                                          <p className="text-sm font-medium">{login.device_info || 'Unknown Device'}</p>
                                          <p className="text-xs text-slate-500">{login.ip_address || 'Unknown IP'}</p>
                                      </div>
                                      <p className="text-xs text-slate-500">{new Date(login.login_time).toLocaleString()}</p>
                                  </div>
                              ))
                          )}
                      </div>
                  </CardContent>
              </Card>
            </div>
          )}

        </main>
      </div>

      {editingAddress && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
            <Card className="max-w-md w-full shadow-2xl border-none">
                <CardHeader>
                    <CardTitle>Edit Address</CardTitle>
                    <CardDescription>Update your shipping address details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateAddress} className="space-y-4">
                        <Input placeholder="Label" value={editingAddress.label || ''} onChange={(e: any) => setEditingAddress({...editingAddress, label: e.target.value})} />
                        <Input placeholder="Street" value={editingAddress.street || ''} onChange={(e: any) => setEditingAddress({...editingAddress, street: e.target.value})} />
                        <div className="grid grid-cols-2 gap-4">
                            <select 
                                className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                value={editingAddress.city || ''}
                                onChange={(e: any) => setEditingAddress({...editingAddress, city: e.target.value, district: TANZANIA_DISTRICTS[e.target.value]?.[0] || ''})}
                                required
                            >
                                <option value="" disabled>Select Region/City</option>
                                {TANZANIA_REGIONS.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                            <select 
                                className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-sm outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all disabled:opacity-50"
                                value={editingAddress.district || ''}
                                onChange={(e: any) => setEditingAddress({...editingAddress, district: e.target.value})}
                                disabled={!editingAddress.city || !TANZANIA_DISTRICTS[editingAddress.city]}
                            >
                                <option value="">Select District</option>
                                {(TANZANIA_DISTRICTS[editingAddress.city] || []).map(district => (
                                    <option key={district} value={district}>{district}</option>
                                ))}
                            </select>
                        </div>
                        <Input placeholder="Phone" value={editingAddress.phone || ''} onChange={(e: any) => setEditingAddress({...editingAddress, phone: e.target.value})} />
                        <div className="flex gap-3 pt-4">
                            <Button variant="secondary" type="button" onClick={() => setEditingAddress(null)} className="flex-1">Cancel</Button>
                            <Button variant="primary" type="submit" className="flex-1" disabled={isUpdatingAddress}>
                                {isUpdatingAddress ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Delete Address"
        message="Are you sure you want to delete this address? This action cannot be undone."
        onConfirm={handleDeleteAddress}
        onCancel={() => setIsConfirmOpen(false)}
        isDangerous
      />
      <ConfirmDialog
        isOpen={isConfirmDeletePaymentOpen}
        title="Remove Payment Method"
        message="Are you sure you want to remove this payment method?"
        onConfirm={handleDeletePayment}
        onCancel={() => setIsConfirmDeletePaymentOpen(false)}
        isDangerous
      />
      <ConfirmModal 
        isOpen={isConfirmAccountDeleteOpen}
        onClose={() => setIsConfirmAccountDeleteOpen(false)}
        onConfirm={handleRequestAccountDeletion}
        title="Request Account Deletion"
        message="Are you sure you want to request account deletion? This action is irreversible."
        confirmText="Request Deletion"
        isDestructive={true}
      />
    </div>
  );
};
