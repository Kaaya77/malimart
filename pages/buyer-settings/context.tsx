import { createContext, useContext } from 'react';

// Shared state/actions for the BuyerSettings tabs. The parent page owns all
// state; tab components consume it via useBuyerSettings().
export const BuyerSettingsCtx = createContext<any>(null);

export const useBuyerSettings = () => {
    const ctx = useContext(BuyerSettingsCtx);
    if (!ctx) throw new Error('useBuyerSettings must be used within its parent page');
    return ctx;
};
