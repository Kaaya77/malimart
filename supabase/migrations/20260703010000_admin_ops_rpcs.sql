-- 20260703010000_admin_ops_rpcs.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Security batch: move admin-side supabase.from() calls out of components
-- (AdminAIHero, AdminModeration, AdminMessages, AdminPage dispute resolution)
-- into SECURITY DEFINER RPCs with explicit role checks.
--
-- Adds:
--   • admin_get_moderation_data(tab)     — one read RPC for the Moderation Hub
--   • admin_moderate_item(...)           — single moderation action + audit log
--   • admin_bulk_moderate(action, items) — ONE atomic call for bulk actions,
--                                          returns per-item results
--   • Hero management RPCs (list/update/status/delete/clear/create/boost)
--   • Hero manual settings read/write (platform_settings row 1)
--   • admin_get_user_profile / admin_get_order (AdminMessages lookups)
--   • mark_thread_read(peer)             — self-scoped unread flip
--   • admin_resolve_dispute(...)         — atomic disputes+orders resolution
--
-- All statements idempotent (OR REPLACE). Uses the existing is_admin() helper.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Moderation Hub read model ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_moderation_data(p_tab TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;

  IF p_tab = 'content' THEN
    SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'created_at') DESC), '[]'::jsonb) INTO _out
    FROM (
      (SELECT to_jsonb(sp) || jsonb_build_object(
         'profiles', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email)
                      FROM profiles pr WHERE pr.id = sp.user_id)
       ) AS row
       FROM social_posts sp ORDER BY sp.created_at DESC LIMIT 100)
      UNION ALL
      (SELECT to_jsonb(rv) || jsonb_build_object(
         'profiles', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email)
                      FROM profiles pr WHERE pr.id = rv.user_id)
       ) AS row
       FROM reviews rv ORDER BY rv.created_at DESC LIMIT 100)
    ) sub;
  ELSIF p_tab = 'reports' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(r) || jsonb_build_object(
      'reporter', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email)
                   FROM profiles pr WHERE pr.id = r.reporter_id),
      'reported', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email)
                   FROM profiles pr WHERE pr.id = r.reported_id)
    ) ORDER BY r.created_at DESC), '[]'::jsonb) INTO _out
    FROM (SELECT * FROM reports ORDER BY created_at DESC LIMIT 100) r;
  ELSIF p_tab = 'users' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.created_at DESC), '[]'::jsonb) INTO _out
    FROM (SELECT * FROM profiles WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100) u;
  ELSIF p_tab = 'vendors' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(v) || jsonb_build_object(
      'profiles', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email)
                   FROM profiles pr WHERE pr.id = v.seller_id),
      'documents', (SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
                    FROM vendor_documents d WHERE d.seller_id = v.seller_id)
    ) ORDER BY v.created_at DESC), '[]'::jsonb) INTO _out
    FROM (SELECT * FROM vendor_profiles ORDER BY created_at DESC LIMIT 100) v;
  ELSIF p_tab = 'logs' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(l) || jsonb_build_object(
      'admin', (SELECT jsonb_build_object('full_name', pr.full_name)
                FROM profiles pr WHERE pr.id = l.admin_id)
    ) ORDER BY l.created_at DESC), '[]'::jsonb) INTO _out
    FROM (SELECT * FROM moderation_logs ORDER BY created_at DESC LIMIT 100) l;
  ELSIF p_tab = 'appeals' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(a) || jsonb_build_object(
      'user', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email)
               FROM profiles pr WHERE pr.id = a.user_id)
    ) ORDER BY a.created_at DESC), '[]'::jsonb) INTO _out
    FROM (SELECT * FROM moderation_appeals ORDER BY created_at DESC LIMIT 100) a;
  ELSIF p_tab = 'products' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'profiles', (SELECT jsonb_build_object('full_name', pr.full_name, 'email', pr.email)
                   FROM profiles pr WHERE pr.id = p.seller_id)
    ) ORDER BY p.created_at DESC), '[]'::jsonb) INTO _out
    FROM (SELECT * FROM products WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100) p;
  ELSE
    RAISE EXCEPTION 'unknown tab: %', p_tab;
  END IF;

  RETURN _out;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_moderation_data(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_moderation_data(TEXT) TO authenticated;

-- ─── 2. Single moderation action (internal core, admin check in wrappers) ────
-- Content types: 'social_post' | 'review' | 'product' | 'report' | 'user'
--                | 'vendor' | 'appeal'. Mirrors the branch logic that lived in
-- AdminModeration.handleAction, with two fixes:
--   • delete_content on a product soft-deletes (deleted_at) instead of the old
--     no-op update against the reviews table;
--   • moderate_product uses 'suspended' (the only moderation status allowed by
--     products_status_check) instead of the invalid 'flagged'.
CREATE OR REPLACE FUNCTION public._admin_moderate_one(
  p_action       TEXT,
  p_id           UUID,
  p_content_type TEXT,
  p_note         TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Audit trail first (same shape the component wrote).
  INSERT INTO moderation_logs (content_id, note, action, admin_id)
  VALUES (p_id, COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'Action: ' || p_action), p_action, auth.uid());

  IF p_action = 'resolve_report' THEN
    UPDATE reports SET status = 'resolved' WHERE id = p_id;
  ELSIF p_action IN ('delete_content', 'approve_content', 'flag_content', 'shadowban_content', 'boost_content') THEN
    IF p_content_type = 'social_post' THEN
      CASE p_action
        WHEN 'delete_content'    THEN UPDATE social_posts SET status = 'deleted' WHERE id = p_id;
        WHEN 'approve_content'   THEN UPDATE social_posts SET status = 'approved', is_shadowbanned = FALSE WHERE id = p_id;
        WHEN 'flag_content'      THEN UPDATE social_posts SET status = 'flagged' WHERE id = p_id;
        WHEN 'shadowban_content' THEN UPDATE social_posts SET is_shadowbanned = TRUE WHERE id = p_id;
        WHEN 'boost_content'     THEN UPDATE social_posts SET is_boosted = TRUE WHERE id = p_id;
      END CASE;
    ELSIF p_content_type = 'review' THEN
      CASE p_action
        WHEN 'delete_content'    THEN UPDATE reviews SET status = 'deleted' WHERE id = p_id;
        WHEN 'approve_content'   THEN UPDATE reviews SET status = 'approved', is_shadowbanned = FALSE WHERE id = p_id;
        WHEN 'flag_content'      THEN UPDATE reviews SET status = 'flagged' WHERE id = p_id;
        WHEN 'shadowban_content' THEN UPDATE reviews SET is_shadowbanned = TRUE WHERE id = p_id;
        WHEN 'boost_content'     THEN UPDATE reviews SET is_boosted = TRUE WHERE id = p_id;
      END CASE;
    ELSIF p_content_type = 'product' AND p_action = 'delete_content' THEN
      UPDATE products SET deleted_at = NOW(), updated_at = NOW() WHERE id = p_id;
    ELSE
      RAISE EXCEPTION 'unsupported content_type % for action %', p_content_type, p_action;
    END IF;
  ELSIF p_action = 'ban_user' THEN
    UPDATE profiles SET is_banned = TRUE WHERE id = p_id;
  ELSIF p_action = 'unban_user' THEN
    UPDATE profiles SET is_banned = FALSE WHERE id = p_id;
  ELSIF p_action = 'verify_vendor' THEN
    UPDATE vendor_profiles SET is_verified = TRUE, verification_level = 'verified' WHERE seller_id = p_id;
  ELSIF p_action = 'reject_vendor' THEN
    UPDATE vendor_profiles SET is_verified = FALSE, verification_level = 'none' WHERE seller_id = p_id;
  ELSIF p_action = 'resolve_appeal' THEN
    UPDATE moderation_appeals SET status = 'approved' WHERE id = p_id;
  ELSIF p_action = 'reject_appeal' THEN
    UPDATE moderation_appeals SET status = 'rejected' WHERE id = p_id;
  ELSIF p_action = 'moderate_product' THEN
    UPDATE products
    SET status = 'suspended',
        takedown_reason = COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), 'Flagged by moderation'),
        updated_at = NOW()
    WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'unknown moderation action: %', p_action;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._admin_moderate_one(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_moderate_item(
  p_action       TEXT,
  p_id           UUID,
  p_content_type TEXT DEFAULT NULL,
  p_note         TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  PERFORM public._admin_moderate_one(p_action, p_id, p_content_type, p_note);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_moderate_item(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_moderate_item(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ─── 3. Bulk moderation: ONE call, per-item results ──────────────────────────
-- p_items: [{"id": "<uuid>", "content_type": "social_post"}, ...]
-- Runs in a single transaction (one function call). Each item is wrapped in a
-- subtransaction so one bad row does not abort the batch; the caller gets
-- [{"id", "ok", "error"}] back.
CREATE OR REPLACE FUNCTION public.admin_bulk_moderate(
  p_action TEXT,
  p_items  jsonb,
  p_note   TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item    jsonb;
  _results jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items must be a json array';
  END IF;
  IF jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'too many items in one batch (max 200)';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    BEGIN
      PERFORM public._admin_moderate_one(
        p_action,
        (_item->>'id')::uuid,
        _item->>'content_type',
        p_note
      );
      _results := _results || jsonb_build_object('id', _item->>'id', 'ok', TRUE, 'error', NULL);
    EXCEPTION WHEN OTHERS THEN
      _results := _results || jsonb_build_object('id', _item->>'id', 'ok', FALSE, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN _results;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bulk_moderate(TEXT, jsonb, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_bulk_moderate(TEXT, jsonb, TEXT) TO authenticated;

-- ─── 4. Hero recommendations (AdminAIHero) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_hero_recommendations()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(hr) || jsonb_build_object(
    'products', (
      SELECT to_jsonb(p) || jsonb_build_object(
        'profiles', (SELECT to_jsonb(pr) FROM profiles pr WHERE pr.id = p.seller_id)
      )
      FROM products p WHERE p.id = hr.product_id
    )
  ) ORDER BY hr.created_at DESC), '[]'::jsonb) INTO _out
  FROM hero_recommendations hr;
  RETURN _out;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_hero_recommendation(
  p_id          UUID,
  p_title       TEXT,
  p_description TEXT,
  p_offer_text  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  UPDATE hero_recommendations
  SET title = p_title, description = p_description, offer_text = p_offer_text
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'recommendation not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_hero_recommendation_status(
  p_id     UUID,
  p_status TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec RECORD;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  IF p_status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'invalid status: %', p_status;
  END IF;

  UPDATE hero_recommendations
  SET status      = p_status,
      approved_at = CASE WHEN p_status = 'approved' THEN NOW() ELSE approved_at END
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'recommendation not found'; END IF;

  -- Notify the seller when their product goes live (was a raw insert client-side).
  IF p_status = 'approved' THEN
    SELECT p.seller_id, p.name INTO _rec
    FROM hero_recommendations hr JOIN products p ON p.id = hr.product_id
    WHERE hr.id = p_id;
    IF FOUND AND _rec.seller_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (
        _rec.seller_id, 'system', 'Product Featured!',
        'Congratulations! Your product "' || _rec.name || '" has been selected to be featured on the homepage hero section.'
      );
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_hero_recommendation(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  DELETE FROM hero_recommendations WHERE id = p_id;
END;
$$;

-- Clears everything that is not the live (approved) recommendation.
CREATE OR REPLACE FUNCTION public.admin_clear_hero_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  DELETE FROM hero_recommendations WHERE status <> 'approved';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_hero_recommendation(
  p_product_id    UUID,
  p_title         TEXT,
  p_description   TEXT,
  p_price_display TEXT,
  p_offer_text    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'product not found';
  END IF;
  INSERT INTO hero_recommendations (product_id, title, description, price_display, offer_text, status)
  VALUES (p_product_id, p_title, p_description, p_price_display, p_offer_text, 'pending')
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_product_boost(
  p_product_id UUID,
  p_boosted    BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  UPDATE products SET is_boosted = p_boosted, updated_at = NOW() WHERE id = p_product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product not found'; END IF;
END;
$$;

-- Products list for the "Top Products" tab (includes full seller profile,
-- matching the old `products.select('*, profiles!seller_id(*))` join).
CREATE OR REPLACE FUNCTION public.admin_list_hero_products()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(p) || jsonb_build_object(
    'profiles', (SELECT to_jsonb(pr) FROM profiles pr WHERE pr.id = p.seller_id)
  ) ORDER BY p.created_at DESC), '[]'::jsonb) INTO _out
  FROM products p
  WHERE p.deleted_at IS NULL;
  RETURN _out;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_hero_recommendations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_hero_recommendation(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_hero_recommendation_status(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_hero_recommendation(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_hero_recommendations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_hero_recommendation(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_product_boost(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_hero_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_hero_recommendations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_hero_recommendation(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_hero_recommendation_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_hero_recommendation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_hero_recommendations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_hero_recommendation(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_product_boost(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_hero_products() TO authenticated;

-- ─── 5. Hero manual settings (platform_settings id=1) ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_hero_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  SELECT jsonb_build_object(
    'hero_badge_text',  hero_badge_text,
    'hero_headline',    hero_headline,
    'hero_subheadline', hero_subheadline
  ) INTO _out
  FROM platform_settings WHERE id = 1;
  RETURN COALESCE(_out, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_hero_settings(
  p_badge_text  TEXT,
  p_headline    TEXT,
  p_subheadline TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  UPDATE platform_settings
  SET hero_badge_text  = p_badge_text,
      hero_headline    = p_headline,
      hero_subheadline = p_subheadline
  WHERE id = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_hero_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_hero_settings(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_hero_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_hero_settings(TEXT, TEXT, TEXT) TO authenticated;

-- ─── 6. AdminMessages lookups ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_user_profile(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  SELECT to_jsonb(pr) INTO _out FROM profiles pr WHERE pr.id = p_user_id;
  RETURN _out; -- null when not found
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_order(p_order_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _out jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  SELECT to_jsonb(o) INTO _out FROM orders o WHERE o.id = p_order_id;
  RETURN _out; -- null when not found
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_profile(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_order(UUID) TO authenticated;

-- Self-scoped: mark everything the peer sent ME as read. Any authenticated
-- user may call this for their own inbox (no cross-user write possible).
CREATE OR REPLACE FUNCTION public.mark_thread_read(p_peer UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE messages
  SET read = TRUE
  WHERE receiver_id = auth.uid() AND sender_id = p_peer AND read = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_thread_read(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_thread_read(UUID) TO authenticated;

-- ─── 7. Atomic dispute resolution (AdminPage.handleResolveDispute) ──────────
-- Replaces two sequential client-side updates (disputes then orders) that
-- could half-apply. One transaction, admin-only, status-validated.
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_notes      TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _dispute      RECORD;
  _order_status TEXT;
  _new_status   TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden: admin only'; END IF;
  IF p_resolution NOT IN ('refund_buyer', 'release_funds') THEN
    RAISE EXCEPTION 'invalid resolution: %', p_resolution;
  END IF;

  SELECT * INTO _dispute FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dispute not found'; END IF;
  IF _dispute.status IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'dispute already resolved';
  END IF;

  IF _dispute.order_id IS NULL THEN
    RAISE EXCEPTION 'dispute has no linked order';
  END IF;

  SELECT status::text INTO _order_status FROM orders WHERE id = _dispute.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'linked order not found'; END IF;

  _new_status := CASE WHEN p_resolution = 'refund_buyer' THEN 'refunded' ELSE 'delivered' END;
  IF _order_status = 'cancelled' AND _new_status = 'delivered' THEN
    RAISE EXCEPTION 'cannot release funds on a cancelled order';
  END IF;

  UPDATE disputes
  SET status           = 'resolved',
      resolution_notes = COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), p_resolution),
      updated_at       = NOW()
  WHERE id = p_dispute_id;

  UPDATE orders
  SET status     = _new_status::order_status,
      updated_at = NOW()
  WHERE id = _dispute.order_id
    AND status::text IS DISTINCT FROM _new_status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT) TO authenticated;
