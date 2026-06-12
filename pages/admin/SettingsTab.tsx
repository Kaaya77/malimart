import React from 'react';
import { Button, Input, Switch } from '../../components/UI';
import { motion } from 'framer-motion';
import { useAdmin } from './context';

export const SettingsTab = () => {
    const { handleSaveSettings, platformSettings, products, setPlatformSettings } = useAdmin();
    return (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-8"
                            >
                                <div className="p-8 bg-card rounded-3xl border border-border shadow-sm">
                                    <h3 className="font-sans font-bold text-2xl tracking-tight mb-8">Platform Configuration</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Maintenance Mode</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Disable access for non-admin users</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.maintenanceMode} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, maintenanceMode: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Allow New Signups</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Open registration for new buyers and sellers</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.newSignups} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, newSignups: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Auto-Approve Vendors</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Bypass manual verification for new stores</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.autoApproveVendors} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, autoApproveVendors: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Require Vendor Verification</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Mandatory KYC for new sellers</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.requireVendorVerification} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, requireVendorVerification: c})} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border border-border">
                                            <div>
                                                <p className="font-sans font-bold text-base text-foreground">Enable Loyalty Program</p>
                                                <p className="text-xs font-medium text-muted-foreground mt-1">Allow buyers to earn points</p>
                                            </div>
                                            <Switch 
                                                checked={platformSettings.enableLoyaltyProgram} 
                                                onCheckedChange={(c) => setPlatformSettings({...platformSettings, enableLoyaltyProgram: c})} 
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Global Commission Rate (%)</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">The percentage taken from every successful sale.</p>
                                                <Input 
                                                    type="number" 
                                                    value={platformSettings.globalCommission} 
                                                    onChange={(e: any) => setPlatformSettings({...platformSettings, globalCommission: Number(e.target.value)})}
                                                    className="w-full bg-background border-border text-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Audit Log Retention (Days)</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">How long to keep system activity logs.</p>
                                                <Input 
                                                    type="number" 
                                                    value={platformSettings.auditRetentionDays} 
                                                    onChange={(e: any) => setPlatformSettings({...platformSettings, auditRetentionDays: Number(e.target.value)})}
                                                    className="w-full bg-background border-border text-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Max Products Per Vendor</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Limit the number of active products.</p>
                                                <Input 
                                                    type="number" 
                                                    value={platformSettings.maxProductsPerVendor} 
                                                    onChange={(e: any) => setPlatformSettings({...platformSettings, maxProductsPerVendor: Number(e.target.value)})}
                                                    className="w-full bg-background border-border text-foreground rounded-xl focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                                                />
                                            </div>
                                            <div className="p-6 bg-muted/30 rounded-2xl border border-border">
                                                <label className="block font-sans font-bold text-sm text-foreground mb-1">Default Currency</label>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Base currency for the platform.</p>
                                                <select 
                                                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm font-medium text-foreground outline-none focus:ring-1 focus:ring-primary transition-colors shadow-sm"
                                                    value={platformSettings.defaultCurrency}
                                                    onChange={(e) => setPlatformSettings({...platformSettings, defaultCurrency: e.target.value})}
                                                >
                                                    <option value="TZS" className="bg-background">TZS</option>
                                                    <option value="USD" className="bg-background">USD</option>
                                                    <option value="KES" className="bg-background">KES</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <Button 
                                            variant="default"
                                            size="lg"
                                            onClick={handleSaveSettings} 
                                            className="h-12 px-8 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm"
                                        >
                                            Save Configuration
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
    );
};
