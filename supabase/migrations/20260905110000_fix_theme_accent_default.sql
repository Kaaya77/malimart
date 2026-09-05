-- profiles.theme_accent defaulted to 'sahara' — a preset key that has not
-- existed in ACCENT_PRESETS (services/theme.ts) for a long time. applyAccent
-- treated any unrecognized key the same as literal Tailwind emerald
-- (clearAccentVars), so every user who signed up and never touched Settings
-- silently rendered green despite rose being the app's intended default.
-- Backfills existing untouched rows and fixes the default for new signups.
update public.profiles set theme_accent = 'rose' where theme_accent = 'sahara';
alter table public.profiles alter column theme_accent set default 'rose';
