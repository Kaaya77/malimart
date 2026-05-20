import { useMemo } from 'react';
import { Product, ProductVariant } from '../types';
import { useAppState } from '../context/AppContext';

/**
 * Calculates display pricing, discount percentages, stock status, and colour
 * swatches for a product.
 *
 * Safe to call even when `product` or `activeVariant` is null — returns a
 * zeroed-out result object so callers don't need to guard every field.
 */
export const useProductPricing = (product: Product | null, activeVariant: ProductVariant | null) => {
    const { getActiveOfferForProduct } = useAppState();

    // Always call the hook — pass a safe fallback id when product is null so
    // the hook call count stays constant (Rules of Hooks).
    const activeOffer = getActiveOfferForProduct(product?.id ?? '');

    return useMemo(() => {
        // ── Null guard: return a safe default when there's no product ──────────
        if (!product) {
            return {
                price: 0,
                maxPrice: 0,
                isRange: false,
                originalPrice: null,
                variantDiscount: 0,
                campaignDiscount: 0,
                stock: 0,
                isOut: true,
                hasVariants: false,
                swatches: [],
                offerLabel: undefined,
                activeOffer: null,
            };
        }

        const variants = product.variants?.filter(v => v.is_active !== false) || [];
        const hasVariants = variants.length > 0;

        const prices = hasVariants ? variants.map(v => v.base_price) : [product.price];
        const basePrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

        const originalPrices = hasVariants
            ? variants.map(v => v.base_price)
            : [product.base_price || product.price];
        const comparePrice = originalPrices.length > 0 ? Math.max(...originalPrices) : 0;

        // Guard activeVariant access — it may still be null when no variants exist
        let finalPrice = (activeVariant != null)
            ? (activeVariant.sale_price || activeVariant.base_price)
            : basePrice;
        let variantDiscountPct = 0;
        let campaignDiscountPct = 0;
        let campaignValue = 0;

        if (comparePrice > basePrice) {
            variantDiscountPct = Math.round(((comparePrice - basePrice) / comparePrice) * 100);
        }

        if (activeOffer && activeOffer.is_auto_apply && activeOffer.campaign_type !== 'bogo') {
            if (activeOffer.type === 'percentage') {
                campaignDiscountPct = activeOffer.value;
                finalPrice = finalPrice - (finalPrice * campaignDiscountPct / 100);
            } else if (activeOffer.type === 'fixed') {
                campaignValue = activeOffer.value;
                finalPrice = Math.max(0, finalPrice - campaignValue);
                campaignDiscountPct = basePrice > 0
                    ? Math.round(((basePrice - finalPrice) / basePrice) * 100)
                    : 0;
            }
        }

        const totalStock = hasVariants
            ? variants.reduce((a, b) => a + (b.stock || 0), 0)
            : (product.stock || 0);

        const swatches = hasVariants
            ? (Array.from(new Set(variants.map(v => {
                const k = Object.keys(v.attributes).find(key =>
                    /color|shade|colour|finish/i.test(key)
                );
                if (!k) return null;
                return { value: v.attributes[k], image: v.image_url, id: v.id };
            }).filter(Boolean))) as any[])
            .reduce((acc: any[], curr: any) => {
                if (!acc.find(i => i.value === curr.value)) acc.push(curr);
                return acc;
            }, [] as any[])
            .slice(0, 5)
            : [];

        return {
            price: finalPrice,
            maxPrice,
            isRange: !activeVariant && maxPrice > basePrice && hasVariants,
            originalPrice: comparePrice > basePrice ? comparePrice : null,
            variantDiscount: variantDiscountPct,
            campaignDiscount: campaignDiscountPct,
            stock: totalStock,
            isOut: totalStock <= 0,
            hasVariants,
            swatches,
            offerLabel: activeOffer?.title,
            activeOffer,
        };
    }, [product, activeOffer, activeVariant]);
};
