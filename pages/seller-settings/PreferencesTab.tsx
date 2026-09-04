import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Input, Switch } from '../../components/UI';
import { Loader2, ShieldOff, UserX } from 'lucide-react';
import { useSellerSettings } from './context';
import { AccentThemePicker } from '../../components/AccentThemePicker';
import { useAppState } from '../../context/AppContext';
import { fetchPeerProfile, PeerProfile } from '../../services/messagesService';

export const PreferencesTab = () => {
    const { handleGenericSave, isSaving, preferences, setPreferences } = useSellerSettings();
    const { user, updateUserProfile, blockedUsers, unblockUser } = useAppState();

    const toggle = (key: keyof typeof preferences) =>
        setPreferences((p: any) => ({ ...p, [key]: !p[key] }));

    const handleSave = () => {
        handleGenericSave({
            order_notifications: preferences.orderNotifications,
            stock_alerts: preferences.stockAlerts,
            vacation_mode: preferences.vacationMode,
            low_stock_threshold: preferences.lowStockThreshold,
        }, 'Preferences saved');
    };

    // Blocked buyers — blockedUsers is a Set of ids only (shared with the
    // messaging surface's block/report flow); hydrate names/avatars for
    // display via the same peer-lookup RPC messaging already uses.
    const [blockedProfiles, setBlockedProfiles] = useState<PeerProfile[] | null>(null);
    const [unblockingId, setUnblockingId] = useState<string | null>(null);
    useEffect(() => {
        let cancelled = false;
        const ids = [...blockedUsers];
        if (ids.length === 0) { setBlockedProfiles([]); return; }
        Promise.all(ids.map(id => fetchPeerProfile(id))).then(rows => {
            if (!cancelled) setBlockedProfiles(rows.filter((r): r is PeerProfile => !!r));
        });
        return () => { cancelled = true; };
    }, [blockedUsers]);

    const handleUnblock = async (id: string) => {
        setUnblockingId(id);
        try { await unblockUser(id); } finally { setUnblockingId(null); }
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <Card>
                <CardHeader>
                    <CardTitle>Store Operations</CardTitle>
                    <CardDescription>Manage alerts and availability.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-4 bg-foreground/[0.03] rounded-xl">
                        <div>
                            <p className="font-bold text-sm text-foreground">Order Notifications</p>
                            <p className="text-xs text-foreground/55">Get alerts for new orders</p>
                        </div>
                        <Switch checked={preferences.orderNotifications} onCheckedChange={() => toggle('orderNotifications')} />
                    </div>
                    <div className="p-4 bg-foreground/[0.03] rounded-xl">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-sm text-foreground">Low Stock Alerts</p>
                                <p className="text-xs text-foreground/55">Notify when inventory is low</p>
                            </div>
                            <Switch checked={preferences.stockAlerts} onCheckedChange={() => toggle('stockAlerts')} />
                        </div>
                        {preferences.stockAlerts && (
                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-foreground/[0.06]">
                                <label htmlFor="low-stock-threshold" className="text-xs font-semibold text-foreground/70 shrink-0">Alert me at or below</label>
                                <Input
                                    id="low-stock-threshold"
                                    type="number"
                                    min={0}
                                    value={preferences.lowStockThreshold}
                                    onChange={(e: any) => setPreferences((p: any) => ({ ...p, lowStockThreshold: Math.max(0, Number(e.target.value) || 0) }))}
                                    className="w-24 h-9 text-sm"
                                />
                                <span className="text-xs text-foreground/45">units in stock</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl mt-4">
                        <div>
                            <p className="font-bold text-sm text-amber-900 dark:text-amber-100">Vacation Mode</p>
                            <p className="text-xs text-amber-700 dark:text-amber-300">Temporarily hide your store and pause new orders</p>
                        </div>
                        <Switch checked={preferences.vacationMode} onCheckedChange={() => toggle('vacationMode')} />
                    </div>
                    <div className="flex justify-end pt-4 border-t border-foreground/8">
                        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : 'Save Preferences'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Notification Channels</CardTitle>
                    <CardDescription>How you're reached — separate from which events notify you, above.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-4 bg-foreground/[0.03] rounded-xl">
                        <div>
                            <p className="font-bold text-sm text-foreground">Email</p>
                            <p className="text-xs text-foreground/55">Order and account notifications by email</p>
                        </div>
                        <Switch
                            checked={(user as any)?.email_notifications ?? true}
                            onCheckedChange={() => updateUserProfile({ email_notifications: !((user as any)?.email_notifications ?? true) } as any)}
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-foreground/[0.03] rounded-xl">
                        <div>
                            <p className="font-bold text-sm text-foreground">SMS</p>
                            <p className="text-xs text-foreground/55">Order and account notifications by text message</p>
                        </div>
                        <Switch
                            checked={(user as any)?.sms_notifications ?? false}
                            onCheckedChange={() => updateUserProfile({ sms_notifications: !((user as any)?.sms_notifications ?? false) } as any)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Blocked Buyers</CardTitle>
                    <CardDescription>Buyers you've blocked can't message you.</CardDescription>
                </CardHeader>
                <CardContent>
                    {blockedProfiles === null ? (
                        <div className="flex items-center gap-2 text-xs text-foreground/40 py-4"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
                    ) : blockedProfiles.length === 0 ? (
                        <EmptyState icon={ShieldOff} title="No blocked buyers" subtitle="Anyone you block from a chat will show up here." className="py-8" />
                    ) : (
                        <div className="space-y-2">
                            {blockedProfiles.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 border border-foreground/8 rounded-xl bg-foreground/[0.02]">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {p.avatar ? (
                                            <img src={p.avatar} alt={`${p.name}'s profile photo`} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-foreground/[0.06] flex items-center justify-center shrink-0"><UserX className="w-4 h-4 text-foreground/40" /></div>
                                        )}
                                        <span className="font-medium text-sm text-foreground truncate">{p.name}</span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => handleUnblock(p.id)} isLoading={unblockingId === p.id}>
                                        {unblockingId === p.id ? 'Unblocking…' : 'Unblock'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Pick an accent — the whole app recolours instantly.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AccentThemePicker
                        value={user?.theme_accent}
                        mode={user?.theme_mode}
                        onSelect={(key) => updateUserProfile({ theme_accent: key } as any)}
                    />
                </CardContent>
            </Card>
        </div>
    );
};
