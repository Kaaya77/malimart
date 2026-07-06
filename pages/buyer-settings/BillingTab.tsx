import React from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, Select } from '../../components/UI';
import { BANK_PROVIDERS, MOBILE_MONEY_PROVIDERS, TANZANIA_DISTRICTS, TANZANIA_REGIONS } from '../../constants';
import { CreditCard, Edit, MapPin, Phone, PlusCircle, Trash2 } from 'lucide-react';
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
                      <EmptyState
                          icon={MapPin}
                          title="No addresses yet"
                          subtitle="Add your first delivery address below so checkout is one tap."
                          className="bg-foreground/[0.02] rounded-3xl border border-dashed border-foreground/10 py-12"
                      />
                  ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[...addresses].sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)).map((addr, idx) => (
                          <div key={addr.id} className={`p-5 border rounded-3xl flex flex-col justify-between transition-all ${addr.is_default ? 'border-emerald-500/40 bg-emerald-500/[0.04] shadow-sm' : 'border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20'}`}>
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <div className="flex items-center gap-2 mb-2">
                                          <p className="font-semibold text-foreground">{addr.label}</p>
                                          {addr.is_default && <Badge variant="success" className="text-[10px] uppercase tracking-widest py-0 h-5">Default</Badge>}
                                      </div>
                                      <p className="text-sm text-foreground/60 leading-relaxed">{addr.street}<br/>{addr.district ? `${addr.district}, ` : ''}{addr.city}</p>
                                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1"><Phone className="w-3 h-3"/> {addr.phone}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2 justify-end mt-auto pt-4 border-t border-foreground/[0.06]">
                                  {!addr.is_default && <Button size="sm" variant="outline" onClick={() => handleSetDefaultAddress(addr.id)} className="text-xs">Set Default</Button>}
                                  <Button size="icon" variant="ghost" aria-label={`Edit ${addr.label || 'address'}`} className="h-11 w-11" onClick={() => setEditingAddress(addr)}><Edit className="w-4 h-4" /></Button>
                                  <Button size="icon" variant="ghost" aria-label={`Delete ${addr.label || 'address'}`} className="h-11 w-11 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => confirmDeleteAddress(addr.id)} isLoading={isDeletingAddress && addressToDelete === addr.id}>{!(isDeletingAddress && addressToDelete === addr.id) && <Trash2 className="w-4 h-4" />}</Button>
                              </div>
                          </div>
                          ))}
                      </div>
                  )}
                  
                  <div className="pt-6 border-t border-foreground/[0.06]">
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Add New Address</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">Save a new delivery location for faster checkout.</p>
                    <form onSubmit={handleAddAddress} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Input placeholder="Label (e.g., Home, Office)" value={addressData.label} onChange={(e: any) => setAddressData({...addressData, label: e.target.value})} required />
                          <Input placeholder="Phone Number" value={addressData.phone} onChange={(e: any) => setAddressData({...addressData, phone: e.target.value})} required />
                          <div className="md:col-span-2">
                              <Input placeholder="Street Address" value={addressData.street} onChange={(e: any) => setAddressData({...addressData, street: e.target.value})} required />
                          </div>
                          <div className="md:col-span-1">
                              <Select
                                  aria-label="Region or city"
                                  value={addressData.city}
                                  onChange={(e: any) => setAddressData({...addressData, city: e.target.value, district: TANZANIA_DISTRICTS[e.target.value]?.[0] || ''})}
                                  required
                              >
                                  <option value="" disabled>Select Region/City</option>
                                  {TANZANIA_REGIONS.map(region => (
                                      <option key={region} value={region}>{region}</option>
                                  ))}
                              </Select>
                          </div>
                          <div className="md:col-span-1">
                              <Select
                                  aria-label="District"
                                  value={addressData.district}
                                  onChange={(e: any) => setAddressData({...addressData, district: e.target.value})}
                                  disabled={!addressData.city || !TANZANIA_DISTRICTS[addressData.city]}
                              >
                                  <option value="">Select District (Optional)</option>
                                  {(TANZANIA_DISTRICTS[addressData.city] || []).map(district => (
                                      <option key={district} value={district}>{district}</option>
                                  ))}
                              </Select>
                          </div>
                      </div>
                      <Button type="submit" variant="secondary" isLoading={isAddingAddress}>
                        {isAddingAddress ? 'Adding...' : <><PlusCircle className="w-4 h-4 mr-2" /> Add Address</>}
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
                          <EmptyState
                              icon={CreditCard}
                              title="No payment methods saved"
                              subtitle="Add a card, mobile money number, or bank account below to speed up checkout."
                              className="bg-foreground/[0.02] rounded-3xl border border-dashed border-foreground/10 py-12"
                          />
                      ) : (
                          <div className="space-y-3">
                            {paymentMethods.map(pm => (
                                <div key={pm.id} className="p-4 border border-foreground/10 rounded-2xl flex justify-between items-center bg-foreground/[0.02]">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-8 rounded-lg flex items-center justify-center text-white font-bold text-[10px] uppercase tracking-widest ${pm.type === 'visa' ? 'bg-slate-900 dark:bg-slate-700' : 'bg-emerald-600'}`}>
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
                      
                      <div className="pt-6 border-t border-foreground/[0.06]">
                        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Add Payment Method</h4>
                        <p className="text-xs text-muted-foreground mt-1 mb-4">We only store the last digits — never your full card number.</p>
                        <form onSubmit={handleAddPaymentMethod} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select aria-label="Payment method type" value={paymentData.type} onChange={(e: any) => setPaymentData({...paymentData, type: e.target.value, provider: e.target.value === 'visa' ? 'visa' : (e.target.value === 'mobile' ? MOBILE_MONEY_PROVIDERS[0] : BANK_PROVIDERS[0])})}>
                                    <option value="visa">Card (Visa/Mastercard)</option>
                                    <option value="mobile">Mobile Money</option>
                                    <option value="bank">Bank Account</option>
                                </Select>
                                {paymentData.type === 'mobile' && (
                                    <Select aria-label="Mobile money provider" value={paymentData.provider} onChange={(e: any) => setPaymentData({...paymentData, provider: e.target.value})}>
                                        {MOBILE_MONEY_PROVIDERS.map(provider => (
                                            <option key={provider} value={provider}>{provider}</option>
                                        ))}
                                    </Select>
                                )}
                                {paymentData.type === 'bank' && (
                                    <Select aria-label="Bank" value={paymentData.provider} onChange={(e: any) => setPaymentData({...paymentData, provider: e.target.value})}>
                                        {BANK_PROVIDERS.map(provider => (
                                            <option key={provider} value={provider}>{provider}</option>
                                        ))}
                                    </Select>
                                )}
                                {paymentData.type === 'visa' ? (
                                    <Input placeholder="Last 4 Digits" value={paymentData.last4} onChange={(e: any) => setPaymentData({...paymentData, last4: e.target.value})} maxLength={4} required />
                                ) : (
                                    <Input placeholder={paymentData.type === 'bank' ? "Account Number" : "Phone Number"} value={paymentData.phone_number} onChange={(e: any) => setPaymentData({...paymentData, phone_number: e.target.value})} required />
                                )}
                            </div>
                            <Button type="submit" variant="secondary" isLoading={isAddingPayment}>
                                {!isAddingPayment && <PlusCircle className="w-4 h-4 mr-2" />} Add Method
                            </Button>
                        </form>
                      </div>
                  </CardContent>
              </Card>
            </div>
    );
};
