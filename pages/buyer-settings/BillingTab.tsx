import React from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '../../components/UI';
import { BANK_PROVIDERS, MOBILE_MONEY_PROVIDERS, TANZANIA_DISTRICTS, TANZANIA_REGIONS } from '../../constants';
import { Edit, Home, Loader2, MapPin, Phone, PlusCircle, Trash2 } from 'lucide-react';
import { useBuyerSettings } from './context';

export const BillingTab = () => {
    const { addressData, addressToDelete, addresses, confirmDeleteAddress, confirmDeletePayment, handleAddAddress, handleAddPaymentMethod, handleSetDefaultAddress, isAddingAddress, isAddingPayment, isDeletingAddress, paymentData, paymentMethods, setAddressData, setEditingAddress, setPaymentData } = useBuyerSettings();
    return (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Addresses</CardTitle>
                  <CardDescription>Manage where your orders are delivered.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {addresses.length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground bg-foreground/[0.03]  rounded-2xl border border-dashed border-foreground/10">
                          <MapPin className="w-8 h-8 mx-auto mb-3 text-foreground/40 opacity-50" />
                          <p className="text-sm font-medium">No addresses found. Add one below.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[...addresses].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)).map((addr, idx) => (
                          <div key={addr.id} className={`p-5 border rounded-2xl flex flex-col justify-between transition-all ${addr.is_default ? 'border-slate-900 dark:border-white bg-foreground/[0.03]/50  shadow-sm' : 'border-foreground/10 hover:border-slate-300 dark:hover:border-white/20'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <div className="flex items-center gap-2 mb-2">
                                          <p className="font-semibold text-foreground">{addr.label}</p>
                                          {addr.is_default && <Badge variant="secondary" className="text-[10px] py-0 h-5 bg-slate-900 text-white dark:bg-white dark:text-slate-900">Default</Badge>}
                                      </div>
                                      <p className="text-sm text-foreground/60 leading-relaxed">{addr.street}<br/>{addr.district ? `${addr.district}, ` : ''}{addr.city}</p>
                                      <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-2 flex items-center gap-1"><Phone className="w-3 h-3"/> {addr.phone}</p>
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
                                  className="w-full h-10 bg-background border border-foreground/10 rounded-xl px-3 text-sm outline-none text-foreground focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
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
                                  className="w-full h-10 bg-background border border-foreground/10 rounded-xl px-3 text-sm outline-none text-foreground focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all disabled:opacity-50"
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
                          <p className="text-sm text-muted-foreground">No payment methods added.</p>
                      ) : (
                          <div className="space-y-3">
                            {paymentMethods.map(pm => (
                                <div key={pm.id} className="p-4 border border-foreground/10 rounded-xl flex justify-between items-center bg-background">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-8 rounded flex items-center justify-center text-white font-bold text-[10px] ${pm.type === 'visa' ? 'bg-slate-900 dark:bg-slate-700' : 'bg-emerald-600'}`}>
                                          {pm.provider.toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-foreground">{pm.type === 'visa' ? `•••• •••• •••• ${pm.last4}` : pm.phone_number}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{pm.provider}</p>
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
                                <select className="h-10 bg-background rounded-xl border border-foreground/10 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white" value={paymentData.type} onChange={(e) => setPaymentData({...paymentData, type: e.target.value, provider: e.target.value === 'visa' ? 'visa' : (e.target.value === 'mobile' ? MOBILE_MONEY_PROVIDERS[0] : BANK_PROVIDERS[0])})}>
                                    <option value="visa">Card (Visa/Mastercard)</option>
                                    <option value="mobile">Mobile Money</option>
                                    <option value="bank">Bank Account</option>
                                </select>
                                {paymentData.type === 'mobile' && (
                                    <select className="h-10 bg-background rounded-xl border border-foreground/10 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white" value={paymentData.provider} onChange={(e) => setPaymentData({...paymentData, provider: e.target.value})}>
                                        {MOBILE_MONEY_PROVIDERS.map(provider => (
                                            <option key={provider} value={provider}>{provider}</option>
                                        ))}
                                    </select>
                                )}
                                {paymentData.type === 'bank' && (
                                    <select className="h-10 bg-background rounded-xl border border-foreground/10 px-3 text-sm outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white" value={paymentData.provider} onChange={(e) => setPaymentData({...paymentData, provider: e.target.value})}>
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
    );
};
