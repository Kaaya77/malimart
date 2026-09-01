import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Compass, Sparkles, CalendarHeart, Check, X, Loader2,
  MessageCircleHeart, BookHeart, Clock,
} from 'lucide-react';
import {
  Card, Button, Input, Label, Badge, EmptyState, Skeleton, BackendError, useToast,
} from '../components/UI';
import { useCompanion } from '../hooks/useCompanion';
import { EFFORT_LABELS } from '../services/nudgeEngine';
import * as api from '../services/companionApi';
import type { Nudge } from '../types';

// ── Setup: the only blocking screen in the product ────────────────────────
// One field required. Everything else about the partner is captured later,
// as it comes up — asking for a full profile up front would be a wall
// between the user and the first useful thing the app does.
const PartnerSetup = ({ onCreated }: { onCreated: () => void }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await api.createPartner({ display_name: name.trim() });
      addToast('All set. Let\'s make this easy.', 'success');
      onCreated();
    } catch (err: any) {
      addToast(err?.message || 'Could not save that.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
          <Heart className="w-7 h-7 text-emerald-500 stroke-[1.75]" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground mb-3">
          Who are we planning for?
        </h1>
        <p className="text-sm font-medium text-foreground/55 leading-relaxed">
          Just their name for now. They don't need the app, and they'll never
          know it exists unless you tell them.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label htmlFor="partner-name">Their name</Label>
            <Input
              id="partner-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Amina"
              maxLength={60}
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" isLoading={saving} disabled={!name.trim()}>
            Start
          </Button>
        </form>
      </Card>

      <p className="text-[11px] text-center text-foreground/40 mt-6 leading-relaxed">
        Everything you save here is private to your account. You can delete all
        of it at any time from the partner page.
      </p>
    </div>
  );
};

// ── A single nudge card ───────────────────────────────────────────────────
const NudgeCard = ({ nudge, onAct }: { nudge: Nudge; onAct: (n: Nudge, o: 'done' | 'skip') => void }) => {
  const tone: Record<Nudge['kind'], string> = {
    occasion: 'text-amber-600 bg-amber-500/10',
    ritual: 'text-emerald-600 bg-emerald-500/10',
    promise: 'text-indigo-600 bg-indigo-500/10',
    drift: 'text-rose-600 bg-rose-500/10',
  };
  const icon: Record<Nudge['kind'], any> = {
    occasion: CalendarHeart,
    ritual: MessageCircleHeart,
    promise: BookHeart,
    drift: Compass,
  };
  const Icon = icon[nudge.kind];

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${tone[nudge.kind]}`}>
            <Icon className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <h3 className="text-sm font-black text-foreground leading-snug">{nudge.title}</h3>
              <Badge variant="secondary" className="text-[10px] py-0.5 px-2">
                <Clock className="w-3 h-3 mr-1" />{EFFORT_LABELS[nudge.effort]}
              </Badge>
            </div>
            <p className="text-[13px] font-medium text-foreground/55 leading-relaxed">{nudge.body}</p>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button size="sm" onClick={() => onAct(nudge, 'done')}>
                <Check className="w-3.5 h-3.5 mr-1.5" /> Done
              </Button>
              {nudge.href && (
                <Button size="sm" variant="secondary" asChild>
                  <Link to={nudge.href}>Show me ideas</Link>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onAct(nudge, 'skip')}>
                <X className="w-3.5 h-3.5 mr-1.5" /> Not now
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const QuickLink = ({ to, icon: Icon, label, sub }: { to: string; icon: any; label: string; sub: string }) => (
  <Link to={to} className="block">
    <Card className="p-5 h-full hover:shadow-md transition-shadow">
      <Icon className="w-6 h-6 text-emerald-500 stroke-[1.75] mb-3" />
      <p className="text-sm font-black text-foreground">{label}</p>
      <p className="text-[12px] font-medium text-foreground/50 mt-1 leading-relaxed">{sub}</p>
    </Card>
  </Link>
);

export const CompanionPage = () => {
  const { partner, nudges, isLoading, error, reload, actOnNudge, hasPartner } = useCompanion();

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (error) {
    return <BackendError message={error} onRetry={reload} />;
  }

  if (!hasPartner) return <PartnerSetup onCreated={reload} />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2">Today</p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
          You and {partner!.display_name}
        </h1>
      </header>

      <section className="space-y-3 mb-12">
        <AnimatePresence mode="popLayout">
          {nudges.length > 0 ? (
            nudges.map(n => <NudgeCard key={n.key} nudge={n} onAct={actOnNudge} />)
          ) : (
            <motion.div key="clear" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                {/* The empty state is a genuine "nothing needed" — never a
                    prompt to do more, and never a streak or a score. */}
                <EmptyState
                  icon={Sparkles}
                  title="Nothing needs you right now"
                  subtitle="That's the point. Have a good day — we'll tap you on the shoulder when something's coming up."
                />
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section>
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground/40 mb-4">
          Whenever you need it
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink to="/discover" icon={Compass} label="Where to go" sub="Places worth taking someone, with a reason attached." />
          <QuickLink to="/date-mode" icon={Sparkles} label="On a date now" sub="Questions, games, and the first-date walkthrough." />
          <QuickLink to="/partner" icon={Heart} label={partner!.display_name} sub="What you know about them. Add to it as it comes up." />
        </div>
      </section>
    </div>
  );
};
