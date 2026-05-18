-- Advanced Store Profile and Reporting Enhancements
ALTER TABLE public.vendor_profiles 
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{"instagram": "", "facebook": "", "twitter": "", "whatsapp": ""}',
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT '{"mon": "08:00-18:00", "tue": "08:00-18:00", "wed": "08:00-18:00", "thu": "08:00-18:00", "fri": "08:00-18:00", "sat": "09:00-16:00", "sun": "Closed"}',
ADD COLUMN IF NOT EXISTS store_policy TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Ensure reports table has category and details
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'category') THEN
        ALTER TABLE public.reports ADD COLUMN category TEXT;
    END IF;
END $$;

-- Add a view for revenue trend to avoid mock data
CREATE OR REPLACE VIEW public.revenue_stats AS
SELECT 
    date_trunc('day', created_at)::date as name,
    SUM(total) as revenue
FROM public.orders
WHERE status = 'delivered'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 7;

-- Add a view for top products
CREATE OR REPLACE VIEW public.top_products_stats AS
SELECT 
    p.name,
    COUNT(oi.id) as count
FROM public.order_items oi
JOIN public.products p ON oi.product_id = p.id
GROUP BY p.name
ORDER BY count DESC
LIMIT 5;
