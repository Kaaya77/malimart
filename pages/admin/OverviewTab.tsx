import React from 'react';
import { AdminDashboard } from '../../components/AdminDashboard';
import { useAdmin } from './context';

export const OverviewTab = () => {
    const { disputes, payouts, products, setActiveTab, stats } = useAdmin();
    return (
                            <AdminDashboard
                                initialStats={stats}
                                onGoUsers={()=>setActiveTab('users')}
                                onGoVendors={()=>setActiveTab('vendors')}
                                onGoProducts={()=>setActiveTab('products')}
                                onGoDisputes={()=>setActiveTab('disputes')}
                                onGoPayouts={()=>setActiveTab('payouts')}
                                onGoGrowth={()=>setActiveTab('growth')}
                            />
    );
};
