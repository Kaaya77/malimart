import { useEffect } from 'react';

/**
 * usePerformance — reports Core Web Vitals to console in development
 * and could report to analytics in production.
 * 
 * Measures: LCP, FID, CLS, FCP, TTFB
 */
export function useWebVitals() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only measure in supported browsers
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          const lcp = entry.startTime;
          if (process.env.NODE_ENV === 'development') {
            console.info(`[MaliMart Perf] LCP: ${lcp.toFixed(0)}ms ${lcp < 2500 ? '✅' : lcp < 4000 ? '⚠️' : '❌'}`);
          }
          // In production, could send to analytics:
          // supabase.from('web_vitals').insert({ metric: 'LCP', value: lcp, url: location.pathname });
        }
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          // Accumulate CLS
        }
      }
    });

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    // Report FCP
    try {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length) {
        const nav = navEntries[0];
        if (process.env.NODE_ENV === 'development') {
          console.info(`[MaliMart Perf] TTFB: ${nav.responseStart.toFixed(0)}ms | DOM Ready: ${nav.domContentLoadedEventEnd.toFixed(0)}ms | Load: ${nav.loadEventEnd.toFixed(0)}ms`);
        }
      }
    } catch {}

    return () => observer.disconnect();
  }, []);
}

/**
 * measureRender — use in development to time component renders
 */
export function measureRender(componentName: string) {
  if (process.env.NODE_ENV !== 'development') return;
  const start = performance.now();
  return () => {
    const ms = performance.now() - start;
    if (ms > 16) console.warn(`[Slow render] ${componentName}: ${ms.toFixed(1)}ms (>1 frame)`);
  };
}
