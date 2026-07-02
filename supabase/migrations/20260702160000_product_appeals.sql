-- 20260702160000_product_appeals.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- DRAFT — NOT YET APPLIED. Fair product-suspension + appeal process.
--
-- Problem today: admin "Take Down" silently flips products.status to
-- 'inactive' (indistinguishable from a seller's own deactivation), the
-- seller is never notified, no reason is recorded, and there is no appeal
-- path. Worse, a seller could flip the product straight back to 'active'
-- via set_product_status or a direct row update.
--
-- This migration:
--   1. Adds products.takedown_reason + a distinct 'suspended' status.
--   2. Creates product_appeals (with RLS) so sellers can contest takedowns.
--   3. admin_takedown_product(): admin-only, reason required, notifies seller.
--   4. resolve_product_appeal(): admin-only approve/reject, notifies seller.
--   5. submit_product_appeal(): seller files an appeal, admins notified.
--   6. get_my_product_moderation(): seller-side read of suspension + appeal.
--   7. Hardens set_product_status + a BEFORE UPDATE trigger so only admins
--      can move a product out of 'suspended'.
--
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. products: takedown_reason column + 'suspended' status ────────────────
-- No existing column records why a product was taken down (checked: products
-- has no reason/moderation column).
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS takedown_reason TEXT;

-- CORRECTION: products.status IS constrained by products_status_check, which
-- (verified against production) only allows active/inactive/out_of_stock. The
-- new 'suspended' value would violate it — the same stale-CHECK class of bug
-- that had deadlocked orders. Widen the constraint to include the statuses the
-- code actually uses (draft/archived are set by set_product_status) plus
-- 'suspended'. No existing row can violate a strict superset, so it validates.
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE public.products ADD CONSTRAINT products_status_check
  CHECK (status = ANY (ARRAY['active','inactive','out_of_stock','draft','archived','suspended']));

-- ─── 2. product_appeals table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_appeals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID        NOT NULL REFERENCES public.products(id)  ON DELETE CASCADE,
  seller_id       UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  reason          TEXT        NOT NULL,              -- the seller's appeal text
  takedown_reason TEXT,                              -- snapshot of why it was taken down
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_response  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_product_appeals_seller  ON public.product_appeals (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_appeals_status  ON public.product_appeals (status, created_at DESC);
-- One open appeal per product at a time (a seller may re-appeal after a rejection).
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_appeals_pending
  ON public.product_appeals (product_id) WHERE status = 'pending';

-- ─── 2b. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.product_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_appeals_seller_select" ON public.product_appeals;
CREATE POLICY "product_appeals_seller_select" ON public.product_appeals
  FOR SELECT USING (seller_id = auth.uid());

-- Sellers may file an appeal only for their own, currently-suspended product,
-- and only in the 'pending' state with no resolution fields pre-filled.
DROP POLICY IF EXISTS "product_appeals_seller_insert" ON public.product_appeals;
CREATE POLICY "product_appeals_seller_insert" ON public.product_appeals
  FOR INSERT WITH CHECK (
    seller_id = auth.uid()
    AND status = 'pending'
    AND admin_response IS NULL
    AND resolved_at IS NULL
    AND resolved_by IS NULL
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_appeals.product_id
        AND p.seller_id = auth.uid()
        AND p.status = 'suspended'
    )
  );

-- Uses the existing is_admin() helper from supabase/rls_policies.sql.
DROP POLICY IF EXISTS "product_appeals_admin_all" ON public.product_appeals;
CREATE POLICY "product_appeals_admin_all" ON public.product_appeals
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.touch_product_appeals_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_product_appeals_touch ON public.product_appeals;
CREATE TRIGGER trg_product_appeals_touch
  BEFORE UPDATE ON public.product_appeals
  FOR EACH ROW EXECUTE FUNCTION public.touch_product_appeals_updated_at();

-- ─── 3. Suspension is admin-territory: trigger guard ─────────────────────────
-- Belt-and-braces: regardless of which code path updates products (direct
-- UPDATE under products_update_seller RLS, set_product_status RPC, etc.),
-- only an admin may move a product OUT of 'suspended' or INTO 'suspended'.
CREATE OR REPLACE FUNCTION public.enforce_product_suspension()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND (OLD.status = 'suspended' OR NEW.status = 'suspended')
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'This product was suspended by MaliMart. Submit an appeal to request reinstatement.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_product_suspension ON public.products;
CREATE TRIGGER trg_enforce_product_suspension
  BEFORE UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_suspension();

-- Re-declare set_product_status (seller status toggle RPC from
-- 20260614000001) with an explicit, friendlier guard. Same signature.
CREATE OR REPLACE FUNCTION public.set_product_status(
  p_product_id UUID,
  p_status     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid     UUID := auth.uid();
  _current TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_status NOT IN ('active', 'draft', 'inactive', 'archived') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  SELECT status INTO _current
  FROM products WHERE id = p_product_id AND seller_id = _uid
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'product not found or access denied'; END IF;
  IF _current = 'suspended' THEN
    RAISE EXCEPTION 'This product was suspended by MaliMart. Submit an appeal to request reinstatement.';
  END IF;

  UPDATE products
  SET    status     = p_status,
         updated_at = NOW()
  WHERE  id = p_product_id AND seller_id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_product_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_product_status(UUID, TEXT) TO authenticated;

-- ─── 4. admin_takedown_product ───────────────────────────────────────────────
-- Replaces the silent client-side `UPDATE products SET status='inactive'`.
-- Sets the DISTINCT 'suspended' status (not the seller-owned 'inactive'),
-- records the reason, and notifies the seller.
CREATE OR REPLACE FUNCTION public.admin_takedown_product(
  p_product_id UUID,
  p_reason     TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller UUID;
  _name   TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'a takedown reason is required (min 5 characters)';
  END IF;

  SELECT seller_id, name INTO _seller, _name
  FROM products WHERE id = p_product_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;

  UPDATE products
  SET    status          = 'suspended',
         takedown_reason = btrim(p_reason),
         updated_at      = NOW()
  WHERE  id = p_product_id;

  -- Notify the seller — no more silent takedowns.
  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (
    _seller,
    'moderation',
    'Listing suspended: ' || _name,
    'Your listing "' || _name || '" was suspended by MaliMart. Reason: '
      || btrim(p_reason)
      || ' If you believe this is a mistake, you can appeal from your Inventory page.',
    FALSE, NOW()
  );

  -- Audit trail (moderation_logs exists; tolerate environments where it does not).
  BEGIN
    INSERT INTO moderation_logs (content_id, note, action, admin_id)
    VALUES (p_product_id, btrim(p_reason), 'takedown_product', auth.uid());
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_takedown_product(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_takedown_product(UUID, TEXT) TO authenticated;

-- ─── 5. submit_product_appeal ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_product_appeal(
  p_product_id UUID,
  p_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid       UUID := auth.uid();
  _name      TEXT;
  _takedown  TEXT;
  _appeal_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'please explain your appeal (min 10 characters)';
  END IF;

  SELECT name, takedown_reason INTO _name, _takedown
  FROM products
  WHERE id = p_product_id AND seller_id = _uid AND status = 'suspended';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found, not yours, or not suspended';
  END IF;

  IF EXISTS (
    SELECT 1 FROM product_appeals
    WHERE product_id = p_product_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'an appeal for this product is already pending review';
  END IF;

  INSERT INTO product_appeals (product_id, seller_id, reason, takedown_reason)
  VALUES (p_product_id, _uid, btrim(p_reason), _takedown)
  RETURNING id INTO _appeal_id;

  -- Let admins know there is a pending appeal.
  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  SELECT pr.id,
         'moderation',
         'New product appeal',
         'A seller appealed the suspension of "' || _name || '". Review it in Admin → Moderation.',
         FALSE, NOW()
  FROM profiles pr
  WHERE pr.role = 'admin';

  RETURN _appeal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_product_appeal(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_product_appeal(UUID, TEXT) TO authenticated;

-- ─── 6. resolve_product_appeal ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_product_appeal(
  p_appeal_id UUID,
  p_approve   BOOLEAN,
  p_response  TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _appeal RECORD;
  _name   TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;

  SELECT * INTO _appeal FROM product_appeals WHERE id = p_appeal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appeal not found'; END IF;
  IF _appeal.status <> 'pending' THEN RAISE EXCEPTION 'appeal already resolved'; END IF;

  -- Fairness: a rejection must come with an explanation.
  IF NOT p_approve AND (p_response IS NULL OR length(btrim(p_response)) < 5) THEN
    RAISE EXCEPTION 'a response is required when rejecting an appeal (min 5 characters)';
  END IF;

  SELECT name INTO _name FROM products WHERE id = _appeal.product_id;

  UPDATE product_appeals
  SET    status         = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         admin_response = NULLIF(btrim(COALESCE(p_response, '')), ''),
         resolved_at    = NOW(),
         resolved_by    = auth.uid(),
         updated_at     = NOW()
  WHERE  id = p_appeal_id;

  IF p_approve THEN
    UPDATE products
    SET    status          = 'active',
           takedown_reason = NULL,
           updated_at      = NOW()
    WHERE  id = _appeal.product_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, read, created_at)
  VALUES (
    _appeal.seller_id,
    'moderation',
    CASE WHEN p_approve
         THEN 'Appeal approved: ' || COALESCE(_name, 'your listing')
         ELSE 'Appeal rejected: ' || COALESCE(_name, 'your listing') END,
    CASE WHEN p_approve
         THEN 'Good news — your appeal was approved and "' || COALESCE(_name, 'your listing') || '" is live again.'
         ELSE 'Your appeal for "' || COALESCE(_name, 'your listing') || '" was rejected.' END
      || COALESCE(' Response from MaliMart: ' || NULLIF(btrim(COALESCE(p_response, '')), ''), ''),
    FALSE, NOW()
  );

  BEGIN
    INSERT INTO moderation_logs (content_id, note, action, admin_id)
    VALUES (
      _appeal.product_id,
      COALESCE(NULLIF(btrim(COALESCE(p_response, '')), ''), 'no response'),
      CASE WHEN p_approve THEN 'approve_product_appeal' ELSE 'reject_product_appeal' END,
      auth.uid()
    );
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_product_appeal(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_product_appeal(UUID, BOOLEAN, TEXT) TO authenticated;

-- ─── 7. get_my_product_moderation ────────────────────────────────────────────
-- Seller-side read model: get_seller_inventory does not return
-- takedown_reason (fixed jsonb column list), so the inventory page fetches
-- this small companion RPC and merges it in by product_id.
CREATE OR REPLACE FUNCTION public.get_my_product_moderation()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'product_id',      p.id,
      'product_status',  p.status,
      'takedown_reason', p.takedown_reason,
      'appeal', (
        SELECT jsonb_build_object(
          'id',             a.id,
          'status',         a.status,
          'reason',         a.reason,
          'admin_response', a.admin_response,
          'created_at',     a.created_at,
          'resolved_at',    a.resolved_at
        )
        FROM product_appeals a
        WHERE a.product_id = p.id AND a.seller_id = auth.uid()
        ORDER BY a.created_at DESC
        LIMIT 1
      )
    ) AS entry
    FROM products p
    WHERE p.seller_id = auth.uid()
      AND (
        p.status = 'suspended'
        OR EXISTS (SELECT 1 FROM product_appeals a WHERE a.product_id = p.id)
      )
  ) sub;
$$;

REVOKE ALL ON FUNCTION public.get_my_product_moderation() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_product_moderation() TO authenticated;
