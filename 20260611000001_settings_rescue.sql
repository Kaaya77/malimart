-- SETTINGS RESCUE — run when Supabase is unrestricted (11/06/2026)
--
-- Root cause of "settings not working" across admin/seller/buyer:
-- the settings pages write these columns, but they were never created.
-- A Supabase UPDATE containing even ONE unknown column fails entirely,
-- so profile/preference saves bundling several fields failed for everyone.
-- Idempotent: safe to run even if some columns already exist (DB drift).

-- Identity & personalisation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_emoji TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Theme & layout preferences (enum-constrained to match client sanitizer)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_accent TEXT DEFAULT 'sahara'
  CHECK (theme_accent IN ('sahara','ocean','forest','sunset','royal','mono'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'system'
  CHECK (theme_mode IN ('light','dark','system'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dashboard_layout TEXT DEFAULT 'comfortable'
  CHECK (dashboard_layout IN ('compact','comfortable','spacious'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS greeting_style TEXT DEFAULT 'karibu'
  CHECK (greeting_style IN ('karibu','habari','hello','mambo'));

-- Defensive: preference toggles referenced by settings pages.
-- These appear in SQL files already, but live-DB drift is possible —
-- IF NOT EXISTS makes this harmless either way.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS newsletter BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_auth BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_visibility BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS opt_out_analytics BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_contrast_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS order_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stock_alerts BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'TZS';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS export_format TEXT DEFAULT 'csv';

-- Verification query — run after, should return 0 rows:
-- SELECT col FROM unnest(ARRAY[
--   'display_name','bio','pronouns','signature_emoji','cover_image_url',
--   'theme_accent','theme_mode','dashboard_layout','greeting_style'
-- ]) AS col
-- WHERE col NOT IN (
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='profiles'
-- );
