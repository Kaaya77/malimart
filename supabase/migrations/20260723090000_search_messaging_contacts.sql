-- 20260723090000_search_messaging_contacts.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Lets any authenticated user search for someone to start a NEW conversation
-- with (seller-to-seller, buyer-to-seller, etc). Messaging has always allowed
-- this at the RLS level (messages_insert only checks sender_id = auth.uid(),
-- no receiver-role restriction) — but there was no way to discover a contact
-- to message in the first place unless they messaged you first: profiles has
-- only profiles_select_own / profiles_select_admin, so any direct client-side
-- lookup of another user's profile (by name search or otherwise) is silently
-- blocked by RLS and returns nothing.
--
-- This RPC returns only the minimal public-safe fields needed to start a
-- chat (id, name, avatar, role) — never wallet/contact/address/verification
-- fields — and excludes banned/deleted accounts and the caller themself.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.search_messaging_contacts(p_query text, p_role text DEFAULT NULL)
RETURNS TABLE (id uuid, full_name text, avatar_url text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.role::text
  FROM profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id <> auth.uid()
    AND COALESCE(p.is_banned, false) = false
    AND p.deleted_at IS NULL
    AND (p_role IS NULL OR p.role::text = p_role)
    AND p.full_name ILIKE '%' || NULLIF(btrim(COALESCE(p_query, '')), '') || '%'
    AND NULLIF(btrim(COALESCE(p_query, '')), '') IS NOT NULL
  ORDER BY p.full_name
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.search_messaging_contacts(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_messaging_contacts(text, text) TO authenticated;
