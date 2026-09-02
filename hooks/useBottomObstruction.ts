import { useLayoutEffect, useRef } from 'react';

/**
 * Publishes the height of a bottom-pinned bar so floating UI can clear it.
 *
 * Floating elements (the Mali chat launcher, toasts) read
 * `--mm-bottom-obstruction` to position themselves. The default is the mobile
 * bottom nav; any page that pins its OWN bar to the bottom must raise it, or
 * the launcher lands on top of that bar's primary action.
 *
 * This logic used to be a hand-rolled useEffect inside ProductPage with a
 * hardcoded height, which meant every new bottom bar had to remember to
 * reimplement it — and the bag, buyer and seller pages all have one and none
 * of them did. Attaching this ref to the bar MEASURES it, so the value is
 * always the bar's real height and cannot drift when the design changes.
 *
 *   const barRef = useBottomObstruction<HTMLDivElement>();
 *   <div ref={barRef} className="fixed bottom-0 ...">
 *
 * Several bars can be mounted at once (a modal bar over a page bar), so each
 * registers its own claim and the largest wins — the safe zone never shrinks
 * because a shorter bar mounted later.
 */
const claims = new Map<symbol, number>();

const republish = () => {
  const root = document.documentElement;
  const tallest = claims.size ? Math.max(...claims.values()) : 0;
  if (tallest > 0) root.style.setProperty('--mm-bottom-obstruction', `${Math.round(tallest)}px`);
  else root.style.removeProperty('--mm-bottom-obstruction');
};

export function useBottomObstruction<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  // One stable id per mounted bar, so unmount removes the right claim.
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol('mm-bottom-bar');

  useLayoutEffect(() => {
    const el = ref.current;
    const id = idRef.current!;
    if (!el) return;

    const measure = () => {
      // offsetHeight includes the bar's own safe-area padding.
      claims.set(id, el.offsetHeight);
      republish();
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      claims.delete(id);
      republish();
    };
  }, []);

  return ref;
}
