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

-- KNOWN GAP at the time of this migration: `authenticated` could still read
-- the full row, because services/adminApi.ts did `select('*')` for the admin
-- settings page and column grants are per-role, so tightening it would have
-- broken admin.
--
-- CLOSED by 20260902150000_platform_settings_admin_rpcs.sql, which moves admin
-- reads/writes behind is_admin()-gated RPCs and shrinks `authenticated` to the
-- same hero-column grant `anon` has.
