import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const Tip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-background border border-foreground/15 rounded-xl px-3 py-2 shadow-xl text-xs">
            <p className="font-bold">{payload[0].payload.name}</p>
            <p className="text-foreground/55 tabular-nums">{payload[0].value} units sold</p>
        </div>
    );
};

export default function TopProductsBars({ data }: { data: { name: string; count: number }[] }) {
    if (!data?.length) {
        return <div className="h-56 flex items-center justify-center text-xs text-foreground/40">No sales yet.</div>;
    }
    return (
        <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={88}
                           tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                           tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v} />
                    <Tooltip content={<Tip />} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                        {data.map((_, i) => (
                            <Cell key={i} fill="currentColor" fillOpacity={1 - i * 0.13} className="text-foreground" />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
