-- 19. PAYMENT METHODS
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- e.g., 'visa', 'mpesa'
    provider TEXT NOT NULL, -- e.g., 'visa', 'vodacom'
    last4 TEXT,
    phone_number TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. CONNECTED ACCOUNTS
CREATE TABLE IF NOT EXISTS public.connected_accounts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL, -- e.g., 'google', 'facebook'
    provider_user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own payment methods" ON public.payment_methods FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own connected accounts" ON public.connected_accounts FOR ALL USING (auth.uid() = user_id);
