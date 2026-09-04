import React from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '../../components/UI';
import { CURRENCY, TANZANIA_DISTRICTS, TANZANIA_REGIONS, resolveShippingFee } from '../../constants';
import { Loader2, Settings, Trash2, Truck } from 'lucide-react';
import { useSellerSettings } from './context';

export const DeliveryTab = () => {
    const { calcDistrict, calcRegion, deliveryData, handleAddZone, handleGenericSave, handleRemoveZone, isSaving, newZone, setCalcDistrict, setCalcRegion, setDeliveryData, setNewZone, shippingZones } = useSellerSettings();
    return (
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
 <div key={zone.id || idx} className="p-3 border border-foreground/10 rounded-xl flex justify-between items-center bg-background">
 <div>
 <span className="font-medium text-sm block">{zone.region}</span>
 {zone.district !== 'All Districts' && <span className="text-xs text-foreground/55">{zone.district}</span>}
 </div>
 <div className="flex items-center gap-3">
 <span className="font-black font-mono text-sm">{CURRENCY} {zone.fee.toLocaleString()}</span>
 <Button variant="ghost" size="icon" className="text-red-500 h-6 w-6" onClick={() => handleRemoveZone(zone.id)}>
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
 aria-label="Region for this fee"
 className="h-10 bg-background border border-foreground/10 rounded-xl px-3 text-sm outline-none flex-1"
 value={newZone.region}
 onChange={(e) => setNewZone({...newZone, region: e.target.value, district: 'All Districts'})}
 >
 {TANZANIA_REGIONS.map(region => (
 <option key={region} value={region}>{region}</option>
 ))}
 </select>
 <select
 aria-label="District for this fee"
 className="h-10 bg-background border border-foreground/10 rounded-xl px-3 text-sm outline-none flex-1 disabled:opacity-50"
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
 aria-label="Test region"
 className="h-10 bg-background border border-emerald-200 dark:border-emerald-800/30 rounded-xl px-3 text-sm outline-none flex-1 w-full"
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
 aria-label="Test district"
 className="h-10 bg-background border border-emerald-200 dark:border-emerald-800/30 rounded-xl px-3 text-sm outline-none flex-1 w-full disabled:opacity-50"
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
 <Button variant="primary" onClick={() => handleGenericSave({ ...deliveryData }, "Delivery settings saved")} disabled={isSaving}>
 {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Delivery Settings'}
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
    );
};
