import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';

export const Button = ({ variant = 'primary', size = 'default', className = '', asChild = false, isLoading, children, ...props }: any) => {
  const base = 'relative inline-flex items-center justify-center transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none overflow-hidden group whitespace-nowrap font-bold';

  const variants: any = {
    primary:   'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    secondary: 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]',
    brand:     'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    danger:    'bg-red-500 text-white hover:bg-red-600 shadow-sm',
    outline:   'border-2 border-foreground/20 text-foreground hover:border-foreground/40',
    ghost:     'hover:bg-foreground/[0.06] text-foreground',
    link:      'text-emerald-600 hover:underline p-0 h-auto',
  };

  const sizes: any = {
    default: 'h-12 px-6 rounded-2xl text-sm',
    sm:      'h-10 px-4 rounded-xl text-xs',
    lg:      'h-14 px-8 rounded-2xl text-base',
    xl:      'h-16 px-10 rounded-3xl text-lg',
    icon:    'h-12 w-12 rounded-2xl',
  };

  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if (asChild) return <Slot className={classes} {...props}>{children}</Slot>;

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={classes}
      disabled={isLoading || props.disabled}
      {...props}
    >
      <span className="relative flex items-center justify-center">
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </span>
    </motion.button>
  );
};
