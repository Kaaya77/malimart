-- Migration to add missing 'price' column to products and product_variants tables
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0);
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0);

-- Update existing products to have price = base_price if base_price exists
UPDATE public.products SET price = base_price WHERE price = 0 AND base_price > 0;
UPDATE public.product_variants SET price = base_price WHERE price = 0 AND base_price > 0;
