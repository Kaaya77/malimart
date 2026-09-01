-- 20260901120100_companion_seed_spots.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Seed rows for curated_spots — SHAPE, NOT TRUTH.
--
-- ⚠ Every row here is inserted with is_active = FALSE on purpose.
--
-- These exist so the browse/filter UI has realistic data to render against and
-- so a curator can see the editorial voice the `why` column is asking for.
-- The venue details (prices, areas, whether the place is even still open) are
-- NOT verified and must not be shown to a real user as-is.
--
-- The curator's job before launch: open /admin/curation, correct each row
-- against first-hand knowledge, then flip it active. A short verified list
-- beats a long unverified one — an app that sends someone to a closed
-- restaurant on a first date has failed at the only thing it promised.
--
-- Idempotent: re-running does nothing once a spot with the same title exists.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.curated_spots
  (title, category, city, area, why, price_min, price_max, tags, sort_weight, is_active)
SELECT * FROM (VALUES
  (
    'Coco Beach (Oyster Bay)',
    'sunset',
    'Dar es Salaam',
    'Oyster Bay',
    'PLACEHOLDER COPY — verify before activating. The default sunset walk. Free, public, and busiest on Sunday evenings. Good for a low-pressure first date because you can leave whenever it stops going well. Buy the grilled maize from the stalls.',
    0, 20000,
    ARRAY['cheap', 'outdoors', 'first-date', 'sunset'],
    100, FALSE
  ),
  (
    'The Slipway',
    'restaurant',
    'Dar es Salaam',
    'Msasani Peninsula',
    'PLACEHOLDER COPY — verify before activating. Waterfront, several restaurants in one place, so it survives indecision. Go before sunset for a table facing the water. Safe choice when you do not yet know what they eat.',
    40000, 120000,
    ARRAY['waterfront', 'safe-choice', 'dinner'],
    90, FALSE
  ),
  (
    'Mlimani City Cinema',
    'movie',
    'Dar es Salaam',
    'Ubungo',
    'PLACEHOLDER COPY — verify before activating. The reliable cinema-and-food-court evening. Weak on conversation, strong on nerves — a good pick when neither of you is ready to talk for three hours straight.',
    25000, 60000,
    ARRAY['indoors', 'first-date', 'low-pressure'],
    70, FALSE
  ),
  (
    'Kigamboni Ferry + beach afternoon',
    'activity',
    'Dar es Salaam',
    'Kigamboni',
    'PLACEHOLDER COPY — verify before activating. The ferry crossing itself is the date — it costs almost nothing and gives you fifteen minutes of something to react to together. Go early afternoon and come back before dark.',
    5000, 30000,
    ARRAY['cheap', 'outdoors', 'memorable'],
    85, FALSE
  ),
  (
    'Botanical Gardens morning walk',
    'breakfast',
    'Dar es Salaam',
    'City Centre',
    'PLACEHOLDER COPY — verify before activating. A morning option for when evenings are complicated. Quiet, shaded, and cheap enough that it does not read as a big gesture — which is sometimes the point.',
    0, 15000,
    ARRAY['cheap', 'morning', 'quiet'],
    60, FALSE
  ),
  (
    'Flowers — Kariakoo stalls',
    'gift',
    'Dar es Salaam',
    'Kariakoo',
    'PLACEHOLDER COPY — verify before activating. Cheapest real flowers in the city if you are willing to haggle and go early. Check the partner profile for allergies before buying anything with a strong scent.',
    5000, 40000,
    ARRAY['gift', 'cheap', 'flowers'],
    80, FALSE
  ),
  (
    'Cake — order a day ahead',
    'gift',
    'Dar es Salaam',
    NULL,
    'PLACEHOLDER COPY — verify before activating. Almost every bakery in Dar needs 24 hours for anything written on it. This is the single most common way a birthday plan fails — order the day before, not the morning of.',
    20000, 80000,
    ARRAY['gift', 'birthday', 'plan-ahead'],
    95, FALSE
  ),
  (
    'Live band night',
    'nightlife',
    'Dar es Salaam',
    NULL,
    'PLACEHOLDER COPY — verify before activating, and set the actual venue and night. Live music removes the pressure to fill silence, which makes it a good third or fourth date rather than a first.',
    20000, 80000,
    ARRAY['music', 'evening', 'weekend'],
    75, FALSE
  )
) AS seed(title, category, city, area, why, price_min, price_max, tags, sort_weight, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.curated_spots cs WHERE cs.title = seed.title
);
