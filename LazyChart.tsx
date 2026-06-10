/**
 * LazyChart — wraps any recharts component to defer the 409kB library
 * until the chart actually enters the viewport.
 * 
 * Usage:
 *   import { LazyBarChart } from './LazyChart';
 *   <LazyBarChart data={data} barSize={28} ...>
 *     ...
 *   </LazyBarChart>
 */
import React, { useRef, useState, useEffect, Suspense, lazy } from 'react';

// Skeleton shown while chart loads
const ChartSkeleton: React.FC<{ height?: number }> = ({ height = 200 }) => (
  <div className="w-full animate-pulse" style={{ height }}>
    <div className="flex items-end justify-between gap-1 h-full px-2 pb-6 pt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-lg bg-foreground/[0.07]"
          style={{ height: `${30 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  </div>
);

// Intersection observer hook — only render when in viewport
function useInView(threshold = 0.1): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView];
}

// Lazy-load recharts components on demand
const RechartsModules = lazy(() => import('./RechartsExports'));

// Re-export the chart types as lazily-loaded wrappers
interface LazyChartProps {
  height?: number;
  children?: React.ReactNode;
  [key: string]: any;
}

export const LazyResponsiveChart: React.FC<LazyChartProps & { type: 'bar' | 'line' | 'area' | 'pie' }> = ({
  height = 240,
  type,
  children,
  ...props
}) => {
  const [containerRef, inView] = useInView(0.05);

  return (
    <div ref={containerRef} style={{ height, width: '100%' }}>
      {inView ? (
        <Suspense fallback={<ChartSkeleton height={height}/>}>
          <RechartsModules type={type} height={height} {...props}>
            {children}
          </RechartsModules>
        </Suspense>
      ) : (
        <ChartSkeleton height={height}/>
      )}
    </div>
  );
};
