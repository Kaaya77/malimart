import React from 'react';
import { Badge, Button, EmptyState, PremiumStatCard } from '../../components/UI';
import { formatTZS } from '../../constants';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, CheckCircle2, MessageSquare, RotateCcw, Sparkles, Store, Users } from 'lucide-react';
import { useAdmin } from './context';

export const DisputesTab = () => {
    const { addToast, disputes, handleAnalyzeDispute, handleMessageUser, handleResolveDispute } = useAdmin();
    return (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="space-y-12"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <PremiumStatCard 
                                        title="Active Disputes" 
                                        value={disputes.length} 
                                        icon={AlertTriangle} 
                                        color="text-rose-600"
                                        trend={{ value: "Action Required", positive: false }}
                                    />
                                    <PremiumStatCard 
                                        title="Avg. Resolution" 
                                        value="2.4 Days" 
                                        icon={Activity} 
                                        color="text-blue-600"
                                    />
                                    <PremiumStatCard 
                                        title="Resolved (MTD)" 
                                        value="142" 
                                        icon={CheckCircle2} 
                                        color="text-emerald-600"
                                    />
                                </div>

                                <div className="space-y-8">
                                    <div className="flex items-center justify-between pb-6">
                                        <h3 className="font-sans font-black text-xl tracking-tight">Pending Resolutions</h3>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => {
                                                if (!disputes.length) { addToast('No disputes to export', 'info'); return; }
                                                const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
                                                const rows = [
                                                    ['ID', 'Order ID', 'Buyer ID', 'Seller ID', 'Reason', 'Status', 'Description', 'Created At'].join(','),
                                                    ...disputes.map(d => [d.id, d.order_id, d.buyer_id, d.seller_id, d.reason, d.status, d.description, d.created_at].map(esc).join(','))
                                                ].join('\n');
                                                const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url; a.download = `disputes-${new Date().toISOString().slice(0,10)}.csv`;
                                                a.click(); URL.revokeObjectURL(url);
                                                addToast('Disputes exported', 'success');
                                            }} className="text-[10px] font-bold uppercase tracking-widest rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40" aria-label="Export disputes as CSV">Export CSV</Button>
                                        </div>
                                    </div>

                                    {disputes.length === 0 ? (
                                        <div className="glass-surface rounded-3xl border border-border shadow-sm">
                                            <EmptyState
                                                icon={CheckCircle2}
                                                title="All clear"
                                                subtitle="No active disputes right now."
                                            />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-6">
                                            {disputes.map(dispute => (
                                                <div key={dispute.id} className="group relative glass-surface rounded-3xl border border-border p-6 overflow-hidden transition-all shadow-sm hover:shadow-md">

                                                    <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-6">
                                                        <div className="flex-1 space-y-4">
                                                            <div className="flex flex-wrap items-center gap-3">
                                                                <Badge variant="secondary" className="px-3 py-1 font-bold text-xs rounded-full">
                                                                    Order #{dispute.order_id.slice(0,8)}
                                                                </Badge>
                                                                <Badge variant="danger" className="px-3 py-1 font-bold text-[10px] uppercase tracking-widest rounded-full">
                                                                    High Priority
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <h4 className="text-lg font-sans font-black tracking-tight text-foreground capitalize">
                                                                    {dispute.reason.replace(/_/g, ' ')}
                                                                </h4>
                                                                <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                                                                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> Buyer: <span className="text-foreground">{dispute.profiles?.full_name}</span></span>
                                                                    <span>â¢</span>
                                                                    <span>Opened {new Date(dispute.created_at).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>

                                                            <div className="p-5 bg-muted/30 rounded-2xl border border-border text-sm text-foreground/80 leading-relaxed font-medium">
                                                                "{dispute.description}"
                                                            </div>
                                                        </div>

                                                        <div className="lg:w-80 space-y-4">
                                                            <div className="p-5 bg-muted/30 rounded-2xl border border-border">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Disputed Value</p>
                                                                <p className="text-2xl font-mono font-bold text-destructive tracking-tight">{formatTZS(dispute.orders?.total)}</p>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-3">
                                                                <Button
                                                                    variant="secondary"
                                                                    className="col-span-2 h-12 w-full rounded-2xl text-[11px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                                                    onClick={() => handleResolveDispute(dispute.id, dispute.order_id, 'release_funds')}
                                                                    aria-label="Rule for seller and release funds"
                                                                >
                                                                    <Store className="w-4 h-4 mr-2" /> Rule for Seller
                                                                </Button>
                                                                <Button
                                                                    variant="secondary"
                                                                    className="col-span-2 h-12 w-full rounded-2xl text-[11px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                                                    onClick={() => handleResolveDispute(dispute.id, dispute.order_id, 'refund_buyer')}
                                                                    aria-label="Rule for buyer and refund the order"
                                                                >
                                                                    <RotateCcw className="w-4 h-4 mr-2" /> Rule for Buyer (Refund)
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full rounded-xl text-[10px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                                                    onClick={() => handleAnalyzeDispute(dispute)}
                                                                >
                                                                    <Sparkles className="w-4 h-4 mr-2" /> AI Analyze
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full rounded-xl text-[10px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                                                    onClick={() => handleMessageUser(dispute.buyer_id, dispute.profiles?.full_name, { type: 'return', id: dispute.id, label: `Order #${dispute.order_id.slice(0,8)}` })}
                                                                >
                                                                    <MessageSquare className="w-4 h-4 mr-2" /> Message
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
    );
};
