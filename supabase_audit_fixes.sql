
-- MALI-MART AUDIT FIXES
-- Run this to align DB Schema with Frontend Expectations

-- 1. PRODUCTS: Add missing columns for UI metrics
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- 2. PROFILES: Add missing columns for User Dashboard
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Bronze';

-- 3. VENDOR_PROFILES: Add missing columns for Store Page stats
ALTER TABLE public.vendor_profiles ADD COLUMN IF NOT EXISTS avg_response_minutes INTEGER DEFAULT 60;

-- 4. Sync triggers for Product Ratings
-- Automatically update product rating when reviews are added/deleted
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.products
    SET 
        rating = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE product_id = NEW.product_id),
        review_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = NEW.product_id)
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_review_change ON public.reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

NOTIFY pgrst, 'reload config';
