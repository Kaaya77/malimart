import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Badge = ({ variant = 'default', className = '', ...props }: any) => {
  const variants: any = {
    default:   'bg-foreground/[0.08] text-foreground',
    secondary: 'bg-foreground/[0.04] text-foreground/65 border border-foreground/10',
    outline:   'border-2 border-foreground/20 text-foreground/70',
    success:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10',
    danger:    'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  };
  return <div className={`inline-flex items-center rounded-xl px-3 py-1 text-xs font-bold transition-all ${variants[variant]} ${className}`} {...props} />;
};

export const VerifiedBadge = ({ className = '' }: { className?: string }) => (
  <div className={`inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest ${className}`}>
    <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
    Verified
  </div>
);
