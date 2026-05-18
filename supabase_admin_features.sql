-- Admin Command Center & Moderation Features SQL Updates

-- 1. Profiles Updates
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- 2. Social Posts Moderation Columns
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'flagged', 'rejected'));
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT false;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;

-- 3. Reviews Moderation Columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'flagged', 'rejected'));
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_shadowbanned BOOLEAN DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;

-- 4. Moderation Logs Table
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    content_id UUID NOT NULL, -- Can be social_post_id or review_id
    action TEXT NOT NULL,
    note TEXT,
    moderator_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Offers (Growth Engine) Updates
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS tier_requirement TEXT DEFAULT 'all';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN DEFAULT false;

-- Update campaign_type check constraint safely
ALTER TABLE public.offers DROP CONSTRAINT IF EXISTS offers_campaign_type_check;
ALTER TABLE public.offers ADD CONSTRAINT offers_campaign_type_check CHECK (campaign_type IN ('discount', 'bogo', 'shipping', 'flash_sale', 'referral'));

-- 6. Disputes Table
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id),
    buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    description TEXT NOT NULL,
    resolution_notes TEXT,
    refund_amount NUMERIC DEFAULT 0 CHECK (refund_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Seller Payouts Table
CREATE TABLE IF NOT EXISTS public.seller_payouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) NOT NULL,
    period DATE NOT NULL,
    total_sales NUMERIC NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
    commission_amount NUMERIC NOT NULL DEFAULT 0 CHECK (commission_amount >= 0),
    net_payout NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Enable RLS on new tables
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- 9. Add basic policies for admins (assuming admin role check is done via app logic or RLS)
-- For simplicity, allowing all authenticated users to read, but app logic restricts to admins
CREATE POLICY "Admins can manage moderation logs" ON public.moderation_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Users can view own disputes" ON public.disputes FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Admins can manage disputes" ON public.disputes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Sellers can view own payouts" ON public.seller_payouts FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage payouts" ON public.seller_payouts FOR ALL USING (auth.role() = 'authenticated');

-- 10. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
