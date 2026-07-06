-- The profiles_prevent_escalation trigger (live in production) raises
-- 'Unauthorized: wallet must be modified through wallet_transactions' whenever
-- a NON-ADMIN session changes profiles.wallet_balance. Inside a SECURITY
-- DEFINER RPC auth.uid() is still the buyer, so every _credit_wallet call
-- made on behalf of a buyer (refund credit, referral reward, checkout debit)
-- would fail at runtime. The wallet migration (20260703040000) never
-- addressed this.
--
-- Fix: _credit_wallet marks its own writes with a transaction-local GUC and
-- the trigger honours that mark. The GUC can only be set server-side —
-- clients cannot smuggle it through PostgREST — and _credit_wallet remains
-- non-callable by clients (EXECUTE revoked), so the ledger-only invariant
-- the trigger enforces is preserved.

-- 1. _credit_wallet: same body as 20260703040000, plus the internal-write
--    mark set just before the balance update and cleared right after.
CREATE OR REPLACE FUNCTION public._credit_wallet(
  p_profile_id  UUID,
  p_amount      NUMERIC,
  p_type        TEXT,        -- 'credit' | 'debit'
  p_description TEXT,
  p_order_id    UUID DEFAULT NULL,
  p_reference   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tx_id UUID;
BEGIN
  IF p_profile_id IS NULL THEN RAISE EXCEPTION 'wallet: missing profile'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet: amount must be positive';
  END IF;
  IF p_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'wallet: invalid type %', p_type;
  END IF;

  PERFORM set_config('malimart.internal_wallet_write', 'on', true);

  IF p_type = 'credit' THEN
    UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount, updated_at = NOW()
    WHERE id = p_profile_id;
  ELSE
    UPDATE profiles SET wallet_balance = GREATEST(COALESCE(wallet_balance, 0) - p_amount, 0), updated_at = NOW()
    WHERE id = p_profile_id;
  END IF;

  PERFORM set_config('malimart.internal_wallet_write', '', true);

  IF NOT FOUND THEN RAISE EXCEPTION 'wallet: profile not found'; END IF;

  INSERT INTO wallet_transactions (profile_id, order_id, amount, type, status, reference_id, description, created_at)
  VALUES (p_profile_id, p_order_id, p_amount, p_type, 'completed', p_reference, p_description, NOW())
  RETURNING id INTO _tx_id;

  RETURN _tx_id;
END;
$$;
REVOKE ALL ON FUNCTION public._credit_wallet(UUID, NUMERIC, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- 2. Trigger fn: identical to the live version except the wallet_balance
--    branch admits _credit_wallet's transaction-local mark.
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip check for system operations (auth.uid() is null during triggers from auth)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot change their own role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::user_role) THEN
      RAISE EXCEPTION 'Unauthorized: cannot change role';
    END IF;
  END IF;

  -- Non-admins cannot directly modify wallet_balance.
  -- Exception: writes made by the internal _credit_wallet helper, which marks
  -- itself via a transaction-local GUC clients cannot set through PostgREST.
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    IF COALESCE(current_setting('malimart.internal_wallet_write', true), '') <> 'on'
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::user_role) THEN
      RAISE EXCEPTION 'Unauthorized: wallet must be modified through wallet_transactions';
    END IF;
  END IF;

  -- Non-admins cannot directly modify points
  IF NEW.points IS DISTINCT FROM OLD.points THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'::user_role) THEN
      RAISE EXCEPTION 'Unauthorized: points must be modified through the rewards system';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
