// =====================================================================
// companionApi.ts — every DB call for the companion domain.
//
// Components and pages must NEVER call supabase.from() for these tables;
// they go through this module. RLS is the real boundary (owner-scoped on
// every table), but keeping the queries here means the access pattern is
// auditable in one file.
//
// Note on user_id: the tables carry it and the RLS policies check it, but
// nothing here trusts a caller-supplied value — it is always read from the
// live session.
// =====================================================================
import { supabase } from './supabaseClient';
import type {
  Partner, PartnerNote, PartnerNoteKind, Occasion, Promise_,
  DateLogEntry, CuratedSpot, SpotCategory,
} from '../types';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('You need to be signed in.');
  return data.user.id;
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- Partner ----------

/** The user's one active partner, or null if they haven't set one up yet. */
export async function getActivePartner(): Promise<Partner | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Partner) ?? null;
}

export async function createPartner(input: Partial<Partner> & { display_name: string }): Promise<Partner> {
  const userId = await requireUserId();
  return unwrap(await supabase
    .from('partners')
    .insert({ ...stripReadOnly(input), user_id: userId, is_active: true })
    .select()
    .single());
}

export async function updatePartner(partnerId: string, patch: Partial<Partner>): Promise<Partner> {
  return unwrap(await supabase
    .from('partners')
    .update(stripReadOnly(patch))
    .eq('id', partnerId)
    .select()
    .single());
}

/**
 * Breakups are a first-class flow, not an edge case. Archiving keeps the
 * history intact (and frees the one-active-partner index) without destroying
 * anything; `deletePartnerForever` is the hard delete for people who want out.
 */
export async function archivePartner(partnerId: string): Promise<void> {
  const res = await supabase.from('partners').update({ is_active: false }).eq('id', partnerId);
  if (res.error) throw new Error(res.error.message);
}

/** Hard delete. Children cascade via FK. Irreversible, by design. */
export async function deletePartnerForever(partnerId: string): Promise<void> {
  const res = await supabase.from('partners').delete().eq('id', partnerId);
  if (res.error) throw new Error(res.error.message);
}

// Columns the client must never set directly.
function stripReadOnly<T extends Record<string, any>>(input: T): Partial<T> {
  const { id, user_id, created_at, updated_at, ...rest } = input as any;
  return rest;
}

// ---------- Notes (the memory layer) ----------

export async function listNotes(partnerId: string, includeArchived = false): Promise<PartnerNote[]> {
  let q = supabase
    .from('partner_notes')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (!includeArchived) q = q.eq('is_archived', false);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as PartnerNote[]) ?? [];
}

export async function addNote(partnerId: string, body: string, kind: PartnerNoteKind = 'fact'): Promise<PartnerNote> {
  const userId = await requireUserId();
  return unwrap(await supabase
    .from('partner_notes')
    .insert({ partner_id: partnerId, user_id: userId, body: body.trim(), kind })
    .select()
    .single());
}

export async function archiveNote(noteId: string): Promise<void> {
  const res = await supabase.from('partner_notes').update({ is_archived: true }).eq('id', noteId);
  if (res.error) throw new Error(res.error.message);
}

export async function deleteNote(noteId: string): Promise<void> {
  const res = await supabase.from('partner_notes').delete().eq('id', noteId);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Occasions ----------

export async function listOccasions(partnerId: string): Promise<Occasion[]> {
  const { data, error } = await supabase
    .from('occasions')
    .select('*')
    .eq('partner_id', partnerId)
    .order('occasion_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Occasion[]) ?? [];
}

export async function addOccasion(
  partnerId: string,
  input: { title: string; occasion_date: string; is_annual?: boolean; lead_days?: number; notes?: string },
): Promise<Occasion> {
  const userId = await requireUserId();
  return unwrap(await supabase
    .from('occasions')
    .insert({
      partner_id: partnerId,
      user_id: userId,
      title: input.title.trim(),
      occasion_date: input.occasion_date,
      is_annual: input.is_annual ?? false,
      lead_days: input.lead_days ?? 7,
      notes: input.notes ?? null,
    })
    .select()
    .single());
}

export async function deleteOccasion(occasionId: string): Promise<void> {
  const res = await supabase.from('occasions').delete().eq('id', occasionId);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Promises ----------

export async function listPromises(partnerId: string, openOnly = true): Promise<Promise_[]> {
  let q = supabase
    .from('promises')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (openOnly) q = q.is('completed_at', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as Promise_[]) ?? [];
}

export async function addPromise(partnerId: string, body: string): Promise<Promise_> {
  const userId = await requireUserId();
  return unwrap(await supabase
    .from('promises')
    .insert({ partner_id: partnerId, user_id: userId, body: body.trim() })
    .select()
    .single());
}

export async function completePromise(promiseId: string): Promise<void> {
  const res = await supabase
    .from('promises')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', promiseId);
  if (res.error) throw new Error(res.error.message);
}

export async function deletePromise(promiseId: string): Promise<void> {
  const res = await supabase.from('promises').delete().eq('id', promiseId);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Date log ----------

export async function listDates(partnerId: string, limit = 30): Promise<DateLogEntry[]> {
  const { data, error } = await supabase
    .from('date_log')
    .select('*')
    .eq('partner_id', partnerId)
    .order('happened_on', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as DateLogEntry[]) ?? [];
}

export async function logDate(
  partnerId: string,
  input: { title: string; happened_on?: string; spot_id?: string | null; rating?: number | null; reflection?: string | null },
): Promise<DateLogEntry> {
  const userId = await requireUserId();
  return unwrap(await supabase
    .from('date_log')
    .insert({
      partner_id: partnerId,
      user_id: userId,
      title: input.title.trim(),
      happened_on: input.happened_on ?? new Date().toISOString().slice(0, 10),
      spot_id: input.spot_id ?? null,
      rating: input.rating ?? null,
      reflection: input.reflection ?? null,
    })
    .select()
    .single());
}

export async function rateDate(dateId: string, rating: number, reflection?: string): Promise<void> {
  const res = await supabase
    .from('date_log')
    .update({ rating, reflection: reflection ?? null })
    .eq('id', dateId);
  if (res.error) throw new Error(res.error.message);
}

// ---------- Nudge dismissals ----------

export interface NudgeDismissal {
  nudge_key: string;
  outcome: 'done' | 'skip';
  suppress_until: string | null;
}

export async function listDismissals(): Promise<NudgeDismissal[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('nudge_dismissals')
    .select('nudge_key, outcome, suppress_until')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data as NudgeDismissal[]) ?? [];
}

/**
 * Upsert on (user_id, nudge_key) — acting on the same nudge twice must not
 * fail, and re-acting should refresh the suppression window.
 */
export async function dismissNudge(
  nudgeKey: string,
  outcome: 'done' | 'skip',
  suppressUntil?: string | null,
): Promise<void> {
  const userId = await requireUserId();
  const res = await supabase
    .from('nudge_dismissals')
    .upsert(
      { user_id: userId, nudge_key: nudgeKey, outcome, suppress_until: suppressUntil ?? null },
      { onConflict: 'user_id,nudge_key' },
    );
  if (res.error) throw new Error(res.error.message);
}

// ---------- Curated spots (read) ----------

export interface SpotFilter {
  category?: SpotCategory | null;
  city?: string | null;
  /** Upper bound on price_min — powers "I have 20,000" browsing. */
  maxBudget?: number | null;
}

export async function listSpots(filter: SpotFilter = {}): Promise<CuratedSpot[]> {
  let q = supabase
    .from('curated_spots')
    .select('*')
    .eq('is_active', true)
    .order('sort_weight', { ascending: false })
    .order('title', { ascending: true });

  if (filter.category) q = q.eq('category', filter.category);
  if (filter.city) q = q.eq('city', filter.city);
  // A spot qualifies if its floor price is within budget. Spots with no price
  // recorded are treated as "unknown, show it" rather than silently hidden.
  if (filter.maxBudget != null) q = q.or(`price_min.is.null,price_min.lte.${filter.maxBudget}`);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data as CuratedSpot[]) ?? [];
}

// ---------- Curated spots (admin write) ----------
// RLS enforces admin-only on all four of these; the role check in the UI is
// convenience, not security.

export async function adminListSpots(): Promise<CuratedSpot[]> {
  const { data, error } = await supabase
    .from('curated_spots')
    .select('*')
    .order('is_active', { ascending: false })
    .order('sort_weight', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as CuratedSpot[]) ?? [];
}

export async function adminCreateSpot(input: Partial<CuratedSpot> & { title: string; category: SpotCategory; why: string }): Promise<CuratedSpot> {
  const userId = await requireUserId();
  return unwrap(await supabase
    .from('curated_spots')
    .insert({ ...stripReadOnly(input), created_by: userId })
    .select()
    .single());
}

export async function adminUpdateSpot(spotId: string, patch: Partial<CuratedSpot>): Promise<CuratedSpot> {
  return unwrap(await supabase
    .from('curated_spots')
    .update(stripReadOnly(patch))
    .eq('id', spotId)
    .select()
    .single());
}

export async function adminDeleteSpot(spotId: string): Promise<void> {
  const res = await supabase.from('curated_spots').delete().eq('id', spotId);
  if (res.error) throw new Error(res.error.message);
}
