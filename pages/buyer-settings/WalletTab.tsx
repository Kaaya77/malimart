import React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../components/UI';
import { CURRENCY } from '../../constants';
import { ArrowDownLeft, ArrowUpRight, Copy, Gift, Wallet } from 'lucide-react';
import { useBuyerSettings } from './context';

export const WalletTab = () => {
    const { addToast, copyReferralCode, user, walletTransactions } = useBuyerSettings();
    return (
            <div className="space-y-6 animate-in fade-in">
              <Card className="overflow-hidden border-none bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <CardContent className="p-8 md:p-10 relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-black/5 blur-[80px] rounded-full pointer-events-none"></div>
                    <div className="relative z-10">
                      <p className="text-sm font-medium opacity-80 mb-2 flex items-center gap-2"><Wallet className="w-4 h-4" /> Available Balance</p>
                      <h2 className="text-5xl md:text-6xl font-display font-bold tracking-tight">{CURRENCY} {(user?.wallet_balance || 0).toLocaleString()}</h2>
                      <div className="mt-8 flex gap-3 flex-wrap">
                        <div className="flex flex-col gap-1">
                          <Button variant="outline" disabled className="bg-white/10 border-white/20 text-white/50 cursor-not-allowed dark:bg-black/5 dark:border-black/10 dark:text-slate-900/50">Top Up</Button>
                          <span className="text-[10px] text-white/50 dark:text-slate-900/50 text-center">Coming soon</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button variant="outline" disabled className="bg-white/10 border-white/20 text-white/50 cursor-not-allowed dark:bg-black/5 dark:border-black/10 dark:text-slate-900/50">Withdraw</Button>
                          <span className="text-[10px] text-white/50 dark:text-slate-900/50 text-center">Coming soon</span>
                        </div>
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
                            <div className="text-center py-8 text-muted-foreground">
                                <p className="text-sm">No recent transactions.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {walletTransactions.slice(0, 5).map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-foreground/[0.06] text-slate-600  dark:text-foreground/40'}`}>
                                                {tx.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground capitalize">{tx.description || tx.type}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`font-semibold ${tx.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
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
                        <div className="flex items-center gap-2 bg-background p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                            <code className="px-3 py-1 font-mono font-bold text-foreground text-sm flex-1 text-center">{user?.referral_code || 'MALI-XXXX'}</code>
                            <Button variant="secondary" size="icon" onClick={copyReferralCode} className="shrink-0 h-8 w-8">
                                <Copy className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
    );
};
