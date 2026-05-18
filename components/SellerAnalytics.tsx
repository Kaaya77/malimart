import React from 'react';
import { Card } from './UI';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, Legend } from 'recharts';

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-background dark:bg-background p-4 border border-foreground/10 dark:border-background/10 rounded-none shadow-2xl">
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground dark:text-background mb-1">{label || payload[0].name}</p>
                <p className="font-serif text-lg text-foreground dark:text-background">
                    {payload[0].value.toLocaleString()}
                </p>
            </div>
        );
    }
    return null;
};

export const SellerAnalytics = ({ stats }: { stats: any }) => {
    const statusData = Object.entries(stats.statusDistribution || {}).map(([name, value]) => ({ name, value }));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
            {/* Revenue Trend */}
            <Card className="group col-span-1 md:col-span-2 p-8 rounded-none shadow-none border border-foreground/10 dark:border-background/10 bg-transparent hover:border-foreground/30 dark:hover:border-background/30 transition-all duration-500">
                <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background mb-8">Revenue Trend (Last 30 Days)</h3>
                <div className="h-64 min-w-0 relative">
                    {stats.revenueTrend.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.revenueTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                <XAxis dataKey="date" hide />
                                <YAxis hide />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="revenue" stroke="currentColor" strokeWidth={2} className="text-foreground dark:text-background" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[10px] uppercase tracking-[0.2em] opacity-40 text-foreground dark:text-background">No revenue data available</div>
                    )}
                </div>
            </Card>

            {/* Top Products */}
            <Card className="group p-8 rounded-none shadow-none border border-foreground/10 dark:border-background/10 bg-transparent hover:border-foreground/30 dark:hover:border-background/30 transition-all duration-500">
                <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background mb-8">Top Products</h3>
                <div className="h-64 min-w-0 relative">
                    {stats.topProducts.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topProducts}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                                <XAxis dataKey="name" hide />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" fill="currentColor" className="text-foreground dark:text-background" radius={[2, 2, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[10px] uppercase tracking-[0.2em] opacity-40 text-foreground dark:text-background">No product data available</div>
                    )}
                </div>
            </Card>

            {/* Order Status Distribution */}
            <Card className="group p-8 rounded-none shadow-none border border-foreground/10 dark:border-background/10 bg-transparent hover:border-foreground/30 dark:hover:border-background/30 transition-all duration-500">
                <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background mb-8">Order Status Distribution</h3>
                <div className="h-64 min-w-0 relative">
                    {statusData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="currentColor" className="text-foreground dark:text-background" paddingAngle={5}>
                                    {statusData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={1 - (index * 0.15)} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[10px] uppercase tracking-[0.2em] opacity-40 text-foreground dark:text-background">No order data available</div>
                    )}
                </div>
            </Card>

            {/* AOV & Top Customers */}
            <Card className="group p-8 rounded-none shadow-none border border-foreground/10 dark:border-background/10 bg-transparent hover:border-foreground/30 dark:hover:border-background/30 transition-all duration-500">
                <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background mb-8">Avg Order Value</h3>
                <div className="flex items-center justify-center h-48">
                    <p className="text-5xl font-serif font-light text-foreground dark:text-background">TZS {stats.aov.toLocaleString()}</p>
                </div>
            </Card>

            <Card className="group p-8 rounded-none shadow-none border border-foreground/10 dark:border-background/10 bg-transparent hover:border-foreground/30 dark:hover:border-background/30 transition-all duration-500">
                <h3 className="text-[10px] uppercase tracking-[0.2em] opacity-60 text-foreground dark:text-background mb-8">Top Customers</h3>
                <div className="space-y-4">
                    {stats.topCustomers.length > 0 ? stats.topCustomers.map((customer: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-4 border-b border-foreground/10 dark:border-background/10 last:border-0 hover:bg-primary/5 dark:hover:bg-background/5 transition-colors">
                            <span className="font-serif text-lg text-foreground dark:text-background">{customer.name}</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60 dark:text-background/60">{customer.count} orders</span>
                        </div>
                    )) : <div className="flex items-center justify-center h-48 text-[10px] uppercase tracking-[0.2em] opacity-40 text-foreground dark:text-background">No customer data available</div>}
                </div>
            </Card>
        </div>
    );
};
