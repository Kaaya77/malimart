import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatTZS } from '../../constants';

const Tip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-background border border-foreground/15 rounded-xl px-3 py-2 shadow-xl text-xs">
            <p className="text-foreground/45 uppercase tracking-widest text-[10px]">{label}</p>
            <p className="font-bold tabular-nums">{formatTZS(payload[0].value)}</p>
        </div>
    );
};

export default function RevenueChart({ data }: { data: { date: string; name?: string; revenue: number }[] }) {
    if (!data?.length) {
        return <div className="h-56 flex items-center justify-center text-xs text-foreground/40">No data yet.</div>;
    }
    return (
        <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="currentColor" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="currentColor" opacity={0.08} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
                    <YAxis hide />
                    <Tooltip content={<Tip />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }} />
                    <Area type="monotone" dataKey="revenue" stroke="currentColor"
                          strokeWidth={2} fill="url(#revFill)" className="text-foreground"
                          isAnimationActive={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
