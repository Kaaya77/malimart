import { useState, useMemo, useEffect } from 'react';
import { Product, ProductVariant } from '../types';

/**
 * Derives variant attribute structure, tracks the user's selected options,
 * and resolves the matching ProductVariant.
 *
 * Safe to call with `product = null` — returns empty / null values so callers
 * don't need to guard every field (Rules of Hooks: always call unconditionally).
 */
export const useVariantSelection = (product: Product | null) => {
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

    const variantStructure = useMemo(() => {
        if (!product?.variants || product.variants.length === 0) return [];
        const mapping: Record<string, Set<string>> = {};
        product.variants.filter(v => v.is_active !== false).forEach(v => {
            Object.entries(v.attributes).forEach(([key, val]) => {
                if (!mapping[key]) mapping[key] = new Set();
                mapping[key].add(String(val));
            });
        });
        return Object.entries(mapping).map(([name, values]) => ({ name, values: Array.from(values).sort() }));
    }, [product]);

    useEffect(() => {
        if (product && variantStructure.length > 0) {
            const defaults: Record<string, string> = {};
            const validVariant = product.variants?.find(v => v.is_active && v.stock > 0) || product.variants?.[0];
            if (validVariant) {
                variantStructure.forEach(attr => defaults[attr.name] = validVariant.attributes[attr.name]);
                setSelectedOptions(defaults);
            }
        } else {
            // Reset when product is null or has no variants
            setSelectedOptions({});
        }
    }, [product, variantStructure]);

    useEffect(() => {
        if (product?.variants?.length && Object.keys(selectedOptions).length > 0) {
            const findVariant = product.variants.find(variant =>
                Object.entries(selectedOptions).every(([key, value]) =>
                    variant.attributes[key] === value
                )
            );
            setSelectedVariant(findVariant || product.variants[0]);
        } else if (product?.variants?.length) {
            setSelectedVariant(product.variants[0]);
        } else {
            setSelectedVariant(null);
        }
    }, [selectedOptions, product]);

    return {
        selectedOptions,
        setSelectedOptions,
        selectedVariant,
        variantStructure,
    };
};
