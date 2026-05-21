import React from 'react';

export const MessageContainer = ({ children }: { children: React.ReactNode }) => (
 <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-[650px] animate-in fade-in duration-500 overflow-hidden bg-background border border-foreground/10 rounded-3xl shadow-sm">
 {children}
 </div>
);

export const SidebarContainer = ({ children, isVisible }: { children: React.ReactNode, isVisible: boolean }) => (
 <div className={`md:col-span-4 lg:col-span-3 border-r border-foreground/10 flex flex-col ${isVisible ? 'hidden md:flex' : 'flex'}`}>
 {children}
 </div>
);

export const ChatAreaContainer = ({ children, isVisible }: { children: React.ReactNode, isVisible: boolean }) => (
 <div className={`md:col-span-8 lg:col-span-6 flex flex-col ${isVisible ? 'hidden md:flex' : 'flex'}`}>
 {children}
 </div>
);

export const DetailsAreaContainer = ({ children, isVisible }: { children: React.ReactNode, isVisible: boolean }) => (
 <div className={`md:col-span-3 bg-foreground/5 flex flex-col border-l border-foreground/10 ${isVisible ? 'flex' : 'hidden'}`}>
 {children}
 </div>
);
