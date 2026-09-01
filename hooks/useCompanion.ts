// =====================================================================
// useCompanion.ts — one hook that owns the companion domain's state.
//
// Loads the active partner and everything hanging off it, then derives the
// day's nudges. Pages read from here rather than fetching for themselves,
// so the nudge list is computed once from one consistent snapshot.
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/companionApi';
import { deriveNudges, isoDay } from '../services/nudgeEngine';
import type { Partner, Occasion, Promise_, DateLogEntry, Nudge } from '../types';

interface CompanionState {
  partner: Partner | null;
  occasions: Occasion[];
  promises: Promise_[];
  dates: DateLogEntry[];
  dismissals: api.NudgeDismissal[];
}

const EMPTY: CompanionState = { partner: null, occasions: [], promises: [], dates: [], dismissals: [] };

export function useCompanion() {
  const [state, setState] = useState<CompanionState>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const partner = await api.getActivePartner();
      if (!partner) {
        setState(EMPTY);
        return;
      }
      // Children only exist once there's a partner, so this second wave is
      // conditional rather than part of the first round trip.
      const [occasions, promises, dates, dismissals] = await Promise.all([
        api.listOccasions(partner.id),
        api.listPromises(partner.id, true),
        api.listDates(partner.id),
        api.listDismissals(),
      ]);
      setState({ partner, occasions, promises, dates, dismissals });
    } catch (e: any) {
      setError(e?.message || 'Could not load your companion data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const nudges: Nudge[] = useMemo(() => {
    if (!state.partner) return [];
    return deriveNudges({
      partner: state.partner,
      occasions: state.occasions,
      promises: state.promises,
      dates: state.dates,
      dismissals: state.dismissals,
    });
  }, [state]);

  /**
   * Acting on a nudge. 'done' and 'skip' both hide it; neither is recorded
   * anywhere the user can see as a success or failure count.
   *
   * Optimistic: the dismissal is applied locally first so the card leaves
   * immediately, then persisted. A failure reloads to resync.
   */
  const actOnNudge = useCallback(async (nudge: Nudge, outcome: 'done' | 'skip') => {
    // Skipping a daily ritual should bring it back tomorrow, not bury it.
    const suppressUntil = nudge.kind === 'ritual' ? isoDay(new Date()) : null;
    setState(prev => ({
      ...prev,
      dismissals: [
        ...prev.dismissals.filter(d => d.nudge_key !== nudge.key),
        { nudge_key: nudge.key, outcome, suppress_until: suppressUntil },
      ],
      // Completing a promise nudge closes the promise itself.
      promises: outcome === 'done' && nudge.promiseId
        ? prev.promises.filter(p => p.id !== nudge.promiseId)
        : prev.promises,
    }));
    try {
      await api.dismissNudge(nudge.key, outcome, suppressUntil);
      if (outcome === 'done' && nudge.promiseId) await api.completePromise(nudge.promiseId);
    } catch {
      await load();
    }
  }, [load]);

  return {
    ...state,
    nudges,
    isLoading,
    error,
    reload: load,
    actOnNudge,
    hasPartner: !!state.partner,
  };
}
