import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '../../components/UI';
import { CURRENCY } from '../../constants';
import { ArrowDownLeft, ArrowUpRight, Copy, Gift, Info, Wallet } from 'lucide-react';
import { useBuyerSettings } from './context';
import { getMyReferralStatus, type ReferralStatus } from '../../services/walletApi';

// Wallet is funded by refunds & credits — there is no payment gateway, so we
// never show top-up/withdraw controls we can't honour. Source labels are
// derived from the transaction's shape (order-linked vs. referral vs. other).
const sourceLabel = (tx: any): string => {
    const d = (tx.description || '').toLowerCase();
    if (d.includes('referral')) return 'Referral credit';
    if (d.includes('refund') || tx.order_id) return 'Order refund';
    if (tx.type === 'debit') return 'Wallet payment';
    return 'Adjustment';
};

export const WalletTab = () => {
    const { copyReferralCode, user, walletTransactions } = useBuyerSettings();
    const [referral, setReferral] = useState<ReferralStatus | null>(null);

    useEffect(() => {
        let live = true;
        getMyReferralStatus().then(r => { if (live) setReferral(r); }).catch(() => {});
        return () => { live = false; };
    }, []);

    const referralCode = referral?.code || user?.referral_code || 'MALI-XXXX';

    return (
            <div className="space-y-6 animate-in fade-in">
              <Card className="overflow-hidden border-none bg-foreground text-background">
                <CardContent className="p-8 md:p-10 relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-background/10 blur-[80px] rounded-full pointer-events-none"></div>
                    <div className="relative z-10">
                      <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80 mb-2 flex items-center gap-2"><Wallet className="w-4 h-4" /> Available Balance</p>
                      <h2 className="text-5xl md:text-6xl font-display font-bold tracking-tight">{CURRENCY} {(user?.wallet_balance || 0).toLocaleString()}</h2>
                      <div className="mt-6 flex items-start gap-2.5 max-w-md rounded-2xl bg-background/10 p-3.5">
                        <Info className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                        <p className="text-xs leading-relaxed opacity-80">
                          Your MaliMart wallet is funded by order refunds and referral rewards.
                          Credits are applied automatically — there's nothing to top up. You can
                          spend your balance at checkout.
                        </p>
                      </div>
                    </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>Your latest wallet credits and debits.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {walletTransactions.length === 0 ? (
                            <EmptyState
                                icon={Wallet}
                                title="No transactions yet"
                                subtitle="Wallet activity like refunds and referral rewards will show up here."
                                className="py-10"
                            />
                        ) : (
                            <div className="space-y-4">
                                {walletTransactions.slice(0, 8).map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between pb-4 border-b border-foreground/[0.06] last:border-0 last:pb-0">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-foreground/[0.06] text-foreground/50'}`}>
                                                {tx.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{tx.description || sourceLabel(tx)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                  <span className="font-semibold uppercase tracking-wide text-[10px] text-foreground/45">{sourceLabel(tx)}</span>
                                                  {' · '}{new Date(tx.created_at).toLocaleDateString()}
                                                </p>
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
                      <CardTitle className="text-emerald-900 dark:text-emerald-100 flex items-center gap-2"><Gift className="w-5 h-5" /> Invite Friends</CardTitle>
                      <CardDescription className="text-emerald-800/70 dark:text-emerald-200/70">
                        {referral
                          ? `Earn ${CURRENCY} ${referral.reward_amount.toLocaleString()} when a friend places their first order.`
                          : 'Share your code and earn wallet credit.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2 bg-background p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
                            <code className="px-3 py-1 font-mono font-bold text-foreground text-sm flex-1 text-center">{referralCode}</code>
                            <Button variant="secondary" size="icon" aria-label="Copy referral code" onClick={copyReferralCode} className="shrink-0 h-11 w-11 rounded-xl">
                                <Copy className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                        {referral && (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-background/60 dark:bg-black/10 p-2.5">
                              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{referral.invited}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">Invited</p>
                            </div>
                            <div className="rounded-xl bg-background/60 dark:bg-black/10 p-2.5">
                              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{referral.rewarded}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">Rewarded</p>
                            </div>
                            <div className="rounded-xl bg-background/60 dark:bg-black/10 p-2.5">
                              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{(referral.total_earned || 0).toLocaleString()}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/60 dark:text-emerald-200/60">Earned</p>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">Share your code with friends. When they sign up and complete their first order, your reward lands in your wallet automatically.</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
    );
};
