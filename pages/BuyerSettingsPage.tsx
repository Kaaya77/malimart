import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppState } from '../context/AppContext';
import { Button, Input, Card, CardHeader, CardContent, CardTitle, CardDescription, ConfirmDialog, useToast, Switch, ConfirmModal, Badge } from '../components/UI';
import { User as UserIcon, Mail, Phone, Home, PlusCircle, Trash2, Edit, Wallet, Gift, Copy, ArrowUpRight, ArrowDownLeft, Bell, Shield, Globe, CreditCard, Download, LogOut, CheckCircle2, MapPin, Settings, Lock, Activity } from 'lucide-react';
import { BackButton } from '../components/BackButton';
import { CURRENCY, TANZANIA_REGIONS, TANZANIA_DISTRICTS, MOBILE_MONEY_PROVIDERS, BANK_PROVIDERS, isValidTanzanianPhone } from '../constants';
import { getMyOrdersForExport, listMyPaymentMethods, addMyPaymentMethod, deleteMyPaymentMethod, disconnectMyAccount, requestMyAccountDeletion } from '../services/accountApi';
import { BuyerSettingsCtx } from './buyer-settings/context';
import { ProfileTab } from './buyer-settings/ProfileTab';
import { BillingTab } from './buyer-settings/BillingTab';
import { WalletTab } from './buyer-settings/WalletTab';
import { SecurityTab } from './buyer-settings/SecurityTab';


export const BuyerSettingsPage = () => {
  const { user, addresses, addAddress, updateAddress, deleteAddress, updateUserProfile, walletTransactions, paymentMethods, connectedAccounts, loginHistory } = useAppState();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('profile');

  const [profileData, setProfileData] = useState({ 
    full_name: user?.full_name || user?.name || '', 
    display_name: user?.display_name || '',
    phone: user?.phone || '',
    avatar_url: user?.avatar_url || '',
    cover_image_url: user?.cover_image_url || '',
    region: user?.region || 'Dar es Salaam',
    bio: user?.bio || '',
    timezone: user?.timezone || 'Africa/Dar_es_Salaam',
    pronouns: user?.pronouns || '',
    signature_emoji: user?.signature_emoji || '',
    greeting_style: user?.greeting_style || 'karibu',
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
            display_name: user.display_name || '',
            phone: user.phone || '',
            avatar_url: user.avatar_url || '',
            cover_image_url: user.cover_image_url || '',
            region: user.region || 'Dar es Salaam',
            bio: user.bio || '',
            timezone: user.timezone || 'Africa/Dar_es_Salaam',
            pronouns: user.pronouns || '',
            signature_emoji: user.signature_emoji || '',
            greeting_style: user.greeting_style || 'karibu',
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
          const { data: orders } = await getMyOrdersForExport(user.id);
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

  const [localPaymentMethods, setLocalPaymentMethods] = useState<any[] | null>(null);
  const activePaymentMethods = localPaymentMethods ?? paymentMethods;

  const refreshPaymentMethods = async () => {
      if (!user) return;
      const { data } = await listMyPaymentMethods(user.id);
      if (data) setLocalPaymentMethods(data);
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setIsAddingPayment(true);
      try {
          const { error } = await addMyPaymentMethod(user.id, paymentData);
          if (error) throw error;
          addToast('Payment method added', 'success');
          setPaymentData({ type: 'visa', provider: 'visa', last4: '', phone_number: '' });
          await refreshPaymentMethods();
      } catch (error: any) {
          addToast(error?.message || 'Failed to add payment method', 'error');
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
              const { error } = await deleteMyPaymentMethod(paymentToDelete);
              if (error) throw error;
              addToast('Payment method removed', 'success');
              setLocalPaymentMethods(prev => (prev ?? paymentMethods).filter(p => p.id !== paymentToDelete));
              setPaymentToDelete(null);
          } catch (error: any) {
              addToast(error?.message || 'Failed to remove payment method', 'error');
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
          await disconnectMyAccount(user.id, provider);
          addToast(provider + ' disconnected', 'success');
          // (state refreshed via AppContext subscription)
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
          await requestMyAccountDeletion(user?.id);
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
  const __ctx = { addToast, addressData, addressToDelete, addresses, confirmDeleteAddress, confirmDeletePayment, confirmRequestAccountDeletion, connectedAccounts, copyReferralCode, handleAddAddress, handleAddPaymentMethod, handleConnectAccount, handleExportData, handleLanguageChange, handleProfileUpdate, handleSetDefaultAddress, isAddingAddress, isAddingPayment, isDeletingAddress, isExporting, isSavingProfile, loginHistory, paymentData, paymentMethods: activePaymentMethods, preferences, profileData, setAddressData, setEditingAddress, setPaymentData, setPreferences, setProfileData, togglePreference, updateUserProfile, user, walletTransactions };


  return (
  <BuyerSettingsCtx.Provider value={__ctx}>

    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in">
      <div className="mb-8">
        <BackButton label="Back" className="mb-3" />
        <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences and settings.</p>
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
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`flex items-center gap-3 px-4 py-3 min-h-11 rounded-2xl text-sm font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  activeTab === tab.id
                    ? 'bg-foreground text-background'
                    : 'text-foreground/50 hover:text-foreground hover:bg-foreground/[0.06]'
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
          {activeTab === 'profile' && <ProfileTab />}

          {/* BILLING & SHIPPING TAB */}
          {activeTab === 'billing' && <BillingTab />}

          {/* WALLET & REWARDS TAB */}
          {activeTab === 'wallet' && <WalletTab />}

          {/* SECURITY & PRIVACY TAB */}
          {activeTab === 'security' && <SecurityTab />}

        </main>
      </div>

      {editingAddress && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <Card className="max-w-md w-full shadow-2xl border-none">
                <CardHeader>
                    <CardTitle>Edit Address</CardTitle>
                    <CardDescription>Update your shipping address details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateAddress} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Label</label>
                            <Input placeholder="Label (e.g., Home, Office)" value={editingAddress.label || ''} onChange={(e: any) => setEditingAddress({...editingAddress, label: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Street</label>
                            <Input placeholder="Street" value={editingAddress.street || ''} onChange={(e: any) => setEditingAddress({...editingAddress, street: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <select
                                aria-label="Region or city"
                                className="w-full h-12 bg-background border border-foreground/10 rounded-2xl px-3 text-sm font-medium outline-none text-foreground focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all"
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
                                aria-label="District"
                                className="w-full h-12 bg-background border border-foreground/10 rounded-2xl px-3 text-sm font-medium outline-none text-foreground focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50 transition-all disabled:opacity-50"
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
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Phone</label>
                            <Input placeholder="Phone" value={editingAddress.phone || ''} onChange={(e: any) => setEditingAddress({...editingAddress, phone: e.target.value})} />
                        </div>
                        <div className="flex gap-3 pt-4">
                            <Button variant="secondary" type="button" onClick={() => setEditingAddress(null)} className="flex-1">Cancel</Button>
                            <Button variant="primary" type="submit" className="flex-1" isLoading={isUpdatingAddress}>
                                {isUpdatingAddress ? 'Saving...' : 'Save Changes'}
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
        isLoading={isDeletingAddress}
      />
      <ConfirmDialog
        isOpen={isConfirmDeletePaymentOpen}
        title="Remove Payment Method"
        message="Are you sure you want to remove this payment method?"
        onConfirm={handleDeletePayment}
        onCancel={() => setIsConfirmDeletePaymentOpen(false)}
        isDangerous
        isLoading={isDeletingPayment}
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
  </BuyerSettingsCtx.Provider>
  );
};
