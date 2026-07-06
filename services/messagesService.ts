/**
 * Messaging profile lookups (BuyerMessages / SellerMessages).
 *
 * The messaging UIs need small reads from `profiles` (RLS-readable public
 * profile fields) to hydrate chat headers, guard report/block actions, and
 * show the profile modal. Components must not call supabase.from directly,
 * so those lookups live here. Message reads/writes themselves go through
 * AppContext (fetchMessages/sendMessage) — not this module.
 */
import { supabase } from './supabaseClient';

/**
 * A user's role, used to guard report/block actions (admins can't be
 * reported or blocked). Returns null when the profile can't be read.
 */
export async function fetchProfileRole(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
  return data?.role ?? null;
}

/**
 * Full profile row for the UserProfileModal (name, avatar, role, region,
 * trust score, verification). Returns null if not found.
 */
export async function fetchProfile(userId: string): Promise<any | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data ?? null;
}

/**
 * Just the display name + avatar for a chat partner the seller has no
 * message history with yet (deep-linked conversations). Null if not found.
 */
export async function fetchProfileNameAvatar(
  userId: string,
): Promise<{ full_name: string | null; avatar_url: string | null } | null> {
  const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single();
  return data ?? null;
}
