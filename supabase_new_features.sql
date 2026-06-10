-- 21. LOGIN HISTORY
CREATE TABLE IF NOT EXISTS public.login_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    ip_address TEXT,
    device_info TEXT,
    login_time TIMESTAMPTZ DEFAULT NOW()
);

-- 22. STAFF ACCOUNTS
CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'staff' CHECK (role IN ('staff', 'manager', 'admin')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. SHIPPING ZONES
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    fee NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to profiles for buyer settings
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'TZS';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS high_contrast_mode BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS export_format TEXT DEFAULT 'csv';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS opt_out_analytics BOOLEAN DEFAULT false;

-- Add new columns to vendor_profiles for seller settings
ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 5;

-- Add new columns to platform_settings for admin settings
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'TZS';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS audit_retention_days INTEGER DEFAULT 30;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS require_vendor_verification BOOLEAN DEFAULT true;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS max_products_per_vendor INTEGER DEFAULT 1000;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS enable_loyalty_program BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own login history" ON public.login_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Sellers can manage their staff accounts" ON public.staff_accounts FOR ALL USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can manage their shipping zones" ON public.shipping_zones FOR ALL USING (auth.uid() = seller_id);

-- 24. FOLLOWERS
CREATE TABLE IF NOT EXISTS public.followers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, seller_id)
);

ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follows" ON public.followers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can follow sellers" ON public.followers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow sellers" ON public.followers FOR DELETE USING (auth.uid() = user_id);

