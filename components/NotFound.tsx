
import React from 'react';
import { Home, Search, MoveLeft, MapPinOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './UI';

export const NotFound = () => {
 const navigate = useNavigate();

 return (
 <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
 <div className="text-center max-w-md w-full animate-in fade-in zoom-in duration-500">
 
 {/* Visual Icon */}
 <div className="relative w-32 h-32 mx-auto mb-8">
 <div className="absolute inset-0 bg-brand-500/20 rounded-full blur-3xl animate-pulse"></div>
 <div className="relative glass-surface rounded-[2.5rem] w-full h-full flex items-center justify-center border-2 border-dashed border-foreground/15 shadow-xl">
 <MapPinOff className="w-12 h-12 text-foreground/40" />
 </div>
 <div className="absolute -bottom-2 -right-2 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">404 ERROR</div>
 </div>

 {/* Text Content */}
 <h1 className="text-4xl font-black font-display text-foreground mb-2 tracking-tight uppercase">
 Umepotea kidogo!
 </h1>
 <p className="text-foreground/60 text-base font-bold mb-1">You've wandered off the map.</p>
 <p className="text-foreground/40 text-sm font-medium leading-relaxed mb-8">
 This page moved, sold out, or maybe never existed. Even the best guides lose the trail sometimes — pole sana.
 </p>
 <div className="kitenge-strip w-28 mx-auto mb-10" aria-hidden="true" />

 {/* Actions */}
 <div className="space-y-3">
 <Button 
 variant="brand" 
 onClick={() => navigate('/')} 
 className="w-full h-14 rounded-2xl shadow-xl shadow-brand-500/20 text-xs font-black uppercase tracking-widest group"
 >
 <Home className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform" /> Return Home
 </Button>
 
 <div className="grid grid-cols-2 gap-3">
 <Button 
 variant="outline" 
 onClick={() => navigate(-1)} 
 className="h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest"
 >
 <MoveLeft className="w-3.5 h-3.5 mr-2" /> Go Back
 </Button>
 <Button 
 variant="outline" 
 onClick={() => navigate('/shop')} 
 className="h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest"
 >
 <Search className="w-3.5 h-3.5 mr-2" /> Market
 </Button>
 </div>
 </div>

 {/* Footer decoration */}
 <div className="mt-12 flex justify-center gap-2 opacity-30">
 <div className="w-1 h-1 bg-foreground/40 rounded-full"></div>
 <div className="w-1 h-1 bg-foreground/40 rounded-full"></div>
 <div className="w-1 h-1 bg-foreground/40 rounded-full"></div>
 </div>
 </div>
 </div>
 );
};
