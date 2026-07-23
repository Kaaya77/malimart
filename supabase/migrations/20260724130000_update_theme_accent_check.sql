-- The accent-theme presets were renamed (emerald/ocean/violet/rose/amber/teal/
-- indigo/slate). The old CHECK constraint only allowed the previous names, so
-- saving a new accent was rejected — themes silently "didn't work". Widen it to
-- accept the new keys; keep the legacy names so any pre-existing rows validate.
alter table public.profiles drop constraint if exists profiles_theme_accent_check;
alter table public.profiles add constraint profiles_theme_accent_check
  check (
    theme_accent is null or theme_accent = any (array[
      'emerald','ocean','violet','rose','amber','teal','indigo','slate',
      'sahara','forest','sunset','royal','mono'
    ])
  );
