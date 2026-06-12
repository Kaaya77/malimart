import { createContext, useContext } from 'react';

// Shared state/actions for the SellerSettings tabs. The parent page owns all
// state; tab components consume it via useSellerSettings().
export const SellerSettingsCtx = createContext<any>(null);

export const useSellerSettings = () => {
    const ctx = useContext(SellerSettingsCtx);
    if (!ctx) throw new Error('useSellerSettings must be used within its parent page');
    return ctx;
};
