import React from 'react';

export const Card = ({ className = '', ...props }: any) => (
  <div
    className={`rounded-3xl border border-foreground/8 glass-surface text-foreground relative overflow-hidden shadow-sm ${className}`}
    {...props}
  >
    <div className="relative z-10">{props.children}</div>
  </div>
);

export const CardHeader = ({ className = '', ...props }: any) => (
  <div className={`p-6 border-b border-foreground/8 ${className}`} {...props} />
);

export const CardContent = ({ className = '', ...props }: any) => (
  <div className={`p-6 ${className}`} {...props} />
);

export const CardTitle = ({ className = '', ...props }: any) => (
  <h3 className={`text-xl font-black tracking-tight text-foreground/60 ${className}`} {...props} />
);

export const CardDescription = ({ className = '', ...props }: any) => (
  <p className={`text-sm font-medium text-foreground/55 mt-1 ${className}`} {...props} />
);
