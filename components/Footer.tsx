import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Shield, Truck, RotateCcw, Heart, Instagram, Twitter, Facebook, Youtube, ArrowRight, Zap, MapPin, Mail, Phone as PhoneIcon } from 'lucide-react';

const LINKS = {
 Shop: [
 {l:'All Products',t:'/shop'},
 {l:'New Arrivals',t:'/shop?sort=newest'},
 {l:'Featured Stores',t:'/shop'},
 {l:'Flash Deals',t:'/shop'},
 {l:'Categories',t:'/categories'},
 ],
 Sell: [
 {l:'Become a Seller',t:'/login?mode=signup&role=seller'},
 {l:'Seller Dashboard',t:'/seller'},
 {l:'Pricing & Fees',t:'/terms'},
 {l:'Seller Guidelines',t:'/terms'},
 ],
 Support: [
 {l:'Help Center',t:'/contact'},
 {l:'Contact Us',t:'/contact'},
 {l:'Returns & Refunds',t:'/terms'},
 {l:'Track Your Order',t:'/buyer?tab=orders'},
 {l:'Report an Issue',t:'/contact'},
 ],
 Legal: [
 {l:'Privacy Policy',t:'/privacy'},
 {l:'Terms of Service',t:'/terms'},
 {l:'Cookie Policy',t:'/privacy'},
 ],
};

const TRUST = [
 {icon:Truck, title:'Nationwide Delivery', desc:'All regions of Tanzania'},
 {icon:Shield, title:'Buyer Protection', desc:'Secure every transaction'},
 {icon:RotateCcw, title:'7-Day Returns', desc:'Hassle-free policy'},
 {icon:Smartphone, title:'Mobile Money', desc:'M-Pesa, Tigo, Airtel'},
];

export const Footer = () => {
 const year = new Date().getFullYear();
 const [email, setEmail] = useState('');
 const [subscribed, setSubscribed] = useState(false);

 const handleSubscribe = (e: React.FormEvent) => {
 e.preventDefault();
 if (email.trim()) { setSubscribed(true); setEmail(''); }
 };

 return (
 <footer className="bg-foreground text-background font-sans mt-20">

 {/* Trust bar */}
 <div className="border-b border-background/10">
 <div className="container mx-auto px-5 md:px-8 py-6">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
 {TRUST.map(({icon:Icon,title,desc})=>(
 <div key={title} className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl bg-background/10 flex items-center justify-center shrink-0">
 <Icon className="w-4.5 h-4.5 stroke-[1.8]"/>
 </div>
 <div>
 <p className="text-[11px] font-bold text-background/90">{title}</p>
 <p className="text-[10px] text-background/45 mt-0.5">{desc}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Main footer body */}
 <div className="container mx-auto px-5 md:px-8 py-12 md:py-16">
 <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-10">

 {/* Brand column */}
 <div className="col-span-2 md:col-span-2 space-y-5">
 <div>
 <Link to="/" className="inline-block">
 <span className="font-sans text-2xl font-bold tracking-tight text-background">MaliMart</span>
 </Link>
 <p className="text-[12px] text-background/50 leading-relaxed mt-3 max-w-[220px]">
 Tanzania's premier marketplace. Connecting local sellers with buyers across the nation.
 </p>
 </div>

 {/* Contact info */}
 <div className="space-y-2">
 {[
 {icon:MapPin, text:'Dar es Salaam, Tanzania'},
 {icon:Mail, text:'support@malimart.tz'},
 {icon:PhoneIcon,text:'+255 XXX XXX XXX'},
 ].map(({icon:Icon,text})=>(
 <div key={text} className="flex items-center gap-2 text-[11px] text-background/45">
 <Icon className="w-3.5 h-3.5 shrink-0 stroke-[2]"/>
 {text}
 </div>
 ))}
 </div>

 {/* Social */}
 <div className="flex gap-2">
 {[
 {icon:Instagram, label:'Instagram'},
 {icon:Twitter, label:'Twitter/X'},
 {icon:Facebook, label:'Facebook'},
 {icon:Youtube, label:'YouTube'},
 ].map(({icon:Icon,label})=>(
 <button key={label} aria-label={label}
 className="w-9 h-9 rounded-xl bg-background/10 hover:bg-background/20 flex items-center justify-center transition-colors active:scale-90">
 <Icon className="w-3.5 h-3.5 stroke-[2]"/>
 </button>
 ))}
 </div>
 </div>

 {/* Link columns */}
 {Object.entries(LINKS).map(([section,items])=>(
 <div key={section}>
 <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-background/35 mb-4">{section}</h4>
 <ul className="space-y-2.5">
 {items.map(({l,t})=>(
 <li key={l}>
 <Link to={t} className="text-[12px] text-background/55 hover:text-background transition-colors">{l}</Link>
 </li>
 ))}
 </ul>
 </div>
 ))}
 </div>

 {/* Newsletter */}
 <div className="mt-12 pt-10 border-t border-background/10">
 <div className="flex flex-col md:flex-row items-center justify-between gap-6">
 <div className="text-center md:text-left">
 <h3 className="font-bold text-lg text-background mb-1">Stay in the loop</h3>
 <p className="text-sm text-background/50">Get exclusive deals and product drops in your inbox.</p>
 </div>
 {subscribed ? (
 <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
 <Zap className="w-4 h-4"/> You're subscribed!
 </div>
 ) : (
 <form onSubmit={handleSubscribe} className="flex gap-2 w-full md:w-auto">
 <input
 type="email" value={email} onChange={e=>setEmail(e.target.value)}
 placeholder="your@email.com" required
 className="flex-1 md:w-60 h-11 px-4 rounded-xl bg-background/10 border border-background/15 text-background placeholder:text-background/35 text-sm focus:outline-none focus:border-background/40 transition-colors"
 />
 <button type="submit"
 className="h-11 px-5 rounded-xl bg-background text-foreground text-sm font-bold hover:bg-background/90 transition-colors flex items-center gap-1.5 shrink-0">
 Subscribe <ArrowRight className="w-3.5 h-3.5"/>
 </button>
 </form>
 )}
 </div>
 </div>
 </div>

 {/* Bottom bar */}
 <div className="border-t border-background/10">
 <div className="container mx-auto px-5 md:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
 <p className="text-[10px] text-background/30 font-semibold uppercase tracking-widest">
 © {year} MaliMart Ltd · All rights reserved
 </p>
 <p className="text-[10px] text-background/25 flex items-center gap-1">
 Made with <Heart className="w-3 h-3 fill-rose-400 text-rose-400"/> in Tanzania
 </p>
 </div>
 </div>
 </footer>
 );
};
