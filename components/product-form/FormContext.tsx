import { createContext, useContext } from 'react';

// Shared state/actions for the ProductForm wizard. The parent ProductForm
// owns all state; step components consume it via usePF().
export const PFContext = createContext<any>(null);

export const usePF = () => {
    const ctx = useContext(PFContext);
    if (!ctx) throw new Error('usePF must be used within ProductForm');
    return ctx;
};
