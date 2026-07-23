import React from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from '../../components/UI';
import { Loader2 } from 'lucide-react';
import { useSellerSettings } from './context';
import { AccentThemePicker } from '../../components/AccentThemePicker';
import { useAppState } from '../../context/AppContext';

export const PreferencesTab = () => {
    const { handleGenericSave, isSaving, preferences, setPreferences } = useSellerSettings();
    const { user, updateUserProfile } = useAppState();

    const toggle = (key: keyof typeof preferences) =>
        setPreferences((p: any) => ({ ...p, [key]: !p[key] }));

    const handleSave = () => {
        handleGenericSave({
            order_notifications: preferences.orderNotifications,
            stock_alerts: preferences.stockAlerts,
            vacation_mode: preferences.vacationMode,
        }, 'Preferences saved');
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
                    <div className="flex items-center justify-between p-4 bg-foreground/[0.03] rounded-xl">
                        <div>
                            <p className="font-bold text-sm text-foreground">Low Stock Alerts</p>
                            <p className="text-xs text-foreground/55">Notify when inventory is low</p>
                        </div>
                        <Switch checked={preferences.stockAlerts} onCheckedChange={() => toggle('stockAlerts')} />
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
