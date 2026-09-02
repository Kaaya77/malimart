import React from 'react';

/**
 * Responsive chat layout containers.
 *
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
export const MessageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-[calc(100dvh-var(--mm-bottom-obstruction,58px)-7rem)] md:h-[calc(100dvh-7rem)] min-h-0 md:min-h-[520px] max-h-[900px] animate-in fade-in duration-300 overflow-hidden bg-background border border-foreground/10 rounded-2xl shadow-sm">
    {children}
  </div>
);

export const SidebarContainer = ({ children, isVisible }: { children: React.ReactNode; isVisible: boolean }) => (
  <div className={`md:col-span-4 lg:col-span-3 border-r border-foreground/8 flex flex-col bg-background ${isVisible ? 'hidden md:flex' : 'flex'}`}>
    {children}
  </div>
);

export const ChatAreaContainer = ({ children, isVisible }: { children: React.ReactNode; isVisible: boolean }) => (
  <div className={`md:col-span-8 lg:col-span-6 flex flex-col min-w-0 ${isVisible ? 'hidden md:flex' : 'flex'}`}>
    {children}
  </div>
);

export const DetailsAreaContainer = ({ children, isVisible }: { children: React.ReactNode; isVisible: boolean }) => (
  <div className={`lg:col-span-3 border-l border-foreground/8 bg-foreground/[0.02] flex flex-col ${isVisible ? 'hidden lg:flex' : 'hidden'}`}>
    {children}
  </div>
);
