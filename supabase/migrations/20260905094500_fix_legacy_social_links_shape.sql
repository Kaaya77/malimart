-- vendor_profiles.social_links held two incompatible shapes: a legacy
-- object {instagram, facebook, whatsapp, twitter} from an older onboarding
-- flow, and the array-of-{platform,url} shape the current Settings UI and
-- StorePage both read/write. For any seller still on the legacy shape,
-- Settings' handleAddSocial did `[...socialLinks, newSocial]` — spreading
-- a plain object into an array literal throws synchronously, so "Add Link"
-- silently did nothing — and StorePage's `social_links.filter(...)` would
-- have thrown the same way, so the section never rendered either. One
-- root cause behind both symptoms. Converts every legacy object row to
-- the array shape, dropping blank entries; array-shaped rows are untouched.
update vendor_profiles
set social_links = (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'platform', case key
        when 'whatsapp' then 'WhatsApp'
        when 'instagram' then 'Instagram'
        when 'facebook' then 'Facebook'
        when 'twitter' then 'X (Twitter)'
        when 'tiktok' then 'TikTok'
        else initcap(key)
      end,
      'url', value
    )
  ), '[]'::jsonb)
  from jsonb_each_text(social_links)
  where value is not null and value <> ''
)
where jsonb_typeof(social_links) = 'object';
