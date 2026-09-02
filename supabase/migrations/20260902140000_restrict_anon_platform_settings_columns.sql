-- Stop leaking business config to anonymous callers.
--
-- `platform_settings` has an RLS policy `platform_settings_public_read` with
-- USING (true) for {anon, authenticated}. RLS is ROW-level, so it cannot
-- restrict columns — anon was reading the whole singleton row, including:
--     global_commission          (our take rate)
--     auto_approve_vendors       (internal onboarding policy)
--     require_vendor_verification
--     max_products_per_vendor
--     audit_retention_days
--     maintenance_mode / new_signups
--
-- The only anonymous consumer is the homepage hero
-- (hooks/useHomePageData.ts), which selects exactly three columns. So the
-- correct tool is a COLUMN-level grant, which RLS cannot express.
--
-- `id` is included because the homepage filters `.eq('id', 1)`, and Postgres
-- requires SELECT on any column referenced in a WHERE clause.
--
-- NOTE: with column-level grants, `select=*` as anon now returns 403 rather
-- than a trimmed row. That is intended — it fails loudly instead of silently
-- widening again. Anonymous readers must name their columns.
revoke select on public.platform_settings from anon;

grant select (
  id,
  hero_badge_text,
  hero_headline,
  hero_subheadline
) on public.platform_settings to anon;

-- KNOWN GAP (deliberately not fixed here): `authenticated` still reads the
-- full row, because services/adminApi.ts does `select('*')` for the admin
-- settings page and column grants are per-role, so tightening it would break
-- admin. Closing that properly means routing admin settings through a
-- SECURITY DEFINER RPC gated on is_admin(), which is an app change, not a
-- grant change. Until then any logged-in user can read global_commission.
