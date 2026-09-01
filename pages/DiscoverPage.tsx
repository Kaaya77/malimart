import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  UtensilsCrossed, Coffee, Sunset, Music, Waves, Ticket,
  Gift, Film, PartyPopper, MapPin, Phone, Wallet,
} from 'lucide-react';
import { Card, Badge, EmptyState, Skeleton, BackendError, Button } from '../components/UI';
import { formatTZS } from '../constants';
import * as api from '../services/companionApi';
import type { CuratedSpot, SpotCategory } from '../types';

// The whole product promise is "tap, don't type" — so this is the primary
// navigation, and there is deliberately no search box on this page.
const CATEGORIES: { id: SpotCategory; label: string; icon: any }[] = [
  { id: 'restaurant', label: 'Dinner',    icon: UtensilsCrossed },
  { id: 'breakfast',  label: 'Breakfast', icon: Coffee },
  { id: 'sunset',     label: 'Sunset',    icon: Sunset },
  { id: 'nightlife',  label: 'Night out', icon: Music },
  { id: 'beach',      label: 'Beach',     icon: Waves },
  { id: 'activity',   label: 'Something to do', icon: Ticket },
  { id: 'gift',       label: 'Gifts',     icon: Gift },
  { id: 'movie',      label: 'Cinema',    icon: Film },
  { id: 'event',      label: "What's on", icon: PartyPopper },
];

// Budget-first browsing. In TZS, and the cheapest band comes first on purpose:
// the app must never imply that a good date requires money.
const BUDGETS: { label: string; max: number | null }[] = [
  { label: 'Any budget', max: null },
  { label: 'Under 20k',  max: 20_000 },
  { label: 'Under 50k',  max: 50_000 },
  { label: 'Under 100k', max: 100_000 },
];

const priceLabel = (spot: CuratedSpot): string | null => {
  if (spot.price_min == null && spot.price_max == null) return null;
  if (spot.price_min != null && spot.price_max != null) {
    return spot.price_min === 0
      ? `Free – ${formatTZS(spot.price_max)}`
      : `${formatTZS(spot.price_min)} – ${formatTZS(spot.price_max)}`;
  }
  return formatTZS(spot.price_min ?? spot.price_max);
};

const SpotCard = ({ spot }: { spot: CuratedSpot }) => {
  const price = priceLabel(spot);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-base font-black tracking-tight text-foreground leading-snug">{spot.title}</h3>
        {price && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            <Wallet className="w-3 h-3 mr-1" />{price}
          </Badge>
        )}
      </div>

      {spot.area && (
        <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/40 mb-3">
          {spot.area}
        </p>
      )}

      {/* `why` is the entire differentiator — an opinion, not a listing. It
          gets the most visual weight on the card for that reason. */}
      <p className="text-[13px] font-medium text-foreground/65 leading-relaxed">{spot.why}</p>

      {spot.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {spot.tags.map(t => (
            <span key={t} className="text-[10px] font-bold text-foreground/45 bg-foreground/[0.05] rounded-lg px-2 py-1">
              {t}
            </span>
          ))}
        </div>
      )}

      {(spot.maps_url || spot.phone) && (
        <div className="flex gap-2 mt-4">
          {spot.maps_url && (
            <Button size="sm" variant="secondary" asChild>
              <a href={spot.maps_url} target="_blank" rel="noopener noreferrer">
                <MapPin className="w-3.5 h-3.5 mr-1.5" /> Map
              </a>
            </Button>
          )}
          {spot.phone && (
            <Button size="sm" variant="secondary" asChild>
              <a href={`tel:${spot.phone}`}>
                <Phone className="w-3.5 h-3.5 mr-1.5" /> Call
              </a>
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

export const DiscoverPage = () => {
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') as SpotCategory | null) ?? null;
  const budgetIdx = Number(params.get('budget') ?? '0');
  const budget = BUDGETS[budgetIdx] ?? BUDGETS[0];

  const [spots, setSpots] = useState<CuratedSpot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSpots(null);
    setError(null);
    try {
      setSpots(await api.listSpots({ category, maxBudget: budget.max }));
    } catch (e: any) {
      setError(e?.message || 'Could not load suggestions.');
    }
  }, [category, budget.max]);

  useEffect(() => { load(); }, [load]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Where to go</h1>
        <p className="text-sm font-medium text-foreground/50 mt-2">
          Hand-picked, with a reason. Tap what you're in the mood for.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setParam('category', null)}
          aria-pressed={category === null}
          className={`px-4 h-11 rounded-2xl text-xs font-bold transition-all ${
            category === null ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]'
          }`}
        >
          Everything
        </button>
        {CATEGORIES.map(c => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setParam('category', c.id)}
              aria-pressed={active}
              className={`px-4 h-11 rounded-2xl text-xs font-bold inline-flex items-center gap-2 transition-all ${
                active ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]'
              }`}
            >
              <c.icon className="w-3.5 h-3.5" /> {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {BUDGETS.map((b, i) => {
          const active = i === budgetIdx;
          return (
            <button
              key={b.label}
              onClick={() => setParam('budget', String(i))}
              aria-pressed={active}
              className={`px-3.5 h-9 rounded-xl text-[11px] font-bold transition-all ${
                active ? 'bg-foreground text-background' : 'bg-foreground/[0.04] text-foreground/60 hover:bg-foreground/[0.08]'
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <BackendError message={error} onRetry={load} />
      ) : spots === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : spots.length === 0 ? (
        <Card>
          {/* Honest empty state: the list being short is a curation reality,
              not a bug, and saying so beats pretending. */}
          <EmptyState
            icon={MapPin}
            title="Nothing here yet"
            subtitle="Every place in this app is checked by a real person before it shows up, so the list grows slowly. Try another category or a wider budget."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {spots.map(s => <SpotCard key={s.id} spot={s} />)}
        </div>
      )}
    </div>
  );
};
