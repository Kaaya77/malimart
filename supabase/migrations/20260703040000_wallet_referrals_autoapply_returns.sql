-- 20260703040000_wallet_referrals_autoapply_returns.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Complete-or-kill batch. Four features, all money paths server-side only:
--
--   1. Wallet ledger (no change needed to money movement — refunds/credits
--      below feed it). Adds a canonical internal credit helper _credit_wallet()
--      used by referrals and returns so a wallet balance and its transaction
--      row always move together atomically. The UI removes its "coming soon"
--      top-up/withdraw buttons (there is no payment gateway).
--
--   2. Referral program — referrals table + RLS; deterministic per-user code;
--      record_referral(code) at signup; a trigger credits the referrer's wallet
--      once the referred buyer's first order reaches a completed status.
--
--   3. Auto-apply discounts — compute_auto_apply_discount(p_items) picks the
--      single best active is_auto_apply offer matching the cart. place_order_atomic
--      applies best-of(coupon, auto) — never stacked. preview_cart_discount()
--      lets checkout show the applied discount before ordering.
--
--   4. Returns state machine — returns/disputes run on the disputes table.
--      buyer_create_return() (replaces the client-side insert), seller_approve_return()
--      (sets refund_amount), seller_reject_return() (reason), and
--      process_return_refund() which credits the buyer wallet atomically.
--
-- All statements idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT
-- EXISTS / CREATE OR REPLACE). Never DROPs columns or tables. SECURITY DEFINER
-- with role/ownership checks; EXECUTE revoked from anon/PUBLIC.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Column guards (reproducible from a clean `supabase db reset`) ───────────
-- offers.is_auto_apply is defined in the standalone schema bootstrap; ensure it
-- exists so compute_auto_apply_discount below doesn't hard-error on a fresh DB.
-- No-op on the live DB where the column already exists.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS is_auto_apply boolean NOT NULL DEFAULT false;

-- ─── 0. Canonical wallet credit helper (internal) ────────────────────────────
-- The ONLY sanctioned way money enters a wallet from these features. Moves the
-- profiles.wallet_balance and inserts the wallet_transactions ledger row in one
-- transaction. Amount is validated (> 0). Never callable by clients.
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

  IF p_type = 'credit' THEN
    UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount, updated_at = NOW()
    WHERE id = p_profile_id;
  ELSE
    UPDATE profiles SET wallet_balance = GREATEST(COALESCE(wallet_balance, 0) - p_amount, 0), updated_at = NOW()
    WHERE id = p_profile_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet: profile not found'; END IF;

  INSERT INTO wallet_transactions (profile_id, order_id, amount, type, status, reference_id, description, created_at)
  VALUES (p_profile_id, p_order_id, p_amount, p_type, 'completed', p_reference, p_description, NOW())
  RETURNING id INTO _tx_id;

  RETURN _tx_id;
END;
$$;
REVOKE ALL ON FUNCTION public._credit_wallet(UUID, NUMERIC, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. REFERRAL PROGRAM
-- ═══════════════════════════════════════════════════════════════════════════

-- Reward paid to the referrer when a referred buyer completes their first order.
-- (Server constant — clients never supply reward amounts.)
CREATE OR REPLACE FUNCTION public._referral_reward_amount()
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT 5000::numeric $$;

CREATE TABLE IF NOT EXISTS public.referrals (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'qualified', 'rewarded')),
  reward_amount NUMERIC NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  qualified_at  TIMESTAMPTZ,
  rewarded_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ,
  UNIQUE (referred_id)  -- a user can be referred at most once
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON public.referrals(status);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- A user may read referral rows where they are either side. All writes go
-- through SECURITY DEFINER RPCs (no INSERT/UPDATE/DELETE policy = denied).
DROP POLICY IF EXISTS referrals_select_own ON public.referrals;
CREATE POLICY referrals_select_own ON public.referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

-- ─── Deterministic per-user referral code ────────────────────────────────────
-- Idempotent: returns the existing profiles.referral_code, generating and
-- persisting one on first call. Format MALI-XXXXXX (base36 of a stable hash).
CREATE OR REPLACE FUNCTION public.get_or_create_my_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _code TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT referral_code INTO _code FROM profiles WHERE id = _uid;
  IF _code IS NOT NULL AND btrim(_code) <> '' THEN
    RETURN _code;
  END IF;

  -- Deterministic, collision-resistant enough for this scale.
  _code := 'MALI-' || upper(substr(md5(_uid::text), 1, 6));

  -- Guard against the rare collision by appending more entropy.
  WHILE EXISTS (SELECT 1 FROM profiles WHERE referral_code = _code AND id <> _uid) LOOP
    _code := 'MALI-' || upper(substr(md5(_uid::text || clock_timestamp()::text), 1, 8));
  END LOOP;

  UPDATE profiles SET referral_code = _code, updated_at = NOW() WHERE id = _uid;
  RETURN _code;
END;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_my_referral_code() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_or_create_my_referral_code() TO authenticated;

-- ─── Record a referral (referred user enters a code) ─────────────────────────
-- Called once, e.g. from the buyer's first session after signup. Guards:
-- code must exist, cannot refer yourself, and you cannot already be referred.
CREATE OR REPLACE FUNCTION public.record_referral(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid      UUID := auth.uid();
  _referrer UUID;
  _code     TEXT := upper(btrim(COALESCE(p_code, '')));
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _code = '' THEN RAISE EXCEPTION 'referral code required'; END IF;

  SELECT id INTO _referrer FROM profiles WHERE upper(referral_code) = _code;
  IF _referrer IS NULL THEN RAISE EXCEPTION 'that referral code is not valid'; END IF;
  IF _referrer = _uid THEN RAISE EXCEPTION 'you cannot refer yourself'; END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = _uid) THEN
    RAISE EXCEPTION 'you have already used a referral code';
  END IF;

  INSERT INTO referrals (referrer_id, referred_id, code, status, created_at)
  VALUES (_referrer, _uid, _code, 'pending', NOW());

  -- Keep the legacy profiles.referred_by breadcrumb in sync.
  UPDATE profiles SET referred_by = _code, updated_at = NOW() WHERE id = _uid;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.record_referral(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.record_referral(TEXT) TO authenticated;

-- ─── My referral status (for the WalletTab UI) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_referral_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  RETURN jsonb_build_object(
    'code',           public.get_or_create_my_referral_code(),
    'reward_amount',  public._referral_reward_amount(),
    'invited',        (SELECT count(*) FROM referrals WHERE referrer_id = _uid),
    'qualified',      (SELECT count(*) FROM referrals WHERE referrer_id = _uid AND status IN ('qualified','rewarded')),
    'rewarded',       (SELECT count(*) FROM referrals WHERE referrer_id = _uid AND status = 'rewarded'),
    'total_earned',   (SELECT COALESCE(sum(reward_amount),0) FROM referrals WHERE referrer_id = _uid AND status = 'rewarded')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_referral_status() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_referral_status() TO authenticated;

-- ─── Trigger: credit the referrer on the referred buyer's first completed order
-- Fires when an order transitions into a completed state. Idempotent per
-- referral (status flips pending → rewarded exactly once).
CREATE OR REPLACE FUNCTION public._referral_on_order_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref     RECORD;
  _reward  numeric := public._referral_reward_amount();
BEGIN
  -- Only act on the transition INTO 'delivered' — the true "first completed
  -- order" signal. NOT 'paid' (set at order creation), which would let a
  -- referred user farm the reward by placing then cancelling before fulfilment.
  IF NEW.status::text <> 'delivered' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = NEW.status::text THEN RETURN NEW; END IF;

  SELECT * INTO _ref FROM referrals
  WHERE referred_id = NEW.user_id AND status = 'pending'
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE referrals
  SET status        = 'rewarded',
      reward_amount = _reward,
      qualified_at  = NOW(),
      rewarded_at   = NOW(),
      updated_at    = NOW()
  WHERE id = _ref.id;

  PERFORM public._credit_wallet(
    _ref.referrer_id, _reward, 'credit',
    'Referral reward — a friend you invited placed their first order',
    NEW.id, _ref.id
  );

  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (_ref.referrer_id, 'system', 'Referral reward earned!',
    'A friend you invited placed their first order. TZS ' || _reward::text
      || ' has been credited to your wallet.', FALSE, NOW());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_on_order_complete ON public.orders;
CREATE TRIGGER trg_referral_on_order_complete
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public._referral_on_order_complete();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. AUTO-APPLY DISCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Best single active auto-apply offer for a cart. Returns the discount amount
-- plus which offer produced it (so the UI can name it). Percentage/fixed only —
-- BOGO/shipping campaigns are out of scope here. Never stacks: one best offer.
CREATE OR REPLACE FUNCTION public.compute_auto_apply_discount(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it            RECORD;
  v_price       numeric;
  v_seller      uuid;
  v_seller_sub  jsonb := '{}'::jsonb;   -- seller_id -> subtotal
  v_subtotal    numeric := 0;
  o             RECORD;
  v_scope_sub   numeric;
  v_disc        numeric;
  v_best        numeric := 0;
  v_best_offer  uuid;
  v_best_title  text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RETURN jsonb_build_object('discount', 0); END IF;

  -- Per-seller subtotals (seller offers apply only to their own items).
  FOR it IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, variant_id uuid, quantity integer) LOOP
    IF it.quantity IS NULL OR it.quantity <= 0 THEN CONTINUE; END IF;
    IF it.variant_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(pv.sale_price,0), NULLIF(pv.base_price,0), pv.price), p.seller_id
        INTO v_price, v_seller
      FROM product_variants pv JOIN products p ON p.id = pv.product_id
      WHERE pv.id = it.variant_id AND pv.product_id = it.product_id;
    ELSE
      SELECT price, seller_id INTO v_price, v_seller FROM products WHERE id = it.product_id;
    END IF;
    IF v_price IS NULL OR v_seller IS NULL THEN CONTINUE; END IF;
    v_subtotal := v_subtotal + (v_price * it.quantity);
    v_seller_sub := jsonb_set(v_seller_sub, ARRAY[v_seller::text],
      to_jsonb(COALESCE((v_seller_sub->>v_seller::text)::numeric, 0) + (v_price * it.quantity)));
  END LOOP;

  IF v_subtotal <= 0 THEN RETURN jsonb_build_object('discount', 0); END IF;

  -- Candidate offers: active, auto-apply, within date window, of discount type.
  FOR o IN
    SELECT id, title, seller_id, scope, type, value, min_order_value
    FROM offers
    WHERE is_auto_apply = TRUE
      AND status = 'active'
      AND COALESCE(campaign_type, 'discount') = 'discount'
      AND type IN ('percentage', 'fixed')
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date   IS NULL OR end_date   >= NOW())
      AND (max_usage IS NULL OR COALESCE(current_usage, 0) < max_usage)
  LOOP
    -- Scope: platform offers apply to the whole cart; seller offers to that
    -- seller's items only.
    IF o.scope = 'platform' THEN
      v_scope_sub := v_subtotal;
    ELSE
      v_scope_sub := COALESCE((v_seller_sub->>o.seller_id::text)::numeric, 0);
    END IF;

    IF v_scope_sub <= 0 THEN CONTINUE; END IF;
    IF v_scope_sub < COALESCE(o.min_order_value, 0) THEN CONTINUE; END IF;

    IF o.type = 'percentage' THEN
      v_disc := ROUND(v_scope_sub * (LEAST(o.value, 100) / 100.0));
    ELSE
      v_disc := LEAST(o.value, v_scope_sub);
    END IF;

    IF v_disc > v_best THEN
      v_best := v_disc; v_best_offer := o.id; v_best_title := o.title;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'discount', GREATEST(v_best, 0),
    'offer_id', v_best_offer,
    'title',    v_best_title
  );
END;
$$;
REVOKE ALL ON FUNCTION public.compute_auto_apply_discount(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.compute_auto_apply_discount(jsonb) TO authenticated;

-- Checkout preview: best-of(coupon, auto). Read-only — computes what the buyer
-- will actually get so the summary can show it before ordering.
CREATE OR REPLACE FUNCTION public.preview_cart_discount(p_items jsonb, p_coupon_code TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon numeric := 0;
  v_auto   jsonb;
  v_auto_d numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF p_coupon_code IS NOT NULL AND btrim(p_coupon_code) <> '' THEN
    v_coupon := COALESCE(public.compute_order_discount(p_items, p_coupon_code), 0);
  END IF;

  v_auto   := public.compute_auto_apply_discount(p_items);
  v_auto_d := COALESCE((v_auto->>'discount')::numeric, 0);

  IF v_auto_d > v_coupon THEN
    RETURN jsonb_build_object('discount', v_auto_d, 'source', 'auto',
      'offer_id', v_auto->>'offer_id', 'title', v_auto->>'title');
  ELSE
    RETURN jsonb_build_object('discount', v_coupon, 'source',
      CASE WHEN v_coupon > 0 THEN 'coupon' ELSE 'none' END,
      'title', CASE WHEN v_coupon > 0 THEN p_coupon_code ELSE NULL END);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_cart_discount(jsonb, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.preview_cart_discount(jsonb, TEXT) TO authenticated;

-- ─── Wire place_order_atomic to apply best-of(coupon, auto) ──────────────────
-- Same body as 20260703030000 (vacation enforcement kept) with ONE change:
-- v_discount becomes GREATEST(coupon_discount, auto_apply_discount) and the
-- winning auto-apply offer is recorded in order_discounts + its usage bumped.
CREATE OR REPLACE FUNCTION public.place_order_atomic(p_user_id uuid, p_shipping_address jsonb, p_payment_method text, p_payment_ref text, p_delivery_fee numeric, p_discount_amount numeric, p_note text, p_items jsonb, p_is_gift boolean DEFAULT false, p_gift_message text DEFAULT NULL::text, p_preferred_delivery_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_delivery_slot text DEFAULT NULL::text, p_coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
    new_order_id uuid; item record; item_price numeric; item_seller_id uuid;
    item_sku text; current_stock integer; v_totals jsonb; v_discount numeric;
    v_vacation_store text;
    v_coupon_disc numeric; v_auto jsonb; v_auto_disc numeric; v_auto_offer uuid;
begin
    if auth.uid() is null or auth.uid() != p_user_id then raise exception 'Unauthorized'; end if;
    if jsonb_array_length(p_items) = 0 then raise exception 'No items in order'; end if;

    -- Vacation-mode enforcement: no item may come from a store on vacation.
    select coalesce(vp.store_name, 'A store in your cart') into v_vacation_store
    from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer)
    join products p on p.id = x.product_id
    join vendor_profiles vp on vp.seller_id = p.seller_id
    where coalesce(vp.vacation_mode, false)
    limit 1;
    if v_vacation_store is not null then
        raise exception 'Seller on vacation: % is currently on vacation and not accepting orders. Please remove their items from your cart.', v_vacation_store;
    end if;

    for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer) loop
        if item.quantity <= 0 then raise exception 'Invalid quantity'; end if;
        if item.variant_id is not null then
            select coalesce(nullif(pv.sale_price, 0), nullif(pv.base_price, 0), pv.price), pv.stock, pv.sku, p.seller_id
              into item_price, current_stock, item_sku, item_seller_id
            from product_variants pv join products p on p.id = item.product_id where pv.id = item.variant_id and pv.product_id = item.product_id;
        else
            select price, stock, sku, seller_id into item_price, current_stock, item_sku, item_seller_id from products where id = item.product_id;
        end if;
        if item_price is null then raise exception 'Product not found: %', item.product_id; end if;
        if current_stock is not null and current_stock < item.quantity then raise exception 'Insufficient stock for product %', item.product_id; end if;
    end loop;

    -- Discount: best-of(manual coupon, auto-apply offer). Never stacked.
    v_coupon_disc := COALESCE(public.compute_order_discount(p_items, p_coupon_code), 0);
    v_auto        := public.compute_auto_apply_discount(p_items);
    v_auto_disc   := COALESCE((v_auto->>'discount')::numeric, 0);
    if v_auto_disc > v_coupon_disc then
        v_discount := v_auto_disc;
        v_auto_offer := NULLIF(v_auto->>'offer_id','')::uuid;
    else
        v_discount := v_coupon_disc;
        v_auto_offer := NULL;
    end if;

    v_totals := public.compute_cart_totals(p_items, p_delivery_fee, v_discount);

    insert into public.orders (
        user_id, subtotal, delivery_fee, discount_amount, vat_amount, total,
        payment_method, payment_ref, shipping_address, note, status,
        is_gift, gift_message, preferred_delivery_date, delivery_slot, created_at, updated_at)
    values (
        p_user_id,
        (v_totals->>'subtotal')::numeric,
        (v_totals->>'delivery_fee')::numeric,
        (v_totals->>'discount')::numeric,
        (v_totals->>'vat_amount')::numeric,
        (v_totals->>'total')::numeric,
        p_payment_method, p_payment_ref, p_shipping_address, p_note, 'pending'::order_status,
        coalesce(p_is_gift,false), p_gift_message, p_preferred_delivery_date, p_delivery_slot, now(), now())
    returning id into new_order_id;

    for item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, variant_id uuid, quantity integer) loop
        if item.variant_id is not null then
            select coalesce(nullif(pv.sale_price, 0), nullif(pv.base_price, 0), pv.price), pv.sku, p.seller_id
              into item_price, item_sku, item_seller_id
            from product_variants pv join products p on p.id = item.product_id where pv.id = item.variant_id;
            update product_variants set stock = stock - item.quantity where id = item.variant_id;
        else
            select price, sku, seller_id into item_price, item_sku, item_seller_id from products where id = item.product_id;
            update products set stock = stock - item.quantity where id = item.product_id;
        end if;
        insert into public.order_items (order_id, product_id, variant_id, seller_id, quantity, price_at_purchase, sku)
        values (new_order_id, item.product_id, item.variant_id, item_seller_id, item.quantity, item_price, item_sku);
    end loop;

    -- Record the auto-applied offer against the order and bump its usage.
    if v_auto_offer is not null and v_discount > 0 then
        insert into public.order_discounts (order_id, offer_id, amount, created_at)
        values (new_order_id, v_auto_offer, v_discount, now());
        update public.offers set current_usage = coalesce(current_usage,0) + 1, updated_at = now()
        where id = v_auto_offer;
    end if;

    insert into public.notifications (user_id, type, title, message, read, created_at)
    select distinct oi.seller_id, 'order', 'New Order — Action Required', 'Order #' || left(new_order_id::text, 8) || ' is waiting for your confirmation.', false, now()
    from order_items oi where oi.order_id = new_order_id;

    return jsonb_build_object('id', new_order_id);
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.place_order_atomic(uuid, jsonb, text, text, numeric, numeric, text, jsonb, boolean, text, timestamptz, text, text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RETURNS STATE MACHINE  (runs on the disputes table)
-- ═══════════════════════════════════════════════════════════════════════════
-- disputes already has status open/under_review/resolved/refunded/closed
-- (widened in 20260703030000). Add the refund-amount owner and a
-- rejection-reason field, then the transition RPCs.
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS refund_amount   NUMERIC;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS refunded_at     TIMESTAMPTZ;
ALTER TABLE public.disputes ADD COLUMN IF NOT EXISTS evidence_urls   TEXT[];

-- ─── Buyer creates a return/dispute (replaces the client-side insert) ────────
CREATE OR REPLACE FUNCTION public.buyer_create_return(
  p_order_id     UUID,
  p_reason       TEXT,
  p_description  TEXT,
  p_evidence     TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       UUID := auth.uid();
  _order     RECORD;
  _seller_id UUID;
  _desc      TEXT := btrim(COALESCE(p_description, ''));
  _id        UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(_desc) < 20 THEN RAISE EXCEPTION 'please describe the issue (min 20 characters)'; END IF;

  SELECT * INTO _order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;
  IF _order.user_id <> _uid THEN RAISE EXCEPTION 'access denied'; END IF;

  IF EXISTS (SELECT 1 FROM disputes WHERE order_id = p_order_id AND status NOT IN ('closed', 'rejected')) THEN
    RAISE EXCEPTION 'a return/dispute is already open for this order';
  END IF;

  SELECT seller_id INTO _seller_id FROM order_items WHERE order_id = p_order_id AND seller_id IS NOT NULL LIMIT 1;
  IF _seller_id IS NULL THEN RAISE EXCEPTION 'could not identify the seller for this order'; END IF;

  INSERT INTO disputes (order_id, buyer_id, seller_id, reason, description, evidence_urls, status, created_at, updated_at)
  VALUES (p_order_id, _uid, _seller_id, p_reason, _desc, p_evidence, 'open', NOW(), NOW())
  RETURNING id INTO _id;

  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (_seller_id, 'return', 'New Return Request',
    'A buyer submitted a return request for order #' || left(p_order_id::text, 8)
      || '. Reason: ' || p_reason, FALSE, NOW());

  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.buyer_create_return(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.buyer_create_return(UUID, TEXT, TEXT, TEXT[]) TO authenticated;

-- ─── Seller approves a return, setting/confirming the refund amount ──────────
-- Moves open/under_review → resolved (approved). The refund amount is bounded
-- by the order total server-side — the client cannot approve more than was paid.
CREATE OR REPLACE FUNCTION public.seller_approve_return(
  p_dispute_id    UUID,
  p_refund_amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d        RECORD;
  _order_total NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public._is_dispute_seller(p_dispute_id) THEN
    RAISE EXCEPTION 'dispute not found or access denied';
  END IF;

  SELECT * INTO _d FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF _d.status NOT IN ('open', 'under_review') THEN
    RAISE EXCEPTION 'this return is already %', _d.status;
  END IF;

  SELECT total INTO _order_total FROM orders WHERE id = _d.order_id;
  IF p_refund_amount IS NULL OR p_refund_amount <= 0 THEN
    RAISE EXCEPTION 'refund amount must be positive';
  END IF;
  IF _order_total IS NOT NULL AND p_refund_amount > _order_total THEN
    RAISE EXCEPTION 'refund amount cannot exceed the order total';
  END IF;

  UPDATE disputes
  SET status        = 'resolved',
      refund_amount = p_refund_amount,
      resolved_at   = NOW(),
      updated_at    = NOW()
  WHERE id = p_dispute_id;

  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (_d.buyer_id, 'return', 'Return approved',
    'Your return on order #' || left(_d.order_id::text, 8)
      || ' was approved. A refund of TZS ' || p_refund_amount::text
      || ' will be credited to your wallet.', FALSE, NOW());
END;
$$;
REVOKE ALL ON FUNCTION public.seller_approve_return(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seller_approve_return(UUID, NUMERIC) TO authenticated;

-- ─── Seller rejects a return with a reason ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.seller_reject_return(
  p_dispute_id UUID,
  p_reason     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d      RECORD;
  _reason TEXT := btrim(COALESCE(p_reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(_reason) < 5 THEN RAISE EXCEPTION 'please give a reason (min 5 characters)'; END IF;
  IF NOT public._is_dispute_seller(p_dispute_id) THEN
    RAISE EXCEPTION 'dispute not found or access denied';
  END IF;

  SELECT * INTO _d FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF _d.status NOT IN ('open', 'under_review') THEN
    RAISE EXCEPTION 'this return is already %', _d.status;
  END IF;

  UPDATE disputes
  SET status           = 'rejected',
      rejection_reason = _reason,
      resolution_notes = COALESCE(resolution_notes, _reason),
      resolved_at      = NOW(),
      updated_at       = NOW()
  WHERE id = p_dispute_id;

  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (_d.buyer_id, 'return', 'Return declined',
    'Your return on order #' || left(_d.order_id::text, 8)
      || ' was declined. Reason: ' || _reason
      || '. You can message the seller or contact MaliMart support.', FALSE, NOW());
END;
$$;
REVOKE ALL ON FUNCTION public.seller_reject_return(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seller_reject_return(UUID, TEXT) TO authenticated;

-- ─── Process the refund: resolved → refunded, crediting the buyer wallet ─────
-- Callable by the seller who owns the return OR an admin. The credited amount is
-- ALWAYS the server-stored disputes.refund_amount (or falls back to the order
-- total) — never a client-supplied number. Atomic: wallet + ledger + status.
-- Also widen the status CHECK to allow 'rejected'.
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_status_check;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_status_check
  CHECK (status IN ('open', 'under_review', 'resolved', 'refunded', 'rejected', 'closed'));

CREATE OR REPLACE FUNCTION public.process_return_refund(p_dispute_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d       RECORD;
  _amount  NUMERIC;
  _is_seller BOOLEAN;
  _is_admin  BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _is_seller := public._is_dispute_seller(p_dispute_id);
  _is_admin  := public.is_admin();
  IF NOT (_is_seller OR _is_admin) THEN RAISE EXCEPTION 'access denied'; END IF;

  SELECT * INTO _d FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'return not found'; END IF;
  IF _d.status = 'refunded' THEN RAISE EXCEPTION 'this return has already been refunded'; END IF;
  IF _d.status <> 'resolved' THEN
    RAISE EXCEPTION 'a return must be approved before it can be refunded';
  END IF;

  _amount := _d.refund_amount;
  IF _amount IS NULL OR _amount <= 0 THEN
    SELECT total INTO _amount FROM orders WHERE id = _d.order_id;
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'no refund amount set'; END IF;

  UPDATE disputes
  SET status        = 'refunded',
      refund_amount = _amount,
      refunded_at   = NOW(),
      updated_at    = NOW()
  WHERE id = p_dispute_id;

  -- Reflect the refund on the order too (best-effort; keep transaction atomic).
  UPDATE orders SET status = 'refunded'::order_status, updated_at = NOW()
  WHERE id = _d.order_id AND status::text NOT IN ('refunded');

  PERFORM public._credit_wallet(
    _d.buyer_id, _amount, 'credit',
    'Refund for return on order #' || left(_d.order_id::text, 8),
    _d.order_id, _d.id
  );

  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (_d.buyer_id, 'return', 'Refund credited',
    'TZS ' || _amount::text || ' has been credited to your wallet for order #'
      || left(_d.order_id::text, 8) || '.', FALSE, NOW());

  RETURN jsonb_build_object('ok', true, 'amount', _amount);
END;
$$;
REVOKE ALL ON FUNCTION public.process_return_refund(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.process_return_refund(UUID) TO authenticated;
