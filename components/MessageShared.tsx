import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Publish the shell's vertical offsets as CSS custom properties, instead of
 * measuring a pixel height into React state.
 *
 * The first version of this fix called `setState` from the measurement, so
 * every recompute forced a React re-render of the whole shell. On mobile,
 * `window.innerHeight` changes as the browser chrome (URL bar) animates
 * during a scroll gesture, which fires `resize` and the ResizeObserver below
 * many times over the course of one fast scroll — each one re-rendering the
 * tree and visibly juddering the page down to its loading skeletons. THAT was
 * the "scroll hard and the whole UI moves" report: a resize handler that
 * updated state was resizing something on almost every scroll frame.
 *
 * The fix is to let `100dvh` do what it is FOR: the browser recalculates it
 * on every one of those chrome-animation frames natively, with no JS and no
 * React render. This hook only needs to publish the two numbers that do NOT
 * change during a scroll — how far down the page the shell sits, and how
 * much space is reserved below it — as CSS variables, written directly onto
 * the element via `style.setProperty`. That is a plain DOM mutation with no
 * React reconciliation attached, so however many times the observer below
 * fires, nothing about the component tree moves.
 *
 * The actual height is then `max(380px, 100dvh - top - below)` in CSS,
 * computed at paint time by the browser on every frame for free.
 */
function useShellOffsets<T extends HTMLElement>() {
  const ref = useRef<T>(null);

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

      // Whichever is larger already covers the nav; counting both is the bug
      // this hook exists to fix.
      const below = Math.max(reservedBelow, obstruction);

      // Direct DOM write, deliberately not React state — see the doc comment.
      el.style.setProperty('--mm-shell-top', `${Math.round(top)}px`);
      el.style.setProperty('--mm-shell-below', `${Math.round(below)}px`);
    };

    measure();
    // A real layout change (font swap, header height change, keyboard) still
    // needs to re-measure — this just no longer routes through React to do it.
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

  return ref;
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
 * See useShellOffsets above for the full history. Short version: the height
 * is `max(380px, 100dvh - top - below)`, where `top`/`below` are CSS
 * variables that hook publishes — a document offset and a reserved-space
 * allowance that do not change mid-scroll, leaving `100dvh` to absorb the
 * browser chrome's show/hide animation the way it is designed to.
 */
export const MessagingShell = ({ children }: { children: React.ReactNode }) => {
  const ref = useShellOffsets<HTMLDivElement>();
  return (
    <div
      ref={ref}
      // Fallback values (top/below) only matter for the very first paint,
      // before useLayoutEffect above has written the real ones — and since
      // that hook runs before the browser paints, this should never actually
      // be visible.
      style={{ ['--mm-shell-top' as any]: '160px', ['--mm-shell-below' as any]: '58px' }}
      className="relative flex h-[max(380px,calc(100dvh-var(--mm-shell-top)-var(--mm-shell-below)))] min-h-0 max-h-[920px] overflow-hidden rounded-3xl border border-foreground/[0.08] bg-background shadow-sm animate-in fade-in duration-300"
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
