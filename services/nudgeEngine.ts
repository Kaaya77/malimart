// =====================================================================
// nudgeEngine.ts — derives the day's nudges from stored state.
//
// Pure functions, no I/O. Nudges are never persisted: they are recomputed
// from occasions/promises/date_log every time the page loads, so there is
// no generator job, no cron, and no drift between what's stored and what's
// shown. The only server state is which nudges the user already dealt with
// (`nudge_dismissals`), keyed by the deterministic keys built here.
//
// ── The rules this file exists to enforce ────────────────────────────────
//  1. Never scold. Copy states an opportunity, never a failure. There is no
//     "you haven't texted in 3 days" anywhere in here, by design.
//  2. No streaks, no scores. Nothing accumulates that can be broken or
//     graded — `weight` is sort order only and is never shown.
//  3. Always something cheap. Every derivation path can produce a 'tiny'
//     effort nudge so the app never implies that love requires money.
//  4. Remind, don't send. Nudges link the user to an action they perform
//     themselves; nothing here dispatches a message on their behalf.
// =====================================================================
import type {
  Partner, Occasion, Promise_, DateLogEntry, Nudge, NudgeEffort,
} from '../types';
import type { NudgeDismissal } from './companionApi';

const DAY_MS = 86_400_000;

/** Local-date ISO stamp (YYYY-MM-DD). Avoids the UTC shift toISOString() causes. */
export function isoDay(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / DAY_MS);
}

/** Monday-anchored week stamp — used to resurface slow nudges weekly, not daily. */
function weekStamp(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return isoDay(d);
}

/**
 * Next occurrence of an occasion on or after today.
 * Annual entries roll to next year once this year's date has passed.
 * Feb 29 on a non-leap year lands on Mar 1, which is the forgiving choice.
 */
export function nextOccurrence(occasion: Occasion, now: Date): Date {
  const base = parseDay(occasion.occasion_date);
  if (!occasion.is_annual) return base;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYear = new Date(now.getFullYear(), base.getMonth(), base.getDate());
  return thisYear >= today
    ? thisYear
    : new Date(now.getFullYear() + 1, base.getMonth(), base.getDate());
}

function humanCountdown(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** Bigger occasions deserve a bigger suggested gesture — but never a required one. */
function effortForLead(days: number): NudgeEffort {
  if (days <= 1) return 'tiny';
  if (days <= 3) return 'small';
  if (days <= 10) return 'evening';
  return 'big';
}

export interface DeriveInput {
  partner: Partner;
  occasions: Occasion[];
  promises: Promise_[];
  dates: DateLogEntry[];
  dismissals: NudgeDismissal[];
  now?: Date;
}

/**
 * Returns the nudges worth showing right now, highest priority first.
 * Already-actioned nudges are filtered out via their deterministic keys.
 */
export function deriveNudges(input: DeriveInput): Nudge[] {
  const now = input.now ?? new Date();
  const today = isoDay(now);
  const week = weekStamp(now);
  const out: Nudge[] = [];

  // ── Daily rituals ───────────────────────────────────────────────────────
  // Opt-in only (both flags default false). Morning window is generous so a
  // late riser isn't told they missed it — there is no "missed" state here.
  const hour = now.getHours();
  if (input.partner.ritual_morning && hour < 12) {
    out.push({
      key: `ritual:morning:${today}`,
      kind: 'ritual',
      effort: 'tiny',
      title: `Say good morning to ${input.partner.display_name}`,
      body: 'Thirty seconds. Your words, not ours — write it badly and send it anyway.',
      weight: 40,
    });
  }
  if (input.partner.ritual_evening && hour >= 19) {
    out.push({
      key: `ritual:evening:${today}`,
      kind: 'ritual',
      effort: 'tiny',
      title: `Ask ${input.partner.display_name} how today went`,
      body: 'One message. Ask about the specific thing they were dreading.',
      weight: 38,
    });
  }

  // ── Occasions ───────────────────────────────────────────────────────────
  for (const occ of input.occasions) {
    const when = nextOccurrence(occ, now);
    const days = daysBetween(now, when);
    if (days < 0 || days > occ.lead_days) continue;

    // Key includes the occurrence date so an annual occasion returns next year
    // rather than staying dismissed forever.
    out.push({
      key: `occasion:${occ.id}:${isoDay(when)}`,
      kind: 'occasion',
      effort: effortForLead(days),
      title: `${occ.title} ${humanCountdown(days)}`,
      body: days === 0
        ? "It's today. Even something small, done now, counts."
        : `You've got ${days} day${days === 1 ? '' : 's'}. Enough time to do it properly rather than in a panic.`,
      weight: 100 - days, // sooner sorts higher
      href: '/discover?category=gift',
    });
  }

  // ── Open promises ───────────────────────────────────────────────────────
  // Resurfaced weekly, never daily. A promise tracker that nags every morning
  // becomes the guilt machine this product exists to avoid.
  for (const p of input.promises) {
    if (p.completed_at) continue;
    const age = daysBetween(parseDay(p.created_at.slice(0, 10)), now);
    if (age < 3) continue; // grace period — not everything is late
    out.push({
      key: `promise:${p.id}:${week}`,
      kind: 'promise',
      effort: 'small',
      title: 'You mentioned you\'d do this',
      body: p.body,
      weight: 55,
      promiseId: p.id,
    });
  }

  // ── Drift ───────────────────────────────────────────────────────────────
  // One soft signal per week, and only once the user's own chosen cadence has
  // passed. Never phrased as a shortfall.
  const lastDate = input.dates
    .map(d => d.happened_on)
    .sort()
    .pop();
  const sinceLast = lastDate ? daysBetween(parseDay(lastDate), now) : null;
  if (sinceLast === null || sinceLast >= input.partner.date_cadence_days) {
    out.push({
      key: `drift:${input.partner.id}:${week}`,
      kind: 'drift',
      effort: 'evening',
      title: lastDate
        ? `It's been ${sinceLast} days since you two went out`
        : `Plan something with ${input.partner.display_name}`,
      body: 'Not a big production — pick something from Discover and just book it.',
      weight: 50,
      href: '/discover',
    });
  }

  return filterDismissed(out, input.dismissals, today).sort((a, b) => b.weight - a.weight);
}

/**
 * Drops nudges the user already acted on. A dismissal with `suppress_until`
 * in the past is treated as expired, which is how a snooze comes back.
 */
export function filterDismissed(nudges: Nudge[], dismissals: NudgeDismissal[], today: string): Nudge[] {
  const active = new Set(
    dismissals
      .filter(d => !d.suppress_until || d.suppress_until >= today)
      .map(d => d.nudge_key),
  );
  return nudges.filter(n => !active.has(n.key));
}

export const EFFORT_LABELS: Record<NudgeEffort, string> = {
  tiny: '30 seconds',
  small: '5 minutes',
  evening: 'An evening',
  big: 'Plan ahead',
};
