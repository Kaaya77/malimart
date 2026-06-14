import React from 'react';

// Responsive chat layout containers.
// Height adapts to viewport rather than being fixed.
export const MessageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-[calc(100vh-7rem)] min-h-[520px] max-h-[900px] animate-in fade-in duration-300 overflow-hidden bg-background border border-foreground/10 rounded-2xl shadow-sm">
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
