import React, { useMemo } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

const COLORS: Record<string, string> = {
    delivered:  '#10b981',
    shipped:    '#22c55e',
    in_transit: '#3b82f6',
    confirmed:  '#6366f1',
    processing: '#a855f7',
    pending:    '#f59e0b',
    cancelled:  '#ef4444',
    refunded:   '#f43f5e',
    failed:     '#dc2626',
    disputed:   '#f97316',
};

const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0];
    return (
        <div className="bg-background border border-foreground/15 rounded-xl px-3 py-2 shadow-xl text-xs">
            <p className="font-bold capitalize">{name.replace(/_/g, ' ')}</p>
            <p className="text-foreground/55 tabular-nums">{value} {value === 1 ? 'order' : 'orders'}</p>
        </div>
    );
};

export default function StatusDonut({ data }: { data: Record<string, number> }) {
    const items = useMemo(
        () => Object.entries(data).map(([name, value]) => ({ name, value: Number(value) })).filter(d => d.value > 0),
        [data],
    );
    const total = useMemo(() => items.reduce((a, b) => a + b.value, 0), [items]);

    if (!items.length) {
        return <div className="h-56 flex items-center justify-center text-xs text-foreground/40">No order data.</div>;
    }

    return (
        <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={items} dataKey="value" nameKey="name"
                         cx="50%" cy="50%" innerRadius={56} outerRadius={84} paddingAngle={3}
                         isAnimationActive={false}>
                        {items.map(it => (
                            <Cell key={it.name} fill={COLORS[it.name] ?? '#9ca3af'} stroke="none" />
                        ))}
                    </Pie>
                    <Tooltip content={<Tip />} />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-black tabular-nums">{total}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/45">orders</p>
            </div>
        </div>
    );
}
