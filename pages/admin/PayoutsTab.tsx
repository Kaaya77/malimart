import React from 'react';
import { Button, EmptyState } from '../../components/UI';
import { formatTZS } from '../../constants';
import { motion } from 'framer-motion';
import { CheckCircle2, DollarSign } from 'lucide-react';
import { useAdmin } from './context';

export const PayoutsTab = () => {
    const { handleApprovePayout, payouts } = useAdmin();
    return (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-6"
                            >
                                {payouts.length === 0 ? (
                                    <div className="glass-surface rounded-3xl border border-border shadow-sm">
                                        <EmptyState
                                            icon={DollarSign}
                                            title="No pending payouts"
                                            subtitle="Seller payout requests will appear here."
                                        />
                                    </div>
                                ) : payouts.map(payout => (
                                    <div key={payout.id} className="p-6 glass-surface rounded-3xl border border-border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:shadow-md">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                                                <DollarSign className="w-6 h-6 stroke-2" />
                                            </div>
                                            <div>
                                                <p className="font-sans font-bold text-xl text-foreground tracking-tight">{formatTZS(payout.net_payout)}</p>
                                                <p className="text-xs text-muted-foreground mt-1 font-medium">Requested by: <span className="text-foreground">{payout.profiles?.full_name}</span></p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="primary"
                                            className="w-full md:w-auto h-12 px-8 rounded-2xl font-bold uppercase tracking-widest text-[11px] shadow-sm hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                            onClick={() => handleApprovePayout(payout.id)}
                                            aria-label={`Mark payout of ${formatTZS(payout.net_payout)} as paid`}
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Paid
                                        </Button>
                                    </div>
                                ))}
                            </motion.div>
    );
};
