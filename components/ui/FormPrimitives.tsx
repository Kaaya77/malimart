import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const Input = ({ className = '', ...props }: any) => (
  <div className="relative group w-full">
    <input
      className={`flex h-14 w-full rounded-2xl border-2 border-foreground/15 bg-foreground/[0.04] px-4 text-sm font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-foreground/30 focus:bg-background transition-all ${className}`}
      {...props}
    />
  </div>
);

export const Textarea = ({ className = '', ...props }: any) => (
  <textarea
    className={`flex min-h-[120px] w-full rounded-2xl border-2 border-foreground/15 bg-foreground/[0.04] px-4 py-4 text-sm font-medium text-foreground placeholder:text-foreground/35 focus:outline-none focus:border-foreground/30 focus:bg-background transition-all resize-none ${className}`}
    {...props}
  />
);

export const Label = ({ className = '', ...props }: any) => (
  <label className={`text-xs font-bold text-foreground/70 mb-2 block ${className}`} {...props} />
);

export const Switch = ({ checked, onCheckedChange, className = '' }: any) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={`peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-foreground/20'} ${className}`}
  >
    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

export const Skeleton = ({ className = '' }: any) => (
  <div className={`relative overflow-hidden bg-foreground/[0.06] rounded-2xl ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent" />
  </div>
);

export const Progress = ({ value = 0, className = '' }: { value: number; className?: string }) => {
  return (
    <div className={`relative h-2.5 w-full overflow-hidden rounded-full bg-foreground/[0.05] ${className}`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full w-full flex-1 bg-emerald-500 transition-all rounded-full"
      />
    </div>
  );
};

export const Accordion = ({ title, children, defaultOpen = false }: { title: string; children?: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  return (
    <div className="border-b border-foreground/8 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-left hover:opacity-70 transition-opacity"
      >
        <span className="text-sm font-bold text-foreground">{title}</span>
        <ChevronDown className={`w-5 h-5 stroke-[2] text-foreground/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
        <div className="text-sm font-medium leading-relaxed text-foreground/55">{children}</div>
      </div>
    </div>
  );
};
