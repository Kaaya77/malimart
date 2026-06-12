import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from '../../components/UI';
import { Store } from 'lucide-react';
import { useSellerSettings } from './context';

export const PreferencesTab = () => {
    const { preferences, setPreferences } = useSellerSettings();
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
 <Switch checked={preferences.orderNotifications} onCheckedChange={() => setPreferences({...preferences, orderNotifications: !preferences.orderNotifications})} />
 </div>
 <div className="flex items-center justify-between p-4 bg-foreground/[0.03] rounded-xl">
 <div>
 <p className="font-bold text-sm text-foreground">Low Stock Alerts</p>
 <p className="text-xs text-foreground/55">Notify when inventory is low</p>
 </div>
 <Switch checked={preferences.stockAlerts} onCheckedChange={() => setPreferences({...preferences, stockAlerts: !preferences.stockAlerts})} />
 </div>
 <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl mt-4">
 <div>
 <p className="font-bold text-sm text-amber-900 dark:text-amber-100">Vacation Mode</p>
 <p className="text-xs text-amber-700 dark:text-amber-300">Temporarily hide your store and products</p>
 </div>
 <Switch checked={preferences.vacationMode} onCheckedChange={() => setPreferences({...preferences, vacationMode: !preferences.vacationMode})} />
 </div>
 </CardContent>
 </Card>
 </div>
    );
};
