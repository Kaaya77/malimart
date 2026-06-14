-- 20260614000000_fix_settings_missing_columns.sql
-- Fixes settings saves failing for ALL user roles.
--
-- Root causes:
--   1. profiles missing push_notifications, reduced_motion, sound_effects
--      → BuyerSettingsPage and AccountSettingsPage saves threw "column does not exist"
--   2. platform_settings missing 5 columns the AdminPage tries to upsert
--      → Every admin "Save Configuration" call failed entirely
--   3. user_sessions table never created
--      → AccountSettingsPage Security tab errored on load
--   4. update_my_settings RPC whitelist didn't cover the new columns
--      → AccountSettingsPage appearance/notifications saves silently dropped fields
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE).

-- ─── 1. profiles: missing notification & appearance columns ─────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_notifications  BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reduced_motion       BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sound_effects        BOOLEAN DEFAULT TRUE;

-- ─── 2. platform_settings: missing admin config columns ────────────────────
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS default_currency            TEXT    DEFAULT 'TZS';
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS audit_retention_days        INTEGER DEFAULT 90;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS require_vendor_verification BOOLEAN DEFAULT FALSE;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS max_products_per_vendor     INTEGER DEFAULT 100;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS enable_loyalty_program      BOOLEAN DEFAULT FALSE;

-- Backfill the single settings row so new columns are non-null
UPDATE public.platform_settings
SET
  default_currency            = COALESCE(default_currency, 'TZS'),
  audit_retention_days        = COALESCE(audit_retention_days, 90),
  require_vendor_verification = COALESCE(require_vendor_verification, FALSE),
  max_products_per_vendor     = COALESCE(max_products_per_vendor, 100),
  enable_loyalty_program      = COALESCE(enable_loyalty_program, FALSE)
WHERE id = 1;

-- ─── 3. user_sessions: create if missing ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_agent     TEXT,
  ip_address     TEXT,
  device_label   TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own sessions"   ON public.user_sessions;
DROP POLICY IF EXISTS "Users update own sessions" ON public.user_sessions;

CREATE POLICY "Users view own sessions"
  ON public.user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.user_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── 4. update_my_settings: replace with expanded whitelist ────────────────
CREATE OR REPLACE FUNCTION public.update_my_settings(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid  uuid := auth.uid();
  _patch jsonb := '{}';
  _allowed text[] := ARRAY[
    -- profile
    'full_name','display_name','phone','region','bio','language','default_currency',
    'pronouns','signature_emoji','cover_image_url','timezone','greeting_style',
    -- appearance
    'theme_mode','theme_accent','dashboard_layout',
    'reduced_motion','high_contrast_mode','sound_effects',
    -- notifications
    'order_notifications','email_notifications','sms_notifications',
    'push_notifications','stock_alerts','newsletter','vacation_mode',
    -- privacy
    'profile_visibility','opt_out_analytics',
    -- misc
    'export_format'
  ];
  _key  text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Build a patch with only whitelisted keys
  FOR _key IN SELECT jsonb_object_keys(p) LOOP
    IF _key = ANY(_allowed) THEN
      _patch := _patch || jsonb_build_object(_key, p->_key);
    END IF;
  END LOOP;

  IF _patch = '{}' THEN
    RETURN '{"ok":true}'::jsonb;
  END IF;

  -- Enum guards (match CHECK constraints on the table)
  IF (_patch ? 'theme_mode')      AND (_patch->>'theme_mode')      NOT IN ('light','dark','system')               THEN _patch := _patch - 'theme_mode';      END IF;
  IF (_patch ? 'theme_accent')    AND (_patch->>'theme_accent')    NOT IN ('sahara','ocean','forest','sunset','royal','mono') THEN _patch := _patch - 'theme_accent';    END IF;
  IF (_patch ? 'dashboard_layout') AND (_patch->>'dashboard_layout') NOT IN ('compact','comfortable','spacious')  THEN _patch := _patch - 'dashboard_layout'; END IF;
  IF (_patch ? 'greeting_style')  AND (_patch->>'greeting_style')  NOT IN ('karibu','habari','hello','mambo')     THEN _patch := _patch - 'greeting_style';  END IF;

  EXECUTE (
    SELECT 'UPDATE public.profiles SET ' ||
           string_agg(quote_ident(k) || ' = ' || quote_literal(_patch->>k), ', ') ||
           ' WHERE id = $1'
    FROM   jsonb_object_keys(_patch) AS k
  ) USING _uid;

  RETURN '{"ok":true}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_settings(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_my_settings(jsonb) TO authenticated;
