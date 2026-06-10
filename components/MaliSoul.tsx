/**
 * MaliMart Soul — the personality layer.
 *
 * <MaliEmptyState kind="cart" />        — playful empty states, Swahili first
 * <CelebrationBurst />                  — confetti for paid orders & wins
 * <KitengeStrip />                      — East African pattern accent
 *
 * Philosophy: MaliMart is Tanzanian. The microcopy leads with Swahili the
 * way people actually speak — warm, a little cheeky, never corporate.
 */
import React, { useMemo } from 'react';

// ── Rotating microcopy ─────────────────────────────────────────────
const EMPTY_COPY: Record<string, { sw: string; en: string; emoji: string }[]> = {
  cart: [
    { sw: 'Kikapu kipo kimya kabisa…', en: 'Your basket is suspiciously quiet', emoji: '🧺' },
    { sw: 'Hakuna kitu humu — bado!', en: "Nothing here — yet. The market is waiting", emoji: '🛒' },
    { sw: 'Kikapu kinakuomba kazi', en: 'This basket is asking for a job', emoji: '😄' },
  ],
  orders: [
    { sw: 'Bado hujanunuliwa chochote', en: 'No orders yet — your story starts with one', emoji: '📦' },
    { sw: 'Safari ya kwanza inaanza hapa', en: 'Every great haul has a first order', emoji: '🚀' },
  ],
  search: [
    { sw: 'Hatukupata kitu… jaribu jina lingine?', en: "We searched everywhere — try another word?", emoji: '🔍' },
    { sw: 'Hata Google angechoka — jaribu tena', en: 'Nothing matched. Different spelling, maybe?', emoji: '🤔' },
  ],
  products: [
    { sw: 'Duka liko tayari — weka bidhaa yako ya kwanza', en: 'Your shop is ready. Add your first product and open the doors', emoji: '🏪' },
  ],
  messages: [
    { sw: 'Kimya kama usiku wa Serengeti', en: 'Quiet as a Serengeti night. Start a conversation', emoji: '🌙' },
  ],
  notifications: [
    { sw: 'Habari njema zinakuja', en: 'Good news travels — none has arrived yet', emoji: '🔔' },
  ],
  generic: [
    { sw: 'Hakuna kitu hapa kwa sasa', en: 'Nothing here right now', emoji: '🍃' },
  ],
};

export const MaliEmptyState: React.FC<{
  kind?: keyof typeof EMPTY_COPY;
  action?: React.ReactNode;
  className?: string;
}> = ({ kind = 'generic', action, className = '' }) => {
  const copy = useMemo(() => {
    const list = EMPTY_COPY[kind] ?? EMPTY_COPY.generic;
    return list[Math.floor(Math.random() * list.length)];
  }, [kind]);

  return (
    <div className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}>
      <div className="mali-sway text-5xl mb-4 select-none" aria-hidden="true">{copy.emoji}</div>
      <p className="text-base font-black tracking-tight text-foreground">{copy.sw}</p>
      <p className="text-sm text-foreground/50 mt-1 max-w-[280px]">{copy.en}</p>
      {action && <div className="mt-6">{action}</div>}
      <div className="kitenge-strip w-24 mt-8" aria-hidden="true" />
    </div>
  );
};

// ── Celebration ────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#059669', '#f59e0b', '#0c4a6e', '#e11d48', '#7c3aed'];

/** Lightweight CSS confetti — no library, ~zero cost. Render on success. */
export const CelebrationBurst: React.FC<{ count?: number }> = ({ count = 18 }) => {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 5 + Math.random() * 5,
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="mali-confetti absolute rounded-[2px]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

/** Kitenge pattern strip — drop under headers/receipts for instant identity */
export const KitengeStrip: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`kitenge-strip ${className}`} aria-hidden="true" />
);

/** Time-aware Swahili greeting for dashboards */
export function maliGreeting(name?: string): string {
  const h = new Date().getHours();
  const base = h < 12 ? 'Habari za asubuhi' : h < 16 ? 'Habari za mchana' : h < 19 ? 'Habari za jioni' : 'Habari za usiku';
  return name ? `${base}, ${name}!` : `${base}!`;
}
