
import React, { Component, ReactNode, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Slot } from '@radix-ui/react-slot';
import { Link } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { Loader2, X, AlertTriangle, ChevronDown, Sun, Moon, ShieldCheck, Printer, Download, CheckCircle2, Package, Truck, CreditCard, Store, Sparkles, RotateCcw, Percent, MessageSquare, Share2, ShieldAlert, BadgeCheck, RefreshCw, WifiOff } from 'lucide-react';
import { Order, VendorProfile, Product } from '../types';
import { formatTZS } from '../constants';
import { useFocusTrap } from '../hooks/useFocusTrap';

// --- Error Boundary ---
interface ErrorBoundaryProps {
 children?: ReactNode;
}

interface ErrorBoundaryState {
 hasError: boolean;
 error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
 public state: ErrorBoundaryState = { hasError: false, error: null };

 constructor(props: ErrorBoundaryProps) {
 super(props);
 }

 static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
 
 componentDidCatch(error: Error, errorInfo: any) { console.error(error, errorInfo); }
 
 render() {
 if (this.state.hasError) {
 return (
 <div className="min-h-screen flex items-center justify-center p-6 bg-background">
 <div className="text-center max-w-md">
 <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
 <AlertTriangle className="w-8 h-8 text-red-500" />
 </div>
 <h2 className="text-2xl font-semibold mb-2 text-foreground">Something went wrong.</h2>
 <p className="text-foreground/50 text-sm mb-8">{this.state.error?.message}</p>
 <button onClick={() => window.location.reload()} className="px-8 py-4 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:scale-105 transition-transform">Reload Application</button>
 </div>
 </div>
 );
 }
 return (this as any).props.children;
 }
}

// --- Toast Context ---
const TOAST_DURATION = 4000;
type ToastAction = { label: string; fn: () => void };
type Toast = { id: string; msg: string; type: 'success' | 'error' | 'info'; action?: ToastAction };

const ToastContext = React.createContext<any>(null);

const ToastItem = ({ t, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) => {
  const [progress, setProgress] = React.useState(100);
  const start = React.useRef(Date.now());
  const raf = React.useRef<number>(0);

  React.useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - start.current;
      setProgress(Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100));
      if (elapsed < TOAST_DURATION) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const accent = t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.18 } }}
      drag="x"
      dragConstraints={{ left: 0, right: 120 }}
      dragElastic={0.08}
      onDragEnd={(_: any, info: any) => { if (info.offset.x > 50) onDismiss(t.id); }}
      className="pointer-events-auto relative w-full overflow-hidden rounded-2xl bg-background border border-foreground/10 shadow-[0_8px_30px_rgba(0,0,0,0.1)] cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accent}`} />
      <div className="flex items-center gap-3 px-4 py-3 pl-5">
        <p className="flex-1 text-[13px] font-semibold text-foreground leading-snug">{t.msg}</p>
        {t.action && (
          <button
            onClick={() => { t.action!.fn(); onDismiss(t.id); }}
            className={`text-[11px] font-black uppercase tracking-wider shrink-0 ${t.type === 'success' ? 'text-emerald-600' : t.type === 'error' ? 'text-red-600' : 'text-blue-600'} hover:opacity-70 transition-opacity`}
          >
            {t.action.label}
          </button>
        )}
        <button onClick={() => onDismiss(t.id)} className="text-foreground/30 hover:text-foreground/60 transition-colors shrink-0 ml-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground/5">
        <div className={`h-full ${accent} transition-none`} style={{ width: `${progress}%` }} />
      </div>
    </motion.div>
  );
};

export const ToastProvider = ({ children }: { children?: ReactNode }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = React.useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = React.useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info', action?: ToastAction) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev.slice(-4), { id, msg, type, action }]);
    timers.current[id] = setTimeout(() => dismiss(id), TOAST_DURATION);
  }, [dismiss]);

  React.useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toasts stack ABOVE everything pinned to the bottom-right.
       *
       * `bottom-6` put them 24px up, which on the product page landed them on
       * the sticky Add-to-Cart bar, the seller / "Visit store" card and the
       * wishlist button.
       *
       * Mobile: --mm-bottom-obstruction is the bottom nav (58px) or a page's
       * own sticky bar. The Mali launcher sits at obstruction + 1rem and is
       * 56px tall (w-14/h-14), so it occupies up to obstruction + 72px;
       * 5.25rem (84px) clears it with a 12px gap.
       * Desktop: no bottom nav and the launcher sits at bottom-6, so a flat
       * 6rem clears it without inheriting the mobile nav allowance.
       */}
      <div className="fixed bottom-[calc(var(--mm-bottom-obstruction,58px)+5.25rem)] md:bottom-24 right-4 z-[250] flex flex-col-reverse gap-2 items-end pointer-events-none w-full max-w-xs sm:max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => <ToastItem key={t.id} t={t} onDismiss={dismiss} />)}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
export const useToast = () => React.useContext(ToastContext);

// --- Components ---

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'brand' | 'danger' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon';
  asChild?: boolean;
  isLoading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = ({ variant = 'primary', size = 'default', className = '', asChild = false, isLoading, children, ...props }: ButtonProps) => {
 const base = "relative inline-flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-0 disabled:opacity-50 disabled:pointer-events-none overflow-hidden group whitespace-nowrap font-bold";
 
 const variants: any = {
 primary: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
 secondary: "bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]",
 brand: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
 danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
 outline: "border-2 border-foreground/20 text-foreground hover:border-foreground/40",
 ghost: "hover:bg-foreground/[0.06] text-foreground",
 link: "text-emerald-600 hover:underline p-0 h-auto"
 };
 
 const sizes: any = { 
 default: "h-12 px-6 rounded-2xl text-sm", 
 sm: "h-10 px-4 rounded-xl text-xs", 
 lg: "h-14 px-8 rounded-2xl text-base", 
 xl: "h-16 px-10 rounded-3xl text-lg",
 icon: "h-12 w-12 rounded-2xl" 
 };

 const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

 if (asChild) {
 return (
 <Slot className={classes} {...(props as any)}>
 {children}
 </Slot>
 );
 }

 return (
 <motion.button
 type="button"
 whileHover={{ scale: 1.02 }}
 whileTap={{ scale: 0.98 }}
 className={classes}
 disabled={isLoading || props.disabled}
 {...(props as any)}
 >
 {/* NOTE: children are wrapped in this inner span, so a `gap-*` passed to
 Button via className lands on the OUTER button and never spaces an icon
 from its label. The convention here is `mr-2` on the icon itself (as the
 loader below does, and ~20 existing call sites). Adding gap-2 here would
 double the spacing on every one of them. */}
 <span className="relative flex items-center justify-center">
 {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 {children}
 </span>
 </motion.button>
 );
};

export const Input = ({ className = '', icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ComponentType<{ className?: string }> }) => (
 <div className="relative group w-full">
 {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />}
 <input
 className={`glass-input flex h-14 w-full rounded-2xl ${Icon ? 'pl-11' : 'px-4'} pr-4 text-sm font-medium text-foreground placeholder:text-foreground/35 focus:outline-none ${className}`}
 {...props}
 />
 </div>
);

// Select primitive — mirrors Input (glass-input, h-14, rounded-2xl) with a chevron affordance.
// API: <Select value onChange icon={OptionalLucideIcon} className>{<option/>s}</Select>
export const Select = ({ className = '', icon: Icon, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { icon?: React.ComponentType<{ className?: string }> }) => (
 <div className="relative group w-full">
 {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />}
 <select
 className={`glass-input flex h-14 w-full appearance-none rounded-2xl ${Icon ? 'pl-10' : 'pl-4'} pr-10 text-sm font-medium text-foreground focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
 {...props}
 >
 {children}
 </select>
 <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 pointer-events-none" />
 </div>
);

export const Textarea = ({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
 <textarea className={`glass-input flex min-h-[120px] w-full rounded-2xl px-4 py-4 text-sm font-medium text-foreground placeholder:text-foreground/35 focus:outline-none resize-none ${className}`} {...props} />
);

export const Label = ({ className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
 <label className={`text-xs font-bold text-foreground/70 mb-2 block ${className}`} {...props} />
);

export const Card = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
 <div
 className={`glass-surface rounded-3xl text-foreground relative overflow-hidden shadow-sm ${className}`}
 {...props}
 >
 <div className="relative z-10">{props.children}</div>
 </div>
);

export const CardHeader = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
 <div className={`p-6 border-b border-foreground/8 ${className}`} {...props} />
);

export const CardContent = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
 <div className={`p-6 ${className}`} {...props} />
);

export const CardTitle = ({ className = '', ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
 <h3 className={`text-xl font-black tracking-tight text-foreground/60 ${className}`} {...props} />
);

export const CardDescription = ({ className = '', ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
 <p className={`text-sm font-medium text-muted-foreground mt-1 ${className}`} {...props} />
);

export const Badge = ({ variant = 'default', className = '', ...props }: { variant?: 'default' | 'secondary' | 'outline' | 'success' | 'danger' } & React.HTMLAttributes<HTMLDivElement>) => {
 const variants: any = {
 default: "bg-foreground/[0.08] text-foreground",
 secondary: "bg-foreground/[0.04] text-foreground/65 border border-foreground/10",
 outline: "border-2 border-foreground/20 text-foreground/70",
 success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 ",
 danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
 };
 return <div className={`inline-flex items-center rounded-xl px-3 py-1 text-xs font-bold transition-all ${variants[variant]} ${className}`} {...props} />;
};

/**
 * Verified seller mark.
 *
 * A solid scalloped seal rather than a stroked shield outline. A generic
 * outline icon reads as a status glyph; a filled rosette with a crisp check is
 * the visual language buyers already associate with verification, and it holds
 * up at 14-16px where thin strokes go muddy.
 *
 * The rosette path is generated geometrically (12 lobes, smoothed with
 * quadratic curves) rather than lifted from another product's mark.
 *
 * Deliberately NOT accent-tinted: this is a trust signal and should mean the
 * same thing, and look the same, whatever theme the user picked. Gradient ids
 * are suffixed per instance so several badges on one page cannot collide in
 * the SVG id namespace.
 */
const VERIFIED_ROSETTE = 'M 12.00 0.80 Q 14.41 3.02 16.00 2.66 Q 17.60 2.30 18.09 3.86 Q 18.58 5.42 20.14 5.91 Q 21.70 6.40 21.34 8.00 Q 20.98 9.59 22.09 10.80 Q 23.20 12.00 22.09 13.20 Q 20.98 14.41 21.34 16.00 Q 21.70 17.60 20.14 18.09 Q 18.58 18.58 18.09 20.14 Q 17.60 21.70 16.00 21.34 Q 14.41 20.98 13.20 22.09 Q 12.00 23.20 10.80 22.09 Q 9.59 20.98 8.00 21.34 Q 6.40 21.70 5.91 20.14 Q 5.42 18.58 3.86 18.09 Q 2.30 17.60 2.66 16.00 Q 3.02 14.41 1.91 13.20 Q 0.80 12.00 1.91 10.80 Q 3.02 9.59 2.66 8.00 Q 2.30 6.40 3.86 5.91 Q 5.42 5.42 5.91 3.86 Q 6.40 2.30 8.00 2.66 Q 9.59 3.02 10.80 1.91 Q 12.00 0.80 13.20 1.91 Z';

let verifiedSeq = 0;

export const VerifiedBadge = ({
 className = '',
 iconOnly = false,
 size = 'w-4 h-4',
}: { className?: string; iconOnly?: boolean; size?: string }) => {
 const gid = React.useMemo(() => `mm-verified-${++verifiedSeq}`, []);

 const Seal = ({ size }: { size: string }) => (
 <svg viewBox="0 0 24 24" role="img" aria-label="Verified seller" className={`${size} shrink-0`}>
 <title>Verified seller</title>
 <defs>
 <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor="#3b9df7" />
 <stop offset="100%" stopColor="#1d6fd0" />
 </linearGradient>
 </defs>
 <path d={VERIFIED_ROSETTE} fill={`url(#${gid})`} />
 {/* Top highlight so it reads as a struck medal rather than a flat sticker. */}
 <path d={VERIFIED_ROSETTE} fill="white" opacity="0.16" transform="translate(0 -0.55) scale(1 0.5)" />
 <path d="M8.2 12.3 L10.9 15 L16 9.6" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 );

 if (iconOnly) {
 return <Seal size={`${size} ${className}`} />;
 }

 return (
 <div className={`inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${className}`}>
 <Seal size="w-3.5 h-3.5" />
 Verified
 </div>
 );
};

// Shared empty state for dashboard tabs — keeps icon/copy/action treatment consistent.
export const EmptyState = ({ icon: Icon, title, subtitle, action, className = '' }: { icon?: any, title: string, subtitle?: string, action?: ReactNode, className?: string }) => (
 <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
 {Icon && (
 <div className="w-14 h-14 rounded-3xl bg-foreground/[0.05] flex items-center justify-center mb-4">
 <Icon className="w-6 h-6 text-foreground/30 stroke-[1.5]" />
 </div>
 )}
 <p className="text-sm font-bold text-foreground">{title}</p>
 {subtitle && <p className="text-xs font-medium text-foreground/45 mt-1 max-w-xs leading-relaxed">{subtitle}</p>}
 {action && <div className="mt-5">{action}</div>}
 </div>
);

// Shared "backend unreachable" state with a self-managing Retry button. Used
// wherever a network/RPC fetch can fail (catalog, dashboards) so the failure UX
// is one consistent thing, and repeated taps give feedback instead of nothing.
export const BackendError = ({
  message,
  onRetry,
  stale = false,
  className = '',
}: { message?: string; onRetry?: () => void | Promise<void>; stale?: boolean; className?: string }) => {
  const [retrying, setRetrying] = React.useState(false);
  const handle = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try { await onRetry(); } finally { setRetrying(false); }
  };
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 px-6 text-center ${className}`}>
      <div className="w-14 h-14 rounded-3xl bg-amber-500/10 flex items-center justify-center">
        <WifiOff className="w-6 h-6 text-amber-500 stroke-[1.75]" />
      </div>
      <p className="text-foreground/70 text-sm font-medium max-w-xs leading-relaxed">
        {message || "We couldn't reach the store right now. Check your connection and try again."}
        {stale && <span className="block mt-1 text-[11px] text-foreground/40">Showing a saved copy — it may be out of date.</span>}
      </p>
      {onRetry && (
        <button
          onClick={handle}
          disabled={retrying}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-bold uppercase tracking-widest hover:opacity-80 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
};

// Nav/tab count badge. `urgent` = needs action (red); default = informational.
export const CountBadge = ({ count, urgent = false, className = '' }: { count: number, urgent?: boolean, className?: string }) => (
 count > 0 ? (
 <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black tabular-nums ${urgent ? 'bg-red-500 dark:bg-red-600 text-white ring-1 ring-background/40' : 'bg-foreground/10 text-foreground/70'} ${className}`}>
 {count > 99 ? '99+' : count}
 </span>
 ) : null
);

export const Switch = ({ checked, onCheckedChange, className = '' }: { checked?: boolean; onCheckedChange?: (checked: boolean) => void; className?: string }) => (
 <button
 type="button"
 role="switch"
 aria-checked={checked}
 onClick={() => onCheckedChange?.(!checked)}
 className={`peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-foreground/20'} ${className}`}
 >
 <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
 </button>
);

export const Skeleton = ({ className = '' }: { className?: string }) => (
 <div className={`relative overflow-hidden bg-foreground/[0.06] rounded-2xl ${className}`}>
 <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent" />
 </div>
);

// One canonical confirm dialog. `ConfirmModal` and `ConfirmDialog` below are
// thin adapters over this, so the two historical prop APIs both keep working
// against a single implementation, look, and a11y behaviour. Sits above Modal
// (z-300) so a confirm can be raised from inside an open modal.
const ConfirmBase = ({ isOpen, title, message, onConfirm, onCancel, danger = false, confirmText = "Confirm", cancelText = "Cancel", isLoading = false }: any) => {
 React.useEffect(() => {
   if (!isOpen) return;
   const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) onCancel?.(); };
   window.addEventListener('keydown', onEsc);
   return () => window.removeEventListener('keydown', onEsc);
 }, [isOpen, onCancel, isLoading]);
 if (!isOpen) return null;
 return (
 <div onClick={() => { if (!isLoading) onCancel?.(); }} className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
 <div role="dialog" aria-modal="true" aria-label={title} onClick={(e: any) => e.stopPropagation()} className="glass-surface w-full max-w-sm p-6 space-y-6 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
 <div className="text-center">
 <h3 className="text-2xl font-black tracking-tight mb-4 text-foreground">{title}</h3>
 <p className="text-sm font-medium text-foreground/55 leading-relaxed">{message}</p>
 </div>
 <div className="flex gap-3">
 <Button variant="secondary" onClick={onCancel} className="flex-1 rounded-xl font-bold" disabled={isLoading}>{cancelText}</Button>
 <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} className="flex-1 rounded-xl font-bold" isLoading={isLoading}>{confirmText}</Button>
 </div>
 </div>
 </div>
 );
};

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel", isDestructive = false }: any) => (
 <ConfirmBase
 isOpen={isOpen} title={title} message={message}
 confirmText={confirmText} cancelText={cancelText} danger={isDestructive}
 onCancel={onClose}
 onConfirm={() => { onConfirm?.(); onClose?.(); }}
 />
);

export const SpotlightCard = ({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
 <div className={`group relative overflow-hidden ${className}`} {...props}>
 {children}
 </div>
);

export const Reveal = ({ children, className = '', delay = 0 }: any) => (
 <div className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
 {children}
 </div>
);

export const Accordion = ({ title, children, defaultOpen = false }: { title: string, children?: React.ReactNode, defaultOpen?: boolean }) => {
 const [isOpen, setIsOpen] = useState(defaultOpen);
 return (
 <div className="border-b border-foreground/8 py-4">
 <button
 onClick={() => setIsOpen(!isOpen)}
 aria-expanded={isOpen}
 className="flex w-full items-center justify-between py-2 text-left hover:opacity-70 transition-opacity"
 >
 <span className="text-sm font-bold text-foreground">{title}</span>
 <ChevronDown className={`w-5 h-5 stroke-[2] text-foreground/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
 </button>
 <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
 <div className="text-sm font-medium leading-relaxed text-foreground/55">
 {children}
 </div>
 </div>
 </div>
 );
};

export const ThemeToggle = () => {
 const { isDark, toggleTheme } = useAppState();

 return (
 <button 
 onClick={toggleTheme}
 className="w-12 h-12 flex items-center justify-center bg-foreground/8 rounded-2xl hover:bg-foreground/12 transition-colors text-foreground"
 >
 {isDark ? <Sun className="w-5 h-5 stroke-[2]" /> : <Moon className="w-5 h-5 stroke-[2]" />}
 </button>
 );
};

export const ImageDropzone = ({ currentImage, onImageSelected }: any) => {
 const inputRef = React.useRef<HTMLInputElement>(null);
 const handleDrop = (e: React.DragEvent) => {
   e.preventDefault();
   const file = e.dataTransfer.files?.[0];
   if (file && file.type.startsWith('image/')) onImageSelected(file);
 };
 return (
 <div
   className="relative w-full h-full border-2 border-dashed border-foreground/15 flex flex-col items-center justify-center bg-foreground/[0.02] hover:bg-foreground/[0.05] transition-all cursor-pointer overflow-hidden group"
   onClick={() => inputRef.current?.click()}
   onDragOver={(e) => e.preventDefault()}
   onDrop={handleDrop}
 >
 {currentImage ? (
 <img src={currentImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Upload" loading="lazy" decoding="async" />
 ) : (
 <div className="text-center p-6 pointer-events-none">
 <div className="w-12 h-12 bg-foreground/[0.06] flex items-center justify-center mx-auto mb-4">
   <X className="w-5 h-5 text-foreground/60 rotate-45 stroke-[2]" />
 </div>
 <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/50">Upload</p>
 <p className="text-[9px] text-foreground/30 mt-1">or drag & drop</p>
 </div>
 )}
 <input
   ref={inputRef}
   type="file"
   className="hidden"
   accept="image/*"
   onChange={(e) => {
     if (e.target.files?.[0]) {
       onImageSelected(e.target.files[0]);
       e.target.value = '';
     }
   }}
 />
 </div>
 );
};

export const Modal = ({ isOpen, title, onClose, children, size = 'md' }: any) => {
 const panelRef = React.useRef<HTMLDivElement>(null);
 useFocusTrap(panelRef, !!isOpen); // shared trap/restore — one pattern app-wide
 // Body scroll lock + ESC to close.
 React.useEffect(() => {
   if (!isOpen) return;
   const prev = document.body.style.overflow;
   document.body.style.overflow = 'hidden';
   const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
   window.addEventListener('keydown', onEsc);
   return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onEsc); };
 }, [isOpen, onClose]);

 const maxW = size === 'lg' ? 'max-w-4xl' : size === 'sm' ? 'max-w-md' : 'max-w-2xl';
 return (
 <AnimatePresence>
 {isOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={onClose}
 className="fixed inset-0 z-[300] flex items-end md:items-center justify-center md:p-4 bg-black/50 backdrop-blur-sm"
 >
 <motion.div
 initial={{ opacity: 0, y: 40, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: 40, scale: 0.98 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 onClick={(e: any) => e.stopPropagation()}
 className={`${maxW} w-full`}
 >
 <div ref={panelRef} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} className="modal-scroll glass-surface p-6 md:p-8 space-y-6 rounded-t-3xl md:rounded-3xl shadow-2xl max-h-[92dvh] md:max-h-[90dvh] overflow-y-auto outline-none" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
 {/* Mobile drag-handle affordance */}
 <div className="md:hidden w-10 h-1 rounded-full bg-foreground/15 mx-auto -mt-2" />
 <div className="flex justify-between items-center border-b border-foreground/8 pb-6">
 <h3 className="text-2xl font-black tracking-tight text-foreground">{title}</h3>
 <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-foreground/[0.05] dark:hover:bg-foreground/[0.05] rounded-full transition-colors"><X className="w-6 h-6 stroke-[2] text-foreground/60" /></button>
 </div>
 <div className="text-foreground/60 ">
 {children}
 </div>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 );
};

export const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, isDangerous, confirmText = "Confirm", isLoading }: any) => (
 <ConfirmBase
 isOpen={isOpen} title={title} message={message}
 confirmText={confirmText} danger={isDangerous} isLoading={isLoading}
 onCancel={onCancel} onConfirm={onConfirm}
 />
);


export const PremiumStatCard = ({ title, value, icon: Icon, color = "text-foreground", loading, trend }: { title: string, value: string | number, icon: any, color?: string, loading?: boolean, trend?: string | { value: string, positive?: boolean, isPositive?: boolean } }) => {
 const trendValue = typeof trend === 'string' ? trend : trend?.value;
 const isPositive = typeof trend === 'object' ? (trend.positive ?? trend.isPositive ?? true) : true;

 return (
 <Card className="p-5 md:p-6 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition-all overflow-hidden relative group">
 <div className="relative z-10 min-w-0 flex-1">
 <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2 flex-wrap">
 {title}
 {trendValue && (
 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isPositive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
 {trendValue}
 </span>
 )}
 </p>
 {loading ? (
 <Skeleton className="h-8 w-28 rounded-xl" />
 ) : (
 <p className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-none truncate">{value}</p>
 )}
 </div>
 <div className={`relative z-10 w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-2xl bg-foreground/[0.06] ${color} transition-transform group-hover:scale-110 shrink-0 ml-3`}>
 <Icon className="w-5 h-5 md:w-6 md:h-6 stroke-[2]" />
 </div>
 </Card>
 );
};

// --- GraphicalTag ---
export const GraphicalTag = ({ type, label, id, onClick }: { type: 'order' | 'return' | 'offer' | 'support' | 'system' | 'shipment' | 'security' | 'wallet' | 'promotion' | 'product', label: string, id?: string, onClick?: () => void }) => {
 const configs = {
 order: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
 return: { icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
 offer: { icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
 support: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 system: { icon: ShieldCheck, color: 'text-foreground/60', bg: 'bg-foreground/[0.05]', border: 'border-foreground/8' },
 shipment: { icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
 security: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
 wallet: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 promotion: { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
 product: { icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' }
 };

 const config = configs[type];
 const Icon = config.icon;

 return (
 <div 
 className={`inline-flex items-center gap-3 px-4 py-2 border ${config.border} ${config.bg} rounded-2xl relative overflow-hidden group transition-all hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''}`}
 onClick={onClick}
 >
 <div className={`w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm ${config.color}`}>
 <Icon className="w-4 h-4 stroke-[2]" />
 </div>
 
 <div className="flex flex-col">
 <span className={`text-[10px] font-extrabold uppercase tracking-wider ${config.color}`}>{type}</span>
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-foreground">{label}</span>
 {id && <span className="text-[10px] font-medium opacity-50">#{id.slice(0, 6)}</span>}
 </div>
 </div>
 </div>
 );
};

// --- GraphicalIcon ---
export const GraphicalIcon = ({ type, className = "" }: { type: string, className?: string }) => {
 const configs = {
 order: { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
 shipment: { icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
 message: { icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 offer: { icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
 security: { icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
 wallet: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
 promotion: { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
 return: { icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' }
 };
 const config = configs[type as keyof typeof configs] || { icon: Sparkles, color: 'text-foreground/60', bg: 'bg-foreground/[0.05]', border: 'border-foreground/8' };
 const Icon = config.icon;
 return (
 <div className={`w-12 h-12 flex items-center justify-center rounded-2xl border ${config.border} ${config.bg} ${config.color} relative group overflow-hidden ${className}`}>
 <Icon className="w-6 h-6 stroke-[2] relative z-10 group-hover:scale-110 transition-transform duration-500" />
 </div>
 );
};

// --- UserProfileModal ---
export const UserProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: any }) => {
 React.useEffect(() => {
   if (!isOpen) return;
   const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
   window.addEventListener('keydown', onEsc);
   return () => window.removeEventListener('keydown', onEsc);
 }, [isOpen, onClose]);
 if (!isOpen || !user) return null;

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
 <div role="dialog" aria-modal="true" className="glass-surface w-full max-w-md p-8 rounded-[2rem] relative shadow-2xl">
 <button onClick={onClose} aria-label="Close" className="absolute top-6 right-6 p-2 hover:bg-foreground/[0.05] dark:hover:bg-foreground/[0.05] rounded-full transition-colors">
 <X className="w-6 h-6 stroke-[2] text-foreground/60" />
 </button>

 <div className="flex flex-col items-center text-center space-y-6">
 <div className="w-24 h-24 bg-foreground/[0.05] dark:bg-foreground/[0.05] rounded-full flex items-center justify-center font-black text-3xl overflow-hidden shadow-sm">
 {user.avatar ? <img src={user.avatar} alt={`${user.name || "User"} avatar`} className="w-full h-full object-cover" loading="lazy" decoding="async" /> : user.name?.slice(0, 1).toUpperCase()}
 </div>

 <div className="space-y-2">
 <h3 className="text-2xl font-black tracking-tight text-foreground/60 ">{user.name}</h3>
 <div className="flex items-center justify-center gap-2">
 <Badge variant="secondary" className="text-xs font-bold py-1 px-3 border-none bg-foreground/[0.05] dark:bg-foreground/[0.05]">{user.role}</Badge>
 {user.is_verified && <Badge variant="success" className="text-xs font-bold py-1 px-3 border-none">Verified</Badge>}
 </div>
 </div>

 
        {user.role === 'seller' && (
          <Link
            to={`/store/${user.id}`}
            onClick={onClose}
            className="w-full flex items-center gap-3 p-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.1] transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </span>
            <span className="text-left flex-1 min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600/80 dark:text-emerald-400/80">Storefront</span>
              <span className="block text-sm font-black text-foreground truncate">Visit their shop</span>
            </span>
          </Link>
        )}

        <div className="w-full pt-6 border-t border-foreground/8 dark:border-foreground/8 space-y-4">
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Member Since</span>
 <span className="text-foreground/60 ">{new Date(user.created_at).toLocaleDateString()}</span>
 </div>
 {user.region && (
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Region</span>
 <span className="text-foreground/60 ">{user.region}</span>
 </div>
 )}
 {/* Only real, stored metrics — never fabricated defaults. New accounts
     honestly show "No data yet" instead of a fake 95% trust score. */}
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Trust Score</span>
 {user.trust_score != null
   ? <span className="text-emerald-600">{user.trust_score}%</span>
   : <span className="text-foreground/35 font-medium">No data yet</span>}
 </div>
 <div className="flex justify-between text-sm font-bold text-foreground/55">
 <span>Total Orders</span>
 {user.total_orders != null
   ? <span>{user.total_orders}</span>
   : <span className="text-foreground/35 font-medium">No data yet</span>}
 </div>
 {user.response_rate != null && (
 <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] opacity-60">
 <span>Response Rate</span>
 <span>{user.response_rate}</span>
 </div>
 )}
 </div>

 <Button variant="primary" className="w-full h-12 rounded-xl text-[10px] uppercase tracking-[0.15em]" onClick={onClose}>Close Profile</Button>
 </div>
 </div>
 </div>
 );
};

// --- Progress ---
export const Progress = ({ value = 0, className = '' }: { value: number, className?: string }) => (
 <div className={`relative h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.05] dark:bg-foreground/[0.05] ${className}`}>
 <motion.div 
 initial={{ width: 0 }}
 animate={{ width: `${value}%` }}
 transition={{ duration: 0.8, ease: "easeOut" }}
 className="h-full w-full flex-1 bg-emerald-500 transition-all rounded-full" 
 />
 </div>
);

// --- SatisfyingOrderGraphic ---
export const SatisfyingOrderGraphic = ({ status }: { status: string }) => {
 const stages = [
 { id: 'pending', icon: Package, label: 'Order Placed', color: 'bg-amber-500' },
 { id: 'processing', icon: Loader2, label: 'Artisan Preparing', color: 'bg-blue-500' },
 { id: 'shipped', icon: Truck, label: 'On Its Way', color: 'bg-indigo-500' },
 { id: 'delivered', icon: CheckCircle2, label: 'Arrived Safely', color: 'bg-emerald-500' }
 ];

 const currentIndex = stages.findIndex(s => s.id === status);
 const activeStage = stages[currentIndex] || stages[0];

 return (
 <div className="relative py-12 px-8 bg-foreground/5 rounded-3xl overflow-hidden group">
 <div className="relative z-10 flex flex-col items-center text-center space-y-8">
 <div className="relative">
 <AnimatePresence mode="wait">
 <motion.div
 key={status}
 initial={{ scale: 0.8, opacity: 0, y: 20 }}
 animate={{ scale: 1, opacity: 1, y: 0 }}
 exit={{ scale: 1.2, opacity: 0, y: -20 }}
 transition={{ duration: 0.4, ease: "easeOut" }}
 className={`w-32 h-32 bg-white rounded-full shadow-sm flex items-center justify-center relative group-hover:scale-105 transition-transform duration-500`}
 >
 <activeStage.icon className={`w-12 h-12 text-foreground ${status === 'processing' ? 'animate-spin' : ''} stroke-[2]`} />
 </motion.div>
 </AnimatePresence>
 </div>

 <div className="space-y-4">
 <motion.h4 
 key={activeStage.label}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="text-2xl font-extrabold tracking-tight text-foreground"
 >
 {activeStage.label}
 </motion.h4>
 <div className="flex gap-2 justify-center">
 {stages.map((s, i) => (
 <div 
 key={s.id}
 className={`h-2 rounded-full transition-all duration-500 ${i <= currentIndex ? 'w-8 bg-primary' : 'w-2 bg-foreground/10'}`}
 />
 ))}
 </div>
 </div>

 <p className="text-sm font-medium opacity-60 max-w-[250px] leading-relaxed">
 {status === 'pending' && "Your request has been received by the artisan."}
 {status === 'processing' && "The artisan is carefully crafting your artifact."}
 {status === 'shipped' && "Your artifact is traveling to its new home."}
 {status === 'delivered' && "Heritage successfully delivered to your doorstep."}
 </p>
 </div>
 </div>
 );
};

// --- ModernFollowCard ---
export const ModernFollowCard = ({ vendor, onUnfollow, onViewStore }: { vendor: VendorProfile, onUnfollow: () => void, onViewStore: () => void }) => (
 <div className="group relative bg-white dark:bg-foreground/[0.05] rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-foreground/8 dark:border-white/5 flex flex-col h-full">
 <div className="h-32 bg-foreground/[0.05] dark:bg-foreground/[0.05] relative overflow-hidden">
 {vendor.banner_url ? (
 <img src={vendor.banner_url} alt={vendor.store_name} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" loading="lazy" decoding="async" />
 ) : (
 <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-indigo-500/20" />
 )}
 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
 <div className="absolute bottom-4 left-6 flex items-center gap-4">
 <div className="w-16 h-16 rounded-2xl bg-white p-1 shadow-lg overflow-hidden border-2 border-white">
 <img src={vendor.logo_url || `https://ui-avatars.com/api/?name=${vendor.store_name}`} alt={`${vendor.store_name} logo`} className="w-full h-full object-cover rounded-xl" loading="lazy" decoding="async" />
 </div>
 <div className="text-white">
 <h3 className="font-black text-lg leading-tight flex items-center gap-2">
 {vendor.store_name}
 {vendor.is_verified && <VerifiedBadge iconOnly />}
 </h3>
 <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Store</p>
 </div>
 </div>
 </div>
 <div className="p-6 flex-1 flex flex-col">
 <p className="text-sm font-medium text-foreground/60 dark:text-foreground/60 line-clamp-2 mb-6 flex-1">
 {vendor.description || "No description provided."}
 </p>
 <div className="flex gap-3 mt-auto">
 <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={onUnfollow}>Unfollow</Button>
 <Button className="flex-1 rounded-xl font-bold" onClick={onViewStore}>Visit Store</Button>
 </div>
 </div>
 </div>
);
