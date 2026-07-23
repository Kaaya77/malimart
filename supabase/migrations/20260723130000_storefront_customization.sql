-- 20260723130000_storefront_customization.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Sellers can currently upload a logo/banner but have no way to add a
-- headline/CTA over the banner or pick an accent color for their public
-- store page. This adds both, scoped to the seller's OWN storefront page
-- only — the app-wide dashboard/checkout theme stays the single shared
-- theme (see CLAUDE.md design direction).
--
-- accent_color is constrained to a strict 6-digit hex so it can be safely
-- interpolated into an inline CSS custom property without sanitization.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS accent_color    TEXT,
  ADD COLUMN IF NOT EXISTS banner_headline TEXT,
  ADD COLUMN IF NOT EXISTS banner_subtext  TEXT,
  ADD COLUMN IF NOT EXISTS banner_cta_text TEXT,
  ADD COLUMN IF NOT EXISTS banner_cta_url  TEXT;

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_accent_color_check;
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_accent_color_check
  CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_banner_headline_len;
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_banner_headline_len
  CHECK (banner_headline IS NULL OR length(banner_headline) <= 80);

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_banner_subtext_len;
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_banner_subtext_len
  CHECK (banner_subtext IS NULL OR length(banner_subtext) <= 160);

ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_banner_cta_text_len;
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_banner_cta_text_len
  CHECK (banner_cta_text IS NULL OR length(banner_cta_text) <= 30);

-- Only http(s) links — blocks javascript:/data: URIs since this is rendered
-- straight into an <a href>.
ALTER TABLE public.vendor_profiles DROP CONSTRAINT IF EXISTS vendor_profiles_banner_cta_url_check;
ALTER TABLE public.vendor_profiles ADD CONSTRAINT vendor_profiles_banner_cta_url_check
  CHECK (banner_cta_url IS NULL OR banner_cta_url ~ '^https?://');

-- The public storefront reads through this view (RLS on vendor_profiles
-- itself only allows the owner/admin to SELECT). Must add the new columns
-- here too, or buyers will never see what the seller customized.
CREATE OR REPLACE VIEW public.public_vendor_profiles AS
SELECT
  seller_id, store_name, description, logo_url, banner_url, region, district,
  is_verified, trust_score, total_sales, verification_level, avg_response_minutes,
  delivery_fee, return_policy, shipping_policy, processing_time, warranty,
  auto_reply_message, instagram_url, facebook_url, website_url, custom_domain,
  social_links, opening_hours, currency, language, tags, vacation_mode, rating,
  store_policy, is_active,
  accent_color, banner_headline, banner_subtext, banner_cta_text, banner_cta_url
FROM public.vendor_profiles;
