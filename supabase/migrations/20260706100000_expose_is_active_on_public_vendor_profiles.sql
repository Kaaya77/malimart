-- Explore → Stores lost its is_active filter when it moved from the
-- owner-only vendor_profiles table to the public_vendor_profiles view,
-- because the view does not expose is_active. Append it (a non-sensitive
-- storefront flag) so listings can hide deactivated/rejected stores again.
-- CREATE OR REPLACE VIEW may only append columns, so is_active goes last;
-- the column list matches the deployed view exactly.
-- security_invoker must stay FALSE (definer rights): the base table's only
-- SELECT policy is owner/admin, so an invoker-rights view would return zero
-- rows to anon/buyers and blank the public storefront. The view is the
-- deliberate safe projection — it exposes no payment/contact columns.

CREATE OR REPLACE VIEW public.public_vendor_profiles
  WITH (security_invoker = false)
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
