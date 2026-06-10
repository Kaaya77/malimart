import { supabase } from '../services/supabaseClient';
import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="bg-transparent py-12 font-sans border-t border-foreground/5 dark:border-background/5">
      <div className="container mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-8">
          <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-foreground dark:text-background">
            Mali<span className="opacity-40">Mart</span>
          </span>
          <div className="h-4 w-px bg-primary/10 dark:bg-background/10 hidden md:block" />
          <p className="text-foreground/40 dark:text-background/40 text-[9px] uppercase tracking-[0.2em]">
            © {new Date().getFullYear()} — All Rights Reserved
          </p>
        </div>
        
        <div className="flex gap-8">
          {['Privacy', 'Terms', 'Returns', 'Contact'].map((item) => (
            <Link 
              key={item} 
              to={`/${item.toLowerCase()}`} 
              className="text-[9px] uppercase tracking-[0.2em] text-foreground/40 dark:text-background/40 hover:text-foreground dark:hover:text-background transition-colors duration-500"
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
};
