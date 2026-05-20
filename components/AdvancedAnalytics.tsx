import React from 'react';
import { Card } from './UI';
import { TrendingUp, Users, RefreshCw, BarChart3 } from 'lucide-react';

export const AdvancedAnalytics = ({ stats }: { stats: any }) => {
    // Estimate Inventory Turnover: (Total Sales / Average Inventory)
    // For simplicity, let's use Total Sales / Current Listings as a proxy
    const inventoryTurnover = stats.listings > 0 ? (stats.revenue / stats.listings).toFixed(2) : 0;
    
    // Estimate Customer Retention: (Returning Customers / Total Customers)
    // For simplicity, let's look at customers with > 1 order
    const returningCustomers = stats.topCustomers.filter((c: any) => c.count > 1).length;
    const totalCustomers = stats.topCustomers.length;
    const retentionRate = totalCustomers > 0 ? ((returningCustomers / totalCustomers) * 100).toFixed(0) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
            <Card className="p-8 rounded-2xl border border-foreground/10 bg-background shadow-sm flex items-center gap-6">
                <div className="p-4 rounded-xl bg-primary/10 text-primary"><TrendingUp className="w-6 h-6" /></div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Sales Velocity</p>
                    <p className="text-2xl font-sans font-black">{stats.salesVelocity.toFixed(2)} <span className="text-sm font-medium">orders/day</span></p>
                </div>
            </Card>
            <Card className="p-8 rounded-2xl border border-foreground/10 bg-background shadow-sm flex items-center gap-6">
                <div className="p-4 rounded-xl bg-primary/10 text-primary"><RefreshCw className="w-6 h-6" /></div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Inventory Avg.</p>
                    <p className="text-2xl font-sans font-black"><span className="text-sm font-medium">TZS</span> {inventoryTurnover}</p>
                </div>
            </Card>
            <Card className="p-8 rounded-2xl border border-foreground/10 bg-background shadow-sm flex items-center gap-6">
                <div className="p-4 rounded-xl bg-primary/10 text-primary"><Users className="w-6 h-6" /></div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Retention Rate</p>
                    <p className="text-2xl font-sans font-black">{retentionRate}%</p>
                </div>
            </Card>
        </div>
    );
};
