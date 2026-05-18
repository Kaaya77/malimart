CREATE TABLE IF NOT EXISTS public.hero_recommendations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price_display TEXT,
    offer_text TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

ALTER TABLE public.hero_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage hero recommendations" ON public.hero_recommendations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Public can view approved hero recommendations" ON public.hero_recommendations FOR SELECT USING (
  status = 'approved'
);
