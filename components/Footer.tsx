import React from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Shield, Truck, RotateCcw, Heart, Instagram, Twitter, Facebook } from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    Shop: [
      { label: 'All Products', to: '/shop' },
      { label: 'Categories', to: '/categories' },
      { label: 'Featured Sellers', to: '/shop' },
      { label: 'New Arrivals', to: '/shop?sort=newest' },
    ],
    Sell: [
      { label: 'Become a Seller', to: '/login?mode=signup&role=seller' },
      { label: 'Seller Dashboard', to: '/seller' },
      { label: 'Seller Guidelines', to: '/terms' },
    ],
    Support: [
      { label: 'Help Center', to: '/contact' },
      { label: 'Contact Us', to: '/contact' },
      { label: 'Returns', to: '/terms' },
      { label: 'Track Order', to: '/buyer?tab=orders' },
    ],
    Legal: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
    ],
  };

  const trustItems = [
    { icon: Truck, text: 'Nationwide delivery' },
    { icon: Shield, text: 'Buyer protection' },
    { icon: RotateCcw, text: '7-day returns' },
    { icon: Smartphone, text: 'Mobile money' },
  ];

  return (
    <footer className="bg-foreground text-background font-sans mt-16">
      {/* Trust bar */}
      <div className="border-b border-background/10">
        <div className="container mx-auto px-5 md:px-8 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {trustItems.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-background/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 stroke-[1.8]" />
                </div>
                <span className="text-[11px] font-semibold text-background/80 uppercase tracking-widest">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="container mx-auto px-5 md:px-8 py-10 md:py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-block mb-5">
              <span className="font-sans text-2xl font-bold tracking-tight text-background">
                MaliMart
              </span>
            </Link>
            <p className="text-[12px] text-background/55 leading-relaxed mb-5 max-w-[200px]">
              Tanzania's premier marketplace connecting buyers and sellers nationwide.
            </p>
            {/* Social */}
            <div className="flex gap-3">
              {[
                { icon: Instagram, label: 'Instagram' },
                { icon: Twitter, label: 'Twitter' },
                { icon: Facebook, label: 'Facebook' },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  aria-label={label}
                  className="w-8 h-8 rounded-full bg-background/10 hover:bg-background/20 flex items-center justify-center transition-colors active:scale-90"
                >
                  <Icon className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([section, items]) => (
            <div key={section}>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-background/40 mb-4">{section}</h4>
              <ul className="space-y-3">
                {items.map(({ label, to }) => (
                  <li key={label}>
                    <Link
                      to={to}
                      className="text-[12px] font-medium text-background/65 hover:text-background transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-background/10">
        <div className="container mx-auto px-5 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[10px] font-semibold text-background/35 uppercase tracking-widest">
            © {currentYear} MaliMart — All rights reserved
          </p>
          <p className="text-[10px] text-background/30 flex items-center gap-1">
            Made with <Heart className="w-3 h-3 fill-rose-400 text-rose-400" /> in Tanzania
          </p>
        </div>
      </div>
    </footer>
  );
};
