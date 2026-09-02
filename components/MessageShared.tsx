import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/** Never shrink below this, however cramped the host page is. */
const MIN_SHELL_HEIGHT = 380;

/**
 * Measure the height the shell can actually occupy, instead of guessing it
 * from a viewport formula.
 *
 * The previous height was `calc(100dvh - var(--mm-bottom-obstruction) - 7rem)`.
 * That formula assumed messaging was the only thing under a 7rem header — but
 * on mobile the dashboards ALSO reserve their own bottom padding for the fixed
 * tab bar (BuyerPage/SellerPage use `pb-[calc(5.5rem+env(safe-area-inset-bottom))]`),
 * and they render a mobile PageHeader plus `pt-6` above the tab content.
 *
 * So the bottom obstruction was subtracted twice and the top was understated,
 * which is the reported "scrolling a bit on mobile leaves empty space at the
 * bottom": the page grew taller than the viewport, and scrolling revealed the
 * host's leftover padding under a shell that had already ended.
 *
 * Measuring the shell's own document offset and the padding that ancestors
 * reserve below it is self-correcting — it stays right if a host page changes
 * its header or padding, which a magic number never does.
 */
function useAvailableHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // Document offset, not viewport offset: this must not change as the
      // user scrolls, or the measurement would feed back into itself.
      const top = el.getBoundingClientRect().top + window.scrollY;

      // Padding ancestors reserve BELOW us — the mobile tab-bar allowance.
      let reservedBelow = 0;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        reservedBelow += parseFloat(getComputedStyle(p).paddingBottom) || 0;
      }

      // Anything pinned over the bottom of the viewport (the mobile nav).
      const obstruction = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--mm-bottom-obstruction'),
      ) || 0;

      // Whichever is larger already covers the nav; counting both is the bug.
      const below = Math.max(reservedBelow, obstruction);
      setHeight(Math.max(MIN_SHELL_HEIGHT, window.innerHeight - top - below));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return { ref, height };
}

/**
 * Messaging layout chassis — two panes and an overlay drawer.
 *
 * The old chassis was a 12-column grid split 3 / 6 / 3: conversations, thread,
 * and a permanently-mounted details column. That third column held an avatar
 * and three buttons, so a quarter of every large screen was spent on almost
 * nothing while the conversation — the actual content — got half. Worse, the
 * admin inbox never rendered a details column at all, so it laid out across 9
 * of 12 columns and left a dead gap down the right-hand side.
 *
 * Details are now a drawer over the thread, which both gives the conversation
 * the reclaimed width and lets the panel hold more than it could at 25%.
 *
 * ── Height ──────────────────────────────────────────────────────────────────
 * Kept verbatim from the previous chassis, because it encodes a real fix.
 * Height was `calc(100vh - 7rem)` with `min-h-[520px]`. Two problems, both
 * mobile-only and both severe:
 *
 *  1. `100vh` on a phone measures the viewport as if the browser URL bar were
 *     collapsed, so the container is TALLER than what is actually visible.
 *  2. It never subtracted the fixed bottom nav (58px).
 *
 * Measured, the composer ended up 94-162px BELOW the fold on common phones
 * (iPhone SE 94px, Android mid 117px, iPhone 12 162px) — and since the
 * container is `overflow-hidden`, you could not scroll to reach it. The
 * message input was simply unreachable.
 *
 * `100dvh` tracks the browser chrome as it collapses, and the bottom
 * obstruction is subtracted via the same variable every other pinned element
 * uses. `min-h` is dropped below md, because forcing 520px on a 519px
 * viewport guarantees the overflow it was meant to prevent.
 */
export const MessagingShell = ({ children }: { children: React.ReactNode }) => {
  const { ref, height } = useAvailableHeight<HTMLDivElement>();
  return (
    <div
      ref={ref}
      // The dvh fallback only applies for the first paint, before the measure
      // lands — after that the measured height is authoritative.
      style={height ? { height } : undefined}
      className="relative flex h-[calc(100dvh-var(--mm-bottom-obstruction,58px)-7rem)] min-h-0 max-h-[920px] overflow-hidden rounded-3xl border border-foreground/[0.08] bg-background shadow-sm animate-in fade-in duration-300"
    >
      {children}
    </div>
  );
};

/**
 * The conversation list. A fixed rail on desktop rather than a grid fraction,
 * so the thread absorbs every extra pixel of a wide window instead of the list
 * growing to a width no conversation name needs.
 */
export const ConversationPane = ({ children, hidden }: { children: React.ReactNode; hidden: boolean }) => (
  <aside
    className={`w-full md:w-[300px] lg:w-[340px] shrink-0 border-r border-foreground/[0.08] flex-col min-h-0 bg-foreground/[0.015] ${hidden ? 'hidden md:flex' : 'flex'}`}
  >
    {children}
  </aside>
);

/** The open conversation. Takes all remaining width. */
export const ThreadPane = ({ children, hidden }: { children: React.ReactNode; hidden: boolean }) => (
  <section className={`flex-1 flex-col min-w-0 min-h-0 ${hidden ? 'hidden md:flex' : 'flex'}`}>
    {children}
  </section>
);

/**
 * Peer details, as a drawer over the thread. Full-width on phones, a panel on
 * desktop. Closes on Escape and on scrim click; the scrim only exists while
 * open so it can never swallow clicks meant for the composer.
 */
export const DetailsDrawer = ({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          className="absolute inset-0 z-20 bg-black/25 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal={open}
        aria-label={title}
        aria-hidden={!open}
        // `invisible` when closed, not just translated off-screen: a panel
        // parked outside the viewport is still focusable, so tabbing from the
        // composer would walk into a drawer nobody can see. Visibility is
        // transitioned alongside the transform so it only flips once the
        // slide-out has finished.
        className={`absolute inset-y-0 right-0 z-30 w-full sm:w-[340px] bg-background border-l border-foreground/[0.08] shadow-2xl flex flex-col min-h-0 transition-[transform,visibility] duration-300 ease-out ${open ? 'translate-x-0 visible' : 'translate-x-full invisible'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.08] shrink-0">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/40">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close details"
            tabIndex={open ? 0 : -1}
            className="h-9 w-9 -mr-2 flex items-center justify-center rounded-2xl text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-5">
          {children}
        </div>
      </div>
    </>
  );
};
