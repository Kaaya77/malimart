-- Explore → Stores lost its is_active filter when it moved from the
-- owner-only vendor_profiles table to the public_vendor_profiles view,
-- because the view does not expose is_active. Append it (a non-sensitive
-- storefront flag) so listings can hide deactivated/rejected stores again.
-- CREATE OR REPLACE VIEW may only append columns, so is_active goes last;
-- column list and security_invoker are otherwise identical to the
-- definition in supabase/rls_policies.sql.

CREATE OR REPLACE VIEW public.public_vendor_profiles
  WITH (security_invoker = true)
AS
SELECT
  seller_id, store_name, description, logo_url, banner_url, region, district,
  is_verified, trust_score, total_sales, verification_level, avg_response_minutes,
  delivery_fee, return_policy, shipping_policy, processing_time, warranty,
  auto_reply_message, instagram_url, facebook_url, website_url, custom_domain,
  social_links, opening_hours, currency, language, tags, vacation_mode,
  rating, store_policy, is_active
FROM vendor_profiles;

GRANT SELECT ON public.public_vendor_profiles TO anon, authenticated;
