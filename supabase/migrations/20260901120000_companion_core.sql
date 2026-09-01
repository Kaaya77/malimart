-- 20260901120000_companion_core.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- COMPANION CORE — the date/relationship concierge domain.
--
-- Single-player by design: one user plans, their partner never needs an
-- account. Everything here is private to the owning user EXCEPT
-- `curated_spots`, which is admin-authored editorial content readable by all.
--
-- Deliberately NOT built here (see the notes on each):
--   • no partner account linking       — v1 is single-player only
--   • no generated/stored nudge rows   — nudges are DERIVED client-side from
--     occasions/promises/date_log, so there is no cron or generator to run.
--     Only the user's dismissals are persisted (`nudge_dismissals`).
--
-- Every table is RLS-enabled with owner-scoped policies. `partner_notes`,
-- `occasions`, `promises` and `date_log` hang off `partners`, so their
-- policies check ownership through it rather than trusting a client-supplied
-- user_id.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── partners ──────────────────────────────────────────────────────────────
-- The person you're planning for. `user_id` owns the row. A user may have
-- exactly one active partner at a time (partial unique index below) but old
-- rows are kept rather than deleted, so a breakup archives instead of erasing.
CREATE TABLE IF NOT EXISTS public.partners (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  pronouns        TEXT,
  avatar_url      TEXT,
  birthday        DATE,
  anniversary     DATE,
  -- Free-text preference memory. Small, deliberately unstructured: the value
  -- is in capturing what was actually said, not in a rigid schema.
  loves           TEXT,
  avoids          TEXT,
  allergies       TEXT,
  sizes           TEXT,
  love_language   TEXT,
  -- Daily ritual toggles + how often a real date should happen. These drive
  -- the derived nudges; all default OFF so the app never nags uninvited.
  ritual_morning  BOOLEAN NOT NULL DEFAULT FALSE,
  ritual_evening  BOOLEAN NOT NULL DEFAULT FALSE,
  date_cadence_days INTEGER NOT NULL DEFAULT 14,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_display_name_len;
ALTER TABLE public.partners ADD CONSTRAINT partners_display_name_len
  CHECK (length(display_name) BETWEEN 1 AND 60);

ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_cadence_range;
ALTER TABLE public.partners ADD CONSTRAINT partners_cadence_range
  CHECK (date_cadence_days BETWEEN 1 AND 365);

-- One ACTIVE partner per user; archived rows are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS partners_one_active_per_user
  ON public.partners (user_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS partners_user_idx ON public.partners (user_id);

-- ── partner_notes ─────────────────────────────────────────────────────────
-- One-tap capture: "they mentioned X". The compounding memory layer.
CREATE TABLE IF NOT EXISTS public.partner_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  -- 'wish' notes are gift candidates and surface in gift nudges; 'fact' is
  -- background memory; 'moment' is something worth remembering happened.
  kind        TEXT NOT NULL DEFAULT 'fact',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.partner_notes DROP CONSTRAINT IF EXISTS partner_notes_kind_check;
ALTER TABLE public.partner_notes ADD CONSTRAINT partner_notes_kind_check
  CHECK (kind IN ('fact', 'wish', 'moment'));

ALTER TABLE public.partner_notes DROP CONSTRAINT IF EXISTS partner_notes_body_len;
ALTER TABLE public.partner_notes ADD CONSTRAINT partner_notes_body_len
  CHECK (length(body) BETWEEN 1 AND 500);

CREATE INDEX IF NOT EXISTS partner_notes_partner_idx
  ON public.partner_notes (partner_id, created_at DESC);

-- ── occasions ─────────────────────────────────────────────────────────────
-- Dated things worth remembering. `is_annual` covers birthdays/anniversaries;
-- one-off entries cover "their job interview on Thursday" — which is the
-- higher-value case and the one no other app handles.
CREATE TABLE IF NOT EXISTS public.occasions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  occasion_date DATE NOT NULL,
  is_annual     BOOLEAN NOT NULL DEFAULT FALSE,
  -- How many days ahead to start nudging. Big occasions need more runway.
  lead_days     INTEGER NOT NULL DEFAULT 7,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.occasions DROP CONSTRAINT IF EXISTS occasions_title_len;
ALTER TABLE public.occasions ADD CONSTRAINT occasions_title_len
  CHECK (length(title) BETWEEN 1 AND 80);

ALTER TABLE public.occasions DROP CONSTRAINT IF EXISTS occasions_lead_range;
ALTER TABLE public.occasions ADD CONSTRAINT occasions_lead_range
  CHECK (lead_days BETWEEN 0 AND 90);

CREATE INDEX IF NOT EXISTS occasions_partner_idx
  ON public.occasions (partner_id, occasion_date);

-- ── promises ──────────────────────────────────────────────────────────────
-- "I said I'd do this and I haven't." Undated by design — a promise with a
-- deadline is just an occasion; the point here is the open, nagging kind.
CREATE TABLE IF NOT EXISTS public.promises (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.promises DROP CONSTRAINT IF EXISTS promises_body_len;
ALTER TABLE public.promises ADD CONSTRAINT promises_body_len
  CHECK (length(body) BETWEEN 1 AND 300);

CREATE INDEX IF NOT EXISTS promises_open_idx
  ON public.promises (partner_id) WHERE completed_at IS NULL;

-- ── date_log ──────────────────────────────────────────────────────────────
-- What you actually did. Feeds drift detection ("it's been 5 weeks") and the
-- post-date loop that turns a good night into remembered preference.
CREATE TABLE IF NOT EXISTS public.date_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- FK added at the bottom of this file: curated_spots is declared after this
  -- table, so the reference cannot be inline here.
  spot_id      UUID,
  title        TEXT NOT NULL,
  happened_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Post-date sentiment, 1–5. Null = logged but never rated.
  rating       SMALLINT,
  reflection   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.date_log DROP CONSTRAINT IF EXISTS date_log_rating_range;
ALTER TABLE public.date_log ADD CONSTRAINT date_log_rating_range
  CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS date_log_partner_idx
  ON public.date_log (partner_id, happened_on DESC);

-- ── nudge_dismissals ──────────────────────────────────────────────────────
-- Nudges are derived, not stored — so the only server state needed is which
-- ones the user has already dealt with. `nudge_key` is a deterministic string
-- built client-side (e.g. 'occasion:<uuid>:2026-09-14'), so the same nudge
-- stays dismissed across devices without ever generating rows.
CREATE TABLE IF NOT EXISTS public.nudge_dismissals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nudge_key    TEXT NOT NULL,
  -- 'done' = acted on it, 'skip' = not this time. Both hide the nudge; the
  -- split exists so the app can learn without ever showing a guilt metric.
  outcome      TEXT NOT NULL DEFAULT 'done',
  -- Dismissals expire: a snoozed daily ritual should return tomorrow.
  suppress_until DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.nudge_dismissals DROP CONSTRAINT IF EXISTS nudge_dismissals_outcome_check;
ALTER TABLE public.nudge_dismissals ADD CONSTRAINT nudge_dismissals_outcome_check
  CHECK (outcome IN ('done', 'skip'));

CREATE UNIQUE INDEX IF NOT EXISTS nudge_dismissals_unique
  ON public.nudge_dismissals (user_id, nudge_key);

-- ── curated_spots ─────────────────────────────────────────────────────────
-- The editorial layer, and the actual moat. Admin-authored, publicly
-- readable. `why` is the whole point — a place without an opinion attached is
-- just a Google result, so it is NOT NULL.
CREATE TABLE IF NOT EXISTS public.curated_spots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  category     TEXT NOT NULL,
  city         TEXT NOT NULL DEFAULT 'Dar es Salaam',
  area         TEXT,
  why          TEXT NOT NULL,
  -- Budget band for two people, in TZS. Powers budget-first browsing, which
  -- matters more here than category browsing.
  price_min    INTEGER,
  price_max    INTEGER,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  image_url    TEXT,
  maps_url     TEXT,
  phone        TEXT,
  -- Higher sorts first. Lets the curator hand-rank without timestamps.
  sort_weight  INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.curated_spots DROP CONSTRAINT IF EXISTS curated_spots_category_check;
ALTER TABLE public.curated_spots ADD CONSTRAINT curated_spots_category_check
  CHECK (category IN (
    'restaurant', 'breakfast', 'sunset', 'nightlife', 'beach',
    'activity', 'gift', 'movie', 'event'
  ));

ALTER TABLE public.curated_spots DROP CONSTRAINT IF EXISTS curated_spots_why_len;
ALTER TABLE public.curated_spots ADD CONSTRAINT curated_spots_why_len
  CHECK (length(why) BETWEEN 10 AND 600);

ALTER TABLE public.curated_spots DROP CONSTRAINT IF EXISTS curated_spots_price_order;
ALTER TABLE public.curated_spots ADD CONSTRAINT curated_spots_price_order
  CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max);

-- Rendered straight into <a href> — block javascript:/data: URIs, same rule
-- the storefront CTA uses.
ALTER TABLE public.curated_spots DROP CONSTRAINT IF EXISTS curated_spots_maps_url_check;
ALTER TABLE public.curated_spots ADD CONSTRAINT curated_spots_maps_url_check
  CHECK (maps_url IS NULL OR maps_url ~ '^https?://');

CREATE INDEX IF NOT EXISTS curated_spots_browse_idx
  ON public.curated_spots (city, category, sort_weight DESC) WHERE is_active;

-- date_log.spot_id references curated_spots, which is declared after it above;
-- add the FK now that both exist.
ALTER TABLE public.date_log DROP CONSTRAINT IF EXISTS date_log_spot_id_fkey;
ALTER TABLE public.date_log ADD CONSTRAINT date_log_spot_id_fkey
  FOREIGN KEY (spot_id) REFERENCES public.curated_spots(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Owner-scoped everywhere. Child tables verify ownership through partners so
-- a forged user_id in the payload cannot widen access.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.partners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occasions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promises         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curated_spots    ENABLE ROW LEVEL SECURITY;

-- partners: owner full control. Admins deliberately get NO read access —
-- this is intimate personal data and moderation has no business in it.
DROP POLICY IF EXISTS partners_owner_all ON public.partners;
CREATE POLICY partners_owner_all ON public.partners
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Reusable ownership predicate for the child tables.
CREATE OR REPLACE FUNCTION public.owns_partner(p_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partners
    WHERE id = p_partner_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_partner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_partner(UUID) TO authenticated;

DROP POLICY IF EXISTS partner_notes_owner_all ON public.partner_notes;
CREATE POLICY partner_notes_owner_all ON public.partner_notes
  FOR ALL USING (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id));

DROP POLICY IF EXISTS occasions_owner_all ON public.occasions;
CREATE POLICY occasions_owner_all ON public.occasions
  FOR ALL USING (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id));

DROP POLICY IF EXISTS promises_owner_all ON public.promises;
CREATE POLICY promises_owner_all ON public.promises
  FOR ALL USING (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id));

DROP POLICY IF EXISTS date_log_owner_all ON public.date_log;
CREATE POLICY date_log_owner_all ON public.date_log
  FOR ALL USING (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.owns_partner(partner_id));

DROP POLICY IF EXISTS nudge_dismissals_owner_all ON public.nudge_dismissals;
CREATE POLICY nudge_dismissals_owner_all ON public.nudge_dismissals
  FOR ALL USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- curated_spots: everyone (including signed-out) reads the active list; only
-- admins write. This is published editorial content and contains no PII.
DROP POLICY IF EXISTS curated_spots_public_read ON public.curated_spots;
CREATE POLICY curated_spots_public_read ON public.curated_spots
  FOR SELECT USING (is_active);

DROP POLICY IF EXISTS curated_spots_admin_read_all ON public.curated_spots;
CREATE POLICY curated_spots_admin_read_all ON public.curated_spots
  FOR SELECT USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS curated_spots_admin_write ON public.curated_spots;
CREATE POLICY curated_spots_admin_write ON public.curated_spots
  FOR INSERT WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS curated_spots_admin_update ON public.curated_spots;
CREATE POLICY curated_spots_admin_update ON public.curated_spots
  FOR UPDATE USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS curated_spots_admin_delete ON public.curated_spots;
CREATE POLICY curated_spots_admin_delete ON public.curated_spots
  FOR DELETE USING ((SELECT public.is_admin()));

-- ── updated_at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partners_touch ON public.partners;
CREATE TRIGGER partners_touch BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS curated_spots_touch ON public.curated_spots;
CREATE TRIGGER curated_spots_touch BEFORE UPDATE ON public.curated_spots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
