import React from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input } from '../../components/UI';
import { BANK_PROVIDERS, MOBILE_MONEY_PROVIDERS, isValidTIN, isValidVRN } from '../../constants';
import { CreditCard, DollarSign, Info, Loader2, PlusCircle, Store, Trash2 } from 'lucide-react';
import { useSellerSettings } from './context';

export const BusinessTab = () => {
    const { businessData, handleAddPayment, handleGenericSave, handleRemovePayment, isSaving, newPayment, paymentMethods, setBusinessData, setNewPayment } = useSellerSettings();
    const tinError = businessData.tin_number && !isValidTIN(businessData.tin_number) ? 'TIN must be exactly 9 digits' : '';
    const vrnError = businessData.vrn && !isValidVRN(businessData.vrn) ? 'VRN must have at least 9 digits' : '';
    return (
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
 <div key={method.id} className="flex items-center justify-between p-3 border border-foreground/8 rounded-xl bg-foreground/[0.02]">
 <div className="flex items-center gap-4">
 <div className={`w-10 h-10 rounded-none flex items-center justify-center border border-foreground/10 ${method.type === 'mobile' ? 'bg-foreground/[0.04]' : 'bg-foreground/[0.04]'}`}>
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
 <EmptyState icon={CreditCard} title="No payment methods yet" subtitle="Add a mobile money or bank account so buyers can pay you." className="py-8" />
 )}

 <div className="pt-6 border-t border-foreground/10 space-y-4">
 <h4 className="text-sm font-semibold text-foreground mb-2">Add New Payment Method</h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <select
 aria-label="Payment method type"
 className="flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all"
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
 aria-label="Provider"
 className="flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all"
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
 <label htmlFor="tin-number" className="text-xs font-semibold text-foreground/70 mb-1.5 block">TIN Number</label>
 <Input id="tin-number" placeholder="TIN Number" value={businessData.tin_number} onChange={(e: any) => setBusinessData({...businessData, tin_number: e.target.value})}
   className={tinError ? 'border-rose-500/60 focus:ring-rose-500/30 focus:border-rose-500/60' : undefined} aria-invalid={!!tinError} />
 {tinError && <p className="text-[11px] text-rose-500 mt-0.5">{tinError}</p>}
 </div>
 <div className="space-y-1">
 <label htmlFor="business-reg-no" className="text-xs font-semibold text-foreground/70 mb-1.5 block">Business Registration No.</label>
 <Input id="business-reg-no" placeholder="Registration No." value={businessData.business_reg_no} onChange={(e: any) => setBusinessData({...businessData, business_reg_no: e.target.value})} />
 </div>
 <div className="space-y-1">
 <label htmlFor="vrn-number" className="text-xs font-semibold text-foreground/70 mb-1.5 block">VAT Registration Number (VRN)</label>
 <Input id="vrn-number" placeholder="Optional VRN" value={businessData.vrn} onChange={(e: any) => setBusinessData({...businessData, vrn: e.target.value})}
   className={vrnError ? 'border-rose-500/60 focus:ring-rose-500/30 focus:border-rose-500/60' : undefined} aria-invalid={!!vrnError} />
 {vrnError && <p className="text-[11px] text-rose-500 mt-0.5">{vrnError}</p>}
 </div>
 <div className="space-y-1">
 <label htmlFor="payout-schedule" className="text-xs font-semibold text-foreground/70 mb-1.5 block">Payout Schedule</label>
 <select
 id="payout-schedule"
 className="flex h-11 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-4 text-sm text-foreground focus:outline-none focus:border-foreground/30 transition-all"
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
 <Button variant="primary" onClick={() => handleGenericSave(businessData, "Business info saved")} disabled={isSaving}>
 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Business Info'}
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
    );
};
