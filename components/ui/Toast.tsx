import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const TOAST_DURATION = 4000;
export type ToastAction = { label: string; fn: () => void };
export type Toast = { id: string; msg: string; type: 'success' | 'error' | 'info'; action?: ToastAction };

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
      <div className="fixed bottom-6 right-4 z-[250] flex flex-col-reverse gap-2 items-end pointer-events-none w-full max-w-xs sm:max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => <ToastItem key={t.id} t={t} onDismiss={dismiss} />)}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => React.useContext(ToastContext);
