import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export const ADMIN_DASHBOARD_KEY = ['admin', 'dashboard'];

/** Single-RPC admin snapshot — all platform stats in one round trip */
export function useAdminDashboard(days = 30) {
    return useQuery({
        queryKey:  [...ADMIN_DASHBOARD_KEY, days],
        queryFn:   async () => {
            const { data, error } = await supabase.rpc('get_admin_dashboard_fast', { p_days: days });
            if (error) throw error;
            return data;
        },
        staleTime: 2 * 60_000,   // 2 min — matches snapshot TTL in DB
    });
}

/**
 * Invalidates the admin dashboard cache when platform-level tables change.
 * Replaces the 60s polling interval with event-driven invalidation.
 */
export function useAdminDashboardRealtime() {
    const qc = useQueryClient();
    useEffect(() => {
        const ch = supabase
            .channel('admin-dashboard-rt-hook')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },         () => qc.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY }))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },         () => qc.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY }))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' },       () => qc.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY }))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },       () => qc.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY }))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'disputes' },       () => qc.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY }))
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'disputes' },       () => qc.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY }))
            .on('postgres_changes', { event: '*',      schema: 'public', table: 'vendor_profiles'}, () => qc.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY }))
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [qc]);
}
