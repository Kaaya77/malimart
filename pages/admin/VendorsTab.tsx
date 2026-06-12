import React from 'react';
import { AdminVendorVerification } from '../../components/AdminVendorVerification';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useAdmin } from './context';

export const VendorsTab = () => {
    const { fetchAdminData, handleMessageUser, vendorsList } = useAdmin();
    return (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-6"
                            >
                                {vendorsList.length === 0 ? (
                                    <div className="text-center p-12 bg-card rounded-3xl border border-border shadow-sm">
                                        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <ShieldCheck className="w-8 h-8 text-muted-foreground stroke-2" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">No vendors found</p>
                                    </div>
                                ) : vendorsList.map(vendor => (
                                    <AdminVendorVerification key={vendor.seller_id} vendor={vendor} onUpdate={fetchAdminData} onMessage={handleMessageUser} />
                                ))}
                            </motion.div>
    );
};
