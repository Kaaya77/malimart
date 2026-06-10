-- ClickPesa payment integration: payments tracking table
-- Apply when Supabase is unrestricted.

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  -- ClickPesa requires alphanumeric-only references; we generate our own
  order_reference TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'clickpesa',
  method TEXT NOT NULL DEFAULT 'ussd_push',
  phone_number TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TZS',
  -- PROCESSING → SUCCESS | FAILED (mirrors ClickPesa statuses)
  status TEXT NOT NULL DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED', 'SETTLED')),
  channel TEXT,                  -- M-PESA / TIGO-PESA / AIRTEL-MONEY (from ClickPesa)
  provider_payment_id TEXT,      -- ClickPesa transaction id
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(order_reference);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Buyers can see their own payments. Nobody can insert/update from the client:
-- ALL writes go through Edge Functions using the service role.
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Orders: payment status column (payment_ref already exists from earlier migration)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
  CHECK (payment_status IN ('unpaid', 'processing', 'paid', 'failed'));

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
