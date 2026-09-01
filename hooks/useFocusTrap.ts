import { RefObject, useEffect } from 'react';

/**
 * Traps Tab focus within `ref` while `active`: moves focus into the container on
 * activate, cycles Tab / Shift+Tab within it, and restores focus to the
 * previously-focused element on deactivate. Escape handling is left to the caller
 * (dialogs differ on whether Escape should close while busy).
 *
 * The container should have `tabIndex={-1}` so it can receive focus as a
 * fallback when it has no focusable children.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () => Array.from(
      node?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter(el => el.offsetParent !== null);

    // Move focus into the dialog once it's painted.
    const t = window.setTimeout(() => (focusables()[0] ?? node)?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) { e.preventDefault(); node?.focus(); return; }
      const first = els[0], last = els[els.length - 1];
      const activeEl = document.activeElement as HTMLElement;
      if (e.shiftKey && (activeEl === first || !node?.contains(activeEl))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && activeEl === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.(); // restore focus to the trigger
    };
  }, [ref, active]);
}
