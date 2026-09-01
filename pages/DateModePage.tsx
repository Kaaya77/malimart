import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, ArrowLeft, CheckCircle2, Circle, Sparkles, ListChecks, BookOpen } from 'lucide-react';
import { Card, Button, Badge, Accordion } from '../components/UI';
import { DECKS, FIRST_DATE_GUIDE, PRE_DATE_CHECKLIST, type Deck } from '../services/dateDecks';

type Tab = 'decks' | 'checklist' | 'guide';

// ── Card player ───────────────────────────────────────────────────────────
// Shuffles once on open so the same deck doesn't replay in order, and never
// repeats a card until the deck is exhausted.
const DeckPlayer = ({ deck, onBack }: { deck: Deck; onBack: () => void }) => {
  const [order] = useState(() => {
    const a = [...deck.cards];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  });
  const [index, setIndex] = useState(0);
  const atEnd = index >= order.length - 1;

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-xs font-bold text-foreground/50 hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All decks
      </button>

      <Card className="p-8 md:p-10 min-h-[240px] flex flex-col justify-center text-center mb-5">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="text-xl md:text-2xl font-black tracking-tight text-foreground leading-snug"
          >
            {order[index]}
          </motion.p>
        </AnimatePresence>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/35 tabular-nums">
          {index + 1} / {order.length}
        </p>
        <Button onClick={() => setIndex(i => (atEnd ? 0 : i + 1))}>
          <Shuffle className="w-4 h-4 mr-2" />
          {atEnd ? 'Start over' : 'Next'}
        </Button>
      </div>
    </div>
  );
};

const Checklist = () => {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  return (
    <Card className="p-2">
      {PRE_DATE_CHECKLIST.map((item, i) => {
        const checked = done.has(i);
        return (
          <button
            key={item}
            onClick={() => toggle(i)}
            aria-pressed={checked}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-foreground/[0.03] rounded-2xl transition-colors"
          >
            {checked
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <Circle className="w-5 h-5 text-foreground/20 shrink-0" />}
            <span className={`text-sm font-medium transition-all ${checked ? 'text-foreground/35 line-through' : 'text-foreground/75'}`}>
              {item}
            </span>
          </button>
        );
      })}
      {/* Intentionally no "you're not ready" state — an unfinished checklist
          is information, never a warning. */}
    </Card>
  );
};

export const DateModePage = () => {
  const [tab, setTab] = useState<Tab>('decks');
  const [active, setActive] = useState<Deck | null>(null);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'decks', label: 'Right now', icon: Sparkles },
    { id: 'checklist', label: 'Before you go', icon: ListChecks },
    { id: 'guide', label: 'First date?', icon: BookOpen },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:py-14">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">Date mode</h1>
        <p className="text-sm font-medium text-foreground/50 mt-2">
          Works with no signal. Open it at the table.
        </p>
      </header>

      <div className="flex gap-2 mb-8">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setActive(null); }}
            aria-pressed={tab === t.id}
            className={`flex-1 h-11 rounded-2xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-all ${
              tab === t.id ? 'bg-emerald-500 text-white' : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'decks' && (
        active
          ? <DeckPlayer deck={active} onBack={() => setActive(null)} />
          : (
            <div className="space-y-3">
              {[...DECKS].sort((a, b) => a.intensity - b.intensity).map(d => (
                <button key={d.id} onClick={() => setActive(d)} className="w-full text-left">
                  <Card className="p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <h3 className="text-base font-black tracking-tight text-foreground">{d.name}</h3>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{d.cards.length} cards</Badge>
                    </div>
                    <p className="text-[13px] font-medium text-foreground/55 leading-relaxed">{d.blurb}</p>
                  </Card>
                </button>
              ))}
            </div>
          )
      )}

      {tab === 'checklist' && <Checklist />}

      {tab === 'guide' && (
        <Card className="px-5 py-2">
          {FIRST_DATE_GUIDE.map((step, i) => (
            <Accordion key={step.heading} title={step.heading} defaultOpen={i === 0}>
              {step.body}
            </Accordion>
          ))}
        </Card>
      )}
    </div>
  );
};
