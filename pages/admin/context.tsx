import { createContext, useContext } from 'react';

// Shared state/actions for the Admin tabs. The parent page owns all
// state; tab components consume it via useAdmin().
export const AdminCtx = createContext<any>(null);

export const useAdmin = () => {
    const ctx = useContext(AdminCtx);
    if (!ctx) throw new Error('useAdmin must be used within its parent page');
    return ctx;
};
