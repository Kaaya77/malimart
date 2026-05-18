
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Heart, Package, Trash2, X, User, MapPin, LogOut, MessageSquare, Plus, Loader2, ArrowRight, ShieldCheck, Tag as TagIcon, Sparkles, Minus, TrendingUp, ShoppingBag, Truck, CheckCircle2, Info } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { Button, Card, Badge, useToast, Input, Label, SpotlightCard } from '../components/UI';
import { CheckoutModal, OrderTracking } from '../components/CheckoutComponents';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { CURRENCY } from '../constants';
import { Product, Offer, Address } from '../types';
import { supabase } from '../services/supabaseClient';

export const WishlistPage = () => {
  const { wishlist } = useAppState();
  
  if (wishlist.length === 0) {
    return (
      <div className="container mx-auto px-6 py-20 text-center animate-in fade-in zoom-in-95 font-sans min-h-[80vh] flex flex-col items-center justify-center">
        <div className="w-48 h-48 bg-foreground/5 rounded-full flex items-center justify-center mb-8 relative group">
            <Heart className="w-16 h-16 text-foreground/20 group-hover:text-primary transition-colors duration-500" />
            <div className="absolute top-8 right-10 w-4 h-4 bg-foreground/10 rounded-full animate-bounce"></div>
        </div>
        <h2 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6 tracking-tight">Wishlist Empty</h2>
        <p className="text-foreground/60 mb-12 max-w-md mx-auto font-medium text-base leading-relaxed">Save your favorite items to track their availability and price drops.</p>
        <Link to="/shop"><Button size="lg" className="px-12 h-14 rounded-full font-extrabold text-base hover:scale-105 transition-transform">Start Exploring</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-12 font-sans pt-28 md:pt-36 pb-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6 border-b border-foreground/10 pb-8">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <Heart className="w-6 h-6 text-primary fill-current" />
                    <span className="text-sm font-bold text-primary">Your Collection</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">Saved Items</h1>
            </div>
            <div className="flex items-center gap-2 bg-foreground/5 px-4 py-2 rounded-full">
                <span className="text-sm font-extrabold text-foreground">{wishlist.length}</span>
                <span className="text-sm font-bold text-foreground/60">Products</span>
            </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {wishlist.map(p => (
                <ProductCard key={p.id} product={p} />
            ))}
        </div>
    </div>
  );
};
