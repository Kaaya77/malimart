import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, PremiumStatCard } from './UI';
import { supabase } from '../services/supabaseClient';
import { TrendingUp, Plus } from 'lucide-react';

export const AdminGrowth = () => {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [name, setName] = useState('');
    const [type, setType] = useState('flash_sale');
    const [target, setTarget] = useState('all');
    const [tier, setTier] = useState('bronze');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [autoReward, setAutoReward] = useState(false);

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const fetchCampaigns = async () => {
        const { data } = await supabase.from('offers').select('*, profiles(full_name)');
        setCampaigns(data || []);
    };

    const createCampaign = async () => {
        await supabase.from('offers').insert({
            title: name,
            campaign_type: type,
            target_type: target,
            tier_requirement: tier,
            start_date: startDate,
            end_date: endDate,
            auto_apply: autoReward,
            scope: 'platform',
            type: 'percentage', // Defaulting to percentage for now
            value: 10 // Defaulting to 10% for now
        });
        fetchCampaigns();
    };

    const stats = {
        total: campaigns.length,
        active: campaigns.filter(c => new Date(c.end_date) > new Date()).length,
        conversions: 1240 // Mock for now
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary dark:bg-white flex items-center justify-center shadow-lg shadow-foreground/10 dark:shadow-white/10">
                            <TrendingUp className="w-4 h-4 text-white dark:text-black" />
                        </div>
                        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 dark:text-white/40">Performance Scaling</p>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-sans font-black text-foreground dark:text-white tracking-tight leading-none">
                        Growth Engine
                    </h2>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <PremiumStatCard 
                    title="Total Campaigns" 
                    value={stats.total} 
                    icon={TrendingUp} 
                    trend={{ value: "All Time", positive: true }}
                />
                <PremiumStatCard 
                    title="Active Offers" 
                    value={stats.active} 
                    icon={Plus} 
                    trend={{ value: "Running", positive: true }}
                />
                <PremiumStatCard 
                    title="Conversions" 
                    value={stats.conversions} 
                    icon={TrendingUp} 
                    trend={{ value: "+12% vs last month", positive: true }}
                />
            </div>
            
            <Card className="p-8 rounded-[2.5rem] bg-white dark:bg-primary border-foreground/5 dark:border-white/5 shadow-xl shadow-foreground/5 dark:shadow-black/20 mb-10">
                <h3 className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground/40 dark:text-white/40 mb-8">Launch New Campaign</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40 ml-1">Campaign Name</label>
                        <Input placeholder="e.g. Summer Solstice" value={name} onChange={(e: any) => setName(e.target.value)} className="h-12 text-xs rounded-2xl bg-background dark:bg-white/5 border-transparent focus:bg-white dark:focus:bg-primary focus:border-foreground dark:focus:border-white transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40 ml-1">Type</label>
                        <select value={type} onChange={e => setType(e.target.value)} className="w-full h-12 text-xs uppercase tracking-[0.1em] rounded-2xl bg-background dark:bg-white/5 border-transparent px-4 text-foreground dark:text-white focus:bg-white dark:focus:bg-primary focus:border-foreground dark:focus:border-white transition-all outline-none appearance-none">
                            <option value="flash_sale" className="bg-background dark:bg-background">Flash Sale</option>
                            <option value="discount" className="bg-background dark:bg-background">Discount</option>
                            <option value="referral" className="bg-background dark:bg-background">Referral</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40 ml-1">Target Audience</label>
                        <select value={target} onChange={e => setTarget(e.target.value)} className="w-full h-12 text-xs uppercase tracking-[0.1em] rounded-2xl bg-background dark:bg-white/5 border-transparent px-4 text-foreground dark:text-white focus:bg-white dark:focus:bg-primary focus:border-foreground dark:focus:border-white transition-all outline-none appearance-none">
                            <option value="all" className="bg-background dark:bg-background">All Users</option>
                            <option value="new" className="bg-background dark:bg-background">New Users</option>
                            <option value="platinum" className="bg-background dark:bg-background">Platinum Users</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40 ml-1">Tier Requirement</label>
                        <select value={tier} onChange={e => setTier(e.target.value)} className="w-full h-12 text-xs uppercase tracking-[0.1em] rounded-2xl bg-background dark:bg-white/5 border-transparent px-4 text-foreground dark:text-white focus:bg-white dark:focus:bg-primary focus:border-foreground dark:focus:border-white transition-all outline-none appearance-none">
                            <option value="bronze" className="bg-background dark:bg-background">Bronze</option>
                            <option value="silver" className="bg-background dark:bg-background">Silver</option>
                            <option value="gold" className="bg-background dark:bg-background">Gold</option>
                            <option value="platinum" className="bg-background dark:bg-background">Platinum</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40 ml-1">Start Date</label>
                        <Input type="date" value={startDate} onChange={(e: any) => setStartDate(e.target.value)} className="h-12 text-xs uppercase tracking-[0.1em] rounded-2xl bg-background dark:bg-white/5 border-transparent text-foreground dark:text-white transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40 ml-1">End Date</label>
                        <Input type="date" value={endDate} onChange={(e: any) => setEndDate(e.target.value)} className="h-12 text-xs uppercase tracking-[0.1em] rounded-2xl bg-background dark:bg-white/5 border-transparent text-foreground dark:text-white transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-widest font-black text-foreground/40 dark:text-white/40 ml-1">Automation</label>
                        <label className="flex items-center gap-3 text-xs uppercase tracking-[0.1em] text-foreground dark:text-white cursor-pointer h-12 px-4 rounded-2xl bg-background dark:bg-white/5 border-transparent transition-all">
                            <input type="checkbox" checked={autoReward} onChange={e => setAutoReward(e.target.checked)} className="w-4 h-4 rounded-full border-foreground/20 dark:border-white/20 text-foreground dark:text-white focus:ring-0 focus:ring-offset-0 bg-transparent" />
                            Auto-Reward
                        </label>
                    </div>
                    <div className="space-y-2 flex flex-col justify-end">
                        <Button className="h-12 rounded-2xl bg-primary dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] transition-transform" onClick={createCampaign}>
                            <Plus className="w-4 h-4 mr-2" /> Launch Campaign
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {campaigns.map(campaign => (
                    <Card key={campaign.id} className="p-8 rounded-[2.5rem] bg-white dark:bg-primary border-foreground/5 dark:border-white/5 shadow-xl shadow-foreground/5 dark:shadow-black/20 group hover:border-foreground/20 dark:hover:border-white/20 transition-all duration-500">
                        <div className="flex justify-between items-start mb-6">
                            <div className="space-y-1">
                                <h4 className="font-sans font-black text-2xl text-foreground dark:text-white leading-tight">{campaign.title}</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] uppercase tracking-[0.2em] font-black text-foreground/40 dark:text-white/40">
                                        {campaign.campaign_type.replace('_', ' ')}
                                    </span>
                                    <div className="w-1 h-1 rounded-full bg-primary/20 dark:bg-white/20" />
                                    <span className="text-[9px] uppercase tracking-[0.2em] font-black text-foreground/40 dark:text-white/40">
                                        {campaign.target_type}
                                    </span>
                                </div>
                            </div>
                            <Badge variant={new Date(campaign.end_date) > new Date() ? 'success' : 'secondary'} className="rounded-full px-4 py-1 text-[8px] uppercase tracking-widest">
                                {new Date(campaign.end_date) > new Date() ? 'Active' : 'Ended'}
                            </Badge>
                        </div>
                        <p className="text-sm text-foreground/60 dark:text-white/60 font-medium mb-8 leading-relaxed">{campaign.description || 'Strategic platform-wide growth initiative.'}</p>
                        <div className="flex items-center justify-between pt-6 border-t border-foreground/5 dark:border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30 dark:text-white/30">
                            <span className="flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 stroke-[1.5]" /> 1.2k Interactions</span>
                            <span className="flex items-center gap-2">
                                {new Date(campaign.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                                <span className="opacity-30">—</span> 
                                {new Date(campaign.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
